import 'server-only'

import { loadQueriesInBatches } from '@/lib/supabase/bounded-query-loader'
import type { PayrollSourceProvider } from '@liquid-hr/payroll-engine'
import { AuthorizationError } from '@/lib/auth/permissions'
import { createPayrollCalculationRepository, PayrollCalculationRepositoryError } from './calculation-repository'
import type { PayrollCalculationRepository } from './calculation-repository'
import { isPayrollLabEnabled } from './feature-flag'
import { createPayrun01Repository, type Payrun01Repository } from './payrun01-repository'
import {
  createLiquidHrPayrollSourceProvider,
  getPayrollSourceSnapshotCorrelationId,
  PayrollSourceProviderError,
} from './source/liquid-hr-source-provider'
import { requireComponentLibraryAccess } from './component-library-access'
import {
  isLocalPayrollAcceptanceRuntime,
  isLocalPayrollAcceptanceScope,
} from './local-payroll-acceptance-runtime'
import type { PayrollPeriodRow } from './database'
import type { PayrollScope } from './scope'
import {
  projectPayrollCycle,
  type PayrollCycleCurrentSource,
  type PayrollCycleProjection,
  type PayrollCycleWorkItem,
} from './payroll-cycle-model'
import { filterPayrollAcceptanceScenarioRuns } from './payroll-acceptance-scenario'

export type PayrollCyclePeriod = { readonly year: number; readonly month: number }

export type PayrollCycleEmployeeReference = {
  readonly employeeId: string
  readonly employmentId: string
}

export type PayrollCycleAccess = {
  readonly scope: PayrollScope
  readonly administration: { readonly id: string }
  readonly actorUserId: string
}

export type PayrollCycleServiceErrorCode =
  | 'PAYROLL_CYCLE_PERIOD_INVALID'
  | 'PAYROLL_CYCLE_CLOSED'
  | 'PAYROLL_CYCLE_REPOSITORY_UNAVAILABLE'
  | 'PAYROLL_CYCLE_NOT_FOUND'

export class PayrollCycleServiceError extends Error {
  constructor(readonly code: PayrollCycleServiceErrorCode) {
    super(code)
    this.name = 'PayrollCycleServiceError'
  }
}

export interface PayrollCycleServiceDependencies {
  readonly requireAccess: (write: boolean) => Promise<PayrollCycleAccess>
  readonly createCalculationRepository: () => PayrollCalculationRepository
  readonly createLifecycleRepository: () => Payrun01Repository
  readonly sourceProvider: PayrollSourceProvider
  readonly enabled: () => boolean
  readonly now?: () => Date
}

const defaultDependencies: PayrollCycleServiceDependencies = {
  requireAccess: async (write) => await requireComponentLibraryAccess(write),
  createCalculationRepository: createPayrollCalculationRepository,
  createLifecycleRepository: createPayrun01Repository,
  sourceProvider: createLiquidHrPayrollSourceProvider(),
  enabled: isPayrollLabEnabled,
}

function assertPeriod(period: PayrollCyclePeriod): void {
  if (!Number.isInteger(period.year) || period.year < 2000 || period.year > 2200
    || !Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new PayrollCycleServiceError('PAYROLL_CYCLE_PERIOD_INVALID')
  }
}

function periodStart(period: PayrollCyclePeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function periodEnd(period: PayrollCyclePeriod): string {
  return new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
}

function scopeColumns(scope: PayrollScope, payrollAdministrationId: string) {
  return {
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
  }
}

function requireEnabled(dependencies: PayrollCycleServiceDependencies): void {
  if (!dependencies.enabled()) throw new PayrollCycleServiceError('PAYROLL_CYCLE_REPOSITORY_UNAVAILABLE')
}

export function createPayrollCycleService(dependencies: PayrollCycleServiceDependencies = defaultDependencies) {
  async function getOrCreateCycle(
    repository: PayrollCalculationRepository,
    access: PayrollCycleAccess,
    period: PayrollCyclePeriod,
  ): Promise<PayrollPeriodRow> {
    const administrationId = access.administration.id
    const existing = await repository.getPayrollPeriod(access.scope, administrationId, period.year, period.month)
    if (existing) return existing

    try {
      return await repository.insertPayrollPeriod(access.scope, administrationId, {
        ...scopeColumns(access.scope, administrationId),
        period_year: period.year,
        period_month: period.month,
        starts_on: periodStart(period),
        ends_on: periodEnd(period),
        status: 'DRAFT',
        created_by_user_id: access.actorUserId,
        updated_by_user_id: access.actorUserId,
      })
    } catch (error) {
      if (!(error instanceof PayrollCalculationRepositoryError) || error.code !== 'PAYROLL_PERIOD_ALREADY_EXISTS') throw error
      const concurrentlyCreated = await repository.getPayrollPeriod(access.scope, administrationId, period.year, period.month)
      if (concurrentlyCreated) return concurrentlyCreated
      throw error
    }
  }

  async function openPayrollCycle(period: PayrollCyclePeriod): Promise<PayrollPeriodRow> {
    assertPeriod(period)
    requireEnabled(dependencies)
    const access = await dependencies.requireAccess(true)
    const repository = dependencies.createCalculationRepository()
    const cycle = await getOrCreateCycle(repository, access, period)
    if (cycle.status === 'CLOSED') throw new PayrollCycleServiceError('PAYROLL_CYCLE_CLOSED')
    if (cycle.status === 'OPEN') return cycle
    if (!repository.openPayrollPeriod) throw new PayrollCycleServiceError('PAYROLL_CYCLE_REPOSITORY_UNAVAILABLE')

    try {
      return await repository.openPayrollPeriod(
        access.scope,
        access.administration.id,
        cycle.id,
        access.actorUserId,
        (dependencies.now ?? (() => new Date()))().toISOString(),
      )
    } catch (error) {
      if (error instanceof PayrollCalculationRepositoryError && error.code === 'PAYROLL_PERIOD_NOT_OPENABLE') {
        throw new PayrollCycleServiceError('PAYROLL_CYCLE_CLOSED')
      }
      throw error
    }
  }

  async function getPayrollCycleWorklist(
    period: PayrollCyclePeriod,
    employeeReferences: readonly PayrollCycleEmployeeReference[] = [],
  ): Promise<PayrollCycleProjection | null> {
    assertPeriod(period)
    requireEnabled(dependencies)
    const access = await dependencies.requireAccess(false)
    const calculations = dependencies.createCalculationRepository()
    const cycle = await calculations.getPayrollPeriod(access.scope, access.administration.id, period.year, period.month)
    if (!cycle) return null

    const allRuns = await calculations.listPayrollRunSummaries(access.scope, access.administration.id, {
      runType: 'INDIVIDUAL_PAYROLL',
      period,
      limit: 200,
    })
    const lifecycleRepository = dependencies.createLifecycleRepository()
    const visibleRuns = await filterPayrollAcceptanceScenarioRuns(
      allRuns,
      async (inputSetId) => await lifecycleRepository.getGenericInputReference(access.scope, access.administration.id, inputSetId),
      async (inputSetIds) => await lifecycleRepository.listGenericInputReferences(access.scope, access.administration.id, inputSetIds),
    )
    const visibleRunIds = new Set(visibleRuns.map((summary) => summary.run.id))
    const scenarioRunIds = new Set(allRuns.flatMap((summary) => visibleRunIds.has(summary.run.id) ? [] : [summary.run.id]))
    const runs = visibleRuns.filter((summary) => summary.payrollPeriod.id === cycle.id)
    const currentSourcesByEmployment = employeeReferences.length === 0
      ? undefined
      : Object.fromEntries(await loadQueriesInBatches(employeeReferences.map((reference) => async () => {
        try {
          const snapshot = await dependencies.sourceProvider.getPayrollSourceSnapshot({
            ...access.scope,
            employeeId: reference.employeeId,
            employmentId: reference.employmentId,
            payrollPeriod: period,
          })
          return [reference.employmentId, {
            employeeId: snapshot.sourceEmployeeId,
            sourceHash: snapshot.sourceHash,
            sourceVersionVector: snapshot.sourceVersionVector,
            gaps: snapshot.sourceGaps,
            diagnostics: snapshot.sourceGaps.map((gap) => ({
              sourceCategory: gap.field,
              errorCode: gap.reasonCode,
              correlationId: getPayrollSourceSnapshotCorrelationId(snapshot),
            })),
          } satisfies PayrollCycleCurrentSource] as const
        } catch (error) {
          const status = typeof error === 'object' && error !== null && 'status' in error
            && typeof error.status === 'number' ? error.status : null
          if (status === 403 || (error instanceof Error && error.name === 'AuthorizationError')) throw error
          const diagnostic = error instanceof PayrollSourceProviderError
            ? [{
              sourceCategory: error.sourceCategory ?? 'source-provider',
              errorCode: error.code,
              correlationId: error.correlationId ?? null,
            }]
            : []
          return [reference.employmentId, {
            employeeId: reference.employeeId,
            sourceHash: null,
            sourceVersionVector: {},
            gaps: [{ field: 'sourceSnapshot', status: 'SOURCE_GAP', reasonCode: 'CORE_SOURCE_READ_FAILED' }],
            diagnostics: diagnostic,
          } satisfies PayrollCycleCurrentSource] as const
        }
      }), 6))
    const employmentIds = [...new Set([
      ...runs.map((summary) => summary.sourceSnapshot.source_employment_id),
      ...employeeReferences.map((reference) => reference.employmentId),
    ])]
    const eventPairs = await Promise.all(employmentIds.map(async (employmentId) => [
      employmentId,
      (await lifecycleRepository.listLifecycleEvents(access.scope, access.administration.id, cycle.id, employmentId))
        .filter((event) => !scenarioRunIds.has(event.calculation_run_id)),
    ] as const))
    const lifecycleEventsByEmployment = Object.fromEntries(eventPairs)
    return projectPayrollCycle({ cycle, runs, lifecycleEventsByEmployment, currentSourcesByEmployment })
  }

  async function reconcilePayrollCycleEmployee(input: {
    readonly employeeId: string
    readonly employmentId: string
    readonly period: PayrollCyclePeriod
  }): Promise<PayrollCycleWorkItem | null> {
    assertPeriod(input.period)
    requireEnabled(dependencies)
    const access = await dependencies.requireAccess(false)
    const calculations = dependencies.createCalculationRepository()
    const cycle = await calculations.getPayrollPeriod(
      access.scope,
      access.administration.id,
      input.period.year,
      input.period.month,
    )
    if (!cycle) return null

    const snapshot = await dependencies.sourceProvider.getPayrollSourceSnapshot({
      ...access.scope,
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      payrollPeriod: input.period,
    })
    const allRuns = await calculations.listPayrollRunSummaries(access.scope, access.administration.id, {
      employeeId: input.employeeId,
      runType: 'INDIVIDUAL_PAYROLL',
      period: input.period,
      limit: 200,
    })
    const lifecycleRepository = dependencies.createLifecycleRepository()
    const visibleRuns = await filterPayrollAcceptanceScenarioRuns(allRuns, async (inputSetId) =>
      await lifecycleRepository.getGenericInputReference(access.scope, access.administration.id, inputSetId))
    const visibleRunIds = new Set(visibleRuns.map((summary) => summary.run.id))
    const scenarioRunIds = new Set(allRuns.flatMap((summary) => visibleRunIds.has(summary.run.id) ? [] : [summary.run.id]))
    const runs = visibleRuns.filter((summary) => summary.payrollPeriod.id === cycle.id
      && summary.sourceSnapshot.source_employment_id === input.employmentId)
    const events = (await lifecycleRepository.listLifecycleEvents(
      access.scope,
      access.administration.id,
      cycle.id,
      input.employmentId,
    )).filter((event) => !scenarioRunIds.has(event.calculation_run_id))
    const projection = projectPayrollCycle({
      cycle,
      runs,
      lifecycleEventsByEmployment: { [input.employmentId]: events },
      currentSourcesByEmployment: {
        [input.employmentId]: {
          employeeId: input.employeeId,
          sourceHash: snapshot.sourceHash,
          sourceVersionVector: snapshot.sourceVersionVector,
          gaps: snapshot.sourceGaps,
          diagnostics: snapshot.sourceGaps.map((gap) => ({
            sourceCategory: gap.field,
            errorCode: gap.reasonCode,
            correlationId: getPayrollSourceSnapshotCorrelationId(snapshot),
          })),
        },
      },
    })
    return projection.workItems[0] ?? {
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      runId: null,
      technicalStatus: null,
      businessStatus: null,
      revision: null,
      previousRunId: null,
      sourceHash: null,
      inputHash: null,
      changedSourceKeys: [],
      sourceDriftKeys: [],
      inputChanged: false,
      stale: false,
      correctionSuccessorRequired: false,
      sourceGaps: snapshot.sourceGaps,
    }
  }

  return { openPayrollCycle, getPayrollCycleWorklist, reconcilePayrollCycleEmployee }
}

const defaultService = () => createPayrollCycleService()

export function createLocalPayrollAcceptanceCycleService(host: string | null) {
  if (!isLocalPayrollAcceptanceRuntime(host)) throw new AuthorizationError('Payroll library unavailable.')

  const dependencies: PayrollCycleServiceDependencies = {
    ...defaultDependencies,
    requireAccess: async (write) => {
      const access = await defaultDependencies.requireAccess(write)
      if (!isLocalPayrollAcceptanceScope(access.scope, access.administration.id)) {
        throw new AuthorizationError('Payroll library unavailable.')
      }
      return access
    },
  }
  return createPayrollCycleService(dependencies)
}

export async function openPayrollCycle(period: PayrollCyclePeriod): Promise<PayrollPeriodRow> {
  return await defaultService().openPayrollCycle(period)
}

export async function getPayrollCycleWorklist(
  period: PayrollCyclePeriod,
  employeeReferences: readonly PayrollCycleEmployeeReference[] = [],
): Promise<PayrollCycleProjection | null> {
  return await defaultService().getPayrollCycleWorklist(period, employeeReferences)
}

export async function reconcilePayrollCycleEmployee(input: {
  readonly employeeId: string
  readonly employmentId: string
  readonly period: PayrollCyclePeriod
}): Promise<PayrollCycleWorkItem | null> {
  return await defaultService().reconcilePayrollCycleEmployee(input)
}

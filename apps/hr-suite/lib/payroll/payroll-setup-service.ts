import 'server-only'

import type { PayrollJson, PayrollEmployerConfigurationVersionRow } from './database'
import { createClient } from '@/lib/supabase/server'
import { createPayrollCalculationRepository, type PayrollRunSummary } from './calculation-repository'
import {
  assertActivePayrollEmployerConfiguration,
  hashPayrollEmployerConfiguration,
  hashPayrollOpeningCumulativeBalance,
  normalizePayrollEmployerConfiguration,
  normalizePayrollOpeningCumulativeBalance,
  payrollOpeningCumulativeBlockers,
  payrollEmployerConfigurationBlockers,
  validatePayrollEmployerConfiguration,
  type PayrollEmployerConfiguration,
  type PayrollEmployerConfigurationDraft,
  type PayrollOpeningCumulativeBalanceDraft,
} from './payroll-setup'
import { requireComponentLibraryAccess } from './component-library-access'
import { createPayrollSetupRepository, type PayrollSetupRepository } from './payroll-setup-repository'

export class PayrollSetupServiceError extends Error {
  constructor(
    readonly code:
      | 'PAYROLL_SETUP_INPUT_INVALID'
      | 'PAYROLL_SETUP_NOT_READY'
      | 'PAYROLL_SETUP_UNAVAILABLE'
      | 'PAYROLL_OPENING_BALANCE_INPUT_INVALID'
      | 'PAYROLL_OPENING_BALANCE_NOT_READY'
      | 'PAYROLL_OPENING_BALANCE_EXISTING_RUN_CONFLICT',
    readonly blockers: readonly PayrollSetupBlocker[] = [],
  ) {
    super(code)
    this.name = 'PayrollSetupServiceError'
  }
}

type PayrollSetupServiceDependencies = {
  readonly repository?: PayrollSetupRepository
  readonly requireAccess?: typeof requireComponentLibraryAccess
}

export type PayrollSetupBlocker = {
  readonly code: string
  readonly field: string
}

export type PayrollSetupEmployeeOption = {
  readonly employeeId: string
  readonly employmentId: string
  readonly employeeNumber: string | null
  readonly employeeName: string
  readonly employmentNumber: string | null
  readonly startsOn: string
  readonly endsOn: string | null
}

export type PayrollSetupReadModel = {
  readonly configurations: readonly PayrollEmployerConfigurationVersionRow[]
  readonly activeConfiguration: PayrollEmployerConfigurationVersionRow | null
  readonly activeConfigurationJson: PayrollEmployerConfiguration | null
  readonly latestConfiguration: PayrollEmployerConfigurationVersionRow | null
  readonly latestConfigurationJson: PayrollEmployerConfiguration | null
  readonly employeeOptions: readonly PayrollSetupEmployeeOption[]
  readonly openingSnapshots: readonly Awaited<ReturnType<PayrollSetupRepository['listOpeningCumulativeSnapshots']>>[number][]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function listPayrollSetupEmployeeOptions(
  scope: Parameters<PayrollSetupRepository['listEmployerConfigurations']>[0],
): Promise<readonly PayrollSetupEmployeeOption[]> {
  const supabase = await createClient()
  const { data: employments, error: employmentsError } = await supabase.from('employments')
    .select('id,employee_id,employment_number,starts_on,ends_on')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('administration_id', scope.administrationId)
    .eq('record_status', 'CONFIRMED')
    .is('deleted_at', null)
    .order('employment_number', { ascending: true })
    .limit(500)
  if (employmentsError) throw employmentsError
  const employeeIds = [...new Set((employments ?? []).map((employment) => employment.employee_id))]
  if (employeeIds.length === 0) return []
  const { data: employees, error: employeesError } = await supabase.from('employees')
    .select('id,employee_number,first_name,birth_name_prefix,birth_name')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .in('id', employeeIds)
    .is('deleted_at', null)
  if (employeesError) throw employeesError
  const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]))
  return (employments ?? []).flatMap((employment) => {
    const employee = employeeById.get(employment.employee_id)
    if (!employee) return []
    const employeeName = [employee.first_name, employee.birth_name_prefix, employee.birth_name]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join(' ')
    if (!employeeName) return []
    return [{
      employeeId: employment.employee_id,
      employmentId: employment.id,
      employeeNumber: employee.employee_number,
      employeeName,
      employmentNumber: employment.employment_number,
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
    }]
  })
}

function configurationFromRow(row: PayrollEmployerConfigurationVersionRow): PayrollEmployerConfiguration | null {
  if (typeof row.configuration_json !== 'object' || row.configuration_json === null || Array.isArray(row.configuration_json)) return null
  const candidate = row.configuration_json as unknown as PayrollEmployerConfigurationDraft
  try {
    const configuration = normalizePayrollEmployerConfiguration(candidate)
    if (hashPayrollEmployerConfiguration(configuration) !== row.configuration_hash) return null
    return configuration
  } catch {
    return null
  }
}

export async function getPayrollSetup(
  dependencies: { readonly repository?: PayrollSetupRepository } = {},
): Promise<PayrollSetupReadModel> {
  const access = await requireComponentLibraryAccess(false)
  const repository = dependencies.repository ?? createPayrollSetupRepository()
  const [configurations, openingSnapshots, employeeOptions] = await Promise.all([
    repository.listEmployerConfigurations(access.scope, access.administration.id),
    repository.listOpeningCumulativeSnapshots(access.scope, access.administration.id),
    listPayrollSetupEmployeeOptions(access.scope),
  ])
  const activeConfiguration = configurations.find((row) => row.status === 'ACTIVE') ?? null
  const latestConfiguration = configurations[0] ?? null
  return {
    configurations,
    activeConfiguration,
    activeConfigurationJson: activeConfiguration ? configurationFromRow(activeConfiguration) : null,
    latestConfiguration,
    latestConfigurationJson: latestConfiguration ? configurationFromRow(latestConfiguration) : null,
    employeeOptions,
    openingSnapshots,
  }
}

export async function savePayrollEmployerConfiguration(
  draft: PayrollEmployerConfigurationDraft,
  dependencies: PayrollSetupServiceDependencies = {},
): Promise<PayrollEmployerConfigurationVersionRow> {
  const access = await (dependencies.requireAccess ?? requireComponentLibraryAccess)(true)
  const repository = dependencies.repository ?? createPayrollSetupRepository()
  const normalized = normalizePayrollEmployerConfiguration(draft)
  const blockers = payrollEmployerConfigurationBlockers(normalized)
  if (normalized.status === 'ACTIVE' && blockers.length > 0) {
    throw new PayrollSetupServiceError('PAYROLL_SETUP_NOT_READY', blockers)
  }
  if (normalized.status === 'ACTIVE') assertActivePayrollEmployerConfiguration(normalized)

  const existing = await repository.listEmployerConfigurations(access.scope, access.administration.id)
  if (normalized.status === 'ACTIVE') {
    const configurationHash = hashPayrollEmployerConfiguration(normalized)
    const matchingActiveVersion = existing.find((row) => {
      if (row.effective_from !== normalized.effectiveFrom || row.effective_to !== normalized.effectiveTo) return false
      const existingConfiguration = configurationFromRow(row)
      return row.status === 'ACTIVE' && existingConfiguration !== null
        && hashPayrollEmployerConfiguration({ ...existingConfiguration, status: 'ACTIVE' }) === configurationHash
    })
    // Configuration rows are append-only: activation is a new immutable version.
    // The Lab database intentionally grants INSERT but not UPDATE on this table.
    if (matchingActiveVersion) return matchingActiveVersion
  }
  const nextVersion = Math.max(0, ...existing.map((row) => row.configuration_version)) + 1
  try {
    return await repository.insertEmployerConfiguration(access.scope, access.administration.id, {
      payroll_administration_id: access.administration.id,
      source_tenant_id: access.scope.tenantId,
      source_hr_group_id: access.scope.hrGroupId,
      source_administration_id: access.scope.administrationId,
      configuration_version: nextVersion,
      effective_from: normalized.effectiveFrom,
      effective_to: normalized.effectiveTo,
      configuration_json: normalized as unknown as PayrollJson,
      configuration_hash: hashPayrollEmployerConfiguration(normalized),
      status: normalized.status,
      source_reference: normalized.sourceReference,
      created_by_user_id: access.actorUserId,
    })
  } catch (error) {
    if (error instanceof PayrollSetupServiceError) throw error
    throw new PayrollSetupServiceError('PAYROLL_SETUP_UNAVAILABLE')
  }
}

export function parsePayrollEmployerConfigurationForm(
  formData: FormData,
): PayrollEmployerConfigurationDraft {
  const scalar = (name: string): string => {
    const values = formData.getAll(name)
    if (values.length !== 1 || typeof values[0] !== 'string') throw new PayrollSetupServiceError('PAYROLL_SETUP_INPUT_INVALID')
    return values[0]
  }
  const yearEndApplies = scalar('yearEndApplies')
  if (!['unknown', 'true', 'false'].includes(yearEndApplies)) throw new PayrollSetupServiceError('PAYROLL_SETUP_INPUT_INVALID')
  const status = scalar('status')
  if (status !== 'DRAFT' && status !== 'ACTIVE') throw new PayrollSetupServiceError('PAYROLL_SETUP_INPUT_INVALID')
  return {
    schemaVersion: 'payroll-employer-configuration-v1',
    effectiveFrom: scalar('effectiveFrom'),
    effectiveTo: scalar('effectiveTo') || null,
    status,
    sourceReference: scalar('sourceReference'),
    employer: {
      sectorCode: scalar('sectorCode'),
      whkDecisionReference: scalar('whkDecisionReference'),
      awfClassification: scalar('awfClassification'),
      aofClassification: scalar('aofClassification'),
      wkoClassification: scalar('wkoClassification'),
      zvwClassification: scalar('zvwClassification'),
    },
    employerRates: {
      awf: scalar('awfRate'),
      aof: scalar('aofRate'),
      wko: scalar('wkoRate'),
      whk: scalar('whkRate'),
      zvw: scalar('zvwRate'),
    },
    reserves: {
      holidayAllowanceRate: scalar('holidayAllowanceRate'),
      yearEndApplies: yearEndApplies === 'unknown' ? null : yearEndApplies === 'true',
      yearEndRate: scalar('yearEndRate'),
    },
    pension: {
      partialMonthMethod: scalar('pensionPartialMonthMethod') as PayrollEmployerConfiguration['pension']['partialMonthMethod'],
      methodSourceReference: scalar('pensionMethodSourceReference'),
    },
  }
}

export function validatePayrollEmployerConfigurationForm(formData: FormData) {
  const draft = parsePayrollEmployerConfigurationForm(formData)
  return { draft, ...validatePayrollEmployerConfiguration(draft) }
}

export type PayrollOpeningCumulativeFormDraft = PayrollOpeningCumulativeBalanceDraft & {
  readonly sourceEmploymentId: string
}

function payrollOpeningScalar(formData: FormData, name: string): string {
  const values = formData.getAll(name)
  if (values.length !== 1 || typeof values[0] !== 'string') {
    throw new PayrollSetupServiceError('PAYROLL_OPENING_BALANCE_INPUT_INVALID')
  }
  return values[0]
}

export function parsePayrollOpeningCumulativeForm(formData: FormData): PayrollOpeningCumulativeFormDraft {
  return {
    sourceEmploymentId: payrollOpeningScalar(formData, 'sourceEmploymentId'),
    sourcePeriodFrom: payrollOpeningScalar(formData, 'sourcePeriodFrom'),
    sourcePeriodTo: payrollOpeningScalar(formData, 'sourcePeriodTo'),
    asOfDate: payrollOpeningScalar(formData, 'asOfDate'),
    meaning: {
      grossWageBeforePeriod: payrollOpeningScalar(formData, 'grossWageBeforePeriod'),
      taxableWageBeforePeriod: payrollOpeningScalar(formData, 'taxableWageBeforePeriod'),
      wageTaxBeforePeriod: payrollOpeningScalar(formData, 'wageTaxBeforePeriod'),
      employeeInsuranceWageBeforePeriod: payrollOpeningScalar(formData, 'employeeInsuranceWageBeforePeriod'),
      zvwWageBeforePeriod: payrollOpeningScalar(formData, 'zvwWageBeforePeriod'),
      holidayReserveBeforePeriod: payrollOpeningScalar(formData, 'holidayReserveBeforePeriod'),
      yearEndReserveBeforePeriod: payrollOpeningScalar(formData, 'yearEndReserveBeforePeriod'),
    },
    sourceReference: payrollOpeningScalar(formData, 'sourceReference'),
  }
}

type OpeningBalanceDependencies = {
  readonly repository?: PayrollSetupRepository
  readonly requireAccess?: typeof requireComponentLibraryAccess
  readonly listEmployeeOptions?: typeof listPayrollSetupEmployeeOptions
  readonly listHistoricalRuns?: (
    scope: Parameters<PayrollSetupRepository['listEmployerConfigurations']>[0],
    payrollAdministrationId: string,
    employeeId: string,
  ) => Promise<readonly PayrollRunSummary[]>
}

const listHistoricalRuns: NonNullable<OpeningBalanceDependencies['listHistoricalRuns']> = async (
  scope,
  payrollAdministrationId,
  employeeId,
) => await createPayrollCalculationRepository().listPayrollRunSummaries(scope, payrollAdministrationId, {
  employeeId,
  runType: 'INDIVIDUAL_PAYROLL',
  limit: 200,
})

export async function savePayrollOpeningCumulativeBalance(
  draft: PayrollOpeningCumulativeFormDraft,
  dependencies: OpeningBalanceDependencies = {},
): Promise<Awaited<ReturnType<PayrollSetupRepository['insertOpeningCumulativeSnapshot']>>> {
  const access = await (dependencies.requireAccess ?? requireComponentLibraryAccess)(true)
  if (!UUID_PATTERN.test(draft.sourceEmploymentId)) {
    throw new PayrollSetupServiceError('PAYROLL_OPENING_BALANCE_INPUT_INVALID', [{ code: 'OPENING_SOURCE_EMPLOYMENT_REQUIRED', field: 'sourceEmploymentId' }])
  }
  const blockers = payrollOpeningCumulativeBlockers(draft)
  if (blockers.length > 0) throw new PayrollSetupServiceError('PAYROLL_OPENING_BALANCE_NOT_READY', blockers)
  const balance = normalizePayrollOpeningCumulativeBalance(draft)
  const employeeOptions = await (dependencies.listEmployeeOptions ?? listPayrollSetupEmployeeOptions)(access.scope)
  const employee = employeeOptions.find((option) => option.employmentId === draft.sourceEmploymentId)
  if (!employee) {
    throw new PayrollSetupServiceError('PAYROLL_OPENING_BALANCE_INPUT_INVALID', [{ code: 'OPENING_SOURCE_EMPLOYMENT_REQUIRED', field: 'sourceEmploymentId' }])
  }

  const existingRuns = await (dependencies.listHistoricalRuns ?? listHistoricalRuns)(access.scope, access.administration.id, employee.employeeId)
  if (existingRuns.some((run) => run.sourceSnapshot.source_employment_id === employee.employmentId
    && run.payrollPeriod.ends_on >= balance.asOfDate)) {
    throw new PayrollSetupServiceError('PAYROLL_OPENING_BALANCE_EXISTING_RUN_CONFLICT', [{ code: 'OPENING_EXISTING_PAYROLL_RUN_CONFLICT', field: 'asOfDate' }])
  }

  const repository = dependencies.repository ?? createPayrollSetupRepository()
  const existingSnapshots = await repository.listOpeningCumulativeSnapshots(access.scope, access.administration.id, employee.employmentId)
  const snapshotVersion = Math.max(0, ...existingSnapshots.map((snapshot) => snapshot.snapshot_version)) + 1
  try {
    return await repository.insertOpeningCumulativeSnapshot(access.scope, access.administration.id, {
      payroll_administration_id: access.administration.id,
      source_tenant_id: access.scope.tenantId,
      source_hr_group_id: access.scope.hrGroupId,
      source_administration_id: access.scope.administrationId,
      source_employment_id: employee.employmentId,
      snapshot_version: snapshotVersion,
      as_of_date: balance.asOfDate,
      opening_balance_json: balance as unknown as PayrollJson,
      snapshot_hash: hashPayrollOpeningCumulativeBalance(balance),
      provenance_status: 'CUSTOMER_OPENING_BALANCE',
      provenance_source: balance.sourceReference,
      created_by_user_id: access.actorUserId,
    })
  } catch (error) {
    if (error instanceof PayrollSetupServiceError) throw error
    throw new PayrollSetupServiceError('PAYROLL_SETUP_UNAVAILABLE')
  }
}

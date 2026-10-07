import 'server-only'

import { createHash } from 'node:crypto'
import {
  PayrollEngineError,
  type PayrollResultMapping,
  buildCalculationInputs,
  calculatePayroll,
  GC_NL_001_RULE_PACKAGE,
  GC_NL_001_RESULT_COMPONENTS,
  type PayrollCalculationInputs,
  type PayrollCalculationResult,
  type PayrollSourceSnapshot,
  type PayrollSerializedValue,
} from '@liquid-hr/payroll-engine'
import type {
  PayrollCalculationRunRow,
  PayrollCalculationRunType,
  PayrollControlRow,
  PayrollDatabase,
  PayrollJson,
  PayrollPeriodRow,
  PayrollSourceSnapshotRow,
  PayrollCalculationInputSetRow,
} from './database'
import {
  createPayrollCalculationRepository,
  PayrollCalculationRepositoryError,
  type PayrollCalculationArtifacts,
  type PayrollCalculationRepository,
} from './calculation-repository'
import { isPayrollLabEnabled } from './feature-flag'
import { assertPayrollScope, type PayrollScope } from './scope'
import {
  createSyntheticPayrollSnapshot,
  type SyntheticPayrollSnapshotOptions,
  type SyntheticPayrollPeriod,
} from './synthetic-source'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_PATTERN = /^[0-9a-f]{64}$/
const PAYROLL_INPUT_ID_NAMESPACE = Buffer.from('4c485250415952554e30310000000002', 'hex')
export const GC_NL_001_PERIOD: SyntheticPayrollPeriod = { year: 2026, month: 9 }

function deterministicPayrollInputSetId(name: string): string {
  const digest = createHash('sha1').update(Buffer.concat([PAYROLL_INPUT_ID_NAMESPACE, Buffer.from(name, 'utf8')])).digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type SyntheticPayrollErrorCode =
  | 'PAYROLL_SYNTHETIC_MODE_DISABLED'
  | 'PAYROLL_SCOPE_INVALID'
  | 'PAYROLL_ADMINISTRATION_UNAVAILABLE'
  | 'PAYROLL_CAPABILITY_DISABLED'
  | 'PAYROLL_PERIOD_CLOSED'
  | 'PAYROLL_INPUT_INVALID'
  | 'PAYROLL_CALCULATION_BLOCKED'
  | 'PAYROLL_CALCULATION_FAILED'
  | 'PAYROLL_PERSISTENCE_FAILED'
  | 'PAYROLL_UNSUPPORTED'

export class SyntheticPayrollServiceError extends Error {
  constructor(readonly code: SyntheticPayrollErrorCode, readonly runId: string | null = null, readonly reasonCode: string | null = null) {
    super(code)
    this.name = 'SyntheticPayrollServiceError'
  }
}

export interface SyntheticPayrollComponentView {
  readonly key: string
  readonly amount: string | null
  readonly payload: PayrollJson
}

export interface SyntheticPayrollControlView {
  readonly key: string
  readonly status: PayrollControlRow['status']
  readonly details: PayrollJson
}

export interface SyntheticPayrollView {
  readonly caseKey?: string | null
  readonly outcome?: string | null
  readonly unsupportedReason?: string | null
  readonly runId: string
  readonly status: PayrollCalculationRunRow['status']
  readonly runType: PayrollCalculationRunRow['run_type']
  readonly payrollAdministrationId: string
  readonly employeeId: string
  readonly sourceSnapshotId: string
  readonly inputSetId: string
  readonly sourcePayload: PayrollJson
  readonly sourceVersionVector: Readonly<Record<string, string>>
  readonly payrollPeriod: SyntheticPayrollPeriod
  readonly sourceHash: string
  readonly inputHash: string
  readonly resultHash: string | null
  readonly rulePackageCompositionId: string
  readonly engineVersion: string
  readonly components: readonly SyntheticPayrollComponentView[]
  readonly trace: PayrollJson | null
  readonly controls: readonly SyntheticPayrollControlView[]
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly createdAt: string
  readonly errorCode: SyntheticPayrollErrorCode | null
}

export type PayrollSelectionEvidence = Readonly<Record<string, string | number | boolean | null>>

export interface SyntheticPayrollEngine {
  buildInputs(sourceSnapshot: PayrollSourceSnapshot, effectiveDate: string, context?: PayrollCalculationContext): PayrollCalculationInputs
  calculate(inputs: PayrollCalculationInputs): PayrollCalculationResult
}

export interface PayrollCalculationContext {
  /** A Payroll-owned projection of the Core snapshot, retaining opaque source identities. */
  readonly sourceSnapshot?: PayrollSourceSnapshot
  readonly sourceValueOverrides?: Readonly<Record<string, PayrollSerializedValue>>
  readonly calculationContextHash?: string
  readonly provenance?: PayrollJson
}

export interface PayrollTestScenario {
  readonly caseKey?: string
  readonly runType?: PayrollCalculationRunType
  readonly reusePersistedInputs?: boolean
  readonly compositionId: string
  readonly period: SyntheticPayrollPeriod
  readonly expectedResults?: readonly PayrollResultMapping[]
  readonly createSnapshot: (scope: PayrollScope, period: SyntheticPayrollPeriod, options: SyntheticPayrollSnapshotOptions, selectionEvidence?: PayrollSelectionEvidence) => PayrollSourceSnapshot | Promise<PayrollSourceSnapshot>
  readonly validateSelection?: (scope: PayrollScope, payrollAdministrationId: string, effectiveDate: string) => Promise<PayrollSelectionEvidence | undefined>
  readonly persistInputReference?: (input: {
    readonly scope: PayrollScope
    readonly payrollAdministrationId: string
    readonly actorUserId: string
    readonly inputSet: PayrollCalculationInputSetRow
    readonly sourceSnapshot: PayrollSourceSnapshotRow
    readonly payrollPeriod: PayrollPeriodRow
    readonly calculationContext?: PayrollCalculationContext
  }) => Promise<void>
  readonly resolveCalculationContext?: (input: {
    readonly scope: PayrollScope
    readonly payrollAdministrationId: string
    readonly actorUserId: string
    readonly period: SyntheticPayrollPeriod
    readonly sourceSnapshot: PayrollSourceSnapshot
  }) => Promise<PayrollCalculationContext | undefined>
  readonly recordLifecycleEvent?: (input: {
    readonly scope: PayrollScope
    readonly payrollAdministrationId: string
    readonly actorUserId: string
    readonly payrollPeriodId: string
    readonly sourceEmploymentId: string
    readonly calculationRunId: string
    readonly revision: number
    readonly eventSequence: number
    readonly eventType: 'BLOCKED' | 'CONCEPT'
    readonly eventPayload: PayrollJson
  }) => Promise<void>
}

export interface SyntheticPayrollServiceDependencies {
  readonly scenario?: PayrollTestScenario
  readonly repository: PayrollCalculationRepository
  readonly engine: SyntheticPayrollEngine
  readonly isEnabled: () => boolean
  readonly now?: () => Date
  readonly createId?: () => string
}

function assertServiceScope(scope: PayrollScope, payrollAdministrationId: string, actorUserId?: string): PayrollScope {
  try {
    const validatedScope = assertPayrollScope(scope)
    if (!UUID_PATTERN.test(payrollAdministrationId) || (actorUserId !== undefined && !UUID_PATTERN.test(actorUserId))) {
      throw new TypeError('Invalid Payroll identifiers.')
    }
    return validatedScope
  } catch {
    throw new SyntheticPayrollServiceError('PAYROLL_SCOPE_INVALID')
  }
}

function isHash(value: string): boolean {
  return HASH_PATTERN.test(value)
}

function toPayrollJson(value: unknown): PayrollJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
    return value
  }
  if (Array.isArray(value)) return value.map((item) => toPayrollJson(item))
  if (typeof value !== 'object') throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  const record: { [key: string]: PayrollJson | undefined } = {}
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) record[key] = toPayrollJson(item)
  }
  return record
}

function periodStart(period: SyntheticPayrollPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function periodEnd(period: SyntheticPayrollPeriod): string {
  return new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
}

function periodReferenceDate(period: SyntheticPayrollPeriod): string {
  return periodStart(period)
}

function isRecord(value: PayrollJson | null): value is { readonly [key: string]: PayrollJson | undefined } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getJsonText(record: { readonly [key: string]: PayrollJson | undefined } | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' ? value : null
}

function viewFromArtifacts(artifacts: PayrollCalculationArtifacts): SyntheticPayrollView {
  const components = artifacts.componentResults.map((row) => {
    const payloadRecord = isRecord(row.result_payload) ? row.result_payload : null
    return {
      key: row.component_key,
      // JSON bevat het exacte bedrag; de numerieke DB-projectie is geen rekenbron.
      amount: getJsonText(payloadRecord, 'amount'),
      payload: row.result_payload,
    }
  })
  const controls = artifacts.controls.map((row) => ({
    key: row.control_key,
    status: row.status,
    details: row.detail_payload,
  }))
  const tracePayload = artifacts.trace?.trace_payload ?? null
  const traceRecord = isRecord(tracePayload) ? tracePayload : null
  const errorCode = getJsonText(traceRecord, 'failureCode')
  const safeErrorCode = errorCode && isSyntheticPayrollErrorCode(errorCode) ? errorCode : null
  const sourceVersionVector: Record<string, string> = {}
  if (isRecord(artifacts.sourceSnapshot.source_version_vector)) {
    for (const [key, value] of Object.entries(artifacts.sourceSnapshot.source_version_vector)) {
      if (typeof value === 'string') sourceVersionVector[key] = value
    }
  }

  return {
    caseKey: artifacts.goldenCase?.case_key ?? getJsonText(traceRecord, 'caseKey'),
    outcome: getJsonText(traceRecord, 'status'),
    unsupportedReason: getJsonText(traceRecord, 'unsupportedReason'),
    runId: artifacts.run.id,
    status: artifacts.run.status,
    runType: artifacts.run.run_type,
    payrollAdministrationId: artifacts.run.payroll_administration_id,
    employeeId: artifacts.sourceSnapshot.source_employee_id,
    sourceSnapshotId: artifacts.sourceSnapshot.id,
    inputSetId: artifacts.inputSet.id,
    sourcePayload: artifacts.sourceSnapshot.source_payload,
    sourceVersionVector,
    payrollPeriod: {
      year: artifacts.payrollPeriod.period_year,
      month: artifacts.payrollPeriod.period_month,
    },
    sourceHash: artifacts.sourceSnapshot.source_hash,
    inputHash: artifacts.inputSet.input_hash,
    resultHash: artifacts.run.result_hash,
    rulePackageCompositionId: artifacts.inputSet.rule_package_composition_id,
    engineVersion: artifacts.inputSet.engine_version,
    components,
    trace: artifacts.trace?.trace_payload ?? null,
    controls,
    startedAt: artifacts.run.started_at,
    finishedAt: artifacts.run.finished_at,
    createdAt: artifacts.run.created_at,
    errorCode: safeErrorCode,
  }
}

function isSyntheticPayrollErrorCode(value: string): value is SyntheticPayrollErrorCode {
  return value === 'PAYROLL_SYNTHETIC_MODE_DISABLED'
    || value === 'PAYROLL_SCOPE_INVALID'
    || value === 'PAYROLL_ADMINISTRATION_UNAVAILABLE'
    || value === 'PAYROLL_CAPABILITY_DISABLED'
    || value === 'PAYROLL_PERIOD_CLOSED'
    || value === 'PAYROLL_INPUT_INVALID'
    || value === 'PAYROLL_CALCULATION_BLOCKED'
    || value === 'PAYROLL_CALCULATION_FAILED'
    || value === 'PAYROLL_PERSISTENCE_FAILED'
    || value === 'PAYROLL_UNSUPPORTED'
}

function resultPayload(
  result: PayrollCalculationResult,
  inputs: PayrollCalculationInputs,
  resultRow: PayrollCalculationResult['resultRows'][number],
): PayrollJson {
  const componentResult = result.componentResults.find((candidate) => candidate.componentCode === resultRow.componentCode)
  const definition = inputs.components.find((candidate) => candidate.code === resultRow.componentCode)
  const outputDefinition = definition?.outputs.find((candidate) => candidate.name === resultRow.outputName)
  return toPayrollJson({
    key: resultRow.key,
    amount: numericResultAmount(resultRow),
    value: resultRow.value,
    valueType: resultRow.valueType,
    componentCode: resultRow.componentCode,
    outputName: resultRow.outputName,
    component: componentResult ? {
      id: componentResult.componentId,
      code: componentResult.componentCode,
      version: componentResult.version,
      processingScope: componentResult.processingScope,
      ownership: definition?.ownership ?? null,
      effectiveFrom: definition?.effectiveFrom ?? null,
      effectiveTo: definition?.effectiveTo ?? null,
      rounding: outputDefinition?.rounding ?? null,
    } : null,
  })
}

function numericResultAmount(resultRow: PayrollCalculationResult['resultRows'][number]): string | null {
  if (resultRow.valueType !== 'MONEY' && resultRow.valueType !== 'DECIMAL' && resultRow.valueType !== 'PERCENTAGE') {
    return null
  }
  return typeof resultRow.value === 'string' ? resultRow.value : null
}

function componentDefinitionTrace(inputs: PayrollCalculationInputs): PayrollJson {
  return toPayrollJson(inputs.components.map((component) => ({
    id: component.id,
    code: component.code,
    version: component.version,
    ownership: component.ownership,
    processingScope: component.processingScope,
    effectiveFrom: component.effectiveFrom,
    effectiveTo: component.effectiveTo,
    outputs: component.outputs.map((output) => ({
      name: output.name,
      valueType: output.valueType,
      rounding: output.rounding ?? null,
    })),
  })))
}

function controlStatus(status: PayrollCalculationResult['controls'][number]['status']): PayrollControlRow['status'] {
  if (status === 'PASS') return 'PASS'
  if (status === 'WARNING') return 'WARN'
  return 'FAIL'
}

function safeFailureCode(error: unknown): SyntheticPayrollErrorCode {
  if (error instanceof SyntheticPayrollServiceError) return error.code
  if (error instanceof PayrollEngineError
    && /^(?:NL2026|KO|RETAIL_MODE|BENCH02)_[A-Z0-9_]+$/.test(error.code)) return 'PAYROLL_UNSUPPORTED'
  if (error instanceof PayrollCalculationRepositoryError) return 'PAYROLL_PERSISTENCE_FAILED'
  return 'PAYROLL_CALCULATION_FAILED'
}

function hasExpectedOutputs(
  result: PayrollCalculationResult,
  inputs: PayrollCalculationInputs,
  expected: readonly PayrollResultMapping[],
): boolean {
  if (result.resultRows.length !== expected.length) return false
  const rowsByKey = new Map(result.resultRows.map((row) => [row.key, row]))
  return expected.every((mapping) => {
    const row = rowsByKey.get(mapping.key)
    const component = inputs.components.find((candidate) => candidate.code === mapping.componentCode)
    const output = component?.outputs.find((candidate) => candidate.name === mapping.outputName)
    return row !== undefined
      && row.componentCode === mapping.componentCode
      && row.outputName === mapping.outputName
      && output !== undefined
      && row.valueType === output.valueType
      && (row.valueType === 'BOOLEAN' ? typeof row.value === 'boolean' : typeof row.value === 'string')
  })
}

function asSourcePayload(snapshot: PayrollSourceSnapshot): PayrollJson {
  return toPayrollJson(snapshot.canonicalSource)
}

export function createSyntheticPayrollService(dependencies: SyntheticPayrollServiceDependencies) {
  const scenario: PayrollTestScenario = dependencies.scenario ?? {
    caseKey: 'GC-NL-001', compositionId: GC_NL_001_RULE_PACKAGE.compositionId,
    period: GC_NL_001_PERIOD, expectedResults: GC_NL_001_RESULT_COMPONENTS, createSnapshot: createSyntheticPayrollSnapshot,
  }
  const now = dependencies.now ?? (() => new Date())
  const createId = dependencies.createId

  async function requirePayrollAdministration(scope: PayrollScope, payrollAdministrationId: string) {
    const gate = await dependencies.repository.getPayrollAdministrationGate(scope, payrollAdministrationId)
    if (!gate || gate.id !== payrollAdministrationId || gate.status !== 'ACTIVE') {
      throw new SyntheticPayrollServiceError('PAYROLL_ADMINISTRATION_UNAVAILABLE')
    }
    if (!gate.capabilityEnabled) throw new SyntheticPayrollServiceError('PAYROLL_CAPABILITY_DISABLED')
  }

  async function getOrCreatePayrollPeriod(
    scope: PayrollScope,
    payrollAdministrationId: string,
    period: SyntheticPayrollPeriod,
    actorUserId: string,
  ): Promise<PayrollPeriodRow> {
    const existing = await dependencies.repository.getPayrollPeriod(scope, payrollAdministrationId, period.year, period.month)
    if (existing) return existing

    try {
      return await dependencies.repository.insertPayrollPeriod(scope, payrollAdministrationId, {
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        period_year: period.year,
        period_month: period.month,
        starts_on: periodStart(period),
        ends_on: periodEnd(period),
        status: 'DRAFT',
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
    } catch (error) {
      if (!(error instanceof PayrollCalculationRepositoryError) || error.code !== 'PAYROLL_PERIOD_ALREADY_EXISTS') throw error
      const concurrentlyCreated = await dependencies.repository.getPayrollPeriod(scope, payrollAdministrationId, period.year, period.month)
      if (concurrentlyCreated) return concurrentlyCreated
      throw error
    }
  }

  async function runSyntheticPayroll(
    rawScope: PayrollScope,
    rawPayrollAdministrationId: string,
    rawActorUserId: string,
  ): Promise<SyntheticPayrollView> {
    if (!dependencies.isEnabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
    const scope = assertServiceScope(rawScope, rawPayrollAdministrationId, rawActorUserId)
    const payrollAdministrationId = rawPayrollAdministrationId
    const actorUserId = rawActorUserId
    let currentRun: PayrollCalculationRunRow | null = null
    let traceInserted = false
    let goldenCaseInserted = false
    let inputReferenceInserted = false
    let currentPayrollPeriodId: string | null = null
    let currentEmploymentId: string | null = null

    try {
      await requirePayrollAdministration(scope, payrollAdministrationId)
      const currentTime = now()
      const period = scenario.period
      const selectionEvidence = await scenario.validateSelection?.(scope, payrollAdministrationId, periodStart(period))
      const payrollPeriod = await getOrCreatePayrollPeriod(scope, payrollAdministrationId, period, actorUserId)
      currentPayrollPeriodId = payrollPeriod.id
      if (payrollPeriod.status === 'CLOSED') throw new SyntheticPayrollServiceError('PAYROLL_PERIOD_CLOSED')

      const snapshot = await scenario.createSnapshot(scope, period, {
        now: currentTime,
        ...(createId ? { createId } : {}),
      }, selectionEvidence)
      currentEmploymentId = snapshot.sourceEmploymentId
      const calculationContext = await scenario.resolveCalculationContext?.({
        scope,
        payrollAdministrationId,
        actorUserId,
        period,
        sourceSnapshot: snapshot,
      })
      const calculationSnapshot = calculationContext?.sourceSnapshot ?? snapshot
      if (
        calculationSnapshot.id !== snapshot.id
        || calculationSnapshot.sourceTenantId !== snapshot.sourceTenantId
        || calculationSnapshot.sourceHrGroupId !== snapshot.sourceHrGroupId
        || calculationSnapshot.sourceAdministrationId !== snapshot.sourceAdministrationId
        || calculationSnapshot.sourceEmployeeId !== snapshot.sourceEmployeeId
        || calculationSnapshot.sourceEmploymentId !== snapshot.sourceEmploymentId
        || calculationSnapshot.periodReference.year !== period.year
        || calculationSnapshot.periodReference.month !== period.month
      ) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      const inputs = dependencies.engine.buildInputs(calculationSnapshot, periodStart(period), calculationContext)
      if (!isHash(calculationSnapshot.sourceHash) || !isHash(inputs.inputHash) || !inputs.rulePackageCompositionId.trim() || !inputs.engineVersion.trim()) {
        throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
      }

      const sourceSnapshotRow = {
        id: snapshot.id,
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        source_employee_id: calculationSnapshot.sourceEmployeeId,
        source_employment_id: calculationSnapshot.sourceEmploymentId,
        source_income_relationship_id: calculationSnapshot.sourceIncomeRelationshipId,
        period_reference: periodReferenceDate(period),
        source_payload: asSourcePayload(calculationSnapshot),
        source_version_vector: toPayrollJson(calculationSnapshot.sourceVersionVector),
        source_hash: calculationSnapshot.sourceHash,
        created_by_user_id: actorUserId,
      } satisfies PayrollDatabase['public']['Tables']['source_snapshots']['Insert']
      if (scenario.reusePersistedInputs && !dependencies.repository.getOrCreateSourceSnapshot) throw new PayrollCalculationRepositoryError()
      const persistedSnapshot = scenario.reusePersistedInputs
        ? await dependencies.repository.getOrCreateSourceSnapshot!(scope, payrollAdministrationId, sourceSnapshotRow)
        : await dependencies.repository.insertSourceSnapshot(scope, payrollAdministrationId, sourceSnapshotRow)
      const inputSetRow = {
        ...(scenario.reusePersistedInputs ? {
          id: deterministicPayrollInputSetId([
            scope.tenantId,
            scope.hrGroupId,
            scope.administrationId,
            payrollAdministrationId,
            persistedSnapshot.id,
            payrollPeriod.id,
            inputs.rulePackageCompositionId,
            inputs.engineVersion,
            inputs.inputHash,
          ].join(':')),
        } : {}),
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        source_snapshot_id: persistedSnapshot.id,
        payroll_period_id: payrollPeriod.id,
        rule_package_composition_id: inputs.rulePackageCompositionId,
        engine_version: inputs.engineVersion,
        input_hash: inputs.inputHash,
        created_by_user_id: actorUserId,
      } satisfies PayrollDatabase['public']['Tables']['calculation_input_sets']['Insert']
      if (scenario.reusePersistedInputs && !dependencies.repository.getOrCreateCalculationInputSet) throw new PayrollCalculationRepositoryError()
      const inputSet = scenario.reusePersistedInputs
        ? await dependencies.repository.getOrCreateCalculationInputSet!(scope, payrollAdministrationId, inputSetRow)
        : await dependencies.repository.insertCalculationInputSet(scope, payrollAdministrationId, inputSetRow)
      if (scenario.persistInputReference) {
        await scenario.persistInputReference({
          scope,
          payrollAdministrationId,
          actorUserId,
          inputSet,
          sourceSnapshot: persistedSnapshot,
          payrollPeriod,
          ...(calculationContext ? { calculationContext } : {}),
        })
        inputReferenceInserted = true
      }
      const createdRun = await dependencies.repository.insertCalculationRun(scope, payrollAdministrationId, {
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        calculation_input_set_id: inputSet.id,
        run_type: scenario.runType ?? 'GOLDEN_CASE',
        status: 'PENDING',
        started_at: null,
        finished_at: null,
        result_hash: null,
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      currentRun = createdRun
      const createdRunId = createdRun.id

      await dependencies.repository.markCalculationRunRunning(scope, payrollAdministrationId, createdRunId, actorUserId, currentTime.toISOString())
      const result = dependencies.engine.calculate(inputs)
      if (
        !isHash(result.resultHash)
        || result.inputHash !== inputs.inputHash
        || result.sourceHash !== calculationSnapshot.sourceHash
        || result.sourceSnapshotId !== calculationSnapshot.id
        || result.status !== 'CALCULATED'
        || !hasExpectedOutputs(result, inputs, scenario.expectedResults ?? inputs.resultMappings)
      ) {
        const code: SyntheticPayrollErrorCode = result.status === 'BLOCKED' ? 'PAYROLL_CALCULATION_BLOCKED' : 'PAYROLL_CALCULATION_FAILED'
        const blockedTrace = toPayrollJson({
          status: result.status,
          failureCode: code,
          sourceHash: result.sourceHash,
          inputHash: result.inputHash,
          resultHash: result.resultHash,
          effectiveDate: result.effectiveDate,
          rulePackageCompositionHash: inputs.rulePackageCompositionHash,
          packageMetadata: inputs.packageMetadata ?? null,
          roundingDefinitions: inputs.roundingDefinitions ?? [],
          calculationContextHash: inputs.calculationContextHash ?? null,
          ...(calculationContext?.provenance ? { calculationContext: calculationContext.provenance } : {}),
          ...(scenario.caseKey ? { caseKey: scenario.caseKey } : {}),
          definitions: componentDefinitionTrace(inputs),
          steps: scenario.runType === 'INDIVIDUAL_PAYROLL' ? [] : result.trace,
        })
        await dependencies.repository.insertCalculationTrace(scope, payrollAdministrationId, {
          payroll_administration_id: payrollAdministrationId,
          source_tenant_id: scope.tenantId,
          source_hr_group_id: scope.hrGroupId,
          source_administration_id: scope.administrationId,
          calculation_run_id: createdRunId,
          trace_payload: blockedTrace,
          created_by_user_id: actorUserId,
        })
        traceInserted = true
        await dependencies.repository.insertPayrollControls(scope, payrollAdministrationId, result.controls.map((control) => ({
          payroll_administration_id: payrollAdministrationId,
          source_tenant_id: scope.tenantId,
          source_hr_group_id: scope.hrGroupId,
          source_administration_id: scope.administrationId,
          calculation_run_id: createdRunId,
          control_key: control.code,
          status: controlStatus(control.status),
          detail_payload: toPayrollJson(control),
          created_by_user_id: actorUserId,
          updated_by_user_id: actorUserId,
        })))
        throw new SyntheticPayrollServiceError(code, createdRunId)
      }

      const resultRows = result.resultRows.map((resultRow) => ({
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        calculation_run_id: createdRunId,
        component_key: resultRow.key,
        amount: numericResultAmount(resultRow),
        result_payload: resultPayload(result, inputs, resultRow),
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })) satisfies readonly PayrollDatabase['public']['Tables']['component_results']['Insert'][]
      const componentResults = await dependencies.repository.insertComponentResults(scope, payrollAdministrationId, resultRows)
      const tracePayload = toPayrollJson({
        status: result.status,
        sourceHash: result.sourceHash,
        inputHash: result.inputHash,
        resultHash: result.resultHash,
        engineVersion: result.engineVersion,
        rulePackageCompositionId: result.rulePackageCompositionId,
        rulePackageCompositionHash: result.rulePackageCompositionHash,
        effectiveDate: result.effectiveDate,
        packageMetadata: inputs.packageMetadata ?? null,
        roundingDefinitions: inputs.roundingDefinitions ?? [],
        calculationContextHash: inputs.calculationContextHash ?? null,
        ...(calculationContext?.provenance ? { calculationContext: calculationContext.provenance } : {}),
        ...(scenario.caseKey ? { caseKey: scenario.caseKey } : {}),
        definitions: componentDefinitionTrace(inputs),
        steps: result.trace,
        components: result.componentResults,
      })
      const trace = await dependencies.repository.insertCalculationTrace(scope, payrollAdministrationId, {
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        calculation_run_id: createdRunId,
        trace_payload: tracePayload,
        created_by_user_id: actorUserId,
      })
      traceInserted = true
      const controls = await dependencies.repository.insertPayrollControls(scope, payrollAdministrationId, result.controls.map((control) => ({
        payroll_administration_id: payrollAdministrationId,
        source_tenant_id: scope.tenantId,
        source_hr_group_id: scope.hrGroupId,
        source_administration_id: scope.administrationId,
        calculation_run_id: createdRunId,
        control_key: control.code,
        status: controlStatus(control.status),
        detail_payload: toPayrollJson(control),
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })))
      const goldenCase = scenario.caseKey && (scenario.runType ?? 'GOLDEN_CASE') === 'GOLDEN_CASE'
        ? await dependencies.repository.insertGoldenCaseRun(scope, payrollAdministrationId, {
          payroll_administration_id: payrollAdministrationId,
          source_tenant_id: scope.tenantId,
          source_hr_group_id: scope.hrGroupId,
          source_administration_id: scope.administrationId,
          calculation_run_id: createdRunId,
          case_key: scenario.caseKey,
          expected_result_hash: null,
          created_by_user_id: actorUserId,
        })
        : null
      goldenCaseInserted = goldenCase !== null
      const finishedAt = now().toISOString()
      const conceptPayload = toPayrollJson({
        sourceHash: calculationSnapshot.sourceHash,
        inputHash: inputs.inputHash,
        resultHash: result.resultHash,
      })
      const succeededRun = scenario.recordLifecycleEvent && dependencies.repository.markCalculationRunSucceededWithConcept
        ? await dependencies.repository.markCalculationRunSucceededWithConcept(
          scope,
          payrollAdministrationId,
          currentRun.id,
          payrollPeriod.id,
          snapshot.sourceEmploymentId,
          actorUserId,
          finishedAt,
          result.resultHash,
          conceptPayload,
        )
        : await dependencies.repository.markCalculationRunSucceeded(
          scope,
          payrollAdministrationId,
          currentRun.id,
          actorUserId,
          finishedAt,
          result.resultHash,
        )
      currentRun = succeededRun
      if (scenario.recordLifecycleEvent && !dependencies.repository.markCalculationRunSucceededWithConcept) {
        await scenario.recordLifecycleEvent({
          scope,
          payrollAdministrationId,
          actorUserId,
          payrollPeriodId: payrollPeriod.id,
          sourceEmploymentId: snapshot.sourceEmploymentId,
          calculationRunId: createdRunId,
          revision: 1,
          eventSequence: 1,
          eventType: 'CONCEPT',
          eventPayload: conceptPayload,
        })
      }
      return viewFromArtifacts({
        run: succeededRun,
        inputSet,
        sourceSnapshot: persistedSnapshot,
        payrollPeriod,
        componentResults,
        trace,
        controls,
        goldenCase,
      })
    } catch (error) {
      const code = safeFailureCode(error)
      if (currentRun && (currentRun.status === 'PENDING' || currentRun.status === 'RUNNING')) {
        if (!traceInserted) {
          try {
            await dependencies.repository.insertCalculationTrace(scope, payrollAdministrationId, {
              payroll_administration_id: payrollAdministrationId,
              source_tenant_id: scope.tenantId,
              source_hr_group_id: scope.hrGroupId,
              source_administration_id: scope.administrationId,
              calculation_run_id: currentRun.id,
              trace_payload: { status: code === 'PAYROLL_UNSUPPORTED' ? 'UNSUPPORTED' : 'FAILED', failureCode: code, ...(scenario.caseKey ? { caseKey: scenario.caseKey } : {}), unsupportedReason: code === 'PAYROLL_UNSUPPORTED' && error instanceof PayrollEngineError ? error.code : null },
              created_by_user_id: actorUserId,
            })
          } catch {
            // Keep the run failure visible even if its diagnostic trace cannot be stored.
          }
        }
        if (scenario.caseKey && (scenario.runType ?? 'GOLDEN_CASE') === 'GOLDEN_CASE' && !goldenCaseInserted) {
          try {
            await dependencies.repository.insertGoldenCaseRun(scope, payrollAdministrationId, {
              payroll_administration_id: payrollAdministrationId,
              source_tenant_id: scope.tenantId,
              source_hr_group_id: scope.hrGroupId,
              source_administration_id: scope.administrationId,
              calculation_run_id: currentRun.id,
              case_key: scenario.caseKey,
              expected_result_hash: null,
              created_by_user_id: actorUserId,
            })
            goldenCaseInserted = true
          } catch {
            // Preserve the run status even when the case index cannot be written.
          }
        }
        try {
          await dependencies.repository.markCalculationRunFailed(scope, payrollAdministrationId, currentRun.id, actorUserId, now().toISOString())
          if (inputReferenceInserted && scenario.recordLifecycleEvent) {
            if (!currentPayrollPeriodId || !currentEmploymentId) throw new PayrollCalculationRepositoryError()
            await scenario.recordLifecycleEvent({
              scope,
              payrollAdministrationId,
              actorUserId,
              payrollPeriodId: currentPayrollPeriodId,
              sourceEmploymentId: currentEmploymentId,
              calculationRunId: currentRun.id,
              revision: 1,
              eventSequence: 1,
              eventType: 'BLOCKED',
              eventPayload: toPayrollJson({ failureCode: code, runId: currentRun.id }),
            })
          }
        } catch {
          throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED', currentRun.id)
        }
      }
      if (error instanceof SyntheticPayrollServiceError) {
        throw new SyntheticPayrollServiceError(error.code, currentRun?.id ?? error.runId, error.reasonCode)
      }
      throw new SyntheticPayrollServiceError(code, currentRun?.id ?? null, code === 'PAYROLL_UNSUPPORTED' && error instanceof PayrollEngineError ? error.code : null)
    }
  }

  async function getLatestSyntheticPayroll(
    rawScope: PayrollScope,
    rawPayrollAdministrationId: string,
    runId?: string,
  ): Promise<SyntheticPayrollView | null> {
    if (!dependencies.isEnabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
    const scope = assertServiceScope(rawScope, rawPayrollAdministrationId)
    await requirePayrollAdministration(scope, rawPayrollAdministrationId)
    if (runId === undefined) {
      const artifacts = await dependencies.repository.getLatestSyntheticArtifacts(
        scope,
        rawPayrollAdministrationId,
        scenario.compositionId,
        undefined,
        scenario.caseKey,
        scenario.runType ?? 'GOLDEN_CASE',
      )
      if (!artifacts) return null
      const view = viewFromArtifacts(artifacts)
      return scenario.caseKey === undefined || view.caseKey === scenario.caseKey ? view : null
    }

    const exactArtifacts = await dependencies.repository.getLatestSyntheticArtifacts(
      scope,
      rawPayrollAdministrationId,
      scenario.compositionId,
      runId,
      undefined,
      scenario.runType ?? 'GOLDEN_CASE',
    )
    if (!exactArtifacts) return null
    const exactView = viewFromArtifacts(exactArtifacts)
    return exactView.runId === runId && (scenario.caseKey === undefined || exactView.caseKey === scenario.caseKey) ? exactView : null
  }

  return { runSyntheticPayroll, getLatestSyntheticPayroll }
}

const productionEngine: SyntheticPayrollEngine = {
  buildInputs: (sourceSnapshot, effectiveDate) => buildCalculationInputs(sourceSnapshot, GC_NL_001_RULE_PACKAGE, { effectiveDate }),
  calculate: calculatePayroll,
}

function defaultService() {
  if (!isPayrollLabEnabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  try {
    return createSyntheticPayrollService({
      repository: createPayrollCalculationRepository(),
      engine: productionEngine,
      isEnabled: isPayrollLabEnabled,
    })
  } catch {
    throw new SyntheticPayrollServiceError('PAYROLL_PERSISTENCE_FAILED')
  }
}

export async function runSyntheticPayroll(
  scope: PayrollScope,
  payrollAdministrationId: string,
  actorUserId: string,
): Promise<SyntheticPayrollView> {
  return await defaultService().runSyntheticPayroll(scope, payrollAdministrationId, actorUserId)
}

export async function getLatestSyntheticPayroll(
  scope: PayrollScope,
  payrollAdministrationId: string,
  runId?: string,
): Promise<SyntheticPayrollView | null> {
  return await defaultService().getLatestSyntheticPayroll(scope, payrollAdministrationId, runId)
}

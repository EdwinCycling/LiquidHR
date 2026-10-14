import 'server-only'

import { createHash } from 'node:crypto'
import {
  FixedDecimal,
  PAYROLL_ENGINE_VERSION,
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollCalculationResult,
  type PayrollSourceGap,
  type PayrollSourceProvider,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { NL_2026_RULE_PACKAGE, NL_2026_RULE_REGISTRY } from '@liquid-hr/payroll-rules-nl-2026'
import { requireComponentLibraryAccess } from './component-library-access'
import { createPayrollCalculationRepository, type PayrollCalculationArtifacts, type PayrollCalculationRepository } from './calculation-repository'
import type { PayrollDatabase, PayrollJson, IndividualPayrollLifecycleEventRow } from './database'
import { isPayrollLabEnabled } from './feature-flag'
import {
  isLocalPayrollAcceptanceRuntime,
  isLocalPayrollAcceptanceScope,
  LOCAL_PAYROLL_ACCEPTANCE_PERIOD,
} from './local-payroll-acceptance-runtime'
import {
  createPayrollAcceptanceScenarioSourceProvider,
  isPayrollAcceptanceScenarioReference,
} from './payroll-acceptance-scenario'
import { createPayrun01Repository, type GenericPayrollInputReferenceInput, type Payrun01Repository } from './payrun01-repository'
import { createLiquidHrPayrollSourceProvider } from './source/liquid-hr-source-provider'
import type { PayrollScope } from './scope'

export type EmployeePayrollPeriod = { readonly year: number; readonly month: number }

type Access = {
  readonly scope: PayrollScope
  readonly administration: { readonly id: string; readonly status?: 'ACTIVE' | 'SUSPENDED'; readonly capabilityEnabled?: boolean }
  readonly actorUserId: string
}

type SourceProvider = Pick<PayrollSourceProvider, 'getPayrollSourceSnapshot'>

export interface EmployeePayrollCalculationDependencies {
  readonly requireAccess: (write: boolean) => Promise<Access>
  readonly createCalculationRepository: () => PayrollCalculationRepository
  readonly createLifecycleRepository: () => Payrun01Repository
  readonly sourceProvider: SourceProvider
  readonly enabled: () => boolean
  readonly now?: () => Date
  readonly createId?: () => string
}

export type EmployeePayrollCalculationStatus =
  | 'SOURCE_GAP'
  | 'UNSUPPORTED'
  | 'IN_PROGRESS'
  | 'CALCULATION_FAILED'
  | 'CALCULATED'
  | 'INCOMPLETE'
  | 'CORRECTION_REQUIRED'

export type EmployeePayrollCalculationView = {
  readonly status: EmployeePayrollCalculationStatus
  readonly completeness: 'COMPLETE' | 'INCOMPLETE' | null
  readonly employeeId: string
  readonly employmentId: string
  readonly period: EmployeePayrollPeriod
  readonly runId: string | null
  readonly sourceSnapshotId: string | null
  readonly inputSetId: string | null
  readonly revision: number | null
  readonly businessStatus: 'CONCEPT' | 'REVIEWED' | 'FINALIZED' | null
  readonly sourceHash: string | null
  readonly inputHash: string | null
  readonly resultHash: string | null
  readonly grossAmount: string | null
  readonly wageTaxAmount: string | null
  /** Gross less statutory wage withholding; does not include pension or other deductions. */
  readonly netAfterWageTax: string | null
  readonly gaps: readonly PayrollSourceGap[]
  readonly incompleteComponents: readonly string[]
  readonly recoveryActions: readonly string[]
  readonly previousRunId: string | null
  readonly changedSourceKeys: readonly string[]
  readonly errorCode: string | null
}

export type EmployeePayrollPreflightView = {
  readonly employeeId: string
  readonly employmentId: string
  readonly period: EmployeePayrollPeriod
  readonly eligibleForCalculation: boolean
  readonly gaps: readonly PayrollSourceGap[]
}

export type LocalPayrollAcceptanceReadback = {
  readonly confirmed: boolean
  readonly runId: string
  readonly sourceSnapshotId: string | null
  readonly inputSetId: string | null
  readonly inputReferenceId: string | null
  readonly payrollPeriodId: string | null
  readonly componentResultCount: number
  readonly controlCount: number
  readonly traceId: string | null
  readonly conceptEventId: string | null
  readonly runStatus: string | null
  readonly sourceHash: string | null
  readonly coreSourceHash: string | null
  readonly assumptionsHash: string | null
  readonly inputHash: string | null
  readonly resultHash: string | null
  readonly scenarioCode: string | null
  readonly controls: readonly { readonly key: string; readonly status: string }[]
}

export class EmployeePayrollCalculationError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 409 | 503 = 409) {
    super(code)
    this.name = 'EmployeePayrollCalculationError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REQUIRED_SOURCE_FIELDS = new Set([
  'employment', 'contractualSalary', 'contractualHours', 'contract', 'laborCondition', 'incomeRelationship', 'taxProfile',
])
const INCOMPLETE_COMPONENTS = [
  'PENSION_EMPLOYEE_ALLOCATION',
  'PENSION_EMPLOYER_ALLOCATION',
  'EMPLOYER_SOCIAL_COSTS',
  'HOLIDAY_AND_YEAR_END_RESERVES',
  'CUMULATIVE_WAGE_TAX',
  'VARIABLE_AND_NON_REGULAR_WAGE',
] as const
const COMPLETENESS_CONTRACT = 'PAYCALC-REAL-01B-COMPLETENESS-1'

const defaults: EmployeePayrollCalculationDependencies = {
  requireAccess: async (write) => await requireComponentLibraryAccess(write),
  createCalculationRepository: createPayrollCalculationRepository,
  createLifecycleRepository: createPayrun01Repository,
  sourceProvider: createLiquidHrPayrollSourceProvider(),
  enabled: isPayrollLabEnabled,
}

function assertPeriod(period: EmployeePayrollPeriod): void {
  if (!Number.isInteger(period.year) || period.year < 1900 || period.year > 2200
    || !Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new EmployeePayrollCalculationError('PAYROLL_PERIOD_INVALID', 400)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toPayrollJson(value: unknown): PayrollJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new EmployeePayrollCalculationError('PAYROLL_INPUT_INVALID')
    return value
  }
  if (Array.isArray(value)) return value.map(toPayrollJson)
  if (!isRecord(value)) throw new EmployeePayrollCalculationError('PAYROLL_INPUT_INVALID')
  const out: { [key: string]: PayrollJson | undefined } = {}
  for (const [key, member] of Object.entries(value)) if (member !== undefined) out[key] = toPayrollJson(member)
  return out
}

function record(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function entries(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) return null
  return value as Record<string, unknown>[]
}

function deterministicUuid(name: string): string {
  const namespace = Buffer.from('4c485250415943414c43303100000001', 'hex')
  const digest = createHash('sha1').update(Buffer.concat([namespace, Buffer.from(name, 'utf8')])).digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function periodStart(period: EmployeePayrollPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function recoveryActions(gaps: readonly PayrollSourceGap[], incomplete: readonly string[] = []): string[] {
  const actions = new Set<string>()
  for (const gap of gaps) {
    if (gap.field === 'taxProfile') actions.add('Laat een bevoegde HR Admin de fiscale verklaring voor dit dienstverband en deze IKV vastleggen of actualiseren.')
    else if (gap.field === 'incomeRelationship') actions.add('Herstel de actieve, eenduidige IKV-koppeling en controleer de aangiftestatus.')
    else if (gap.field === 'contract') actions.add('Bevestig een dienstverbandcontract dat de volledige loonperiode dekt.')
    else if (gap.field === 'laborCondition') actions.add('Bevestig de effectieve arbeidsvoorwaarden voor de volledige loonperiode.')
    else if (gap.field === 'contractualSalary') actions.add('Voer een positieve, effectieve vaste maandbeloning in EUR in die de volledige loonperiode dekt.')
    else if (gap.field === 'contractualHours') actions.add('Herstel roosteruren, deeltijdfactor en voltijdsnorm voor de volledige loonperiode.')
    else if (gap.field === 'actualWork') actions.add('Beoordeel en verwerk ontbrekende of niet-ondersteunde variabele uren voordat de salarisperiode wordt afgerond.')
    else if (gap.field === 'sourceSnapshot') actions.add('Lees de actuele Core-bronnen opnieuw en start de conceptberekening opnieuw nadat de bronwijziging is verwerkt.')
  }
  if (incomplete.some((code) => code.startsWith('PENSION_'))) {
    actions.add('Valideer de toepasselijke pensioenregeling en maandallocatie voordat de salarisuitkomst definitief kan worden.')
  }
  if (incomplete.includes('EMPLOYER_SOCIAL_COSTS')) {
    actions.add('Voeg versiegebonden, toepasselijke werkgeverspremies toe voordat de salarisuitkomst definitief kan worden.')
  }
  if (incomplete.includes('HOLIDAY_AND_YEAR_END_RESERVES')) {
    actions.add('Valideer toepasselijke vakantie- en eindejaarsreserveringen voordat de salarisuitkomst definitief kan worden.')
  }
  if (incomplete.includes('CUMULATIVE_WAGE_TAX')) {
    actions.add('Koppel de gecontroleerde cumulatieve loon- en belastingbasis voor definitieve loonheffing.')
  }
  if (incomplete.includes('VARIABLE_AND_NON_REGULAR_WAGE')) {
    actions.add('Beoordeel variabel en niet-regulier loon en verwerk alleen ondersteunde componenten.')
  }
  return [...actions]
}

function validateSupportedRegularMonth(snapshot: PayrollSourceSnapshot): PayrollSourceGap[] {
  const gaps: PayrollSourceGap[] = []
  const source = record(snapshot.canonicalSource)
  const compensation = record(source?.compensation)
  const scheduleSource = record(source?.schedule)
  const contractSource = record(source?.contract)
  const laborSource = record(source?.laborConditions)
  const salaryRows = entries(compensation?.entries)
  const scheduleRows = entries(scheduleSource?.entries)
  const contractRows = entries(contractSource?.entries)
  const laborRows = entries(laborSource?.entries)
  if (!salaryRows || salaryRows.length !== 1) gaps.push({ field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'ONE_EFFECTIVE_MONTHLY_SALARY_REQUIRED' })
  if (!scheduleRows || scheduleRows.length !== 1) gaps.push({ field: 'contractualHours', status: 'UNSUPPORTED', reasonCode: 'ONE_EFFECTIVE_REGULAR_SCHEDULE_REQUIRED' })
  if (!contractRows || contractRows.length !== 1) gaps.push({ field: 'contract', status: 'UNSUPPORTED', reasonCode: 'ONE_EFFECTIVE_CONTRACT_REQUIRED' })
  if (!laborRows || laborRows.length !== 1) gaps.push({ field: 'laborCondition', status: 'UNSUPPORTED', reasonCode: 'ONE_EFFECTIVE_LABOR_CONDITION_REQUIRED' })
  const salary = salaryRows?.[0]
  const schedule = scheduleRows?.[0]
  const contract = contractRows?.[0]
  if (salary) {
    if (salary.paymentType !== 'PERIODIC_FIXED' || salary.paymentFrequency !== 'MONTHLY' || salary.currencyCode !== 'EUR') {
      gaps.push({ field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'ONLY_FIXED_EUR_MONTHLY_WAGE_SUPPORTED' })
    }
    try {
      const fulltime = FixedDecimal.parse(String(salary.fulltimeAmount))
      const parttime = FixedDecimal.parse(String(salary.parttimeAmount))
      if (fulltime.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0 || parttime.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) {
        gaps.push({ field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'POSITIVE_EFFECTIVE_SALARY_REQUIRED' })
      }
      if (!schedule || typeof schedule.partTimeFactor !== 'number') {
        gaps.push({ field: 'contractualHours', status: 'SOURCE_GAP', reasonCode: 'PART_TIME_FACTOR_REQUIRED' })
      } else {
        const factor = FixedDecimal.parse(String(schedule.partTimeFactor))
        const expectedParttime = fulltime.multiply(factor).round(2, 'HALF_UP')
        if (expectedParttime.compare(parttime.round(2, 'HALF_UP')) !== 0) {
          gaps.push({ field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR' })
        }
      }
    } catch {
      gaps.push({ field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'EFFECTIVE_SALARY_DECIMAL_INVALID' })
    }
  }
  if (schedule) {
    const fulltimeHours = Number(schedule.fulltimeHoursPerWeek)
    const averageHours = Number(schedule.averageHoursPerWeek)
    const factor = Number(schedule.partTimeFactor)
    if (schedule.isOnCall !== false || schedule.scheduleType === 'TIMES_PER_DAY'
      || !['HOURS_PER_DAY', 'HOURS_AND_AVG_DAYS', 'HOURS_AND_SPECIFIC_DAYS'].includes(String(schedule.scheduleType))
      || !Number.isFinite(fulltimeHours) || !Number.isFinite(averageHours) || !Number.isFinite(factor)
      || fulltimeHours <= 0 || averageHours <= 0 || factor <= 0 || factor > 1) {
      gaps.push({ field: 'contractualHours', status: 'UNSUPPORTED', reasonCode: 'REGULAR_NON_ON_CALL_HOURS_SCHEDULE_REQUIRED' })
    } else {
      try {
        const expectedHours = FixedDecimal.parse(String(fulltimeHours)).multiply(FixedDecimal.parse(String(factor))).round(4, 'HALF_UP')
        if (expectedHours.compare(FixedDecimal.parse(String(averageHours)).round(4, 'HALF_UP')) !== 0) {
          gaps.push({ field: 'contractualHours', status: 'UNSUPPORTED', reasonCode: 'SCHEDULE_HOURS_DO_NOT_RECONCILE_TO_PART_TIME_FACTOR' })
        }
        if (contract && FixedDecimal.parse(String(contract.fulltimeHoursPerWeek)).compare(FixedDecimal.parse(String(fulltimeHours))) !== 0) {
          gaps.push({ field: 'contractualHours', status: 'UNSUPPORTED', reasonCode: 'SCHEDULE_FULLTIME_HOURS_CONFLICT_WITH_CONTRACT' })
        }
      } catch {
        gaps.push({ field: 'contractualHours', status: 'UNSUPPORTED', reasonCode: 'SCHEDULE_DECIMAL_INVALID' })
      }
    }
  }
  const wage = record(source?.regularWage)
  if (!wage || wage.fiscalYear !== String(snapshot.periodReference.year) || typeof wage.grossAmount !== 'string') {
    gaps.push({ field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'SUPPORTED_REGULAR_WAGE_INPUT_UNAVAILABLE' })
  }
  const fiscalProfile = record(source?.fiscalProfile)
  if (fiscalProfile?.status !== 'CONFIRMED' || typeof fiscalProfile.id !== 'string'
    || typeof fiscalProfile.versionNumber !== 'number') {
    gaps.push({ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'VALIDATED_FISCAL_PROFILE_REQUIRED' })
  } else if (fiscalProfile.incomeRelationshipId !== snapshot.sourceIncomeRelationshipId) {
    gaps.push({ field: 'taxProfile', status: 'UNSUPPORTED', reasonCode: 'FISCAL_PROFILE_IKV_SOURCE_MISMATCH' })
  }
  const income = record(source?.incomeRelationship)
  if (typeof income?.id !== 'string' || typeof income.employmentIncomeRelationshipId !== 'string') {
    gaps.push({ field: 'incomeRelationship', status: 'SOURCE_GAP', reasonCode: 'VALIDATED_IKV_LINK_REQUIRED' })
  } else if (income.id !== snapshot.sourceIncomeRelationshipId) {
    gaps.push({ field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'INCOME_RELATIONSHIP_SOURCE_MISMATCH' })
  }
  return gaps
}

function isBlockingGap(gap: PayrollSourceGap): boolean {
  return REQUIRED_SOURCE_FIELDS.has(gap.field)
}

function lifecycleStatus(events: readonly IndividualPayrollLifecycleEventRow[]): IndividualPayrollLifecycleEventRow | null {
  return [...events].sort((left, right) => right.revision - left.revision
    || right.event_sequence - left.event_sequence
    || right.created_at.localeCompare(left.created_at))[0] ?? null
}

function eventText(event: IndividualPayrollLifecycleEventRow | null, key: string): string | null {
  const payload = record(event?.event_payload)
  return typeof payload?.[key] === 'string' ? payload[key] as string : null
}

function eventStringArray(event: IndividualPayrollLifecycleEventRow | null, key: string): string[] {
  const payload = record(event?.event_payload)
  const value = payload?.[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function persistedSourceGaps(artifacts: PayrollCalculationArtifacts): PayrollSourceGap[] {
  const payload = record(artifacts.sourceSnapshot.source_payload)
  const values = payload?.sourceGaps
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    const gap = record(value)
    return typeof gap?.field === 'string'
      && (gap.status === 'SOURCE_GAP' || gap.status === 'UNSUPPORTED')
      && typeof gap.reasonCode === 'string'
      ? [{ field: gap.field, status: gap.status, reasonCode: gap.reasonCode }]
      : []
  })
}

function sourceColumns(scope: PayrollScope, payrollAdministrationId: string) {
  return {
    payroll_administration_id: payrollAdministrationId,
    source_tenant_id: scope.tenantId,
    source_hr_group_id: scope.hrGroupId,
    source_administration_id: scope.administrationId,
  }
}

function resultAmount(result: PayrollCalculationResult, key: string): string | null {
  const row = result.resultRows.find((candidate) => candidate.key === key)
  return row && typeof row.value === 'string' ? row.value : null
}

function resultView(input: {
  readonly status: EmployeePayrollCalculationStatus
  readonly employeeId: string
  readonly employmentId: string
  readonly period: EmployeePayrollPeriod
  readonly runId: string | null
  readonly sourceSnapshotId: string | null
  readonly inputSetId: string | null
  readonly revision: number | null
  readonly businessStatus: EmployeePayrollCalculationView['businessStatus']
  readonly sourceHash: string | null
  readonly inputHash: string | null
  readonly resultHash: string | null
  readonly grossAmount: string | null
  readonly wageTaxAmount: string | null
  readonly netAfterWageTax: string | null
  readonly gaps?: readonly PayrollSourceGap[]
  readonly incompleteComponents?: readonly string[]
  readonly previousRunId?: string | null
  readonly changedSourceKeys?: readonly string[]
  readonly errorCode?: string | null
}): EmployeePayrollCalculationView {
  const gaps = input.gaps ?? []
  return {
    ...input,
    completeness: input.status === 'CALCULATED' ? 'COMPLETE' : input.status === 'INCOMPLETE' ? 'INCOMPLETE' : null,
    gaps,
    incompleteComponents: input.incompleteComponents ?? [],
    recoveryActions: recoveryActions(gaps, input.incompleteComponents ?? []),
    previousRunId: input.previousRunId ?? null,
    changedSourceKeys: input.changedSourceKeys ?? [],
    errorCode: input.errorCode ?? null,
  }
}

function viewFromArtifacts(
  artifacts: PayrollCalculationArtifacts,
  events: readonly IndividualPayrollLifecycleEventRow[],
  incompletes: readonly string[] = INCOMPLETE_COMPONENTS,
): EmployeePayrollCalculationView {
  const latest = lifecycleStatus(events)
  const amountFor = (key: string) => {
    const row = artifacts.componentResults.find((candidate) => candidate.component_key === key)
    const payload = record(row?.result_payload)
    return typeof payload?.amount === 'string' ? payload.amount : null
  }
  const event = events.find((candidate) => candidate.calculation_run_id === artifacts.run.id && candidate.event_type !== 'BLOCKED')
  const hasIncomplete = incompletes.length > 0
  return resultView({
    status: artifacts.run.status === 'SUCCEEDED' ? (hasIncomplete ? 'INCOMPLETE' : 'CALCULATED') : 'CALCULATION_FAILED',
    employeeId: artifacts.sourceSnapshot.source_employee_id,
    employmentId: artifacts.sourceSnapshot.source_employment_id,
    period: { year: artifacts.payrollPeriod.period_year, month: artifacts.payrollPeriod.period_month },
    runId: artifacts.run.id,
    sourceSnapshotId: artifacts.sourceSnapshot.id,
    inputSetId: artifacts.inputSet.id,
    revision: event?.revision ?? null,
    businessStatus: latest?.calculation_run_id === artifacts.run.id && latest.event_type !== 'BLOCKED' ? latest.event_type : null,
    sourceHash: artifacts.sourceSnapshot.source_hash,
    inputHash: artifacts.inputSet.input_hash,
    resultHash: artifacts.run.result_hash,
    grossAmount: amountFor('gross_salary'),
    wageTaxAmount: amountFor('wage_tax'),
    netAfterWageTax: amountFor('net_salary'),
    incompleteComponents: incompletes,
    gaps: persistedSourceGaps(artifacts),
    previousRunId: eventText(event ?? null, 'previousRunId'),
    changedSourceKeys: eventStringArray(event ?? null, 'changedSourceKeys'),
    errorCode: artifacts.run.status === 'FAILED' ? 'CALCULATION_RUN_FAILED' : null,
  })
}

function resultPayload(result: PayrollCalculationResult, inputs: ReturnType<typeof buildCalculationInputs>, row: PayrollCalculationResult['resultRows'][number]): PayrollJson {
  const componentResult = result.componentResults.find((candidate) => candidate.componentCode === row.componentCode)
  const definition = inputs.components.find((candidate) => candidate.code === row.componentCode)
  const output = definition?.outputs.find((candidate) => candidate.name === row.outputName)
  return toPayrollJson({
    key: row.key,
    amount: row.valueType === 'MONEY' || row.valueType === 'DECIMAL' || row.valueType === 'PERCENTAGE'
      ? (typeof row.value === 'string' ? row.value : null)
      : null,
    value: row.value,
    valueType: row.valueType,
    componentCode: row.componentCode,
    outputName: row.outputName,
    component: componentResult ? {
      id: componentResult.componentId,
      code: componentResult.componentCode,
      version: componentResult.version,
      processingScope: componentResult.processingScope,
      ownership: definition?.ownership ?? null,
      effectiveFrom: definition?.effectiveFrom ?? null,
      effectiveTo: definition?.effectiveTo ?? null,
      rounding: output?.rounding ?? null,
    } : null,
  })
}

function persistedControlStatus(status: PayrollCalculationResult['controls'][number]['status']): 'PASS' | 'WARN' | 'FAIL' {
  return status === 'PASS' ? 'PASS' : status === 'WARNING' ? 'WARN' : 'FAIL'
}

function controlRows(scope: PayrollScope, adminId: string, actorUserId: string, runId: string, result: PayrollCalculationResult) {
  const base = result.controls.map((control) => ({
    ...sourceColumns(scope, adminId),
    calculation_run_id: runId,
    control_key: control.code,
    status: persistedControlStatus(control.status),
    detail_payload: toPayrollJson(control),
    created_by_user_id: actorUserId,
    updated_by_user_id: actorUserId,
  }))
  const incomplete = INCOMPLETE_COMPONENTS.map((code) => ({
    ...sourceColumns(scope, adminId),
    calculation_run_id: runId,
    control_key: `PAYCALC-CTRL-INCOMPLETE-${code}`,
    status: 'WARN' as const,
    detail_payload: toPayrollJson({ status: 'INCOMPLETE', reason: `${code}_NOT_IN_BASE_RULE_PACKAGE` }),
    created_by_user_id: actorUserId,
    updated_by_user_id: actorUserId,
  }))
  return [...base, ...incomplete]
}

function tracePayload(result: PayrollCalculationResult, inputs: ReturnType<typeof buildCalculationInputs>): PayrollJson {
  return toPayrollJson({
    schemaVersion: COMPLETENESS_CONTRACT,
    status: result.status,
    resultHash: result.resultHash,
    sourceHash: result.sourceHash,
    inputHash: result.inputHash,
    engineVersion: result.engineVersion,
    rulePackageCompositionId: result.rulePackageCompositionId,
    rulePackageCompositionHash: result.rulePackageCompositionHash,
    effectiveDate: result.effectiveDate,
    packageMetadata: inputs.packageMetadata ?? null,
    roundingDefinitions: inputs.roundingDefinitions ?? [],
    definitions: inputs.components.map((component) => ({
      id: component.id, code: component.code, version: component.version,
      ownership: component.ownership, processingScope: component.processingScope,
      effectiveFrom: component.effectiveFrom, effectiveTo: component.effectiveTo,
      outputs: component.outputs,
    })),
    steps: result.trace,
    components: result.componentResults,
    incompleteComponents: INCOMPLETE_COMPONENTS,
  })
}

function artifactAmounts(artifacts: PayrollCalculationArtifacts): Pick<EmployeePayrollCalculationView, 'grossAmount' | 'wageTaxAmount' | 'netAfterWageTax'> {
  const amount = (key: string) => {
    const result = artifacts.componentResults.find((row) => row.component_key === key)
    const payload = record(result?.result_payload)
    return typeof payload?.amount === 'string' ? payload.amount : null
  }
  return { grossAmount: amount('gross_salary'), wageTaxAmount: amount('wage_tax'), netAfterWageTax: amount('net_salary') }
}

function latestEventSourceHash(event: IndividualPayrollLifecycleEventRow | null): string | null {
  return eventText(event, 'sourceHash') ?? eventText(event, 'sourceSnapshotHash')
}

function assertOpaqueId(value: string): void {
  if (!UUID.test(value)) throw new EmployeePayrollCalculationError('PAYROLL_INPUT_INVALID', 400)
}

function sameValidatedCoreSource(
  original: PayrollSourceSnapshot,
  current: PayrollSourceSnapshot,
  scope: PayrollScope,
  employeeId: string,
  employmentId: string,
): boolean {
  return current.sourceEmployeeId === employeeId
    && current.sourceEmploymentId === employmentId
    && current.sourceTenantId === scope.tenantId
    && current.sourceHrGroupId === scope.hrGroupId
    && current.sourceAdministrationId === scope.administrationId
    && current.sourceIncomeRelationshipId === original.sourceIncomeRelationshipId
    && current.sourceHash === original.sourceHash
    && stableSerialize(current.canonicalSource) === stableSerialize(original.canonicalSource)
    && stableSerialize(current.sourceVersionVector) === stableSerialize(original.sourceVersionVector)
    && stableSerialize(current.sourceGaps) === stableSerialize(original.sourceGaps)
}

async function revalidateCoreSource(
  sourceProvider: SourceProvider,
  original: PayrollSourceSnapshot,
  scope: PayrollScope,
  employeeId: string,
  employmentId: string,
  period: EmployeePayrollPeriod,
): Promise<{ readonly source: PayrollSourceSnapshot } | { readonly reasonCode: string }> {
  let current: PayrollSourceSnapshot
  try {
    current = await sourceProvider.getPayrollSourceSnapshot({ ...scope, employeeId, employmentId, payrollPeriod: period })
  } catch (error) {
    if (record(error)?.status === 403) throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
    return { reasonCode: 'CORE_SOURCE_REVALIDATION_FAILED' }
  }
  if (current.sourceEmployeeId !== employeeId || current.sourceEmploymentId !== employmentId
    || current.sourceTenantId !== scope.tenantId || current.sourceHrGroupId !== scope.hrGroupId
    || current.sourceAdministrationId !== scope.administrationId) {
    throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
  }
  return sameValidatedCoreSource(original, current, scope, employeeId, employmentId)
    ? { source: current }
    : { reasonCode: 'CORE_SOURCE_CHANGED_BEFORE_SAVE' }
}

function sourceGapsResult(snapshot: PayrollSourceSnapshot, gaps: readonly PayrollSourceGap[], employeeId: string, employmentId: string, period: EmployeePayrollPeriod): EmployeePayrollCalculationView {
  const blocking = gaps.filter(isBlockingGap)
  const status = blocking.some((gap) => gap.status === 'UNSUPPORTED') ? 'UNSUPPORTED' : 'SOURCE_GAP'
  return resultView({
    status,
    employeeId,
    employmentId,
    period,
    runId: null,
    sourceSnapshotId: snapshot.id,
    inputSetId: null,
    revision: null,
    businessStatus: null,
    sourceHash: snapshot.sourceHash,
    inputHash: null,
    resultHash: null,
    grossAmount: null,
    wageTaxAmount: null,
    netAfterWageTax: null,
    gaps,
  })
}

export function createEmployeePayrollCalculationService(dependencies: EmployeePayrollCalculationDependencies = defaults) {
  async function inspectEmployeePayrollSource(input: {
    readonly employeeId: string
    readonly employmentId: string
    readonly period: EmployeePayrollPeriod
  }): Promise<EmployeePayrollPreflightView> {
    assertPeriod(input.period)
    assertOpaqueId(input.employeeId)
    assertOpaqueId(input.employmentId)
    if (!dependencies.enabled()) throw new EmployeePayrollCalculationError('PAYROLL_SERVICE_UNAVAILABLE', 503)
    const access = await dependencies.requireAccess(false)
    const { scope, administration } = access
    const periodRow = await dependencies.createCalculationRepository().getPayrollPeriod(
      scope,
      administration.id,
      input.period.year,
      input.period.month,
    )
    if (!periodRow) throw new EmployeePayrollCalculationError('PAYROLL_CYCLE_NOT_FOUND', 404)
    if (periodRow.status !== 'OPEN') throw new EmployeePayrollCalculationError('PAYROLL_CYCLE_NOT_OPEN')

    const snapshot = await dependencies.sourceProvider.getPayrollSourceSnapshot({
      ...scope,
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      payrollPeriod: input.period,
    })
    if (snapshot.sourceEmployeeId !== input.employeeId || snapshot.sourceEmploymentId !== input.employmentId
      || snapshot.sourceTenantId !== scope.tenantId || snapshot.sourceHrGroupId !== scope.hrGroupId
      || snapshot.sourceAdministrationId !== scope.administrationId) {
      throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
    }
    const gaps = [...snapshot.sourceGaps, ...validateSupportedRegularMonth(snapshot)]
    return {
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      period: input.period,
      eligibleForCalculation: !gaps.some(isBlockingGap),
      gaps,
    }
  }

  async function calculateEmployeePayroll(input: {
    readonly employeeId: string
    readonly employmentId: string
    readonly period: EmployeePayrollPeriod
  }): Promise<EmployeePayrollCalculationView> {
    assertPeriod(input.period)
    assertOpaqueId(input.employeeId)
    assertOpaqueId(input.employmentId)
    if (!dependencies.enabled()) throw new EmployeePayrollCalculationError('PAYROLL_SERVICE_UNAVAILABLE', 503)
    const access = await dependencies.requireAccess(true)
    const scope = access.scope
    const administrationId = access.administration.id
    const calculations = dependencies.createCalculationRepository()
    const periodRow = await calculations.getPayrollPeriod(scope, administrationId, input.period.year, input.period.month)
    if (!periodRow) throw new EmployeePayrollCalculationError('PAYROLL_CYCLE_NOT_FOUND', 404)
    if (periodRow.status === 'DRAFT') throw new EmployeePayrollCalculationError('PAYROLL_CYCLE_NOT_OPEN')
    const snapshot = await dependencies.sourceProvider.getPayrollSourceSnapshot({
      ...scope,
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      payrollPeriod: input.period,
    })
    if (snapshot.sourceEmployeeId !== input.employeeId || snapshot.sourceEmploymentId !== input.employmentId
      || snapshot.sourceTenantId !== scope.tenantId || snapshot.sourceHrGroupId !== scope.hrGroupId
      || snapshot.sourceAdministrationId !== scope.administrationId) {
      throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
    }
    const lifecycle = dependencies.createLifecycleRepository()
    let events = await lifecycle.listLifecycleEvents(scope, administrationId, periodRow.id, input.employmentId)
    const canonicalSource = record(snapshot.canonicalSource)
    const acceptanceScenario = record(canonicalSource?.testScenario)?.sourceClassification === 'PAYROLL_TEST_SCENARIO'
    if (!acceptanceScenario) {
      const scenarioRunIds = new Set<string>()
      for (const runId of new Set(events.map((event) => event.calculation_run_id))) {
        const artifacts = await calculations.getLatestSyntheticArtifacts(
          scope, administrationId, undefined, runId, undefined, 'INDIVIDUAL_PAYROLL', input.period,
        )
        if (!artifacts) continue
        const reference = await lifecycle.getGenericInputReference(scope, administrationId, artifacts.inputSet.id)
        if (isPayrollAcceptanceScenarioReference(reference?.input_reference_json)) scenarioRunIds.add(runId)
      }
      events = events.filter((event) => !scenarioRunIds.has(event.calculation_run_id))
    }
    const latest = lifecycleStatus(events)
    if (latest?.event_type === 'FINALIZED') {
      const previous = await calculations.getLatestSyntheticArtifacts(scope, administrationId, undefined,
        latest.calculation_run_id, undefined, 'INDIVIDUAL_PAYROLL', input.period)
      if (previous && (latestEventSourceHash(latest) ?? previous.sourceSnapshot.source_hash) === snapshot.sourceHash) {
        return viewFromArtifacts(previous, events)
      }
      return resultView({
        status: 'CORRECTION_REQUIRED',
        employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: latest.calculation_run_id, sourceSnapshotId: previous?.sourceSnapshot.id ?? null,
        inputSetId: previous?.inputSet.id ?? null, revision: latest.revision, businessStatus: 'FINALIZED',
        sourceHash: snapshot.sourceHash, inputHash: previous?.inputSet.input_hash ?? null,
        resultHash: previous?.run.result_hash ?? null,
        ...previous ? artifactAmounts(previous) : { grossAmount: null, wageTaxAmount: null, netAfterWageTax: null },
        gaps: [], incompleteComponents: INCOMPLETE_COMPONENTS,
        errorCode: 'PAYRUN01_SUCCESSOR_REQUIRES_FINALIZED_PREDECESSOR',
      })
    }
    if (periodRow.status !== 'OPEN') throw new EmployeePayrollCalculationError('PAYROLL_CYCLE_NOT_OPEN')
    const yearSupported = input.period.year === 2026
      && NL_2026_RULE_PACKAGE.metadata?.packageId === 'NL-PAYROLL-2026'
      && NL_2026_RULE_PACKAGE.metadata.version === '2026.1'
    if (!yearSupported) {
      return resultView({
        status: 'UNSUPPORTED', employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: null, sourceSnapshotId: snapshot.id, inputSetId: null, revision: null, businessStatus: null,
        sourceHash: snapshot.sourceHash, inputHash: null, resultHash: null,
        grossAmount: null, wageTaxAmount: null, netAfterWageTax: null,
        gaps: [{ field: 'rulePackage', status: 'UNSUPPORTED', reasonCode: 'NL_2026_BASE_PACKAGE_ONLY_EFFECTIVE_IN_2026' }],
      })
    }

    const sourcePayload = toPayrollJson({
      ...(canonicalSource ?? {}),
      sourceGaps: snapshot.sourceGaps,
    })
    const sourceRow = {
      id: deterministicUuid(`source:${scope.tenantId}:${scope.hrGroupId}:${scope.administrationId}:${administrationId}:${input.employeeId}:${input.employmentId}:${input.period.year}-${input.period.month}:${snapshot.sourceHash}`),
      ...sourceColumns(scope, administrationId),
      source_employee_id: snapshot.sourceEmployeeId,
      source_employment_id: snapshot.sourceEmploymentId,
      source_income_relationship_id: snapshot.sourceIncomeRelationshipId,
      period_reference: periodStart(input.period),
      source_payload: sourcePayload,
      source_version_vector: toPayrollJson(snapshot.sourceVersionVector),
      source_hash: snapshot.sourceHash,
      created_by_user_id: access.actorUserId,
    } satisfies PayrollDatabase['public']['Tables']['source_snapshots']['Insert']
    if (!calculations.getOrCreateSourceSnapshot) throw new EmployeePayrollCalculationError('PAYROLL_IDEMPOTENT_REPOSITORY_REQUIRED', 503)
    const persistedSnapshot = await calculations.getOrCreateSourceSnapshot(scope, administrationId, sourceRow)
    const storedSourceSnapshot = { ...snapshot, id: persistedSnapshot.id }
    const gaps = [...snapshot.sourceGaps, ...validateSupportedRegularMonth(snapshot)]
    if (gaps.some(isBlockingGap)) return sourceGapsResult(storedSourceSnapshot, gaps, input.employeeId, input.employmentId, input.period)

    const calculationSnapshot = { ...snapshot, id: persistedSnapshot.id }
    const inputs = buildCalculationInputs(calculationSnapshot, NL_2026_RULE_PACKAGE, {
      effectiveDate: periodStart(input.period),
      scopeInstanceIds: {
        EMPLOYEE: input.employeeId,
        EMPLOYMENT: input.employmentId,
        INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
      },
    })
    if (inputs.engineVersion !== PAYROLL_ENGINE_VERSION || inputs.rulePackageCompositionId !== NL_2026_RULE_PACKAGE.compositionId) {
      throw new EmployeePayrollCalculationError('PAYROLL_RULE_PACKAGE_UNSUPPORTED')
    }
    const source = record(snapshot.canonicalSource)
    const fiscalProfile = record(source?.fiscalProfile)
    const income = record(source?.incomeRelationship)
    const testScenario = record(source?.testScenario)
    const taxProfileId = typeof fiscalProfile?.id === 'string' ? fiscalProfile.id : null
    const taxProfileVersion = typeof fiscalProfile?.versionNumber === 'number' ? fiscalProfile.versionNumber : null
    const linkedIncomeRelationshipId = typeof income?.employmentIncomeRelationshipId === 'string' ? income.employmentIncomeRelationshipId : null
    const sourceIncomeRelationshipId = snapshot.sourceIncomeRelationshipId
    if (!taxProfileId || taxProfileVersion === null || !linkedIncomeRelationshipId || !sourceIncomeRelationshipId) {
      return sourceGapsResult(storedSourceSnapshot, [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'GENERIC_INPUT_REFERENCE_SOURCE_REQUIRED' }], input.employeeId, input.employmentId, input.period)
    }
    if (!calculations.getOrCreateCalculationInputSet || !calculations.getOrCreateCalculationRun) {
      throw new EmployeePayrollCalculationError('PAYROLL_IDEMPOTENT_REPOSITORY_REQUIRED', 503)
    }
    const sourceValidation = await revalidateCoreSource(
      dependencies.sourceProvider, snapshot, scope, input.employeeId, input.employmentId, input.period,
    )
    if (!('source' in sourceValidation)) {
      return resultView({
        status: 'SOURCE_GAP', employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: null, sourceSnapshotId: persistedSnapshot.id, inputSetId: null, revision: null, businessStatus: null,
        sourceHash: snapshot.sourceHash, inputHash: null, resultHash: null,
        grossAmount: null, wageTaxAmount: null, netAfterWageTax: null,
        gaps: [{ field: 'sourceSnapshot', status: 'SOURCE_GAP', reasonCode: sourceValidation.reasonCode }],
      })
    }
    const revalidatedSource = sourceValidation.source
    const inputSetRow = {
      id: deterministicUuid(`input:${scope.tenantId}:${scope.hrGroupId}:${scope.administrationId}:${administrationId}:${persistedSnapshot.id}:${periodRow.id}:${inputs.rulePackageCompositionId}:${inputs.engineVersion}:${inputs.inputHash}`),
      ...sourceColumns(scope, administrationId),
      source_snapshot_id: persistedSnapshot.id,
      payroll_period_id: periodRow.id,
      rule_package_composition_id: inputs.rulePackageCompositionId,
      engine_version: inputs.engineVersion,
      input_hash: inputs.inputHash,
      created_by_user_id: access.actorUserId,
    } satisfies PayrollDatabase['public']['Tables']['calculation_input_sets']['Insert']
    const inputSet = await calculations.getOrCreateCalculationInputSet(scope, administrationId, inputSetRow)
    const predecessorRunId = latest?.calculation_run_id ?? null
    const predecessorRevision = latest?.revision ?? 0
    const inputReference: GenericPayrollInputReferenceInput = {
      ...sourceColumns(scope, administrationId),
      calculation_input_set_id: inputSet.id,
      source_employee_id: input.employeeId,
      source_employment_id: input.employmentId,
      source_income_relationship_id: sourceIncomeRelationshipId,
      employment_income_relationship_id: linkedIncomeRelationshipId,
      tax_profile_id: taxProfileId,
      tax_profile_version: taxProfileVersion,
      core_source_contract_version: 'payroll-source-v4',
      core_validated_at: revalidatedSource.createdAt,
      source_version_vector: toPayrollJson(snapshot.sourceVersionVector),
      source_hash: snapshot.sourceHash,
      input_hash: inputs.inputHash,
      input_reference_json: toPayrollJson({
        schemaVersion: COMPLETENESS_CONTRACT,
        sourceHash: snapshot.sourceHash,
        inputHash: inputs.inputHash,
        taxProfileId,
        taxProfileVersion,
        coreSourceContractVersion: 'payroll-source-v4',
        sourceVersionVector: snapshot.sourceVersionVector,
        employmentIncomeRelationshipId: linkedIncomeRelationshipId,
        incompleteComponents: INCOMPLETE_COMPONENTS,
        netAmountMeaning: 'GROSS_MINUS_WAGE_TAX_BEFORE_PENSION_AND_OTHER_DEDUCTIONS',
        ...(testScenario ? { sourceClassification: 'PAYROLL_TEST_SCENARIO', testScenario } : {}),
      }),
      created_by_user_id: access.actorUserId,
    }
    await lifecycle.getOrCreateGenericInputReference(scope, administrationId, inputReference)

    const existingArtifacts = latest && latestEventSourceHash(latest) === snapshot.sourceHash
      ? await calculations.getLatestSyntheticArtifacts(scope, administrationId, inputs.rulePackageCompositionId,
        latest.calculation_run_id, undefined, 'INDIVIDUAL_PAYROLL', input.period)
      : null
    if (existingArtifacts?.inputSet.input_hash === inputs.inputHash) return viewFromArtifacts(existingArtifacts, events)

    const runId = deterministicUuid(`run:${scope.tenantId}:${scope.hrGroupId}:${scope.administrationId}:${administrationId}:${inputSet.id}:${predecessorRevision}:${predecessorRunId ?? 'ROOT'}`)
    const runRow = {
      id: runId,
      ...sourceColumns(scope, administrationId),
      calculation_input_set_id: inputSet.id,
      run_type: 'INDIVIDUAL_PAYROLL' as const,
      status: 'PENDING' as const,
      started_at: null,
      finished_at: null,
      result_hash: null,
      created_by_user_id: access.actorUserId,
      updated_by_user_id: access.actorUserId,
    } satisfies PayrollDatabase['public']['Tables']['calculation_runs']['Insert']
    const { run, created } = await calculations.getOrCreateCalculationRun(scope, administrationId, runRow)
    if (!created) {
      if (run.status === 'SUCCEEDED') {
        const completed = await calculations.getLatestSyntheticArtifacts(scope, administrationId, inputs.rulePackageCompositionId,
          run.id, undefined, 'INDIVIDUAL_PAYROLL', input.period)
        if (completed) return viewFromArtifacts(completed, events)
      }
      return resultView({
        status: run.status === 'FAILED' ? 'CALCULATION_FAILED' : 'IN_PROGRESS',
        employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: run.id, sourceSnapshotId: persistedSnapshot.id, inputSetId: inputSet.id,
        revision: null, businessStatus: null, sourceHash: snapshot.sourceHash, inputHash: inputs.inputHash,
        resultHash: run.result_hash, grossAmount: null, wageTaxAmount: null, netAfterWageTax: null,
        incompleteComponents: INCOMPLETE_COMPONENTS,
        errorCode: run.status === 'FAILED' ? 'CALCULATION_RUN_FAILED' : null,
      })
    }

    const now = (dependencies.now ?? (() => new Date()))().toISOString()
    await calculations.markCalculationRunRunning(scope, administrationId, run.id, access.actorUserId, now)
    let result: PayrollCalculationResult
    try {
      result = calculatePayroll(inputs, NL_2026_RULE_REGISTRY)
    } catch {
      await calculations.markCalculationRunFailed(scope, administrationId, run.id, access.actorUserId,
        (dependencies.now ?? (() => new Date()))().toISOString())
      return resultView({
        status: 'CALCULATION_FAILED', employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: run.id, sourceSnapshotId: persistedSnapshot.id, inputSetId: inputSet.id,
        revision: null, businessStatus: null, sourceHash: snapshot.sourceHash, inputHash: inputs.inputHash,
        resultHash: null, grossAmount: null, wageTaxAmount: null, netAfterWageTax: null,
        incompleteComponents: INCOMPLETE_COMPONENTS, errorCode: 'PAYROLL_ENGINE_EXECUTION_FAILED',
      })
    }
    if (result.status !== 'CALCULATED' || result.sourceHash !== snapshot.sourceHash || result.inputHash !== inputs.inputHash) {
      await calculations.markCalculationRunFailed(scope, administrationId, run.id, access.actorUserId,
        (dependencies.now ?? (() => new Date()))().toISOString())
      return resultView({
        status: 'CALCULATION_FAILED', employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: run.id, sourceSnapshotId: persistedSnapshot.id, inputSetId: inputSet.id,
        revision: null, businessStatus: null, sourceHash: snapshot.sourceHash, inputHash: inputs.inputHash,
        resultHash: null, grossAmount: null, wageTaxAmount: null, netAfterWageTax: null,
        incompleteComponents: INCOMPLETE_COMPONENTS, errorCode: 'PAYROLL_ENGINE_RESULT_INVALID',
      })
    }
    let finalSourceValidation: Awaited<ReturnType<typeof revalidateCoreSource>>
    try {
      finalSourceValidation = await revalidateCoreSource(
        dependencies.sourceProvider, snapshot, scope, input.employeeId, input.employmentId, input.period,
      )
    } catch (error) {
      await calculations.markCalculationRunFailed(scope, administrationId, run.id, access.actorUserId,
        (dependencies.now ?? (() => new Date()))().toISOString())
      throw error
    }
    if (!('source' in finalSourceValidation)) {
      await calculations.markCalculationRunFailed(scope, administrationId, run.id, access.actorUserId,
        (dependencies.now ?? (() => new Date()))().toISOString())
      return resultView({
        status: 'SOURCE_GAP', employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
        runId: run.id, sourceSnapshotId: persistedSnapshot.id, inputSetId: inputSet.id,
        revision: null, businessStatus: null, sourceHash: snapshot.sourceHash, inputHash: inputs.inputHash,
        resultHash: null, grossAmount: null, wageTaxAmount: null, netAfterWageTax: null,
        gaps: [{ field: 'sourceSnapshot', status: 'SOURCE_GAP', reasonCode: finalSourceValidation.reasonCode }],
      })
    }
    const componentRows = result.resultRows.map((row) => ({
      ...sourceColumns(scope, administrationId),
      calculation_run_id: run.id,
      component_key: row.key,
      amount: row.valueType === 'MONEY' || row.valueType === 'DECIMAL' || row.valueType === 'PERCENTAGE'
        ? (typeof row.value === 'string' ? row.value : null)
        : null,
      result_payload: resultPayload(result, inputs, row),
      created_by_user_id: access.actorUserId,
      updated_by_user_id: access.actorUserId,
    })) satisfies readonly PayrollDatabase['public']['Tables']['component_results']['Insert'][]
    await calculations.insertComponentResults(scope, administrationId, componentRows)
    await calculations.insertPayrollControls(scope, administrationId, controlRows(scope, administrationId, access.actorUserId, run.id, result))
    await calculations.insertCalculationTrace(scope, administrationId, {
      ...sourceColumns(scope, administrationId),
      calculation_run_id: run.id,
      trace_payload: tracePayload(result, inputs),
      created_by_user_id: access.actorUserId,
    })
    const resultHash = sha256(stableSerialize({
      ruleResultHash: result.resultHash,
      completenessContract: COMPLETENESS_CONTRACT,
      incompleteComponents: INCOMPLETE_COMPONENTS,
      sourceGaps: gaps,
    }))
    const sourceVersions = record(snapshot.sourceVersionVector) ?? {}
    const previousArtifacts = predecessorRunId
      ? await calculations.getLatestSyntheticArtifacts(scope, administrationId, undefined, predecessorRunId,
        undefined, 'INDIVIDUAL_PAYROLL', input.period)
      : null
    const previousVersions = record(previousArtifacts?.sourceSnapshot.source_version_vector) ?? {}
    const versionKeys = new Set([...Object.keys(previousVersions), ...Object.keys(sourceVersions)])
    const changedSourceKeys = [...versionKeys].filter((key) => previousVersions[key] !== sourceVersions[key]).sort()
    await calculations.markCalculationRunSucceededWithConcept!(
      scope, administrationId, run.id, periodRow.id, input.employmentId, access.actorUserId,
      (dependencies.now ?? (() => new Date()))().toISOString(), resultHash,
      toPayrollJson({
        schemaVersion: COMPLETENESS_CONTRACT,
        sourceHash: snapshot.sourceHash,
        inputHash: inputs.inputHash,
        rulePackageCompositionId: inputs.rulePackageCompositionId,
        engineVersion: inputs.engineVersion,
        resultHash,
        ruleResultHash: result.resultHash,
        previousRunId: predecessorRunId,
        changedSourceKeys,
        incompleteComponents: INCOMPLETE_COMPONENTS,
      }),
    )
    const savedArtifacts = await calculations.getLatestSyntheticArtifacts(scope, administrationId,
      inputs.rulePackageCompositionId, run.id, undefined, 'INDIVIDUAL_PAYROLL', input.period)
    if (savedArtifacts) {
      const updatedEvents = await lifecycle.listLifecycleEvents(scope, administrationId, periodRow.id, input.employmentId)
      return viewFromArtifacts(savedArtifacts, updatedEvents)
    }
    return resultView({
      status: 'INCOMPLETE', employeeId: input.employeeId, employmentId: input.employmentId, period: input.period,
      runId: run.id, sourceSnapshotId: persistedSnapshot.id, inputSetId: inputSet.id,
      revision: (latest?.revision ?? 0) + 1, businessStatus: 'CONCEPT', sourceHash: snapshot.sourceHash,
      inputHash: inputs.inputHash, resultHash, grossAmount: resultAmount(result, 'gross_salary'),
      wageTaxAmount: resultAmount(result, 'wage_tax'), netAfterWageTax: resultAmount(result, 'net_salary'),
      incompleteComponents: INCOMPLETE_COMPONENTS, previousRunId: predecessorRunId, changedSourceKeys,
      gaps: gaps.filter((gap) => !isBlockingGap(gap)),
    })
  }

  async function reviewEmployeePayroll(input: { readonly employeeId: string; readonly employmentId: string; readonly period: EmployeePayrollPeriod; readonly runId: string }) {
    return await transitionLifecycle(input, 'REVIEWED')
  }

  async function finalizeEmployeePayroll(input: { readonly employeeId: string; readonly employmentId: string; readonly period: EmployeePayrollPeriod; readonly runId: string }) {
    return await transitionLifecycle(input, 'FINALIZED')
  }

  async function transitionLifecycle(input: {
    readonly employeeId: string; readonly employmentId: string; readonly period: EmployeePayrollPeriod; readonly runId: string
  }, eventType: 'REVIEWED' | 'FINALIZED') {
    assertPeriod(input.period)
    for (const id of [input.employeeId, input.employmentId, input.runId]) assertOpaqueId(id)
    if (!dependencies.enabled()) throw new EmployeePayrollCalculationError('PAYROLL_SERVICE_UNAVAILABLE', 503)
    const access = await dependencies.requireAccess(true)
    const calculations = dependencies.createCalculationRepository()
    const periodRow = await calculations.getPayrollPeriod(access.scope, access.administration.id, input.period.year, input.period.month)
    if (!periodRow || periodRow.status !== 'OPEN') throw new EmployeePayrollCalculationError('PAYROLL_CYCLE_NOT_OPEN')
    const currentSource = await dependencies.sourceProvider.getPayrollSourceSnapshot({
      ...access.scope,
      employeeId: input.employeeId,
      employmentId: input.employmentId,
      payrollPeriod: input.period,
    })
    if (currentSource.sourceEmployeeId !== input.employeeId || currentSource.sourceEmploymentId !== input.employmentId
      || currentSource.sourceTenantId !== access.scope.tenantId || currentSource.sourceHrGroupId !== access.scope.hrGroupId
      || currentSource.sourceAdministrationId !== access.scope.administrationId) {
      throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
    }
    const lifecycle = dependencies.createLifecycleRepository()
    const events = await lifecycle.listLifecycleEvents(access.scope, access.administration.id, periodRow.id, input.employmentId)
    const latest = lifecycleStatus(events)
    const artifacts = await calculations.getLatestSyntheticArtifacts(access.scope, access.administration.id,
      undefined, input.runId, undefined, 'INDIVIDUAL_PAYROLL', input.period)
    if (!artifacts || artifacts.sourceSnapshot.source_employee_id !== input.employeeId
      || artifacts.sourceSnapshot.source_employment_id !== input.employmentId
      || artifacts.payrollPeriod.id !== periodRow.id || artifacts.run.status !== 'SUCCEEDED') {
      throw new EmployeePayrollCalculationError('PAYROLL_RUN_SCOPE_OR_STATUS_INVALID', 403)
    }
    const reference = await lifecycle.getGenericInputReference(access.scope, access.administration.id, artifacts.inputSet.id)
    if (isPayrollAcceptanceScenarioReference(reference?.input_reference_json)) {
      throw new EmployeePayrollCalculationError('PAYROLL_TEST_SCENARIO_CANNOT_TRANSITION', 409)
    }
    if (currentSource.sourceHash !== artifacts.sourceSnapshot.source_hash) {
      throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED')
    }
    const expectedPrevious = eventType === 'REVIEWED' ? 'CONCEPT' : 'REVIEWED'
    const expectedSequence = eventType === 'REVIEWED' ? 2 : 3
    if (!latest || latest.calculation_run_id !== input.runId || latest.event_type !== expectedPrevious) {
      throw new EmployeePayrollCalculationError('PAYROLL_LIFECYCLE_TRANSITION_INVALID')
    }
    if (eventType === 'FINALIZED') {
      const referenceJson = record(reference?.input_reference_json)
      const incomplete = Array.isArray(referenceJson?.incompleteComponents) ? referenceJson.incompleteComponents : INCOMPLETE_COMPONENTS
      if (incomplete.length > 0 || artifacts.controls.some((control) => control.status !== 'PASS')) {
        throw new EmployeePayrollCalculationError('PAYROLL_FINALIZATION_INCOMPLETE')
      }
    }
    await lifecycle.insertLifecycleEvent(access.scope, access.administration.id, {
      ...sourceColumns(access.scope, access.administration.id),
      payroll_period_id: periodRow.id,
      source_employment_id: input.employmentId,
      calculation_run_id: input.runId,
      revision: latest.revision,
      event_sequence: expectedSequence,
      event_type: eventType,
      event_payload: toPayrollJson({
        sourceHash: artifacts.sourceSnapshot.source_hash,
        inputHash: artifacts.inputSet.input_hash,
        resultHash: artifacts.run.result_hash,
        runId: input.runId,
        completeness: eventType === 'FINALIZED' ? 'COMPLETE' : 'INCOMPLETE',
      }),
      created_by_user_id: access.actorUserId,
    })
    return { runId: input.runId, eventType, revision: latest.revision }
  }

  return { inspectEmployeePayrollSource, calculateEmployeePayroll, reviewEmployeePayroll, finalizeEmployeePayroll }
}

const defaultService = () => createEmployeePayrollCalculationService()

export function createLocalPayrollAcceptanceCalculationService(host: string | null) {
  if (!isLocalPayrollAcceptanceRuntime(host)) {
    throw new EmployeePayrollCalculationError('PAYROLL_SERVICE_UNAVAILABLE', 404)
  }

  const scopedDependencies = {
    ...defaults,
    requireAccess: async (write: boolean) => {
      const access = await defaults.requireAccess(write)
      if (!isLocalPayrollAcceptanceScope(access.scope, access.administration.id)) {
        throw new EmployeePayrollCalculationError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
      }
      return access
    },
  }
  const service = createEmployeePayrollCalculationService({
    ...scopedDependencies,
    sourceProvider: createPayrollAcceptanceScenarioSourceProvider(defaults.sourceProvider),
  })
  const sourceOnlyService = createEmployeePayrollCalculationService(scopedDependencies)

  async function readBackScenarioCalculation(input: {
    readonly employeeId: string
    readonly employmentId: string
    readonly runId: string
  }): Promise<LocalPayrollAcceptanceReadback | null> {
    const access = await scopedDependencies.requireAccess(false)
    const period = LOCAL_PAYROLL_ACCEPTANCE_PERIOD
    const calculations = defaults.createCalculationRepository()
    const payrollPeriod = await calculations.getPayrollPeriod(
      access.scope, access.administration.id, period.year, period.month,
    )
    if (!payrollPeriod) return null
    const artifacts = await calculations.getLatestSyntheticArtifacts(
      access.scope, access.administration.id, undefined, input.runId, undefined, 'INDIVIDUAL_PAYROLL', period,
    )
    if (!artifacts || artifacts.run.id !== input.runId
      || artifacts.sourceSnapshot.source_employee_id !== input.employeeId
      || artifacts.sourceSnapshot.source_employment_id !== input.employmentId) return null

    const lifecycle = defaults.createLifecycleRepository()
    const [reference, events] = await Promise.all([
      lifecycle.getGenericInputReference(access.scope, access.administration.id, artifacts.inputSet.id),
      lifecycle.listLifecycleEvents(access.scope, access.administration.id, payrollPeriod.id, input.employmentId),
    ])
    const conceptEvent = events.find((event) => event.calculation_run_id === input.runId && event.event_type === 'CONCEPT') ?? null
    const laterFinalization = events.some((event) => event.calculation_run_id === input.runId
      && (event.event_type === 'REVIEWED' || event.event_type === 'FINALIZED'))
    const sourcePayload = record(artifacts.sourceSnapshot.source_payload)
    const sourceScenario = record(sourcePayload?.testScenario)
    const inputReference = record(reference?.input_reference_json)
    const referenceScenario = record(inputReference?.testScenario)
    const scenarioCode = typeof sourceScenario?.code === 'string' ? sourceScenario.code : null
    const coreSourceHash = typeof sourceScenario?.coreSourceHash === 'string' ? sourceScenario.coreSourceHash : null
    const assumptionsHash = typeof sourceScenario?.assumptionsHash === 'string' ? sourceScenario.assumptionsHash : null
    const sourceHash = artifacts.sourceSnapshot.source_hash
    const inputHash = artifacts.inputSet.input_hash
    const resultHash = artifacts.run.result_hash
    const confirmed = artifacts.run.status === 'SUCCEEDED'
      && artifacts.run.calculation_input_set_id === artifacts.inputSet.id
      && artifacts.inputSet.source_snapshot_id === artifacts.sourceSnapshot.id
      && artifacts.payrollPeriod.id === payrollPeriod.id
      && reference !== null
      && reference.source_hash === sourceHash
      && reference.input_hash === inputHash
      && artifacts.componentResults.length > 0
      && artifacts.controls.length > 0
      && artifacts.trace !== null
      && conceptEvent !== null
      && !laterFinalization
      && sourceScenario?.sourceClassification === 'PAYROLL_TEST_SCENARIO'
      && referenceScenario?.sourceClassification === 'PAYROLL_TEST_SCENARIO'
      && referenceScenario?.code === scenarioCode
      && referenceScenario?.coreSourceHash === coreSourceHash
      && referenceScenario?.assumptionsHash === assumptionsHash
      && typeof sourceHash === 'string'
      && typeof inputHash === 'string'
      && typeof resultHash === 'string'

    return {
      confirmed,
      runId: artifacts.run.id,
      sourceSnapshotId: artifacts.sourceSnapshot.id,
      inputSetId: artifacts.inputSet.id,
      inputReferenceId: reference?.id ?? null,
      payrollPeriodId: artifacts.payrollPeriod.id,
      componentResultCount: artifacts.componentResults.length,
      controlCount: artifacts.controls.length,
      traceId: artifacts.trace?.id ?? null,
      conceptEventId: conceptEvent?.id ?? null,
      runStatus: artifacts.run.status,
      sourceHash,
      coreSourceHash,
      assumptionsHash,
      inputHash,
      resultHash,
      scenarioCode,
      controls: artifacts.controls.map((control) => ({ key: control.control_key, status: control.status })),
    }
  }

  return {
    inspectScenarioCandidate: service.inspectEmployeePayrollSource,
    calculateScenarioCandidate: service.calculateEmployeePayroll,
    inspectExceptionCandidate: sourceOnlyService.inspectEmployeePayrollSource,
    readBackScenarioCalculation,
  }
}

export async function inspectEmployeePayrollSource(input: {
  readonly employeeId: string
  readonly employmentId: string
  readonly period: EmployeePayrollPeriod
}): Promise<EmployeePayrollPreflightView> {
  return await defaultService().inspectEmployeePayrollSource(input)
}

export async function calculateEmployeePayroll(input: {
  readonly employeeId: string
  readonly employmentId: string
  readonly period: EmployeePayrollPeriod
}): Promise<EmployeePayrollCalculationView> {
  return await defaultService().calculateEmployeePayroll(input)
}

export async function reviewEmployeePayroll(input: {
  readonly employeeId: string; readonly employmentId: string; readonly period: EmployeePayrollPeriod; readonly runId: string
}) {
  return await defaultService().reviewEmployeePayroll(input)
}

export async function finalizeEmployeePayroll(input: {
  readonly employeeId: string; readonly employmentId: string; readonly period: EmployeePayrollPeriod; readonly runId: string
}) {
  return await defaultService().finalizeEmployeePayroll(input)
}

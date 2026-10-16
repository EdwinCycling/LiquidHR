import 'server-only'

import { AuthorizationError, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createPayrollCalculationRepository, type PayrollCalculationArtifacts, type PayrollRunSummary } from './calculation-repository'
import { requireComponentLibraryAccess } from './component-library-access'
import { createPayrollRepository, type PayrollRepository } from './repository'
import { createPayrun01Repository } from './payrun01-repository'
import {
  createFinalizedEmployeePayslipPdfArtifact,
  createPayrun01PayslipPdfArtifactForRun,
  getPayrollProfessionalPayslipPdfArtifactForRun as getPersistedPayrollProfessionalPayslipPdfArtifactForRun,
  renderFinalizedEmployeePayslipPdf,
  renderPayrun01PayslipPdfPreviewForRun,
  type FinalizedEmployeePayslipInput,
} from './payrun01-service'
import { isPayrollLabEnabled } from './feature-flag'
import { payrollScopeFromAuthContext, type PayrollScope } from './scope'
import {
  filterPayrollAcceptanceScenarioRuns,
  isCompletePayfull02ScenarioReference,
  isPayrollAcceptanceScenarioReference,
} from './payroll-acceptance-scenario'

export type PayrollProfessionalRun = PayrollCalculationArtifacts & {
  readonly lifecycleEvents: Awaited<ReturnType<ReturnType<typeof createPayrun01Repository>['listLifecycleEvents']>>
  readonly canTransition: boolean
  readonly hasGenericInputReference: boolean
  readonly hasPayslipPdfArtifact: boolean
}

export async function listPayrollProfessionalRuns(): Promise<readonly PayrollRunSummary[]> {
  const access = await requireComponentLibraryAccess(false)
  const repository = createPayrollCalculationRepository()
  const summaries = await repository.listPayrollRunSummaries(access.scope, access.administration.id, {
    runType: 'INDIVIDUAL_PAYROLL',
    limit: 100,
  })
  if (summaries.length === 0) return summaries
  const lifecycle = createPayrun01Repository()
  return await filterPayrollAcceptanceScenarioRuns(summaries, async (inputSetId) =>
    await lifecycle.getGenericInputReference(access.scope, access.administration.id, inputSetId))
}

export async function getPayrollProfessionalRun(runId: string): Promise<PayrollProfessionalRun | null> {
  const access = await requireComponentLibraryAccess(false)
  const calculations = createPayrollCalculationRepository()
  const artifacts = await calculations.getLatestSyntheticArtifacts(
    access.scope,
    access.administration.id,
    undefined,
    runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts) return null
  const inputReference = await createPayrun01Repository().getGenericInputReference(
    access.scope,
    access.administration.id,
    artifacts.inputSet.id,
  )
  if (isPayrollAcceptanceScenarioReference(inputReference?.input_reference_json)
    && !isCompletePayfull02ScenarioReference(inputReference?.input_reference_json)) return null
  const lifecycleEvents = await createPayrun01Repository().listLifecycleEvents(
    access.scope,
    access.administration.id,
    artifacts.payrollPeriod.id,
    artifacts.sourceSnapshot.source_employment_id,
  )
  const isFinalized = lifecycleEvents.some((event) => event.calculation_run_id === runId && event.event_type === 'FINALIZED')
  const hasPayslipPdfArtifact = inputReference !== null && isFinalized
    ? (await getPersistedPayrollProfessionalPayslipPdfArtifactForRun({
      scope: access.scope,
      payrollAdministrationId: access.administration.id,
      actorUserId: access.actorUserId,
      runId,
    })) !== null
    : false
  return {
    ...artifacts,
    lifecycleEvents,
    canTransition: access.canCopy,
    hasGenericInputReference: inputReference !== null,
    hasPayslipPdfArtifact,
  }
}

/**
 * Renders a finalized Payroll run through the standard Dutch payslip template.
 * Generic Core-backed runs use the already scoped Core display profile and
 * the employee payslip renderer; legacy PAYRUN01 scenarios keep their
 * versioned assignment renderer.
 */
export async function renderPayrollProfessionalPayslipPreviewForRun(input: {
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly actorUserId: string
  readonly runId: string
}) {
  const artifacts = await createPayrollCalculationRepository().getLatestSyntheticArtifacts(
    input.scope,
    input.payrollAdministrationId,
    undefined,
    input.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts || artifacts.run.id !== input.runId) return null

  const genericReference = await createPayrun01Repository().getGenericInputReference(
    input.scope,
    input.payrollAdministrationId,
    artifacts.inputSet.id,
  )
  if (!genericReference) return await renderPayrun01PayslipPdfPreviewForRun(input)

  const employeeId = artifacts.sourceSnapshot.source_employee_id
  const genericPayslipProfile = await loadScopedPayslipDisplayProfile(input.scope, employeeId)
  if (!genericPayslipProfile) throw new Error('PAYROLL_PAYSLIP_PROFILE_UNAVAILABLE')
  const payslipInput: FinalizedEmployeePayslipInput = {
    ...input,
    employeeId,
    genericPayslipProfile,
  }
  return await renderFinalizedEmployeePayslipPdf(payslipInput)
}

export async function createPayrollProfessionalPayslipPdfArtifactForRun(input: {
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly actorUserId: string
  readonly runId: string
}) {
  const artifacts = await createPayrollCalculationRepository().getLatestSyntheticArtifacts(
    input.scope,
    input.payrollAdministrationId,
    undefined,
    input.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  if (!artifacts || artifacts.run.id !== input.runId) return null
  const reference = await createPayrun01Repository().getGenericInputReference(
    input.scope,
    input.payrollAdministrationId,
    artifacts.inputSet.id,
  )
  if (!reference) {
    return await createPayrun01PayslipPdfArtifactForRun(input)
  }

  const employeeId = artifacts.sourceSnapshot.source_employee_id
  const genericPayslipProfile = await loadScopedPayslipDisplayProfile(input.scope, employeeId)
  if (!genericPayslipProfile) throw new Error('PAYROLL_PAYSLIP_PROFILE_UNAVAILABLE')
  const payslipInput: FinalizedEmployeePayslipInput = {
    ...input,
    employeeId,
    genericPayslipProfile,
  }
  return await createFinalizedEmployeePayslipPdfArtifact(payslipInput)
}

export async function getPayrollProfessionalPayslipPdfArtifactForRun(input: {
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
  readonly actorUserId: string
  readonly runId: string
}) {
  return await getPersistedPayrollProfessionalPayslipPdfArtifactForRun(input)
}

export type EmployeePayrollStatement = {
  readonly periodYear: number
  readonly periodMonth: number
  readonly components: readonly EmployeePayrollComponent[]
  readonly pension: EmployeePensionSummary | null
  readonly pensionReadiness: 'CALCULATED' | 'CALCULATED_TEST_ASSUMPTIONS' | 'REVIEW_REQUIRED' | 'SOURCE_VERIFICATION_REQUIRED'
}

export type EmployeePayrollPeriod = Pick<EmployeePayrollStatement, 'periodYear' | 'periodMonth'>

export type EmployeePayslipDisplayProfile = {
  readonly employeeName: string
  readonly employerName: string
}

export type EmployeePayrollComponent = {
  readonly key: string
  readonly amount: number | null
}

export type EmployeePensionSummary = {
  readonly arrangementName: string | null
  readonly pensionableBase: string | null
  readonly rate: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asPayrollDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !/^-?\d{1,12}(?:\.\d{1,4})?$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const PAYFULL02_PENSION_CONTROLS = [
  'PAYFULL02-CTRL-009-EMPLOYEE-PENSION-WITHIN-GROSS',
  'PAYFULL02-CTRL-010-PENSION-PLAN-ACTIVE',
  'PAYFULL02-CTRL-011-PENSION-SHARES-NONNEGATIVE',
  'PAYFULL02-CTRL-012-PENSIONABLE-SPECIAL-REWARD-UNSUPPORTED',
  'PAYFULL02-CTRL-013-PENSION-PART-TIME-FACTOR-IN-RANGE',
] as const

function hasCompletePayfull02PensionEvidence(artifacts: PayrollCalculationArtifacts): boolean {
  const sourcePayload = asRecord(artifacts.sourceSnapshot.source_payload)
  const testScenario = asRecord(sourcePayload?.testScenario)
  const payrollOwned = asRecord(sourcePayload?.payrollOwned)
  const setup = asRecord(payrollOwned?.setup)
  const pension = asRecord(payrollOwned?.pension)
  const openingBalance = asRecord(payrollOwned?.openingBalance)
  const validHash = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
  const validUuid = (value: unknown): value is string => typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

  if (!testScenario || !payrollOwned || !setup || !pension || !openingBalance
    || !isCompletePayfull02ScenarioReference({ testScenario, payfull02Setup: payrollOwned })) return false

  const sourceSnapshotId = artifacts.sourceSnapshot.id
  const periodStart = `${artifacts.payrollPeriod.period_year}-${String(artifacts.payrollPeriod.period_month).padStart(2, '0')}-01`
  const periodEnd = new Date(Date.UTC(artifacts.payrollPeriod.period_year, artifacts.payrollPeriod.period_month, 0))
    .toISOString().slice(0, 10)
  const monthlyFranchise = asPayrollDecimal(pension.monthlyFranchise)
  const monthlyMaximum = asPayrollDecimal(pension.monthlyMaximum)
  const partTimeFactor = asPayrollDecimal(pension.partTimeFactor)
  const employeeRate = asPayrollDecimal(pension.employeeRate)
  const employerRate = asPayrollDecimal(pension.employerRate)
  const employeeShare = asPayrollDecimal(pension.employeeSharePercent)
  const employerShare = asPayrollDecimal(pension.employerSharePercent)
  const premiumRate = asPayrollDecimal(pension.totalPremiumRate)
  const pensionRow = artifacts.componentResults.find((row) => row.component_key === 'employee_pension')
  const pensionPayload = asRecord(pensionRow?.result_payload)
  const savedEmployeePension = asPayrollDecimal(pensionRow?.amount ?? pensionPayload?.amount)

  const controls = new Map(artifacts.controls.map((control) => [control.control_key, control.status]))
  const allPensionControlsPass = PAYFULL02_PENSION_CONTROLS.every((key) => controls.get(key) === 'PASS')
  const setupIsSyntheticAndVersioned = setup.code === 'TEST_SETUP_PAYFULL_02'
    && setup.version === '1.0'
    && setup.classification === 'TEST_ONLY_NOT_AN_EXTERNAL_PENSION_CONTRACT_OR_EMPLOYER_DECISION'
    && setup.validFrom === '2026-01-01'
    && setup.validTo === '2026-12-31'
    && setup.provenance === 'Controlled synthetic Payroll Lab TEST configuration for the Mars acceptance scope.'
    && validUuid(setup.configVersionId)
    && validHash(setup.configHash)
    && validHash(setup.sourceHash)
  const openingIsBound = openingBalance.effectiveFrom === '2026-01-01'
    && openingBalance.effectiveTo === '2026-09-30'
    && validUuid(openingBalance.openingSnapshotId)
    && validHash(openingBalance.sourceHash)
    && validHash(openingBalance.openingHash)
    && openingBalance.openingHash === openingBalance.sourceHash
    && openingBalance.provenance === 'Explicit effective-dated TEST opening balance. It is not represented as actual finalized January-September payroll history.'
  const sourceAndInputAreBound = validHash(artifacts.sourceSnapshot.source_hash)
    && validHash(artifacts.inputSet.input_hash)
    && artifacts.inputSet.source_snapshot_id === sourceSnapshotId
  const pensionConfigurationIsValid = typeof pension.planId === 'string'
    && /^TEST-PENSION-DEMO-00[12]$/.test(pension.planId)
    && pension.planVersion === '1.0'
    && pension.classification === 'SYNTHETIC_TEST_PLAN_NOT_EXTERNAL_FUND_CONTRACT'
    && pension.provenance === 'TEST_SETUP_PAYFULL_02'
    && pension.active === true
    && typeof pension.effectiveFrom === 'string' && pension.effectiveFrom <= periodStart
    && typeof pension.effectiveTo === 'string' && pension.effectiveTo >= periodEnd
    && monthlyFranchise !== null && monthlyFranchise > 0
    && monthlyMaximum !== null && monthlyMaximum >= monthlyFranchise
    && partTimeFactor !== null && partTimeFactor > 0 && partTimeFactor <= 1
    && employeeRate !== null && employeeRate >= 0 && employeeRate <= 100
    && employerRate !== null && employerRate >= 0 && employerRate <= 100
    && employeeShare !== null && employeeShare >= 0 && employeeShare <= 100
    && employerShare !== null && employerShare >= 0 && employerShare <= 100
    && employeeShare + employerShare === 100
    && premiumRate !== null && premiumRate > 0 && premiumRate <= 100
    && employeeRate !== null && employerRate !== null
    && Math.abs(employeeRate + employerRate - premiumRate) < 0.0001
    && Math.abs((employeeRate / premiumRate) * 100 - employeeShare) < 0.01
    && Math.abs((employerRate / premiumRate) * 100 - employerShare) < 0.01

  return setupIsSyntheticAndVersioned
    && openingIsBound
    && sourceAndInputAreBound
    && pensionConfigurationIsValid
    && savedEmployeePension !== null
    && savedEmployeePension >= 0
    && allPensionControlsPass
}

const EMPLOYEE_VISIBLE_COMPONENT_KEYS = new Set([
  'contractual_salary', 'additional_cash_amount', 'additional_hours_pay', 'variable_regular_wage',
  'gross_salary', 'employee_pension', 'taxable_wage', 'employee_insurance_base', 'zvw_base', 'wage_tax',
  'net_reimbursement', 'net_deduction', 'net_correction', 'net_salary',
  'cumulative_gross', 'cumulative_taxable_wage', 'cumulative_wage_tax',
])

function projectEmployeeComponents(artifacts: PayrollCalculationArtifacts): readonly EmployeePayrollComponent[] {
  return artifacts.componentResults.filter((row) => EMPLOYEE_VISIBLE_COMPONENT_KEYS.has(row.component_key)).map((row) => {
    const payload = asRecord(row.result_payload)
    const value = typeof row.amount === 'number' ? row.amount : payload?.amount
    const amount = typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof value === 'string' && /^-?\d{1,12}(?:\.\d{1,4})?$/.test(value)
        ? Number(value)
        : null
    return { key: row.component_key, amount: amount !== null && Number.isFinite(amount) ? amount : null }
  })
}

function projectEmployeePensionSummary(artifacts: PayrollCalculationArtifacts): EmployeePensionSummary | null {
  const payload = asRecord(artifacts.sourceSnapshot.source_payload)
  const payrollOwned = asRecord(payload?.payrollOwned)
  const summary = asRecord(payrollOwned?.pensionCalculationSummary)
  if (!summary) return null
  if (isPayrollAcceptanceScenarioReference({ testScenario: asRecord(payload?.testScenario) })) return null

  const arrangementId = asString(summary.arrangementId)
  const canonicalPension = asRecord(payload?.pension)
  const assignments = Array.isArray(canonicalPension?.assignments) ? canonicalPension.assignments : []
  const matchingNames = assignments.flatMap((value) => {
    const assignment = asRecord(value)
    const arrangement = asRecord(assignment?.arrangement)
    return arrangement && arrangement.id === arrangementId ? [asString(arrangement.name)] : []
  }).filter((name): name is string => name !== null)

  const arrangementName = matchingNames.length === 1 ? matchingNames[0]! : null
  const pensionableBase = asString(summary.pensionableBase)
  const rate = asString(summary.rate)
  return arrangementName || pensionableBase || rate ? { arrangementName, pensionableBase, rate } : null
}

function projectEmployeePensionReadiness(
  artifacts: PayrollCalculationArtifacts,
  pension: EmployeePensionSummary | null,
): EmployeePayrollStatement['pensionReadiness'] {
  const sourcePayload = asRecord(artifacts.sourceSnapshot.source_payload)
  const testScenario = asRecord(sourcePayload?.testScenario)
  if (isPayrollAcceptanceScenarioReference({ testScenario })) {
    const pensionControls = artifacts.controls.filter((control) => PAYFULL02_PENSION_CONTROLS.includes(
      control.control_key as typeof PAYFULL02_PENSION_CONTROLS[number],
    ))
    if (pensionControls.some((control) => control.status !== 'PASS')) return 'REVIEW_REQUIRED'
    if (pensionControls.length !== PAYFULL02_PENSION_CONTROLS.length
      || !hasCompletePayfull02PensionEvidence(artifacts)) return 'SOURCE_VERIFICATION_REQUIRED'
    return 'CALCULATED_TEST_ASSUMPTIONS'
  }

  const hasEmployeePension = artifacts.componentResults.some((row) => row.component_key === 'employee_pension')
  if (!hasEmployeePension) {
    return 'SOURCE_VERIFICATION_REQUIRED'
  }

  const pensionRuleReadiness = artifacts.controls.find((control) =>
    control.control_key === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')
  if (pensionRuleReadiness?.status === 'PASS') return 'CALCULATED'
  if (pensionRuleReadiness?.status === 'WARN' || pensionRuleReadiness?.status === 'FAIL'
    || artifacts.controls.some((control) => control.status === 'WARN' && /PENSION-RULE-READY/i.test(control.control_key))) {
    return 'REVIEW_REQUIRED'
  }
  if (!pension) return 'SOURCE_VERIFICATION_REQUIRED'
  return 'CALCULATED'
}

export type EmployeePayrollDependencies = {
  readonly requireAuthContext: typeof requireAuthContext
  readonly requirePermission: typeof requirePermission
  readonly isEnabled: typeof isPayrollLabEnabled
  readonly createPayrollRepository: () => Pick<PayrollRepository, 'getPayrollAdministration'>
  readonly createCalculationRepository: typeof createPayrollCalculationRepository
  readonly createPayrunRepository: typeof createPayrun01Repository
  readonly renderPayslipPdf: typeof renderFinalizedEmployeePayslipPdf
  readonly loadPayslipDisplayProfile: (scope: PayrollScope, employeeId: string) => Promise<EmployeePayslipDisplayProfile | null>
}

async function loadScopedPayslipDisplayProfile(
  scope: PayrollScope,
  employeeId: string,
): Promise<EmployeePayslipDisplayProfile | null> {
  const supabase = await createClient()
  const [employeeResult, administrationResult] = await Promise.all([
    supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name')
      .eq('tenant_id', scope.tenantId)
      .eq('hr_group_id', scope.hrGroupId)
      .eq('id', employeeId)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('administrations').select('id,name')
      .eq('tenant_id', scope.tenantId)
      .eq('hr_group_id', scope.hrGroupId)
      .eq('id', scope.administrationId)
      .eq('is_active', true)
      .maybeSingle(),
  ])
  if (employeeResult.error || administrationResult.error) throw new Error('PAYROLL_PAYSLIP_PROFILE_UNAVAILABLE')
  const employee = employeeResult.data
  const employerName = administrationResult.data?.name?.trim()
  if (!employee || !employerName) return null
  const employeeName = [employee.first_name, employee.birth_name_prefix, employee.birth_name]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ')
  return employeeName ? { employeeName, employerName } : null
}

const defaultEmployeePayrollDependencies: EmployeePayrollDependencies = {
  requireAuthContext,
  requirePermission,
  isEnabled: isPayrollLabEnabled,
  createPayrollRepository,
  createCalculationRepository: createPayrollCalculationRepository,
  createPayrunRepository: createPayrun01Repository,
  renderPayslipPdf: renderFinalizedEmployeePayslipPdf,
  loadPayslipDisplayProfile: loadScopedPayslipDisplayProfile,
}

type EmployeePayrollAccess = {
  readonly employeeId: string
  readonly actorUserId: string
  readonly scope: PayrollScope
  readonly payrollAdministrationId: string
}

type VerifiedEmployeePayrollPeriod = {
  readonly statement: EmployeePayrollStatement
  readonly runId: string
}

function isFinalizedRun(
  events: readonly Awaited<ReturnType<ReturnType<typeof createPayrun01Repository>['listLifecycleEvents']>>[number][],
  runId: string,
): boolean {
  const runEvents = events.filter((event) => event.calculation_run_id === runId)
  const expected = [
    { event_type: 'CONCEPT', event_sequence: 1 },
    { event_type: 'REVIEWED', event_sequence: 2 },
    { event_type: 'FINALIZED', event_sequence: 3 },
  ] as const
  return runEvents.length === expected.length && expected.every((event, index) =>
    runEvents[index]?.event_type === event.event_type && runEvents[index]?.event_sequence === event.event_sequence)
}

async function createEmployeePayrollAccess(
  context: Awaited<ReturnType<typeof requirePermission>>,
  employeeId: string,
  dependencies: EmployeePayrollDependencies,
): Promise<EmployeePayrollAccess | null> {
  const scope = payrollScopeFromAuthContext(context)
  if (!scope || !dependencies.isEnabled()) return null

  const administration = await dependencies.createPayrollRepository().getPayrollAdministration(scope)
  if (!administration || administration.status !== 'ACTIVE' || !administration.capabilityEnabled) return null

  return {
    employeeId,
    actorUserId: context.userId,
    scope,
    payrollAdministrationId: administration.id,
  }
}

async function authorizeMySalary(
  dependencies: EmployeePayrollDependencies,
): Promise<EmployeePayrollAccess | null> {
  const initialContext = await dependencies.requireAuthContext()
  const employeeId = initialContext.employeeId
  if (!employeeId) throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')

  const context = await dependencies.requirePermission('salary:read', employeeId)
  if (context.employeeId !== employeeId || context.userId !== initialContext.userId || context.tenantId !== initialContext.tenantId
    || context.hrGroupId !== initialContext.hrGroupId || context.administrationId !== initialContext.administrationId) {
    throw new AuthorizationError('Persoonlijke salarisgegevens zijn niet beschikbaar.')
  }
  return await createEmployeePayrollAccess(context, employeeId, dependencies)
}

async function authorizeEmployeeSalary(
  employeeId: string,
  dependencies: EmployeePayrollDependencies,
): Promise<EmployeePayrollAccess | null> {
  const context = await dependencies.requirePermission('salary:read', employeeId)
  return await createEmployeePayrollAccess(context, employeeId, dependencies)
}

async function listFinalizedEmployeePeriods(
  access: EmployeePayrollAccess,
  dependencies: EmployeePayrollDependencies,
): Promise<readonly VerifiedEmployeePayrollPeriod[]> {
  const calculations = dependencies.createCalculationRepository()
  const summaries = await calculations.listPayrollRunSummaries(access.scope, access.payrollAdministrationId, {
    employeeId: access.employeeId,
    runType: 'INDIVIDUAL_PAYROLL',
    limit: 200,
  })
  const payrun = dependencies.createPayrunRepository()
  const visibleSummaries = await filterPayrollAcceptanceScenarioRuns(summaries, async (inputSetId) =>
    await payrun.getGenericInputReference(access.scope, access.payrollAdministrationId, inputSetId))
  const periods = new Map<string, VerifiedEmployeePayrollPeriod>()

  for (let offset = 0; offset < visibleSummaries.length; offset += 10) {
    const batch = visibleSummaries.slice(offset, offset + 10)
    const verifiedBatch = await Promise.all(batch.map(async (summary) => {
      if (summary.run.status !== 'SUCCEEDED' || summary.sourceSnapshot.source_employee_id !== access.employeeId) return null
      const artifacts = await calculations.getLatestSyntheticArtifacts(
        access.scope,
        access.payrollAdministrationId,
        undefined,
        summary.run.id,
        undefined,
        'INDIVIDUAL_PAYROLL',
      )
      if (!artifacts || artifacts.run.id !== summary.run.id
        || artifacts.sourceSnapshot.source_employee_id !== access.employeeId) return null
      const periodYear = artifacts.payrollPeriod.period_year
      const periodMonth = artifacts.payrollPeriod.period_month
      if (!Number.isInteger(periodYear) || !Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) return null

      const events = await payrun.listLifecycleEvents(
        access.scope,
        access.payrollAdministrationId,
        artifacts.payrollPeriod.id,
        artifacts.sourceSnapshot.source_employment_id,
      )
      if (!isFinalizedRun(events, summary.run.id)) return null
      const pension = projectEmployeePensionSummary(artifacts)
      return {
        periodKey: `${periodYear}-${String(periodMonth).padStart(2, '0')}`,
        verified: {
          runId: summary.run.id,
          statement: {
            periodYear,
            periodMonth,
            components: projectEmployeeComponents(artifacts),
            pension,
            pensionReadiness: projectEmployeePensionReadiness(artifacts, pension),
          },
        } satisfies VerifiedEmployeePayrollPeriod,
      }
    }))
    for (const result of verifiedBatch) {
      if (result && !periods.has(result.periodKey)) periods.set(result.periodKey, result.verified)
    }
  }

  return [...periods.values()].sort((left, right) =>
    right.statement.periodYear - left.statement.periodYear
      || right.statement.periodMonth - left.statement.periodMonth)
}

export async function getMySalaryStatements(
  dependencies: EmployeePayrollDependencies = defaultEmployeePayrollDependencies,
): Promise<readonly EmployeePayrollStatement[]> {
  const access = await authorizeMySalary(dependencies)
  if (!access) return []
  return (await listFinalizedEmployeePeriods(access, dependencies)).map((period) => period.statement)
}

export async function getMySalaryStatement(
  dependencies: EmployeePayrollDependencies = defaultEmployeePayrollDependencies,
): Promise<EmployeePayrollStatement | null> {
  return (await getMySalaryStatements(dependencies))[0] ?? null
}

export async function listEmployeePayrollPayslipPeriods(
  employeeId: string,
  dependencies: EmployeePayrollDependencies = defaultEmployeePayrollDependencies,
): Promise<readonly EmployeePayrollPeriod[]> {
  const access = await authorizeEmployeeSalary(employeeId, dependencies)
  if (!access) return []
  return (await listFinalizedEmployeePeriods(access, dependencies)).map(({ statement }) => ({
    periodYear: statement.periodYear,
    periodMonth: statement.periodMonth,
  }))
}

async function renderEmployeePayslipPdf(
  employeeId: string,
  periodYear: number,
  periodMonth: number,
  access: EmployeePayrollAccess | null,
  dependencies: EmployeePayrollDependencies,
) {
  if (!access) return null
  const period = (await listFinalizedEmployeePeriods(access, dependencies)).find(({ statement }) =>
    statement.periodYear === periodYear && statement.periodMonth === periodMonth)
  if (!period) return null

  const artifacts = await dependencies.createCalculationRepository().getLatestSyntheticArtifacts(
    access.scope,
    access.payrollAdministrationId,
    undefined,
    period.runId,
    undefined,
    'INDIVIDUAL_PAYROLL',
  )
  const genericReference = artifacts
    ? await dependencies.createPayrunRepository().getGenericInputReference(access.scope, access.payrollAdministrationId, artifacts.inputSet.id)
    : null
  const genericPayslipProfile = genericReference
    ? await dependencies.loadPayslipDisplayProfile(access.scope, employeeId) ?? undefined
    : undefined

  const input: FinalizedEmployeePayslipInput = {
    scope: access.scope,
    payrollAdministrationId: access.payrollAdministrationId,
    actorUserId: access.actorUserId,
    employeeId,
    runId: period.runId,
    genericPayslipProfile,
  }
  if (genericReference && !input.genericPayslipProfile) throw new Error('PAYROLL_PAYSLIP_PROFILE_UNAVAILABLE')
  return await dependencies.renderPayslipPdf(input)
}

export async function renderMySalaryPayslipPdf(
  periodYear: number,
  periodMonth: number,
  dependencies: EmployeePayrollDependencies = defaultEmployeePayrollDependencies,
) {
  const access = await authorizeMySalary(dependencies)
  if (!access) return null
  return await renderEmployeePayslipPdf(access.employeeId, periodYear, periodMonth, access, dependencies)
}

export async function renderEmployeePayrollPayslipPdf(
  employeeId: string,
  periodYear: number,
  periodMonth: number,
  dependencies: EmployeePayrollDependencies = defaultEmployeePayrollDependencies,
) {
  const access = await authorizeEmployeeSalary(employeeId, dependencies)
  return await renderEmployeePayslipPdf(employeeId, periodYear, periodMonth, access, dependencies)
}

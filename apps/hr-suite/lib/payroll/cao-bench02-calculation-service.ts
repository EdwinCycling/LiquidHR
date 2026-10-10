import 'server-only'

import { randomUUID } from 'node:crypto'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollCalculationInputs,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  evaluateMetalektroHpApplicability,
  getKinderopvangRuleBundle,
  getOpenBandsRuleBundle,
  getRetailModeRuleBundle,
  type MetalektroHpApplicabilityResult,
} from '@liquid-hr/payroll-rules-cao-bench02'
import {
  buildCalculationCompositionSnapshot,
  getArrangementPackage,
  getSyntheticArrangementFixture,
  resolveArrangementVersion,
} from './arrangement-foundation'
import { createArrangementRepository } from './arrangement-repository'
import { createPayrollCalculationRepository } from './calculation-repository'
import type { PayrollJson } from './database'
import { isPayrollLabEnabled } from './feature-flag'
import { payrollSourceSnapshotSchema } from './source/schemas'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import type { PayrollScope } from './scope'
import {
  createSyntheticPayrollService,
  SyntheticPayrollServiceError,
  type PayrollTestScenario,
  type PayrollSelectionEvidence,
  type SyntheticPayrollView,
} from './synthetic-calculation-service'
import type { SyntheticPayrollPeriod } from './synthetic-source'

const PACKAGE_IDS = Object.freeze({
  kinderopvang: 'KINDEROPVANG_2025_2026',
  retail: 'RETAIL_NON_FOOD_MODE_2026_2027',
  openBands: 'LHR_DEMO_OPEN_BANDS_2026',
})

export const CAO_BENCH02_CALCULATION_CASES = [
  'CAO-BENCH02-K1',
  'CAO-BENCH02-K2',
  'CAO-BENCH02-R1',
  'CAO-BENCH02-R2',
  'CAO-BENCH02-B1',
  'CAO-BENCH02-B2',
  'CAO-BENCH02-C1',
] as const

export type CaoBench02CalculationCaseKey = typeof CAO_BENCH02_CALCULATION_CASES[number]
export type CaoBench02CaseKey = CaoBench02CalculationCaseKey | 'CAO-BENCH02-H1'

type CalculationSpec = {
  readonly caseKey: CaoBench02CalculationCaseKey
  readonly fixtureCode: string
  readonly packageId: string
  readonly displayNameKey: string
  readonly arrangementNameKey: string
  readonly period: SyntheticPayrollPeriod
  readonly input: Readonly<Record<string, string | boolean>>
  readonly family: 'KINDEROPVANG' | 'RETAIL_MODE' | 'OPEN_BANDS'
}

function scenarioInput(values: Record<string, string | boolean>): Readonly<Record<string, string | boolean>> {
  return Object.freeze(values)
}

const CALCULATION_SPECS = Object.freeze([
  {
    caseKey: 'CAO-BENCH02-K1', fixtureCode: 'CAO-BENCH02-KINDEROPVANG', packageId: PACKAGE_IDS.kinderopvang,
    displayNameKey: 'payrollLabBenchK1', arrangementNameKey: 'payrollLabBenchKinderopvang',
    period: { year: 2026, month: 8 }, family: 'KINDEROPVANG',
    input: scenarioInput({ scenarioCode: 'K1', salaryScale: '6', salaryNumber: '12', contractHoursPerWeek: '36', fullTimeHoursPerWeek: '36', sundayHoursInPeriod: '0' }),
  },
  {
    caseKey: 'CAO-BENCH02-K2', fixtureCode: 'CAO-BENCH02-KINDEROPVANG', packageId: PACKAGE_IDS.kinderopvang,
    displayNameKey: 'payrollLabBenchK2', arrangementNameKey: 'payrollLabBenchKinderopvang',
    period: { year: 2026, month: 9 }, family: 'KINDEROPVANG',
    input: scenarioInput({ scenarioCode: 'K2', salaryScale: '6', salaryNumber: '12', contractHoursPerWeek: '24', fullTimeHoursPerWeek: '36', sundayHoursInPeriod: '4' }),
  },
  {
    caseKey: 'CAO-BENCH02-R1', fixtureCode: 'CAO-BENCH02-RETAIL-MODE', packageId: PACKAGE_IDS.retail,
    displayNameKey: 'payrollLabBenchR1', arrangementNameKey: 'payrollLabBenchRetailMode',
    period: { year: 2026, month: 7 }, family: 'RETAIL_MODE',
    input: scenarioInput({ scenarioCode: 'R1', functionGroup: 'I', experienceRow: '15', contractHoursPerWeek: '38', fullTimeHoursPerWeek: '38', existingActualHourlyRate: '28.90', weekdayNightHours: '0', sundayHours: '0', dailyOvertimeHours: '0', isEcommerce: false }),
  },
  {
    caseKey: 'CAO-BENCH02-R2', fixtureCode: 'CAO-BENCH02-RETAIL-MODE', packageId: PACKAGE_IDS.retail,
    displayNameKey: 'payrollLabBenchR2', arrangementNameKey: 'payrollLabBenchRetailMode',
    period: { year: 2026, month: 7 }, family: 'RETAIL_MODE',
    input: scenarioInput({ scenarioCode: 'R2', functionGroup: 'C', experienceRow: '1', contractHoursPerWeek: '24', fullTimeHoursPerWeek: '38', existingActualHourlyRate: '0', weekdayNightHours: '1', sundayHours: '1', dailyOvertimeHours: '2', isEcommerce: false }),
  },
  {
    caseKey: 'CAO-BENCH02-B1', fixtureCode: 'CAO-BENCH02-OPEN-BAND-BENCHMARK', packageId: PACKAGE_IDS.openBands,
    displayNameKey: 'payrollLabBenchB1', arrangementNameKey: 'payrollLabBenchOpenBands',
    period: { year: 2026, month: 7 }, family: 'OPEN_BANDS',
    input: scenarioInput({ scenarioCode: 'B1', bandCode: 'F', agreedHourlyRate: '0', contractHoursPerWeek: '40', fullTimeHoursPerWeek: '40', monthlyGrossSalary: '0' }),
  },
  {
    caseKey: 'CAO-BENCH02-B2', fixtureCode: 'CAO-BENCH02-OPEN-BAND-BENCHMARK', packageId: PACKAGE_IDS.openBands,
    displayNameKey: 'payrollLabBenchB2', arrangementNameKey: 'payrollLabBenchOpenBands',
    period: { year: 2026, month: 7 }, family: 'OPEN_BANDS',
    input: scenarioInput({ scenarioCode: 'B2', bandCode: 'F', agreedHourlyRate: '21.00', contractHoursPerWeek: '32', fullTimeHoursPerWeek: '40', monthlyGrossSalary: '0' }),
  },
  {
    caseKey: 'CAO-BENCH02-C1', fixtureCode: 'CAO-BENCH02-CEO-BENCHMARK', packageId: PACKAGE_IDS.openBands,
    displayNameKey: 'payrollLabBenchC1', arrangementNameKey: 'payrollLabBenchOpenBands',
    period: { year: 2026, month: 7 }, family: 'OPEN_BANDS',
    input: scenarioInput({ scenarioCode: 'C1', bandCode: '', agreedHourlyRate: '0', contractHoursPerWeek: '40', fullTimeHoursPerWeek: '40', monthlyGrossSalary: '12000' }),
  },
] satisfies readonly CalculationSpec[])

const H1_INPUTS = Object.freeze({
  supported: {
    asOfDate: '2026-10-03',
    employerScope: { value: 'IN_SCOPE' as const, evidence: 'Synthetic scenario stipulates an employer in Metalektro scope.' },
    functionLevel: {
      value: 'ABOVE_BASIS_CAO' as const,
      evidence: 'Synthetic job evaluation assigns ISF 600 points, HP group L.',
      evaluationSystem: 'ISF', isfPoints: 600, hpGroup: 'L' as const,
    },
    enterpriseDirector: { value: 'NO' as const, evidence: 'Synthetic senior specialist is not an enterprise director.' },
    directlyDeterminesEnterprisePolicy: { value: 'NO' as const, evidence: 'Synthetic specialist duties do not determine enterprise policy.' },
  },
  excluded: {
    asOfDate: '2026-10-03',
    employerScope: { value: 'IN_SCOPE' as const, evidence: 'Synthetic scenario stipulates an employer in Metalektro scope.' },
    functionLevel: {
      value: 'ABOVE_BASIS_CAO' as const,
      evidence: 'Synthetic role is above the Basis-CAO level; this fact alone does not establish HP eligibility.',
      evaluationSystem: 'ISF', isfPoints: 600, hpGroup: 'L' as const,
    },
    enterpriseDirector: { value: 'YES' as const, evidence: 'Synthetic individual is stipulated to be an enterprise director.' },
    directlyDeterminesEnterprisePolicy: { value: 'NO' as const, evidence: 'Synthetic facts do not separately assert policy-making duties.' },
  },
  review: {
    asOfDate: '2026-10-03',
    employerScope: { value: 'UNKNOWN' as const, evidence: '' },
    functionLevel: { value: 'UNKNOWN' as const, evidence: '' },
    enterpriseDirector: { value: 'UNKNOWN' as const, evidence: '' },
    directlyDeterminesEnterprisePolicy: { value: 'UNKNOWN' as const, evidence: '' },
  },
})

export type CaoBench02H1Result = {
  readonly supported: MetalektroHpApplicabilityResult
  readonly excludedDirector: MetalektroHpApplicabilityResult
  readonly evidenceGap: MetalektroHpApplicabilityResult
}

export function getCaoBench02H1Examples(): CaoBench02H1Result {
  return {
    supported: evaluateMetalektroHpApplicability(H1_INPUTS.supported),
    excludedDirector: evaluateMetalektroHpApplicability(H1_INPUTS.excluded),
    evidenceGap: evaluateMetalektroHpApplicability(H1_INPUTS.review),
  }
}

export function isCaoBench02CalculationCase(value: string): value is CaoBench02CalculationCaseKey {
  return (CAO_BENCH02_CALCULATION_CASES as readonly string[]).includes(value)
}

export function getCaoBench02CalculationCase(caseKey: string): CalculationSpec | null {
  return CALCULATION_SPECS.find((scenario) => scenario.caseKey === caseKey) ?? null
}

function periodStart(period: SyntheticPayrollPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}-01`
}

function createSnapshot(
  scope: PayrollScope,
  period: SyntheticPayrollPeriod,
  spec: CalculationSpec,
  options: { readonly now?: Date; readonly createId?: () => string },
  selectionEvidence?: PayrollSelectionEvidence,
): PayrollSourceSnapshot {
  const fixture = getSyntheticArrangementFixture(spec.fixtureCode)
  if (!fixture) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  const sourceEmployeeId = `c2b00000-0000-4000-8000-00000000000${spec.family === 'KINDEROPVANG' ? '4' : spec.family === 'RETAIL_MODE' ? '5' : spec.caseKey.endsWith('C1') ? '7' : '6'}`
  if (!selectionEvidence
    || selectionEvidence.packageId !== spec.packageId
    || selectionEvidence.fixtureCode !== fixture.code
    || selectionEvidence.asOfDate !== periodStart(period)
    || typeof selectionEvidence.arrangementVersion !== 'string'
    || typeof selectionEvidence.packageVersionHash !== 'string'
    || typeof selectionEvidence.compositionSnapshotHash !== 'string'
    || typeof selectionEvidence.salaryStrategy !== 'string') {
    throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED', null, 'CAO_BENCH02_COMPOSITION_SNAPSHOT_MISSING')
  }
  const scenario = {
    caseKey: spec.caseKey,
    effectiveDate: periodStart(period),
    packageId: spec.packageId,
    ...spec.input,
    arrangementSelection: selectionEvidence,
  }
  const canonicalSource = {
    schemaVersion: 'payroll-source-v1',
    employment: {
      source: 'SYNTHETIC_FIXTURE',
      fixtureCode: fixture.code,
      startsOn: fixture.effectiveFrom,
      endsOn: null,
      employmentType: 'REGULAR',
      contractType: 'PERMANENT',
      recordStatus: 'CONFIRMED',
    },
    scenario,
    incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'CAO_BENCH02_GROSS_ONLY' },
    fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_FISCAL_SCENARIO' },
  } as const
  const ruleMetadata = getCaoBench02RuleMetadata(spec.caseKey)
  if (!ruleMetadata) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  const sourceVersionVector = {
    [`fixture:${fixture.code}`]: `${fixture.code}:v1`,
    [`scenario:${spec.caseKey}`]: `${spec.caseKey}:v1`,
    [`package:${spec.packageId}`]: `${selectionEvidence.arrangementVersion}:${selectionEvidence.packageVersionHash}`,
    [`arrangement-composition:${fixture.code}:${selectionEvidence.asOfDate}`]: selectionEvidence.compositionSnapshotHash,
    [`rule-package:${ruleMetadata.compositionId}`]: `${ruleMetadata.rulePackageVersion}:${ruleMetadata.packageHash}`,
  }
  const sourceGaps = [
    { field: 'incomeRelationship', status: 'UNSUPPORTED' as const, reasonCode: 'CAO_BENCH02_GROSS_ONLY' },
    { field: 'fiscalProfile', status: 'SOURCE_GAP' as const, reasonCode: 'NO_ACCEPTED_FISCAL_SCENARIO' },
  ]
  const hashInput = {
    sourceTenantId: scope.tenantId,
    sourceHrGroupId: scope.hrGroupId,
    sourceAdministrationId: scope.administrationId,
    sourceEmployeeId,
    sourceEmploymentId: fixture.sourceEmploymentId,
    sourceIncomeRelationshipId: null,
    periodReference: period,
    canonicalSource,
    sourceVersionVector,
    sourceGaps,
  }
  const snapshot: PayrollSourceSnapshot = {
    id: (options.createId ?? randomUUID)(),
    ...hashInput,
    sourceHash: hashPayrollSourceSnapshot(hashInput),
    createdAt: (options.now ?? new Date()).toISOString(),
  }
  const parsed = payrollSourceSnapshotSchema.safeParse(snapshot)
  if (!parsed.success) throw new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID')
  return parsed.data
}

function isRecord(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function validateAssignedArrangement(
  scope: PayrollScope,
  payrollAdministrationId: string,
  spec: CalculationSpec,
  effectiveDate: string,
): Promise<PayrollSelectionEvidence> {
  const fixture = getSyntheticArrangementFixture(spec.fixtureCode)
  if (!fixture) throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED')
  const repository = createArrangementRepository()
  const [availabilityRows, assignmentRows, compositionRows] = await Promise.all([
    repository.listAvailability(scope, payrollAdministrationId),
    repository.listAssignments(scope, payrollAdministrationId),
    repository.listCompositionSnapshots(scope, payrollAdministrationId),
  ])
  const assignments = assignmentRows.filter((row) => row.fixture_code === fixture.code)
  if (assignments.length !== 1) throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED', null, 'CAO_BENCH02_ASSIGNMENT_MISSING')
  const assignment = assignments[0]!
  const available = availabilityRows.find((row) => row.package_id === spec.packageId)
  if (assignment.source_employment_id !== fixture.sourceEmploymentId
    || assignment.package_id !== spec.packageId
    || assignment.salary_strategy !== fixture.salaryStrategy
    || !assignment.is_primary
    || assignment.effective_from > effectiveDate
    || (assignment.effective_to !== null && assignment.effective_to < effectiveDate)
    || !available
    || available.effective_from > effectiveDate
    || (available.effective_to !== null && available.effective_to < effectiveDate)) {
    throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED', null, 'CAO_BENCH02_ASSIGNMENT_INVALID')
  }
  let expectedComposition: ReturnType<typeof buildCalculationCompositionSnapshot>
  try {
    expectedComposition = buildCalculationCompositionSnapshot({
      tenantId: scope.tenantId,
      hrGroupId: scope.hrGroupId,
      administrationId: scope.administrationId,
      payrollAdministrationId,
      fixtureCode: fixture.code,
      sourceEmploymentId: fixture.sourceEmploymentId,
      assignmentId: assignment.id,
      packageId: spec.packageId,
      salaryStrategy: fixture.salaryStrategy,
      assignmentEffectiveFrom: assignment.effective_from,
      assignmentEffectiveTo: assignment.effective_to,
      asOfDate: effectiveDate,
    })
  } catch {
    throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED', null, 'CAO_BENCH02_COMPOSITION_SNAPSHOT_INVALID')
  }
  const composition = compositionRows.find((row) => row.assignment_id === assignment.id && row.as_of_date === effectiveDate)
  const snapshot = composition?.snapshot_json
  const primary = isRecord(snapshot) ? snapshot.primaryAssignment : undefined
  const arrangement = isRecord(snapshot) ? snapshot.arrangement : undefined
  const snapshotScope = isRecord(snapshot) ? snapshot.scope : undefined
  if (!composition
    || composition.payroll_administration_id !== payrollAdministrationId
    || composition.source_tenant_id !== scope.tenantId
    || composition.source_hr_group_id !== scope.hrGroupId
    || composition.source_administration_id !== scope.administrationId
    || composition.source_employment_id !== fixture.sourceEmploymentId
    || !isRecord(primary)
    || primary.id !== assignment.id
    || primary.packageId !== spec.packageId
    || !isRecord(arrangement)
    || arrangement.packageId !== spec.packageId
    || arrangement.version !== expectedComposition.content.arrangement.version
    || arrangement.packageVersionHash !== expectedComposition.content.arrangement.packageVersionHash
    || !isRecord(snapshotScope)
    || snapshotScope.tenantId !== scope.tenantId
    || snapshotScope.hrGroupId !== scope.hrGroupId
    || snapshotScope.administrationId !== scope.administrationId
    || snapshotScope.payrollAdministrationId !== payrollAdministrationId
    || stableSerialize(snapshot) !== stableSerialize(expectedComposition.content)
    || composition.snapshot_hash !== expectedComposition.contentHash
    || sha256(stableSerialize(snapshot)) !== composition.snapshot_hash) {
    throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED', null, 'CAO_BENCH02_COMPOSITION_SNAPSHOT_MISSING')
  }
  return Object.freeze({
    packageId: spec.packageId,
    arrangementVersion: expectedComposition.content.arrangement.version,
    packageVersionHash: expectedComposition.content.arrangement.packageVersionHash,
    effectiveFrom: expectedComposition.content.arrangement.effectiveFrom,
    effectiveTo: expectedComposition.content.arrangement.effectiveTo,
    compositionSnapshotHash: expectedComposition.contentHash,
    asOfDate: effectiveDate,
    fixtureCode: fixture.code,
    salaryStrategy: fixture.salaryStrategy,
  })
}

function makeScenario(spec: CalculationSpec): PayrollTestScenario {
  const effectiveDate = periodStart(spec.period)
  const bundle = spec.family === 'KINDEROPVANG'
    ? getKinderopvangRuleBundle(effectiveDate)
    : spec.family === 'RETAIL_MODE'
      ? getRetailModeRuleBundle(effectiveDate)
      : getOpenBandsRuleBundle(effectiveDate, spec.caseKey === 'CAO-BENCH02-C1' ? 'C1' : undefined)
  return {
    caseKey: spec.caseKey,
    compositionId: bundle.rulePackage.compositionId,
    period: spec.period,
    expectedResults: bundle.rulePackage.resultMappings,
    createSnapshot: (scope, period, options, selectionEvidence) => createSnapshot(scope, period, spec, options, selectionEvidence),
    validateSelection: (scope, administrationId, date) => validateAssignedArrangement(scope, administrationId, spec, date),
  }
}

function makeEngine(spec: CalculationSpec) {
  const effectiveDate = periodStart(spec.period)
  const bundle = spec.family === 'KINDEROPVANG'
    ? getKinderopvangRuleBundle(effectiveDate)
    : spec.family === 'RETAIL_MODE'
      ? getRetailModeRuleBundle(effectiveDate)
      : getOpenBandsRuleBundle(effectiveDate, spec.caseKey === 'CAO-BENCH02-C1' ? 'C1' : undefined)
  return {
    buildInputs: (snapshot: PayrollSourceSnapshot): PayrollCalculationInputs => {
      return buildCalculationInputs(snapshot, bundle.rulePackage, {
        effectiveDate,
        scopeInstanceIds: getCaoBench02ScopeInstanceIds(snapshot),
      })
    },
    calculate: (inputs: PayrollCalculationInputs) => calculatePayroll(inputs, bundle.registry),
  }
}

export function getCaoBench02ScopeInstanceIds(
  snapshot: Pick<PayrollSourceSnapshot, 'sourceEmployeeId' | 'sourceEmploymentId' | 'sourceIncomeRelationshipId'>,
) {
  return {
    EMPLOYEE: snapshot.sourceEmployeeId,
    EMPLOYMENT: snapshot.sourceEmploymentId,
    ...(snapshot.sourceIncomeRelationshipId ? { INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId } : {}),
  }
}

function createService(caseKey: CaoBench02CalculationCaseKey) {
  if (!isPayrollLabEnabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  const spec = getCaoBench02CalculationCase(caseKey)
  if (!spec) throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED')
  return createSyntheticPayrollService({
    repository: createPayrollCalculationRepository(),
    isEnabled: isPayrollLabEnabled,
    engine: makeEngine(spec),
    scenario: makeScenario(spec),
  })
}

export async function runCaoBench02Payroll(
  scope: PayrollScope,
  administrationId: string,
  actorUserId: string,
  caseKey: string,
): Promise<SyntheticPayrollView> {
  if (!isCaoBench02CalculationCase(caseKey)) throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED')
  return await createService(caseKey).runSyntheticPayroll(scope, administrationId, actorUserId)
}

export async function getLatestCaoBench02Payroll(
  scope: PayrollScope,
  administrationId: string,
  caseKey: string,
  runId?: string,
): Promise<SyntheticPayrollView | null> {
  if (!isCaoBench02CalculationCase(caseKey)) throw new SyntheticPayrollServiceError('PAYROLL_UNSUPPORTED')
  const service = createService(caseKey)
  return await loadCaoBench02RunForRequest(
    (requestedRunId) => service.getLatestSyntheticPayroll(scope, administrationId, requestedRunId),
    caseKey,
    runId,
  )
}

export async function loadCaoBench02RunForRequest<T extends Pick<SyntheticPayrollView, 'caseKey' | 'runId'>>(
  readRun: (runId?: string) => Promise<T | null>,
  caseKey: string,
  runId?: string,
): Promise<T | null> {
  const requested = await readRun(runId)
  return selectCaoBench02RunForRequest(requested, caseKey, runId)
}

export function selectCaoBench02RunForRequest<T extends Pick<SyntheticPayrollView, 'caseKey' | 'runId'>>(
  latest: T | null,
  caseKey: string,
  runId?: string,
): T | null {
  if (!latest || latest.caseKey !== caseKey || (runId !== undefined && latest.runId !== runId)) return null
  return latest
}

export function getCaoBench02RuleMetadata(caseKey: CaoBench02CalculationCaseKey) {
  const spec = getCaoBench02CalculationCase(caseKey)
  if (!spec) return null
  const date = periodStart(spec.period)
  const bundle = spec.family === 'KINDEROPVANG'
    ? getKinderopvangRuleBundle(date)
    : spec.family === 'RETAIL_MODE'
      ? getRetailModeRuleBundle(date)
      : getOpenBandsRuleBundle(date, spec.caseKey === 'CAO-BENCH02-C1' ? 'C1' : undefined)
  const rules = bundle.registry.map((rule) => ({
    ruleKey: rule.ruleKey,
    ruleVersion: rule.ruleVersion,
    implementationHash: rule.implementationHash,
    parameterSetHash: rule.parameterSetHash,
    packageId: rule.packageId,
    packageVersion: rule.packageVersion,
  }))
  const arrangement = getArrangementPackage(spec.packageId)
  if (!arrangement) return null
  const arrangementVersion = resolveArrangementVersion(arrangement, date).version
  const rulePackageVersion = bundle.rulePackage.metadata?.version ?? rules[0]?.packageVersion
  const rulePackageId = bundle.rulePackage.metadata?.packageId ?? rules[0]?.packageId
  if (!rulePackageId || !rulePackageVersion) return null
  return {
    caseKey: spec.caseKey,
    fixtureCode: spec.fixtureCode,
    packageId: spec.packageId,
    rulePackageId,
    displayNameKey: spec.displayNameKey,
    arrangementNameKey: spec.arrangementNameKey,
    period: spec.period,
    effectiveDate: date,
    arrangementVersion,
    rulePackageVersion,
    compositionId: bundle.rulePackage.compositionId,
    packageHash: bundle.rulePackage.metadata?.packageHash ?? sha256(stableSerialize(bundle.rulePackage)),
    input: spec.input,
    outputs: bundle.rulePackage.resultMappings,
    rules,
    sourceMetadata: bundle.rulePackage.metadata?.sourceMetadata ?? {},
  }
}

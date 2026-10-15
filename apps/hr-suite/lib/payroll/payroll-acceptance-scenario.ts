import { createHash } from 'node:crypto'
import { FixedDecimal, type PayrollJsonValue, type PayrollSourceProvider, type PayrollSourceSnapshot, type PayrollSourceProviderInput } from '@liquid-hr/payroll-engine'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'

export const PAYROLL_ACCEPTANCE_SCENARIO_CODE = 'NL-2026-MONTHLY-WHITE-REGULAR-TEST'
export const PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE = 'NL-2026-MONTHLY-WHITE-REGULAR-VARIABLE-TEST'
export const PAYROLL_ACCEPTANCE_SCENARIO_VERSION = '1'
export const PAYROLL_ACCEPTANCE_VARIABLE_WAGE_AMOUNT = '500.00'

export type PayrollAcceptanceScenarioVariant = 'REGULAR' | 'VARIABLE_BONUS_DEMO_001'

const sourceScope = {
  tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
  hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
  administrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
} as const

const scenarios = [
  {
    key: 'DEMO-001',
    employeeId: '6f2e2302-748f-8684-0ce6-1b29702d5d92',
    employmentId: '8b0ceb1c-1aa1-84f4-9231-87ec2be1ff94',
    incomeRelationshipNumber: '1',
    grossAmount: '3517.00',
    payrollTaxCreditApplies: false,
    employeePensionRate: '10.00',
    employerPensionRate: '15.00',
    netReimbursement: '45.00',
  },
  {
    key: 'DEMO-002',
    employeeId: '1620bd56-4f74-db62-9f9e-a5ce1d286bc5',
    employmentId: '6236ee34-182d-1676-6635-ad8eed4c21f3',
    incomeRelationshipNumber: '2',
    grossAmount: '3534.00',
    payrollTaxCreditApplies: false,
    employeePensionRate: '13.00',
    employerPensionRate: '13.00',
    netReimbursement: '32.50',
  },
] as const

type Scenario = (typeof scenarios)[number]

export class PayrollAcceptanceScenarioError extends Error {
  constructor(
    readonly code: 'PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE' | 'PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED',
    readonly sourceChecks: readonly string[] = [],
  ) {
    super(code)
    this.name = 'PayrollAcceptanceScenarioError'
  }
}

export function isPayrollAcceptanceScenarioReference(value: unknown): boolean {
  if (!isRecord(value)) return false
  const testScenario = isRecord(value.testScenario) ? value.testScenario : null
  return testScenario?.sourceClassification === 'PAYROLL_TEST_SCENARIO'
    && (testScenario.code === PAYROLL_ACCEPTANCE_SCENARIO_CODE
      || testScenario.code === PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE)
}

export function isCompletePayfull02ScenarioReference(value: unknown): boolean {
  if (!isRecord(value) || !isPayrollAcceptanceScenarioReference(value)) return false
  const payrollOwned = isRecord(value.payfull02Setup) ? value.payfull02Setup : null
  const setup = payrollOwned && isRecord(payrollOwned.setup) ? payrollOwned.setup : null
  const openingBalance = payrollOwned && isRecord(payrollOwned.openingBalance) ? payrollOwned.openingBalance : null
  return setup?.code === 'TEST_SETUP_PAYFULL_02'
    && setup.version === '1.0'
    && typeof setup.sourceHash === 'string'
    && /^[0-9a-f]{64}$/.test(setup.sourceHash)
    && openingBalance?.effectiveFrom === '2026-01-01'
    && openingBalance.effectiveTo === '2026-09-30'
    && typeof openingBalance.sourceHash === 'string'
    && /^[0-9a-f]{64}$/.test(openingBalance.sourceHash)
}

export async function filterPayrollAcceptanceScenarioRuns<
  T extends { readonly run: { readonly id: string }; readonly inputSet: { readonly id: string } },
>(
  summaries: readonly T[],
  readInputReference: (inputSetId: string) => Promise<{ readonly input_reference_json: unknown } | null>,
): Promise<readonly T[]> {
  const scenarioFlags = await Promise.all(summaries.map(async (summary) => {
    const reference = await readInputReference(summary.inputSet.id)
    const referenceJson = reference?.input_reference_json
    return [summary.run.id, isPayrollAcceptanceScenarioReference(referenceJson)
      && !isCompletePayfull02ScenarioReference(referenceJson)] as const
  }))
  const scenarioRunIds = new Set(scenarioFlags.flatMap(([runId, isScenario]) => isScenario ? [runId] : []))
  return summaries.filter((summary) => !scenarioRunIds.has(summary.run.id))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function payrollJson(value: unknown): PayrollJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(payrollJson)
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, payrollJson(entry)]))
  }
  throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED')
}

function uuidFor(value: string): string {
  const bytes = Buffer.from(createHash('sha256').update(value, 'utf8').digest().subarray(0, 16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function money(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  try {
    const parsed = FixedDecimal.parse(String(value))
    return parsed.scale > 2 ? null : parsed.toString(2)
  } catch {
    return null
  }
}

function expectedRegularSourceGaps(snapshot: PayrollSourceSnapshot, scenario: Scenario): string[] {
  const source = isRecord(snapshot.canonicalSource) ? snapshot.canonicalSource : null
  const compensation = source && isRecord(source.compensation) ? source.compensation : null
  const schedule = source && isRecord(source.schedule) ? source.schedule : null
  const contract = source && isRecord(source.contract) ? source.contract : null
  const income = source && isRecord(source.incomeRelationship) ? source.incomeRelationship : null
  const fiscal = source && isRecord(source.fiscalProfile) ? source.fiscalProfile : null
  const salaries = compensation && Array.isArray(compensation.entries) ? compensation.entries : null
  const schedules = schedule && Array.isArray(schedule.entries) ? schedule.entries : null
  const contracts = contract && Array.isArray(contract.entries) ? contract.entries : null
  const salary = salaries?.length === 1 && isRecord(salaries[0]) ? salaries[0] : null
  const roster = schedules?.length === 1 && isRecord(schedules[0]) ? schedules[0] : null
  const contractRow = contracts?.length === 1 && isRecord(contracts[0]) ? contracts[0] : null
  const reasons = fiscal && Array.isArray(fiscal.reasonCodes) ? fiscal.reasonCodes : []
  const taxGaps = snapshot.sourceGaps.filter((gap) => gap.field === 'taxProfile')
  const allowedTaxGapCodes = new Set([
    'NO_CONFIRMED_FISCAL_PROFILE',
    'EMPLOYEE_BIRTH_DATE_REQUIRED_FOR_TAX_CLASSIFICATION',
  ])
  const missingFiscalProfileForTest = fiscal?.status === 'SOURCE_GAP'
    && reasons.includes('NO_CONFIRMED_FISCAL_PROFILE')
    && taxGaps.length > 0
    && taxGaps.every((gap) => gap.status === 'SOURCE_GAP' && allowedTaxGapCodes.has(gap.reasonCode))
  const confirmedFiscalRegularProfile = fiscal?.status === 'CONFIRMED'
    && fiscal.residenceCountryCode === 'NL'
    && fiscal.wageTaxTable === 'WHITE'
    && fiscal.ageCategory === 'UNDER_AOW'
    && fiscal.herleiding === 'STD'
    && fiscal.timePeriod === 'MONTH'
    && fiscal.regularWageOnly === true
    && fiscal.fullPeriodOnly === true
    && fiscal.hasSpecialSituation === false

  const checks: readonly [string, boolean][] = [
    ['source_scope', snapshot.sourceTenantId === sourceScope.tenantId
      && snapshot.sourceHrGroupId === sourceScope.hrGroupId
      && snapshot.sourceAdministrationId === sourceScope.administrationId],
    ['employee_employment', snapshot.sourceEmployeeId === scenario.employeeId
      && snapshot.sourceEmploymentId === scenario.employmentId],
    ['period', snapshot.periodReference.year === 2026 && snapshot.periodReference.month === 10],
    ['income_relationship', snapshot.sourceIncomeRelationshipId !== null
      && income?.status === 'LINKED'
      && income.reportingStatus === 'READY'
      && income.id === snapshot.sourceIncomeRelationshipId
      && typeof income.employmentIncomeRelationshipId === 'string'],
    [`candidate_${scenario.key}`, true],
    ['fiscal_profile_source_supported', missingFiscalProfileForTest || fiscal?.status === 'CONFIRMED'],
    ['fiscal_confirmed_profile', missingFiscalProfileForTest || fiscal?.status === 'CONFIRMED'],
    ['fiscal_admin_confirmation', missingFiscalProfileForTest || fiscal?.sourceClassification === 'HR_ADMIN_CONFIRMED'],
    ['fiscal_profile_gap_free', missingFiscalProfileForTest || taxGaps.length === 0],
    ['fiscal_regular_profile', missingFiscalProfileForTest || confirmedFiscalRegularProfile],
    ['fiscal_credit_match', missingFiscalProfileForTest || fiscal?.payrollTaxCreditApplies === scenario.payrollTaxCreditApplies],
    ['fiscal_single_income_relationship', missingFiscalProfileForTest || fiscal?.activeIncomeRelationshipCount === 1],
    ['fiscal_source', missingFiscalProfileForTest || (
      confirmedFiscalRegularProfile
      && fiscal?.sourceClassification === 'HR_ADMIN_CONFIRMED'
      && taxGaps.length === 0
      && fiscal.payrollTaxCreditApplies === scenario.payrollTaxCreditApplies
      && fiscal.activeIncomeRelationshipCount === 1
    )],
    ['salary', salary?.paymentType === 'PERIODIC_FIXED'
      && salary.paymentFrequency === 'MONTHLY'
      && salary.currencyCode === 'EUR'
      && money(salary.parttimeAmount) === scenario.grossAmount
      && money(salary.fulltimeAmount) === scenario.grossAmount],
    ['schedule', roster?.averageHoursPerWeek === 40
      && roster.fulltimeHoursPerWeek === 40
      && roster.partTimeFactor === 1],
    ['contract', contractRow?.fulltimeHoursPerWeek === 40],
  ]
  return checks.filter(([, passes]) => !passes).map(([key]) => key)
}

function payfull02PayrollOwned(scenario: Scenario, variant: PayrollAcceptanceScenarioVariant) {
  const demo001 = scenario.key === 'DEMO-001'
  const variableRegularWage = variant === 'VARIABLE_BONUS_DEMO_001' && demo001
    ? PAYROLL_ACCEPTANCE_VARIABLE_WAGE_AMOUNT
    : '0.00'
  const employeePension = demo001 ? '191.93' : '251.72'
  const employerPension = demo001 ? '287.90' : '251.72'
  const taxableWage = demo001 ? '3325.07' : '3282.28'
  const opening = {
    grossWageBeforePeriod: demo001 ? '31653.00' : '31806.00',
    holidayReserveBeforePeriod: demo001 ? '2532.24' : '2544.48',
    yearEndReserveBeforePeriod: '0.00',
    taxableWageBeforePeriod: demo001 ? '29925.63' : '29540.52',
    wageTaxBeforePeriod: demo001 ? '10697.22' : '10560.78',
    employeeInsuranceWageBeforePeriod: demo001 ? '29925.63' : '29540.52',
    zvwWageBeforePeriod: demo001 ? '29925.63' : '29540.52',
    employeePensionBeforePeriod: demo001 ? '1727.37' : '2265.48',
    employerPensionBeforePeriod: demo001 ? '2591.10' : '2265.48',
  }
  const payrollOwnedValues = {
    amounts: {
      variableRegularWage,
      specialRewardWage: '0.00',
      netReimbursement: scenario.netReimbursement,
      netDeduction: '0.00',
      netCorrection: '0.00',
    },
    controls: {
      sourceReady: true,
      employmentStartConsistent: true,
      ikvUnambiguous: true,
      salaryConsistent: true,
      hoursConsistent: true,
      normalHoursNotDuplicated: true,
      additionalHoursSupported: true,
      sourceFresh: true,
      compositionSupported: true,
      pensionRuleReady: true,
      socialWageCapClear: true,
      cumulativeContinuity: true,
      reservationContinuity: true,
      hashesConsistent: true,
      variableWageIsRegular: true,
      specialRewardPensionable: false,
      specialRewardIncludedInHolidayReserve: false,
      specialRewardIncludedInYearEndReserve: false,
      netReimbursementsTaxFree: true,
      netDeductionsAuthorized: true,
    },
    taxProfile: {
      specialRewardAnnualWage: '0.00',
      specialRewardAnnualWageResolved: false,
      provenance: 'TEST_SETUP_PAYFULL_02; no special reward is paid in this regular-wage scenario, so no annual-wage band is applied',
    },
    pension: {
      planId: `TEST-PENSION-${scenario.key}`,
      planVersion: '1.0',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      annualFranchise: '19172.00',
      monthlyFranchise: '1597.67',
      annualPensionableMaximum: '137800.00',
      monthlyMaximum: '11483.33',
      totalPremiumRate: demo001 ? '25.00' : '26.00',
      employeeSharePercent: demo001 ? '40.00' : '50.00',
      employerSharePercent: demo001 ? '60.00' : '50.00',
      employeeRate: scenario.employeePensionRate,
      employerRate: scenario.employerPensionRate,
      active: true,
      classification: 'SYNTHETIC_TEST_PLAN_NOT_EXTERNAL_FUND_CONTRACT',
      provenance: 'TEST_SETUP_PAYFULL_02',
    },
    employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
    employerClassifications: {
      awf: { code: 'HIGH', reason: 'Synthetic fixed-term contract classification for TEST setup' },
      aof: { code: 'LOW', reason: 'Synthetic small-employer class for TEST setup' },
      whk: { code: 'TEST_RATE', reason: 'Synthetic employer rate; not represented as a real beschikking' },
      zvw: { code: 'EMPLOYER_LEVY', reason: 'Synthetic employee class subject to employer levy' },
    },
    reserveRates: { holidayAllowance: '8.00', yearEnd: '0.00' },
    reserveTerms: {
      holidayAllowance: 'TEST contract term: 8 percent accrued monthly',
      yearEnd: 'No separate year-end bonus/reserve term in this synthetic contract',
    },
    parameters: { annualSocialWageMaximum: '79409.00' },
    cumulatives: opening,
    actualWorkProjection: { cashCompensatedHours: '0.0000' },
  }
  const openingBalanceValues = {
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-09-30',
    periodCount: 9,
    monthlyGross: scenario.grossAmount,
    monthlyEmployeePension: employeePension,
    monthlyEmployerPension: employerPension,
    monthlyTaxableWage: taxableWage,
    monthlyWageTax: demo001 ? '1188.58' : '1173.42',
    cumulativeBalances: opening,
    source: 'TEST_SETUP_PAYFULL_02 synthetic opening balances calculated from the same effective-dated setup; no prior finalized runs are asserted.',
  }
  const openingBalanceSourceHash = createHash('sha256').update(JSON.stringify(openingBalanceValues), 'utf8').digest('hex')
  const setupHash = createHash('sha256').update(JSON.stringify({ payrollOwnedValues, openingBalanceSourceHash }), 'utf8').digest('hex')
  return {
    ...payrollOwnedValues,
    setup: {
      code: 'TEST_SETUP_PAYFULL_02',
      version: '1.0',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      provenance: 'Controlled synthetic Payroll Lab TEST configuration for the Mars acceptance scope.',
      classification: 'TEST_ONLY_NOT_AN_EXTERNAL_PENSION_CONTRACT_OR_EMPLOYER_DECISION',
      sourceHash: setupHash,
    },
    openingBalance: {
      ...openingBalanceValues,
      sourceHash: openingBalanceSourceHash,
      provenance: 'Explicit effective-dated TEST opening balance. It is not represented as actual finalized January-September payroll history.',
    },
  }
}

function scenarioSnapshot(
  snapshot: PayrollSourceSnapshot,
  scenario: Scenario,
  variant: PayrollAcceptanceScenarioVariant,
): PayrollSourceSnapshot {
  const sourceChecks = expectedRegularSourceGaps(snapshot, scenario)
  if (sourceChecks.length > 0) {
    throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED', sourceChecks)
  }
  if (variant === 'VARIABLE_BONUS_DEMO_001' && scenario.key !== 'DEMO-001') {
    throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')
  }

  const income = snapshot.canonicalSource as Record<string, unknown>
  const incomeRelationship = income.incomeRelationship as Record<string, unknown>
  const scenarioCode = variant === 'VARIABLE_BONUS_DEMO_001'
    ? PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE
    : PAYROLL_ACCEPTANCE_SCENARIO_CODE
  const scenarioProfileId = uuidFor(`${scenarioCode}:${PAYROLL_ACCEPTANCE_SCENARIO_VERSION}:${scenario.key}`)
  const assumptions = {
    residenceCountryCode: 'NL',
    wageTaxTable: 'WHITE',
    ageCategory: 'UNDER_AOW',
    herleiding: 'STD',
    timePeriod: 'MONTH',
    regularWageOnly: true,
    fullPeriodOnly: true,
    hasSpecialSituation: false,
    payrollTaxCreditApplies: scenario.payrollTaxCreditApplies,
  } as const
  const assumptionsHash = createHash('sha256').update(JSON.stringify(assumptions), 'utf8').digest('hex')
  const variableRegularWage = variant === 'VARIABLE_BONUS_DEMO_001'
    ? PAYROLL_ACCEPTANCE_VARIABLE_WAGE_AMOUNT
    : '0.00'
  const sourceScenario = {
    code: scenarioCode,
    version: PAYROLL_ACCEPTANCE_SCENARIO_VERSION,
    key: scenario.key,
    variant,
    variableRegularWage,
    variableWageProvenance: variant === 'VARIABLE_BONUS_DEMO_001'
      ? 'TEST_SETUP_PAYFULL_02 variable-wage revision: fixed €500.00 regular cash component for the October 2026 DEMO-001 TEST scenario; not a Core earning.'
      : 'No variable wage is included in this regular-wage TEST scenario.',
    sourceClassification: 'PAYROLL_TEST_SCENARIO',
    coreSourceHash: snapshot.sourceHash,
    assumptions,
    assumptionsHash,
    note: 'Synthetic TEST-only calculation inputs. The pension arrangement is not a confirmed external fund contract and the tax choice is not an employee declaration.',
  }
  const payrollOwned = payfull02PayrollOwned(scenario, variant)
  const canonicalSource = payrollJson({
    ...(snapshot.canonicalSource as Record<string, unknown>),
    fiscalProfile: {
      status: 'TEST_SCENARIO',
      id: scenarioProfileId,
      incomeRelationshipId: snapshot.sourceIncomeRelationshipId,
      employmentIncomeRelationshipId: incomeRelationship.employmentIncomeRelationshipId,
      effectiveFrom: '2026-10-01',
      effectiveTo: '2026-10-31',
      versionNumber: 1,
      ...assumptions,
      sourceClassification: 'PAYROLL_TEST_SCENARIO',
      sourceReferenceHash: assumptionsHash,
      scenarioCode,
      scenarioVersion: PAYROLL_ACCEPTANCE_SCENARIO_VERSION,
    },
    regularWage: {
      fiscalYear: '2026',
      table: assumptions.wageTaxTable,
      residence: assumptions.residenceCountryCode,
      ageCategory: assumptions.ageCategory,
      herleiding: assumptions.herleiding,
      timePeriod: assumptions.timePeriod,
      payrollTaxCredit: assumptions.payrollTaxCreditApplies,
      regularWage: assumptions.regularWageOnly,
      fullPeriod: assumptions.fullPeriodOnly,
      hasSpecialSituation: assumptions.hasSpecialSituation,
      incomeRelationshipCount: '1',
      grossAmount: scenario.grossAmount,
      fulltimeMonthlyAmount: scenario.grossAmount,
      contractHoursPerWeek: '40',
      fulltimeHoursPerWeek: '40',
    },
    testScenario: sourceScenario,
    payrollOwned,
  })
  const removedScenarioGaps = new Set([
    'NO_CONFIRMED_FISCAL_PROFILE',
    'EMPLOYEE_BIRTH_DATE_REQUIRED_FOR_TAX_CLASSIFICATION',
  ])
  const sourceGaps = snapshot.sourceGaps.filter((gap) => gap.field !== 'taxProfile' || !removedScenarioGaps.has(gap.reasonCode))
  const sourceVersionVector = {
    ...snapshot.sourceVersionVector,
    [`payroll_test_scenario:${scenarioCode}`]: `${PAYROLL_ACCEPTANCE_SCENARIO_VERSION}:${assumptionsHash}:${variableRegularWage}`,
    'payroll_test_setup:TEST_SETUP_PAYFULL_02': String(payrollOwned.setup.sourceHash),
  }
  const hashInput = {
    sourceTenantId: snapshot.sourceTenantId,
    sourceHrGroupId: snapshot.sourceHrGroupId,
    sourceAdministrationId: snapshot.sourceAdministrationId,
    sourceEmployeeId: snapshot.sourceEmployeeId,
    sourceEmploymentId: snapshot.sourceEmploymentId,
    sourceIncomeRelationshipId: snapshot.sourceIncomeRelationshipId,
    periodReference: snapshot.periodReference,
    canonicalSource,
    sourceVersionVector,
    sourceGaps,
  }

  return { ...snapshot, canonicalSource, sourceVersionVector, sourceGaps, sourceHash: hashPayrollSourceSnapshot(hashInput) }
}

export function createPayrollAcceptanceScenarioSourceProvider(
  provider: Pick<PayrollSourceProvider, 'getPayrollSourceSnapshot'>,
  variant: PayrollAcceptanceScenarioVariant = 'REGULAR',
): Pick<PayrollSourceProvider, 'getPayrollSourceSnapshot'> {
  return {
    async getPayrollSourceSnapshot(input: PayrollSourceProviderInput) {
      const scenario = scenarios.find((candidate) => candidate.employeeId === input.employeeId && candidate.employmentId === input.employmentId)
      if (!scenario) throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')
      const snapshot = await provider.getPayrollSourceSnapshot(input)
      return scenarioSnapshot(snapshot, scenario, variant)
    },
  }
}

export const PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES = scenarios.map(({ key, employeeId, employmentId, grossAmount }) => ({
  key,
  employeeId,
  employmentId,
  grossAmount,
}))

import { createHash } from 'node:crypto'
import { FixedDecimal, sha256, stableSerialize, type PayrollJsonValue, type PayrollSourceProvider, type PayrollSourceSnapshot, type PayrollSourceProviderInput } from '@liquid-hr/payroll-engine'
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
    readonly code: 'PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE' | 'PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED' | 'PAYFULL02_TEST_SETUP_NOT_PERSISTED',
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
    && typeof setup.configVersionId === 'string'
    && typeof setup.configHash === 'string'
    && /^[0-9a-f]{64}$/.test(setup.configHash)
    && openingBalance?.effectiveFrom === '2026-01-01'
    && openingBalance.effectiveTo === '2026-09-30'
    && typeof openingBalance.sourceHash === 'string'
    && /^[0-9a-f]{64}$/.test(openingBalance.sourceHash)
    && typeof openingBalance.openingSnapshotId === 'string'
    && typeof openingBalance.openingHash === 'string'
    && /^[0-9a-f]{64}$/.test(openingBalance.openingHash)
    && openingBalance.openingHash === openingBalance.sourceHash
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

function decimal(value: unknown): FixedDecimal | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  try { return FixedDecimal.parse(String(value)) } catch { return null }
}

function decimalProduct(value: unknown, factor: number): string | null {
  const parsed = decimal(value)
  if (!parsed) return null
  try { return parsed.multiply(FixedDecimal.parse(String(factor))).toString(2) } catch { return null }
}

function equalsMoney(left: unknown, right: unknown): boolean {
  const parsedLeft = decimal(left)
  const parsedRight = decimal(right)
  return parsedLeft !== null && parsedRight !== null && parsedLeft.compare(parsedRight) === 0
}

function derivedScenarioControls(input: {
  readonly snapshot: PayrollSourceSnapshot
  readonly scenario: Scenario
  readonly variant: PayrollAcceptanceScenarioVariant
  readonly sourceChecks: readonly string[]
  readonly payrollOwnedValues: Record<string, unknown>
  readonly persistedSetup: PersistedPayrollAcceptanceScenarioSetup
  readonly variableRegularWage: string
}): Record<string, boolean> {
  const { snapshot, scenario, variant, sourceChecks, payrollOwnedValues, persistedSetup, variableRegularWage } = input
  const source = isRecord(snapshot.canonicalSource) ? snapshot.canonicalSource : {}
  const employment = isRecord(source.employment) ? source.employment : {}
  const income = isRecord(source.incomeRelationship) ? source.incomeRelationship : {}
  const pension = isRecord(payrollOwnedValues.pension) ? payrollOwnedValues.pension : {}
  const amounts = isRecord(payrollOwnedValues.amounts) ? payrollOwnedValues.amounts : {}
  const parameters = isRecord(payrollOwnedValues.parameters) ? payrollOwnedValues.parameters : {}
  const opening = isRecord(persistedSetup.openingBalanceJson.cumulativeBalances)
    ? persistedSetup.openingBalanceJson.cumulativeBalances
    : {}
  const sourcePeriods = Array.isArray(persistedSetup.openingBalanceJson.sourcePeriods)
    ? persistedSetup.openingBalanceJson.sourcePeriods
    : []
  const reimbursement = isRecord(payrollOwnedValues.reimbursementEvidence) ? payrollOwnedValues.reimbursementEvidence : {}
  const deductionEvidence = isRecord(payrollOwnedValues.deductionEvidence) ? payrollOwnedValues.deductionEvidence : {}
  const deductions = Array.isArray(deductionEvidence.authorizedItems) ? deductionEvidence.authorizedItems : []
  const reward = isRecord(payrollOwnedValues.specialRewardClassification) ? payrollOwnedValues.specialRewardClassification : {}
  const actualWork = isRecord(payrollOwnedValues.actualWorkProjection) ? payrollOwnedValues.actualWorkProjection : {}
  const currentVariable = decimal(variableRegularWage)
  const monthlyGross = decimal(scenario.grossAmount)
  const baseEmployeePension = decimal(scenario.key === 'DEMO-001' ? '191.93' : '251.72')
  const employeeRate = decimal(pension.employeeRate)
  const variableEmployeePension = currentVariable && employeeRate
    ? currentVariable.multiply(employeeRate).divideExact(FixedDecimal.parse('100')).round(2, 'HALF_UP')
    : FixedDecimal.parse('0.00')
  const currentGross = monthlyGross && currentVariable ? monthlyGross.add(currentVariable) : null
  const currentPension = baseEmployeePension?.add(variableEmployeePension) ?? null
  const currentTaxableWage = currentGross && currentPension ? currentGross.subtract(currentPension) : null
  const socialCap = decimal(parameters.annualSocialWageMaximum)
  const employeeInsuranceOpening = decimal(opening.employeeInsuranceWageBeforePeriod)
  const zvwOpening = decimal(opening.zvwWageBeforePeriod)
  const currentAgeOfSourceMs = Date.now() - Date.parse(snapshot.createdAt)
  const cumulativePeriodCount = persistedSetup.openingBalanceJson.periodCount
  const expectedRegularWage = variant === 'REGULAR'
    ? variableRegularWage === '0.00'
    : variant === 'VARIABLE_BONUS_DEMO_001' && scenario.key === 'DEMO-001'
      && currentVariable !== null && currentVariable.compare(FixedDecimal.parse('0')) > 0
  const rateSplit = decimal(pension.employeeSharePercent)?.add(decimal(pension.employerSharePercent) ?? FixedDecimal.parse('0'))
  const totalRate = decimal(pension.totalPremiumRate)
  const combinedIndividualRates = decimal(pension.employeeRate)?.add(decimal(pension.employerRate) ?? FixedDecimal.parse('0'))
  const benefitClaimSupported = reimbursement.classification === 'ACTUAL_PUBLIC_TRANSPORT_COST_REIMBURSEMENT'
    && reimbursement.approvedStatus === 'APPROVED_SYNTHETIC_TEST_CLAIM'
    && reimbursement.periodStart === '2026-10-01'
    && reimbursement.periodEnd === '2026-10-31'
    && equalsMoney(reimbursement.amount, amounts.netReimbursement)
    && typeof reimbursement.evidenceReference === 'string'
    && reimbursement.evidenceReference.startsWith(`TEST_SETUP_PAYFULL_02/${scenario.key}/`)
  const socialCapClear = !!socialCap && !!employeeInsuranceOpening && !!zvwOpening && !!currentTaxableWage
    && employeeInsuranceOpening.add(currentTaxableWage).compare(socialCap) <= 0
    && zvwOpening.add(currentTaxableWage).compare(socialCap) <= 0
  const validEffectiveEmployment = typeof employment.startsOn === 'string'
    && employment.startsOn <= '2026-10-01'
    && (employment.endsOn === null || (typeof employment.endsOn === 'string' && employment.endsOn >= '2026-10-31'))
    && employment.recordStatus === 'CONFIRMED'
  const sourceHistoryMatchesNinePeriods = sourcePeriods.length === 9 && sourcePeriods.every((value, index) => {
    if (!isRecord(value)) return false
    return value.year === 2026
      && value.month === index + 1
      && typeof value.sourceHash === 'string'
      && /^[0-9a-f]{64}$/.test(value.sourceHash)
      && value.provenance === 'CORE_TEST_SOURCE_SNAPSHOT'
      && equalsMoney(value.monthlyGross, scenario.grossAmount)
  })
  const cumulativeMatchesNinePeriods = cumulativePeriodCount === 9
    && sourceHistoryMatchesNinePeriods
    && equalsMoney(opening.grossWageBeforePeriod, decimalProduct(scenario.grossAmount, 9))
    && equalsMoney(opening.taxableWageBeforePeriod, decimalProduct(scenario.key === 'DEMO-001' ? '3325.07' : '3282.28', 9))
    && equalsMoney(opening.wageTaxBeforePeriod, decimalProduct(scenario.key === 'DEMO-001' ? '1188.58' : '1173.42', 9))
    && equalsMoney(opening.employeePensionBeforePeriod, decimalProduct(scenario.key === 'DEMO-001' ? '191.93' : '251.72', 9))
    && equalsMoney(opening.employerPensionBeforePeriod, decimalProduct(scenario.key === 'DEMO-001' ? '287.90' : '251.72', 9))
  const holidayReserveOpeningMatches = equalsMoney(
    opening.holidayReserveBeforePeriod,
    decimalProduct(FixedDecimal.parse(scenario.grossAmount).multiply(FixedDecimal.parse('0.08')).toString(2), 9),
  )
  const deductionAmount = decimal(amounts.netDeduction)
  const deductionsAuthorized = deductionAmount !== null && deductionAmount.compare(FixedDecimal.parse('0')) >= 0
    && (equalsMoney(amounts.netDeduction, '0.00') || deductions.every((item) => isRecord(item) && item.approved === true))
  const rewardNoPay = reward.status === 'NO_SPECIAL_REWARD_IN_THIS_PERIOD' && equalsMoney(reward.amount, '0.00')
  const configHashValid = /^[0-9a-f]{64}$/.test(persistedSetup.configHash)
  const openingHashValid = /^[0-9a-f]{64}$/.test(persistedSetup.openingHash)
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const noExtraHours = equalsMoney(actualWork.cashCompensatedHours, '0.0000')

  return {
    sourceReady: sourceChecks.length === 0,
    employmentStartConsistent: validEffectiveEmployment,
    ikvUnambiguous: income.status === 'LINKED' && income.reportingStatus === 'READY'
      && typeof income.employmentIncomeRelationshipId === 'string',
    salaryConsistent: !sourceChecks.includes('salary'),
    hoursConsistent: !sourceChecks.includes('schedule') && !sourceChecks.includes('contract'),
    normalHoursNotDuplicated: noExtraHours,
    additionalHoursSupported: noExtraHours,
    sourceFresh: Number.isFinite(currentAgeOfSourceMs) && currentAgeOfSourceMs >= -60_000 && currentAgeOfSourceMs <= 15 * 60_000,
    compositionSupported: persistedSetup.configJson.schemaVersion === 'PAYFULL02_TEST_CALCULATION_CONFIG_V1',
    pensionRuleReady: pension.active === true
      && pension.effectiveFrom === '2026-01-01' && pension.effectiveTo === '2026-12-31'
      && rateSplit?.compare(FixedDecimal.parse('100')) === 0
      && totalRate !== null && combinedIndividualRates?.compare(totalRate) === 0,
    socialWageCapClear: socialCapClear,
    cumulativeContinuity: cumulativeMatchesNinePeriods,
    reservationContinuity: holidayReserveOpeningMatches && equalsMoney(opening.yearEndReserveBeforePeriod, '0.00'),
    hashesConsistent: configHashValid && openingHashValid
      && uuid.test(persistedSetup.configVersionId) && uuid.test(persistedSetup.openingSnapshotId),
    variableWageIsRegular: expectedRegularWage,
    specialRewardPensionable: rewardNoPay ? false : reward.pensionable === true,
    specialRewardIncludedInHolidayReserve: rewardNoPay ? false : reward.includedInHolidayReserve === true,
    specialRewardIncludedInYearEndReserve: rewardNoPay ? false : reward.includedInYearEndReserve === true,
    netReimbursementsTaxFree: equalsMoney(amounts.netReimbursement, '0.00') || benefitClaimSupported,
    netDeductionsAuthorized: deductionsAuthorized,
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
      partTimeFactor: '1.0000',
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
    parameters: {
      annualSocialWageMaximum: '79409.00',
      parameterSetVersion: 'NL-2026-01',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      sourceReferences: {
        awf: 'Belastingdienst 2026 Cijferbijlage, tabel 9: hoog tarief 7,74%; https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf',
        aof: 'Belastingdienst 2026 Cijferbijlage, tabel 9: laag tarief 6,27%; https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf',
        wko: 'Belastingdienst 2026 Cijferbijlage, tabel 9: opslag Wko 0,50%; https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf',
        zvw: 'Belastingdienst 2026: werkgeversheffing Zvw 6,10% en maximumbijdrage-inkomen €79.409; https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/werk_en_inkomen/zorgverzekeringswet/veranderingen-bijdrage-zvw/',
        whk: 'TEST_SETUP_PAYFULL_02 synthetic employer assumption 1,81%; no real employer beschikking is asserted.',
        pension: 'TEST_SETUP_PAYFULL_02 synthetic plan parameters; no external pension fund contract is asserted.',
        reserves: 'TEST_SETUP_PAYFULL_02 synthetic contract terms; holiday allowance is set to 8% and no year-end reserve is configured.',
      },
    },
    cumulatives: opening,
    actualWorkProjection: { cashCompensatedHours: '0.0000' },
    reimbursementEvidence: {
      classification: 'ACTUAL_PUBLIC_TRANSPORT_COST_REIMBURSEMENT',
      approvedStatus: 'APPROVED_SYNTHETIC_TEST_CLAIM',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      amount: scenario.netReimbursement,
      evidenceReference: `TEST_SETUP_PAYFULL_02/${scenario.key}/TRAVEL/2026-10`,
      provenance: 'Synthetic approved public transport expense claim; not a real invoice or payment.',
    },
    deductionEvidence: { authorizedItems: [] },
    specialRewardClassification: {
      status: 'NO_SPECIAL_REWARD_IN_THIS_PERIOD',
      amount: '0.00',
      pensionable: false,
      includedInHolidayReserve: false,
      includedInYearEndReserve: false,
      provenance: 'TEST_SETUP_PAYFULL_02; no special reward is present in the regular October calculation.',
    },
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

export type PayrollAcceptanceScenarioSetupDefinition = {
  readonly scenarioKey: string
  readonly employeeId: string
  readonly employmentId: string
  readonly effectiveFrom: '2026-01-01'
  readonly effectiveTo: '2026-12-31'
  readonly configVersion: 1
  readonly configJson: Record<string, unknown>
  readonly openingSnapshotVersion: 1
  readonly openingAsOfDate: '2026-09-30'
  readonly openingBalanceJson: Record<string, unknown>
}

/**
 * The immutable Payroll Lab TEST configuration and opening balance used by
 * PAYFULL-02. These definitions are persisted through Payrun01Repository
 * before the acceptance flow inspects or calculates a candidate.
 */
export function getPayrollAcceptanceScenarioSetupDefinition(
  employeeId: string,
  employmentId: string,
  januaryThroughSeptemberSourceSnapshots: readonly PayrollSourceSnapshot[],
): PayrollAcceptanceScenarioSetupDefinition {
  const scenario = scenarios.find((candidate) => candidate.employeeId === employeeId && candidate.employmentId === employmentId)
  if (!scenario) throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')

  const expectedMonths = Array.from({ length: 9 }, (_, index) => index + 1)
  if (januaryThroughSeptemberSourceSnapshots.length !== expectedMonths.length) {
    throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED', ['opening_history_period_count'])
  }
  const sourcePeriodReferences: Record<string, unknown>[] = []
  for (const [index, sourceSnapshot] of januaryThroughSeptemberSourceSnapshots.entries()) {
    const month = expectedMonths[index]!
    const source = isRecord(sourceSnapshot.canonicalSource) ? sourceSnapshot.canonicalSource : null
    const employment = source && isRecord(source.employment) ? source.employment : null
    const compensation = source && isRecord(source.compensation) ? source.compensation : null
    const schedule = source && isRecord(source.schedule) ? source.schedule : null
    const contract = source && isRecord(source.contract) ? source.contract : null
    const income = source && isRecord(source.incomeRelationship) ? source.incomeRelationship : null
    const salaryEntries = compensation && Array.isArray(compensation.entries) ? compensation.entries : []
    const scheduleEntries = schedule && Array.isArray(schedule.entries) ? schedule.entries : []
    const contractEntries = contract && Array.isArray(contract.entries) ? contract.entries : []
    const salary = salaryEntries.length === 1 && isRecord(salaryEntries[0]) ? salaryEntries[0] : null
    const roster = scheduleEntries.length === 1 && isRecord(scheduleEntries[0]) ? scheduleEntries[0] : null
    const contractRow = contractEntries.length === 1 && isRecord(contractEntries[0]) ? contractEntries[0] : null
    const periodEndInclusive = new Date(Date.UTC(2026, month, 0)).toISOString().slice(0, 10)
    const periodEndExclusive = new Date(Date.UTC(2026, month, 1)).toISOString().slice(0, 10)
    const dateCovers = (row: Record<string, unknown> | null, endDate: string) =>
      row !== null && typeof row.validFrom === 'string' && row.validFrom <= `2026-${String(month).padStart(2, '0')}-01`
      && (row.validUntil === null || (typeof row.validUntil === 'string' && row.validUntil >= endDate))
    const sourceGaps = sourceSnapshot.sourceGaps.filter((gap) => gap.field !== 'taxProfile')
    const valid = sourceSnapshot.sourceTenantId === sourceScope.tenantId
      && sourceSnapshot.sourceHrGroupId === sourceScope.hrGroupId
      && sourceSnapshot.sourceAdministrationId === sourceScope.administrationId
      && sourceSnapshot.sourceEmployeeId === employeeId
      && sourceSnapshot.sourceEmploymentId === employmentId
      && sourceSnapshot.periodReference.year === 2026
      && sourceSnapshot.periodReference.month === month
      && /^[0-9a-f]{64}$/.test(sourceSnapshot.sourceHash)
      && sourceGaps.length === 0
      && employment?.recordStatus === 'CONFIRMED'
      && typeof employment.startsOn === 'string' && employment.startsOn <= '2026-01-01'
      && (employment.endsOn === null || (typeof employment.endsOn === 'string' && employment.endsOn >= '2026-09-30'))
      && salary?.paymentType === 'PERIODIC_FIXED'
      && salary.paymentFrequency === 'MONTHLY'
      && salary.currencyCode === 'EUR'
      && money(salary.parttimeAmount) === scenario.grossAmount
      && money(salary.fulltimeAmount) === scenario.grossAmount
      && dateCovers(salary, periodEndExclusive)
      && roster?.averageHoursPerWeek === 40
      && roster.fulltimeHoursPerWeek === 40
      && roster.partTimeFactor === 1
      && dateCovers(roster, periodEndInclusive)
      && contractRow?.fulltimeHoursPerWeek === 40
      && dateCovers(contractRow, periodEndExclusive)
      && income?.status === 'LINKED'
      && income.reportingStatus === 'READY'
    if (!valid) {
      throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED', [`opening_history_2026_${String(month).padStart(2, '0')}`])
    }
    sourcePeriodReferences.push({
      year: 2026,
      month,
      sourceHash: sourceSnapshot.sourceHash,
      employmentStartsOn: employment.startsOn,
      employmentEndsOn: employment.endsOn,
      salaryValidFrom: salary.validFrom,
      salaryValidUntil: salary.validUntil,
      monthlyGross: scenario.grossAmount,
      provenance: 'CORE_TEST_SOURCE_SNAPSHOT',
    })
  }

  const owned = payfull02PayrollOwned(scenario, 'REGULAR')
  const { setup: _setup, openingBalance, controls: _controls, cumulatives, ...configuration } = owned
    void _setup
    void _controls
  const configJson = payrollJson({
    schemaVersion: 'PAYFULL02_TEST_CALCULATION_CONFIG_V1',
    code: 'TEST_SETUP_PAYFULL_02',
    version: '1.0',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    source: 'TEST_SETUP_PAYFULL_02',
    classification: 'SYNTHETIC_TEST_ASSUMPTION_NOT_AN_EXTERNAL_PENSION_CONTRACT_OR_EMPLOYER_DECISION',
    statutoryParameterSet: {
      version: 'NL-2026-01',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      references: isRecord(configuration.parameters) ? configuration.parameters.sourceReferences : {},
    },
    pensionArrangement: {
      id: `TEST-PENSION-${scenario.key}`,
      version: '1.0',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
      classification: 'SYNTHETIC_TEST_PLAN_NOT_EXTERNAL_FUND_CONTRACT',
      provenance: 'TEST_SETUP_PAYFULL_02',
    },
    fiscalAssumption: {
      residenceCountryCode: 'NL',
      wageTaxTable: 'WHITE',
      ageCategory: 'UNDER_AOW',
      herleiding: 'STD',
      timePeriod: 'MONTH',
      regularWageOnly: true,
      fullPeriodOnly: true,
      hasSpecialSituation: false,
      payrollTaxCreditApplies: scenario.payrollTaxCreditApplies,
      classification: 'SYNTHETIC_TEST_SCENARIO_NOT_AN_EMPLOYEE_DECLARATION',
      provenance: 'TEST_SETUP_PAYFULL_02',
    },
    values: configuration,
    openingCumulativeBalances: cumulatives,
    provenanceLedger: Object.keys(configuration).sort().map((field) => ({
      field,
      source: 'TEST_SETUP_PAYFULL_02',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      classification: 'SYNTHETIC_TEST_ASSUMPTION',
    })),
  }) as Record<string, unknown>

  const openingBalanceJson = payrollJson({
    schemaVersion: 'PAYFULL02_TEST_OPENING_BALANCE_V1',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-09-30',
    periodCount: 9,
    monthlyGross: scenario.grossAmount,
    monthlyEmployeePension: scenario.key === 'DEMO-001' ? '191.93' : '251.72',
    monthlyEmployerPension: scenario.key === 'DEMO-001' ? '287.90' : '251.72',
    monthlyTaxableWage: scenario.key === 'DEMO-001' ? '3325.07' : '3282.28',
    monthlyWageTax: scenario.key === 'DEMO-001' ? '1188.58' : '1173.42',
    cumulativeBalances: cumulatives,
    source: openingBalance.source,
    provenance: openingBalance.provenance,
    classification: 'EXPLICIT_TEST_OPENING_BALANCE_NOT_FINALIZED_HISTORICAL_PAYROLL',
    calculationBasis: 'Nine monthly periods derived from the effective-dated synthetic salary, pension, tax table, employer, and reserve setup.',
    sourcePeriods: sourcePeriodReferences,
    provenanceLedger: Object.keys(cumulatives).sort().map((field) => ({
      field,
      source: 'TEST_SETUP_PAYFULL_02',
      validFrom: '2026-01-01',
      validTo: '2026-09-30',
      classification: 'SYNTHETIC_TEST_OPENING_BALANCE',
      sourcePeriods: sourcePeriodReferences.map(({ year, month, sourceHash }) => ({ year, month, sourceHash })),
    })),
  }) as Record<string, unknown>

  return {
    scenarioKey: scenario.key,
    employeeId,
    employmentId,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    configVersion: 1,
    configJson,
    openingSnapshotVersion: 1,
    openingAsOfDate: '2026-09-30',
    openingBalanceJson,
  }
}

export type PersistedPayrollAcceptanceScenarioSetup = {
  readonly configVersionId: string
  readonly configHash: string
  readonly configJson: Record<string, unknown>
  readonly openingSnapshotId: string
  readonly openingHash: string
  readonly openingBalanceJson: Record<string, unknown>
}

function scenarioSnapshot(
  snapshot: PayrollSourceSnapshot,
  scenario: Scenario,
  variant: PayrollAcceptanceScenarioVariant,
  persistedSetup: PersistedPayrollAcceptanceScenarioSetup | null,
): PayrollSourceSnapshot {
  const sourceChecks = expectedRegularSourceGaps(snapshot, scenario)
  if (sourceChecks.length > 0) {
    throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED', sourceChecks)
  }
  if (variant === 'VARIABLE_BONUS_DEMO_001' && scenario.key !== 'DEMO-001') {
    throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')
  }
  if (!persistedSetup) throw new PayrollAcceptanceScenarioError('PAYFULL02_TEST_SETUP_NOT_PERSISTED')

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
    variableWageClassification: variant === 'VARIABLE_BONUS_DEMO_001' ? 'REGULAR_WAGE_TEST_REVISION' : 'NO_VARIABLE_WAGE',
    sourceClassification: 'PAYROLL_TEST_SCENARIO',
    coreSourceHash: snapshot.sourceHash,
    assumptions,
    assumptionsHash,
    note: 'Synthetic TEST-only calculation inputs. The pension arrangement is not a confirmed external fund contract and the tax choice is not an employee declaration.',
  }
  const payrollOwnedConfig = isRecord(persistedSetup.configJson.values)
    ? persistedSetup.configJson.values
    : null
  const payrollOwnedOpening = persistedSetup.openingBalanceJson
  if (!payrollOwnedConfig) throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED')
  const payrollOwnedValues = payrollJson({
    ...payrollOwnedConfig,
    cumulatives: payrollOwnedOpening.cumulativeBalances,
    amounts: {
      ...(isRecord(payrollOwnedConfig.amounts) ? payrollOwnedConfig.amounts : {}),
      variableRegularWage,
    },
  })
  const derivedControls = derivedScenarioControls({
    snapshot,
    scenario,
    variant,
    sourceChecks,
    payrollOwnedValues: payrollOwnedValues as Record<string, unknown>,
    persistedSetup,
    variableRegularWage,
  })
  const openingHash = persistedSetup.openingHash
  const setupHash = sha256(stableSerialize({
    code: 'TEST_SETUP_PAYFULL_02',
    version: '1.0',
    configVersionId: persistedSetup.configVersionId,
    configHash: persistedSetup.configHash,
    openingSnapshotId: persistedSetup.openingSnapshotId,
    openingHash,
  }))
  const payrollOwned = {
    ...payrollOwnedValues as Record<string, unknown>,
    controls: derivedControls,
    setup: {
      code: 'TEST_SETUP_PAYFULL_02',
      version: '1.0',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      provenance: 'Controlled synthetic Payroll Lab TEST configuration for the Mars acceptance scope.',
      classification: 'TEST_ONLY_NOT_AN_EXTERNAL_PENSION_CONTRACT_OR_EMPLOYER_DECISION',
      configVersionId: persistedSetup.configVersionId,
      configHash: persistedSetup.configHash,
      sourceHash: setupHash,
    },
    openingBalance: {
      ...payrollOwnedOpening,
      sourceHash: openingHash,
      openingSnapshotId: persistedSetup.openingSnapshotId,
      openingHash,
    },
  }
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
  readPersistedSetup?: (
    employeeId: string,
    employmentId: string,
  ) => Promise<PersistedPayrollAcceptanceScenarioSetup | null>,
): Pick<PayrollSourceProvider, 'getPayrollSourceSnapshot'> {
  return {
    async getPayrollSourceSnapshot(input: PayrollSourceProviderInput) {
      const scenario = scenarios.find((candidate) => candidate.employeeId === input.employeeId && candidate.employmentId === input.employmentId)
      if (!scenario) throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')
      const snapshot = await provider.getPayrollSourceSnapshot(input)
      const persistedSetup = readPersistedSetup
        ? await readPersistedSetup(scenario.employeeId, scenario.employmentId)
        : null
      return scenarioSnapshot(snapshot, scenario, variant, persistedSetup)
    },
  }
}

export const PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES = scenarios.map(({ key, employeeId, employmentId, grossAmount }) => ({
  key,
  employeeId,
  employmentId,
  grossAmount,
}))

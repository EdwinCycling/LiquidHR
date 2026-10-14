import { createHash } from 'node:crypto'
import { FixedDecimal, type PayrollJsonValue, type PayrollSourceProvider, type PayrollSourceSnapshot, type PayrollSourceProviderInput } from '@liquid-hr/payroll-engine'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'

export const PAYROLL_ACCEPTANCE_SCENARIO_CODE = 'NL-2026-MONTHLY-WHITE-REGULAR-TEST'
export const PAYROLL_ACCEPTANCE_SCENARIO_VERSION = '1'

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
  },
  {
    key: 'DEMO-002',
    employeeId: '1620bd56-4f74-db62-9f9e-a5ce1d286bc5',
    employmentId: '6236ee34-182d-1676-6635-ad8eed4c21f3',
    incomeRelationshipNumber: '2',
    grossAmount: '3534.00',
  },
] as const

type Scenario = (typeof scenarios)[number]

export class PayrollAcceptanceScenarioError extends Error {
  constructor(readonly code: 'PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE' | 'PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED') {
    super(code)
    this.name = 'PayrollAcceptanceScenarioError'
  }
}

export function isPayrollAcceptanceScenarioReference(value: unknown): boolean {
  if (!isRecord(value)) return false
  const testScenario = isRecord(value.testScenario) ? value.testScenario : null
  return testScenario?.sourceClassification === 'PAYROLL_TEST_SCENARIO'
    && testScenario.code === PAYROLL_ACCEPTANCE_SCENARIO_CODE
}

export async function filterPayrollAcceptanceScenarioRuns<
  T extends { readonly run: { readonly id: string }; readonly inputSet: { readonly id: string } },
>(
  summaries: readonly T[],
  readInputReference: (inputSetId: string) => Promise<{ readonly input_reference_json: unknown } | null>,
): Promise<readonly T[]> {
  const scenarioFlags = await Promise.all(summaries.map(async (summary) => {
    const reference = await readInputReference(summary.inputSet.id)
    return [summary.run.id, isPayrollAcceptanceScenarioReference(reference?.input_reference_json)] as const
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

function hasExpectedRegularSource(snapshot: PayrollSourceSnapshot, scenario: Scenario): boolean {
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

  return snapshot.sourceTenantId === sourceScope.tenantId
    && snapshot.sourceHrGroupId === sourceScope.hrGroupId
    && snapshot.sourceAdministrationId === sourceScope.administrationId
    && snapshot.sourceEmployeeId === scenario.employeeId
    && snapshot.sourceEmploymentId === scenario.employmentId
    && snapshot.periodReference.year === 2026
    && snapshot.periodReference.month === 10
    && snapshot.sourceIncomeRelationshipId !== null
    && income?.status === 'LINKED'
    && income.reportingStatus === 'READY'
    && income.id === snapshot.sourceIncomeRelationshipId
    && typeof income.employmentIncomeRelationshipId === 'string'
    && fiscal?.status === 'SOURCE_GAP'
    && reasons.includes('NO_CONFIRMED_FISCAL_PROFILE')
    && taxGaps.length > 0
    && taxGaps.every((gap) => gap.status === 'SOURCE_GAP' && allowedTaxGapCodes.has(gap.reasonCode))
    && salary?.paymentType === 'PERIODIC_FIXED'
    && salary.paymentFrequency === 'MONTHLY'
    && salary.currencyCode === 'EUR'
    && money(salary.parttimeAmount) === scenario.grossAmount
    && money(salary.fulltimeAmount) === scenario.grossAmount
    && roster?.averageHoursPerWeek === 40
    && roster.fulltimeHoursPerWeek === 40
    && roster.partTimeFactor === 1
    && contractRow?.fulltimeHoursPerWeek === 40
}

function scenarioSnapshot(snapshot: PayrollSourceSnapshot, scenario: Scenario): PayrollSourceSnapshot {
  if (!hasExpectedRegularSource(snapshot, scenario)) {
    throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED')
  }

  const income = snapshot.canonicalSource as Record<string, unknown>
  const incomeRelationship = income.incomeRelationship as Record<string, unknown>
  const scenarioProfileId = uuidFor(`${PAYROLL_ACCEPTANCE_SCENARIO_CODE}:${PAYROLL_ACCEPTANCE_SCENARIO_VERSION}:${scenario.key}`)
  const assumptions = {
    residenceCountryCode: 'NL',
    wageTaxTable: 'WHITE',
    ageCategory: 'UNDER_AOW',
    herleiding: 'STD',
    timePeriod: 'MONTH',
    regularWageOnly: true,
    fullPeriodOnly: true,
    hasSpecialSituation: false,
    payrollTaxCreditApplies: false,
  } as const
  const assumptionsHash = createHash('sha256').update(JSON.stringify(assumptions), 'utf8').digest('hex')
  const sourceScenario = {
    code: PAYROLL_ACCEPTANCE_SCENARIO_CODE,
    version: PAYROLL_ACCEPTANCE_SCENARIO_VERSION,
    key: scenario.key,
    sourceClassification: 'PAYROLL_TEST_SCENARIO',
    coreSourceHash: snapshot.sourceHash,
    assumptions,
    assumptionsHash,
    note: 'Fictitious test assumptions. This is not an employee declaration and does not establish legal applicability or complete net pay.',
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
      scenarioCode: PAYROLL_ACCEPTANCE_SCENARIO_CODE,
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
    },
    testScenario: sourceScenario,
  })
  const removedScenarioGaps = new Set([
    'NO_CONFIRMED_FISCAL_PROFILE',
    'EMPLOYEE_BIRTH_DATE_REQUIRED_FOR_TAX_CLASSIFICATION',
  ])
  const sourceGaps = snapshot.sourceGaps.filter((gap) => gap.field !== 'taxProfile' || !removedScenarioGaps.has(gap.reasonCode))
  const sourceVersionVector = {
    ...snapshot.sourceVersionVector,
    [`payroll_test_scenario:${PAYROLL_ACCEPTANCE_SCENARIO_CODE}`]: `${PAYROLL_ACCEPTANCE_SCENARIO_VERSION}:${assumptionsHash}`,
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
): Pick<PayrollSourceProvider, 'getPayrollSourceSnapshot'> {
  return {
    async getPayrollSourceSnapshot(input: PayrollSourceProviderInput) {
      const scenario = scenarios.find((candidate) => candidate.employeeId === input.employeeId && candidate.employmentId === input.employmentId)
      if (!scenario) throw new PayrollAcceptanceScenarioError('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')
      const snapshot = await provider.getPayrollSourceSnapshot(input)
      return scenarioSnapshot(snapshot, scenario)
    },
  }
}

export const PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES = scenarios.map(({ key, employeeId, employmentId, grossAmount }) => ({
  key,
  employeeId,
  employmentId,
  grossAmount,
}))

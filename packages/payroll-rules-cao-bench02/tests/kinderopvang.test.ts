import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PayrollEngineError,
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  KINDEROPVANG_CALCULATION_SCALE,
  KINDEROPVANG_EFFECTIVE_FROM,
  KINDEROPVANG_EFFECTIVE_TO,
  KINDEROPVANG_IMPLEMENTATION_SHA256,
  KINDEROPVANG_K1_SYNTHETIC_INPUT,
  KINDEROPVANG_K2_SYNTHETIC_INPUT,
  KINDEROPVANG_SEPTEMBER_BOUNDARY,
  getKinderopvangRuleBundle,
} from '../src/kinderopvang'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const implementationPath = resolve(testDirectory, '../src/kinderopvang.ts')

type ScenarioInput = typeof KINDEROPVANG_K1_SYNTHETIC_INPUT

function scenarioInput(overrides: Partial<Record<keyof ScenarioInput, string>> = {}): Readonly<Record<string, string>> {
  return { ...KINDEROPVANG_K1_SYNTHETIC_INPUT, ...overrides }
}

function sourceSnapshot(asOfDate: string, scenario: Readonly<Record<string, string>>): PayrollSourceSnapshot {
  const canonicalSource = { scenario }
  const period = asOfDate.slice(0, 7).split('-')
  return {
    id: `synthetic-kinderopvang-${asOfDate}`,
    sourceTenantId: 'tenant-kinderopvang-benchmark',
    sourceHrGroupId: 'group-kinderopvang-benchmark',
    sourceAdministrationId: 'administration-kinderopvang-benchmark',
    sourceEmployeeId: 'synthetic-k1-k2',
    sourceEmploymentId: 'synthetic-k1-k2-employment',
    sourceIncomeRelationshipId: 'synthetic-k1-k2-income-relationship',
    periodReference: { year: Number(period[0]), month: Number(period[1]) },
    canonicalSource,
    sourceVersionVector: { employment: 'synthetic-v1', salary: 'synthetic-v1', roster: 'synthetic-v1' },
    sourceGaps: [],
    sourceHash: sha256(stableSerialize(canonicalSource)),
    createdAt: '2026-10-03T09:00:00.000Z',
  }
}

function calculate(asOfDate: string, scenario: Readonly<Record<string, string>>) {
  const bundle = getKinderopvangRuleBundle(asOfDate)
  const snapshot = sourceSnapshot(asOfDate, scenario)
  const calculationInputs = buildCalculationInputs(snapshot, bundle.rulePackage, { effectiveDate: asOfDate })
  const result = calculatePayroll(calculationInputs, bundle.registry)
  return { bundle, result }
}

function mappedValues(result: ReturnType<typeof calculatePayroll>): Readonly<Record<string, string | boolean>> {
  return Object.fromEntries(result.resultRows.map((row) => [row.key, row.value]))
}

function componentValues(result: ReturnType<typeof calculatePayroll>): Readonly<Record<string, string | boolean>> {
  const outputs = result.componentResults.find((component) => component.componentCode === 'KO_GROSS_PAY')?.outputs ?? []
  return Object.fromEntries(outputs.map(({ name, value }) => [name, value]))
}

function expectEngineCode(action: () => unknown, code: string): void {
  try {
    action()
    throw new Error(`Expected PayrollEngineError ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(PayrollEngineError)
    expect((error as PayrollEngineError).code).toBe(code)
  }
}

describe('Kinderopvang 2025-2026 synthetic K1/K2 rule slice', () => {
  it('pins official sources, the two supported 2026 table rows and the September version boundary', () => {
    const january = getKinderopvangRuleBundle('2026-08-31')
    const september = getKinderopvangRuleBundle(KINDEROPVANG_SEPTEMBER_BOUNDARY)
    const januaryComponent = january.rulePackage.components.find((component) => component.code === 'KO_GROSS_PAY')
    const septemberComponent = september.rulePackage.components.find((component) => component.code === 'KO_GROSS_PAY')

    expect(january.rulePackageVersion).toBe('2026.01')
    expect(september.rulePackageVersion).toBe('2026.09')
    expect(januaryComponent).toMatchObject({
      effectiveFrom: KINDEROPVANG_EFFECTIVE_FROM,
      effectiveTo: '2026-08-31',
      parameters: { fullTimeMonthlySalary: { valueType: 'MONEY', value: '2777' } },
    })
    expect(septemberComponent).toMatchObject({
      effectiveFrom: KINDEROPVANG_SEPTEMBER_BOUNDARY,
      effectiveTo: KINDEROPVANG_EFFECTIVE_TO,
      parameters: { fullTimeMonthlySalary: { valueType: 'MONEY', value: '2819' } },
    })

    const metadata = september.rulePackage.metadata?.sourceMetadata
    expect(metadata).toMatchObject({
      salaryAppendixTitle: 'Bijlage 2 Cao Kinderopvang 2025-2026 - Salarisschalen',
      salaryAppendixUrl: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-04/Bijlage-2-Salarisschalen-Cao-Kinderopvang-2025-2026.pdf',
      salaryDeterminationUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen',
      workHourSupplementUrl: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/werkurentoeslag',
      salaryScale: '6',
      salaryNumber: '12',
      fullTimeHoursPerWeek: '36',
      fullTimeAnnualHours2026: '1879.2',
      salaryIncreaseBoundary: KINDEROPVANG_SEPTEMBER_BOUNDARY,
      implementationSha256: KINDEROPVANG_IMPLEMENTATION_SHA256,
    })
    expect(metadata?.precisionPolicy).toContain('cent rounding is not applied')
    expect(january.rulePackage.metadata?.packageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(september.rulePackage.metadata?.packageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(september.registry).toHaveLength(1)
    expect(september.registry[0]?.allowedComponents).toEqual([
      { id: septemberComponent?.id, code: 'KO_GROSS_PAY', version: '2026.09' },
    ])
  })

  it('calculates K1 full-time scale 6 number 12 at the August table value', () => {
    const { result } = calculate('2026-08-31', KINDEROPVANG_K1_SYNTHETIC_INPUT)

    expect(result.status).toBe('CALCULATED')
    expect(mappedValues(result)).toEqual({
      base_salary: '2777.000000000000000000',
      work_hour_supplement: '0.000000000000000000',
      gross_salary: '2777.000000000000000000',
    })
    expect(componentValues(result)).toMatchObject({
      fullTimeMonthlySalary: '2777.000000000000000000',
      baseSalary: '2777.000000000000000000',
      hourlySalary: '17.733077905491698595',
      workHourSupplement: '0.000000000000000000',
      grossEarnings: '2777.000000000000000000',
    })
    expect(result.resultRows.some((row) => /tax|net/i.test(row.key))).toBe(false)
  })

  it('calculates K2 part-time base and four Sunday hours at 45% to engine precision', () => {
    const { result } = calculate('2026-09-01', KINDEROPVANG_K2_SYNTHETIC_INPUT)

    expect(result.status).toBe('CALCULATED')
    expect(mappedValues(result)).toEqual({
      base_salary: '1879.333333333333333333',
      work_hour_supplement: '32.402298850574712643',
      gross_salary: '1911.735632183908045976',
    })
    expect(componentValues(result)).toMatchObject({
      fullTimeMonthlySalary: '2819.000000000000000000',
      baseSalary: '1879.333333333333333333',
      hourlySalary: '18.001277139208173690',
      workHourSupplement: '32.402298850574712643',
      grossEarnings: '1911.735632183908045976',
    })
    const calculationTrace = result.trace.find((step) => step.componentCode === 'KO_GROSS_PAY')?.registeredRuleTrace ?? []
    const classificationTrace = calculationTrace.find((step) => step.code === 'classification.accepted')
    expect(classificationTrace?.values.rulePackageVersion).toEqual({ valueType: 'STRING', value: '2026.09' })
    expect(classificationTrace?.values).not.toHaveProperty('arrangementVersion')
    expect(calculationTrace.map((step) => step.code)).toEqual([
      'classification.accepted',
      'salary.table-and-proration',
      'supplement.sunday-work-hours',
      'result.gross-earnings',
    ])
    const premiumTrace = calculationTrace.find((step) => step.code === 'supplement.sunday-work-hours')
    expect(premiumTrace?.values.sundayPremiumPercent).toEqual({ valueType: 'PERCENTAGE', value: '45' })
    expect(premiumTrace?.sourceReference).toContain('art. 6.2(1)-(3)')
    expect(premiumTrace?.sourceReference).toContain('salary-number-18 cap and exceptions')
    expect(result.trace.find((step) => step.componentCode === 'KO_GROSS_PAY')?.rulePackageProvenance)
      .toMatchObject({ packageId: 'CAO-KINDEROPVANG-2025-2026', version: '2026.09' })
    expect(result.resultRows.some((row) => /tax|net/i.test(row.key))).toBe(false)
  })

  it('rejects dates outside the selected package and invalid calendar dates', () => {
    expectEngineCode(() => getKinderopvangRuleBundle('2026-02-30'), 'KO_DATE_INVALID')
    expectEngineCode(() => getKinderopvangRuleBundle('not-a-date'), 'KO_DATE_INVALID')
    expectEngineCode(() => getKinderopvangRuleBundle('2025-12-31'), 'KO_DATE_OUT_OF_SCOPE')
    expectEngineCode(() => getKinderopvangRuleBundle('2027-01-01'), 'KO_DATE_OUT_OF_SCOPE')
  })

  it('fails closed for an unimplemented salary scale or number', () => {
    expectEngineCode(() => calculate('2026-08-31', scenarioInput({ salaryScale: '5' })), 'KO_UNSUPPORTED_SCALE')
    expectEngineCode(() => calculate('2026-08-31', scenarioInput({ salaryNumber: '18' })), 'KO_UNSUPPORTED_SALARY_NUMBER')
  })

  it('rejects unsupported full-time bases and invalid contract or Sunday hours', () => {
    expectEngineCode(
      () => calculate('2026-08-31', scenarioInput({ fullTimeHoursPerWeek: '40' })),
      'KO_FULL_TIME_HOURS_UNSUPPORTED',
    )
    expectEngineCode(
      () => calculate('2026-08-31', scenarioInput({ contractHoursPerWeek: '0' })),
      'KO_CONTRACT_HOURS_INVALID',
    )
    expectEngineCode(
      () => calculate('2026-08-31', scenarioInput({ contractHoursPerWeek: '37' })),
      'KO_CONTRACT_HOURS_INVALID',
    )
    expectEngineCode(
      () => calculate('2026-08-31', scenarioInput({ sundayHoursInPeriod: '-1' })),
      'KO_SUNDAY_HOURS_INVALID',
    )
    expectEngineCode(
      () => calculate('2026-08-31', scenarioInput({ sundayHoursInPeriod: '25' })),
      'KO_SUNDAY_HOURS_INVALID',
    )
  })

  it('pins the implementation SHA-256 with a normalized hash declaration', async () => {
    const source = (await readFile(implementationPath, 'utf8')).replace(/\r\n/g, '\n')
    const normalizedSource = source.replace(
      /export const KINDEROPVANG_IMPLEMENTATION_SHA256 = '[^']+'/,
      "export const KINDEROPVANG_IMPLEMENTATION_SHA256 = '__KO_IMPLEMENTATION_SHA256__'",
    )
    const computedHash = createHash('sha256').update(normalizedSource, 'utf8').digest('hex')

    expect(KINDEROPVANG_IMPLEMENTATION_SHA256).toBe(computedHash)
    expect(KINDEROPVANG_CALCULATION_SCALE).toBe(18)
  })
})

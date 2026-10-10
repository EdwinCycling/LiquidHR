import { describe, expect, it } from 'vitest'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollJsonValue,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  evaluateMetalektroHpApplicability,
  getOpenBandsRuleBundle,
  type MetalektroHpApplicabilityInput,
} from '../src/open-bands'

interface ScenarioInput {
  readonly scenarioCode: 'B1' | 'B2' | 'C1'
  readonly bandCode: string
  readonly agreedHourlyRate: string
  readonly contractHoursPerWeek: string
  readonly fullTimeHoursPerWeek: string
  readonly monthlyGrossSalary: string
}

const expectedBands = [
  { code: 'A', jan: ['16.29', '17.74', '19.19'], jul: ['16.62', '18.10', '19.57'] },
  { code: 'B', jan: ['16.29', '17.88', '19.46'], jul: ['16.62', '18.24', '19.85'] },
  { code: 'C', jan: ['16.43', '18.23', '20.03'], jul: ['16.76', '18.60', '20.43'] },
  { code: 'D', jan: ['16.58', '18.73', '20.88'], jul: ['16.91', '19.11', '21.30'] },
  { code: 'E', jan: ['17.00', '19.44', '21.87'], jul: ['17.34', '19.83', '22.31'] },
  { code: 'F', jan: ['17.56', '20.35', '23.14'], jul: ['17.92', '20.77', '23.61'] },
  { code: 'G', jan: ['18.28', '21.49', '24.70'], jul: ['18.64', '21.92', '25.20'] },
  { code: 'H', jan: ['19.13', '22.77', '26.41'], jul: ['19.51', '23.23', '26.94'] },
  { code: 'I', jan: ['20.26', '24.40', '28.53'], jul: ['20.66', '24.88', '29.10'] },
  { code: 'J', jan: ['21.53', '26.38', '31.22'], jul: ['21.96', '26.91', '31.85'] },
] as const

function sourceSnapshot(scenario: ScenarioInput, month: number): PayrollSourceSnapshot {
  const canonicalSource = {
    scenario: {
      scenarioCode: scenario.scenarioCode,
      bandCode: scenario.bandCode,
      agreedHourlyRate: scenario.agreedHourlyRate,
      contractHoursPerWeek: scenario.contractHoursPerWeek,
      fullTimeHoursPerWeek: scenario.fullTimeHoursPerWeek,
      monthlyGrossSalary: scenario.monthlyGrossSalary,
    },
  } satisfies PayrollJsonValue
  return {
    id: `snapshot-cao-bench02-${scenario.scenarioCode}-${month}`,
    sourceTenantId: 'tenant-cao-bench02-synthetic',
    sourceHrGroupId: 'group-cao-bench02-synthetic',
    sourceAdministrationId: 'administration-cao-bench02-synthetic',
    sourceEmployeeId: `employee-cao-bench02-${scenario.scenarioCode}`,
    sourceEmploymentId: `employment-cao-bench02-${scenario.scenarioCode}`,
    sourceIncomeRelationshipId: `ikv-cao-bench02-${scenario.scenarioCode}`,
    periodReference: { year: 2026, month },
    canonicalSource,
    sourceVersionVector: { employment: 'synthetic-v1', incomeRelationship: 'synthetic-v1' },
    sourceGaps: [],
    sourceHash: sha256(stableSerialize(canonicalSource)),
    createdAt: '2026-10-03T08:00:00.000Z',
  } satisfies PayrollSourceSnapshot
}

function calculate(scenario: ScenarioInput, effectiveDate: string) {
  const bundle = getOpenBandsRuleBundle(effectiveDate, scenario.scenarioCode === 'C1' ? 'C1' : undefined)
  const snapshot = sourceSnapshot(scenario, Number(effectiveDate.slice(5, 7)))
  const inputs = buildCalculationInputs(snapshot, bundle.rulePackage, {
    scopeInstanceIds: { EMPLOYMENT: snapshot.sourceEmploymentId! },
    effectiveDate,
  })
  const result = calculatePayroll(inputs, bundle.registry)
  const values = Object.fromEntries(result.resultRows.map((row) => [row.key, row.value])) as Record<string, string | boolean>
  return { bundle, result, values }
}

function bandScenario(code: string, rate: string): ScenarioInput {
  return {
    scenarioCode: 'B2',
    bandCode: code,
    agreedHourlyRate: rate,
    contractHoursPerWeek: '32',
    fullTimeHoursPerWeek: '40',
    monthlyGrossSalary: '0',
  }
}

const eligibleH1: MetalektroHpApplicabilityInput = {
  asOfDate: '2026-10-03',
  employerScope: { value: 'IN_SCOPE', evidence: 'Synthetic employer stipulated inside Metalektro scope.' },
  functionLevel: {
    value: 'ABOVE_BASIS_CAO',
    evidence: 'Synthetic job evaluation assigns ISF 600 points, HP group L.',
    evaluationSystem: 'ISF',
    isfPoints: 600,
    hpGroup: 'L',
  },
  enterpriseDirector: { value: 'NO', evidence: 'Synthetic H1 is an employed senior specialist, not an enterprise director.' },
  directlyDeterminesEnterprisePolicy: { value: 'NO', evidence: 'Synthetic specialist duties do not include direct enterprise policy-making.' },
}

describe('CAO-BENCH02 synthetic company open-band rules', () => {
  it('selects the January and July band versions on their effective-date boundary', () => {
    const june = getOpenBandsRuleBundle('2026-06-30')
    const july = getOpenBandsRuleBundle('2026-07-01')

    expect(june.arrangementVersion).toBe('2026.01')
    expect(june.rulePackage.metadata?.sourceMetadata.bandTableEffectiveFrom).toBe('2026-01-01')
    expect(july.arrangementVersion).toBe('2026.07')
    expect(july.rulePackage.metadata?.sourceMetadata.bandTableEffectiveFrom).toBe('2026-07-01')
    expect(july.rulePackage.metadata?.sourceMetadata.officialSourceIdentifier).toBe('Staatscourant 2026, nr. 11183')
    expect(july.rulePackage.metadata?.sourceMetadata.monthlyGrossPolicy).toContain('40 x 52 / 12')
    expect(july.rulePackage.metadata?.sourceMetadata.monthlyGrossPolicy).toContain('does not adopt source factor 164.667')
  })

  it.each(expectedBands.flatMap((band) => [
    { band, effectiveDate: '2026-01-01', expected: band.jan },
    { band, effectiveDate: '2026-07-01', expected: band.jul },
  ]))('uses the published $band.code bounds and HALF_UP midpoint on $effectiveDate', ({ band, effectiveDate, expected }) => {
    const { values } = calculate(bandScenario(band.code, expected[1]), effectiveDate)

    expect(values.salary_band_minimum).toBe(expected[0])
    expect(values.salary_band_midpoint).toBe(expected[1])
    expect(values.salary_band_maximum).toBe(expected[2])
    expect(values.compa_ratio).toBe('100.000000')
    expect(values.band_status).toBe('WITHIN_BAND')
  })

  it('uses Band F midpoint for full-time B1 and the synthetic 40-hour monthly basis', () => {
    const b1: ScenarioInput = {
      scenarioCode: 'B1',
      bandCode: 'F',
      agreedHourlyRate: '0',
      contractHoursPerWeek: '40',
      fullTimeHoursPerWeek: '40',
      monthlyGrossSalary: '0',
    }
    const january = calculate(b1, '2026-01-01').values
    const july = calculate(b1, '2026-07-01').values

    expect(january.gross_hourly_rate).toBe('20.35')
    expect(january.gross_salary).toBe('3527.33')
    expect(january.compa_ratio).toBe('100.000000')
    expect(july.gross_hourly_rate).toBe('20.77')
    expect(july.gross_salary).toBe('3600.13')
    expect(july.compa_ratio).toBe('100.000000')
  })

  it('normalizes part-time B2 to full-time for the ratio without changing its agreed pay', () => {
    const b2 = bandScenario('F', '21.00')
    const january = calculate(b2, '2026-01-01').values
    const july = calculate(b2, '2026-07-01').values

    expect(january.gross_hourly_rate).toBe('21.00')
    expect(january.gross_salary).toBe('2912.00')
    expect(january.full_time_equivalent_gross_monthly_salary).toBe('3640.00')
    expect(january.compa_ratio).toBe('103.194103')
    expect(january.compa_ratio_display).toBe('103.19')
    expect(july.gross_hourly_rate).toBe('21.00')
    expect(july.gross_salary).toBe('2912.00')
    expect(july.compa_ratio).toBe('101.107366')
    expect(july.compa_ratio_display).toBe('101.11')
  })

  it.each([
    { date: '2026-01-01', minimum: '17.56', maximum: '23.14', below: '17.55', above: '23.15' },
    { date: '2026-07-01', minimum: '17.92', maximum: '23.61', below: '17.91', above: '23.62' },
  ])('classifies inclusive Band F edges and outside rates for $date', ({ date, minimum, maximum, below, above }) => {
    expect(calculate(bandScenario('F', below), date).values.band_status).toBe('BELOW_MIN')
    expect(calculate(bandScenario('F', minimum), date).values.band_status).toBe('WITHIN_BAND')
    expect(calculate(bandScenario('F', maximum), date).values.band_status).toBe('WITHIN_BAND')
    expect(calculate(bandScenario('F', above), date).values.band_status).toBe('ABOVE_MAX')
  })

  it('passes through C1 monthly gross without a band, compa-ratio or other payroll outputs', () => {
    const c1: ScenarioInput = {
      scenarioCode: 'C1',
      bandCode: '',
      agreedHourlyRate: '0',
      contractHoursPerWeek: '0',
      fullTimeHoursPerWeek: '0',
      monthlyGrossSalary: '12000',
    }
    const { result, values } = calculate(c1, '2026-07-01')

    expect(values.gross_salary).toBe('12000.00')
    expect(values.salary_strategy).toBe('FREELY_NEGOTIATED')
    expect(values.band_applied).toBe(false)
    expect(values.band_status).toBe('NO_APPLICABLE_CAO_IDENTIFIED_IN_SYNTHETIC_DEMO')
    expect(values.band_applied).toBe(false)
    expect(values.compa_ratio_display).toBeUndefined()
    expect(values.salary_band_minimum).toBeUndefined()
    expect(values.salary_band_midpoint).toBeUndefined()
    expect(values.salary_band_maximum).toBeUndefined()
    expect(result.resultRows.map((row) => row.key).sort()).toEqual([
      'band_applied', 'band_status', 'gross_salary', 'salary_basis', 'salary_strategy',
    ])
    expect(result.resultRows.map((row) => row.key)).not.toEqual(expect.arrayContaining([
      'net_salary', 'wage_tax', 'employer_cost', 'employer_costs',
    ]))
  })
})

describe('Metalektro Hoger Personeel applicability evidence', () => {
  it('supports an evidenced synthetic higher specialist and uses the July scope amendment', () => {
    const result = evaluateMetalektroHpApplicability(eligibleH1)

    expect(result.status).toBe('SUPPORTED')
    expect(result.sourceIdentifier).toBe('Staatscourant 2026, nr. 22083')
    expect(result.sourceEffectiveFrom).toBe('2026-07-17')
  })

  it('requires review when the employer scope is unknown', () => {
    const result = evaluateMetalektroHpApplicability({
      ...eligibleH1,
      employerScope: { value: 'UNKNOWN', evidence: '' },
    })

    expect(result.status).toBe('REQUIRES_REVIEW')
    expect(result.missingEvidence).toContain('employerScope')
  })

  it('excludes a directly policy-making director even when pay and CEO title match', () => {
    const directorAtSamePay = {
      ...eligibleH1,
      enterpriseDirector: { value: 'YES' as const, evidence: 'Synthetic comparison fixture is a board director.' },
      directlyDeterminesEnterprisePolicy: { value: 'YES' as const, evidence: 'The comparison role directly determines enterprise policy.' },
      jobTitle: 'CEO',
      monthlyGrossSalary: '12000',
    }
    const result = evaluateMetalektroHpApplicability(directorAtSamePay)

    expect(result.status).toBe('EXCLUDED')
    expect(result.reasonCode).toBe('EXCLUDED_ROLE_CATEGORY')
  })

  it('selects the pre-amendment scope wording on 16 July and the amendment on 17 July', () => {
    const before = evaluateMetalektroHpApplicability({ ...eligibleH1, asOfDate: '2026-07-16' })
    const effective = evaluateMetalektroHpApplicability({ ...eligibleH1, asOfDate: '2026-07-17' })

    expect(before.sourceIdentifier).toBe('Staatscourant 2026, nr. 14650')
    expect(effective.sourceIdentifier).toBe('Staatscourant 2026, nr. 22083')
    expect(before.status).toBe('SUPPORTED')
    expect(effective.status).toBe('SUPPORTED')
  })
})

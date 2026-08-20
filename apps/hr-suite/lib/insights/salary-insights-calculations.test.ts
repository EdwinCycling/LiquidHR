import { describe, expect, it } from 'vitest'
import { buildSalaryInsightFilterOptions, createSalaryInsightReport, defaultSalaryInsightFilters, normalizeSalaryInsightRows, sumScaled } from './salary-insights-calculations'
import type { SalaryInsightProjectionRow } from './salary-insights-types'

function row(overrides: Partial<SalaryInsightProjectionRow> = {}): SalaryInsightProjectionRow {
  return {
    employeeId: 'employee-1', employeeNumber: 'E-1', employeeName: 'Employee 1', employmentId: 'employment-1', employmentNumber: 'EMP-1',
    administrationId: 'admin-1', administrationName: 'Mercurius BV', administrationNumber: 'M-1', departmentId: 'department-1', departmentName: 'Services',
    managerId: 'manager-1', managerName: 'Manager', functionName: 'Consultant', functionGroupId: 'group-1', functionGroupName: 'Consulting', seniorityId: 'senior-1', seniorityName: 'Medior',
    locationId: 'location-1', locationName: 'Amsterdam', laborConditionSetId: 'cao-1', laborConditionSetName: 'CAO Liquid', employmentType: 'EMPLOYEE', fte: '1',
    fulltimeSalary: '5000.00', actualSalary: '5000.00', salaryRoute: 'SALARY_BAND', salaryStructureId: 'structure-1', salaryStructureName: 'Functiebands 2026', salaryStructureCode: 'BANDS-2026', salaryStructureActive: true,
    revisionId: 'revision-1', revisionEffectiveFrom: '2026-01-01', revisionNumber: 1, salaryBandId: 'band-1', salaryBandCode: 'E3', salaryBandName: 'E3', bandMinimum: '4000.00', bandMidpoint: '5000.00', bandMaximum: '6000.00',
    salaryScaleId: null, salaryScaleCode: null, salaryScaleName: null, salaryStepCode: null, salaryStepName: null, hasPublishedRevision: true, hasResolvedBand: true, hasResolvedScaleStep: false, structureDisabled: false,
    ...overrides,
  }
}

describe('salary insights calculations', () => {
  it('reuses band calculations at exact boundaries', () => {
    const rows = normalizeSalaryInsightRows([
      row({ employeeId: 'under', fulltimeSalary: '3999.99' }),
      row({ employeeId: 'minimum', fulltimeSalary: '4000.00' }),
      row({ employeeId: 'midpoint', fulltimeSalary: '5000.00' }),
      row({ employeeId: 'maximum', fulltimeSalary: '6000.00' }),
      row({ employeeId: 'above', fulltimeSalary: '6000.01' }),
    ])
    expect(rows.map((item) => item.bandStatus)).toEqual(['UNDER_MINIMUM', 'WITHIN_RANGE', 'WITHIN_RANGE', 'WITHIN_RANGE', 'ABOVE_MAXIMUM'])
    expect(rows[2].compaRatio).toBe('100.00')
    expect(rows[2].rangePenetration).toBe('50.00')
  })

  it('keeps compa-ratio when a band has an open maximum', () => {
    const normalized = normalizeSalaryInsightRows([row({ bandMaximum: null, fulltimeSalary: '5500.00' })])
    expect(normalized[0].compaRatio).toBe('110.00')
    expect(normalized[0].rangePenetration).toBeNull()
  })

  it('does not turn a missing minimum-wage amount into zero', () => {
    const report = createSalaryInsightReport({
      report: 'salary-overview',
      asOfDate: '2026-08-14',
      rows: [row({ salaryRoute: 'MINIMUM_WAGE', fulltimeSalary: null, actualSalary: null }), row({ employeeId: 'manual', salaryRoute: 'MANUAL', salaryStructureId: null, salaryStructureName: null, fulltimeSalary: '3000.00', actualSalary: '2400.00' })],
      filters: defaultSalaryInsightFilters('salary-overview', '2026-08-14'),
      isHrAdmin: true,
    })
    expect(report.kpis.find((item) => item.id === 'salarySum')?.value).toBe('2400.00')
    expect(report.kpis.find((item) => item.id === 'averageFulltimeSalary')?.value).toBe('3000.00')
  })

  it('keeps insufficient peer groups free of peer metrics', () => {
    const rows = Array.from({ length: 4 }, (_, index) => row({ employeeId: `employee-${index}`, employmentId: `employment-${index}`, employeeName: `Employee ${index}`, fulltimeSalary: `${4000 + index * 100}.00` }))
    const report = createSalaryInsightReport({ report: 'salary-internal-position', asOfDate: '2026-08-14', rows, filters: defaultSalaryInsightFilters('salary-internal-position', '2026-08-14'), isHrAdmin: true })
    expect(report.rows.every((item) => item.peerStatus === 'INSUFFICIENT')).toBe(true)
    expect(report.rows.every((item) => item.peerMedian === null && item.peerAverage === null && item.relativePosition === null && item.peerGroupSize === null)).toBe(true)
  })

  it('calculates peer metrics only at five valid members', () => {
    const rows = Array.from({ length: 5 }, (_, index) => row({ employeeId: `employee-${index}`, employmentId: `employment-${index}`, employeeName: `Employee ${index}`, fulltimeSalary: `${4000 + index * 100}.00` }))
    const report = createSalaryInsightReport({ report: 'salary-internal-position', asOfDate: '2026-08-14', rows, filters: defaultSalaryInsightFilters('salary-internal-position', '2026-08-14'), isHrAdmin: true })
    expect(report.rows.every((item) => item.peerStatus === 'SUFFICIENT')).toBe(true)
    expect(report.rows.find((item) => item.employeeId === 'employee-2')?.peerMedian).toBe('4200.00')
    expect(report.rows[0]).not.toHaveProperty('peerNames')
  })

  it('keeps decimal sums exact', () => {
    expect(sumScaled(['0.10', '0.20', null])).toBe('0.30')
  })

  it('uses the five contractual compa buckets', () => {
    const salaries = ['3900.00', '4250.00', '4750.00', '5250.00', '6000.00']
    const report = createSalaryInsightReport({
      report: 'salary-band-position',
      asOfDate: '2026-08-14',
      rows: salaries.map((fulltimeSalary, index) => row({ employeeId: `compa-${index}`, employmentId: `compa-employment-${index}`, fulltimeSalary })),
      filters: defaultSalaryInsightFilters('salary-band-position', '2026-08-14'),
      isHrAdmin: true,
    })
    expect(report.chart.kind).toBe('compa-distribution')
    expect(report.chart.buckets.map((bucket) => bucket.count)).toEqual([1, 1, 1, 1, 1])
    expect(report.chart.buckets.map((bucket) => bucket.label)).toEqual(['<80%', '80–<90%', '90–<100%', '100–<110%', '≥110%'])
  })

  it('keeps the four band status groups visible, including empty groups', () => {
    const report = createSalaryInsightReport({
      report: 'salary-band-status',
      asOfDate: '2026-08-14',
      rows: [
        row({ employeeId: 'under', fulltimeSalary: '3999.99' }),
        row({ employeeId: 'within', fulltimeSalary: '5000.00' }),
        row({ employeeId: 'above', fulltimeSalary: '6000.01' }),
        row({ employeeId: 'invalid', fulltimeSalary: null, bandMinimum: null, bandMidpoint: null, bandMaximum: null, hasPublishedRevision: false, hasResolvedBand: false }),
      ],
      filters: defaultSalaryInsightFilters('salary-band-status', '2026-08-14'),
      isHrAdmin: true,
    })
    expect(report.chart.buckets.map((bucket) => bucket.value)).toEqual(['UNDER_MINIMUM', 'WITHIN_RANGE', 'ABOVE_MAXIMUM', 'NO_VALID_BAND'])
    expect(report.chart.buckets.map((bucket) => bucket.count)).toEqual([1, 1, 1, 1])
  })

  it('uses only available full-time salary amounts for the overview distribution', () => {
    const report = createSalaryInsightReport({
      report: 'salary-overview',
      asOfDate: '2026-08-14',
      rows: [row({ employeeId: 'with-amount', fulltimeSalary: '5000.00' }), row({ employeeId: 'without-amount', salaryRoute: 'MINIMUM_WAGE', fulltimeSalary: null, actualSalary: null })],
      filters: defaultSalaryInsightFilters('salary-overview', '2026-08-14'),
      isHrAdmin: true,
    })
    expect(report.chart.population).toBe(1)
    expect(report.chart.excluded).toBe(1)
    expect(report.chart.buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(1)
  })

  it('derives dependent options from the other active filters', () => {
    const rows = normalizeSalaryInsightRows([
      row({ employeeId: 'one', salaryStructureId: 'structure-1', salaryBandId: 'band-1', salaryBandName: 'E3' }),
      row({ employeeId: 'two', salaryStructureId: 'structure-2', salaryStructureName: 'Other structure', salaryBandId: 'band-2', salaryBandName: 'F4' }),
    ])
    const filters = { ...defaultSalaryInsightFilters('salary-band-position', '2026-08-14'), structures: ['structure-1'] }
    const options = buildSalaryInsightFilterOptions(rows, filters)
    expect(options.bands).toEqual([{ value: 'band-1', label: 'E3' }])
  })
})

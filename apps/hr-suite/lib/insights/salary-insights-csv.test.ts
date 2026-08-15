import { describe, expect, it } from 'vitest'
import { createSalaryInsightReport, defaultSalaryInsightFilters } from './salary-insights-calculations'
import { salaryInsightCsv } from './salary-insights-csv'
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

describe('salary insights CSV export', () => {
  it('contains the selected date, scope and active filters without peer identities', () => {
    const filters = { ...defaultSalaryInsightFilters('salary-overview', '2025-01-01'), administrations: ['admin-1'] }
    const report = createSalaryInsightReport({ report: 'salary-overview', asOfDate: '2025-01-01', rows: [row()], filters, isHrAdmin: true })
    const csv = salaryInsightCsv(report)
    expect(csv).toContain('report;salary-overview')
    expect(csv).toContain('asOfDate;2025-01-01')
    expect(csv).toContain('authorizedPopulation;1')
    expect(csv).toContain('filter.administrations;admin-1')
    expect(csv).toContain('Employee 1')
    expect(csv).not.toContain('peerNames')
  })
})

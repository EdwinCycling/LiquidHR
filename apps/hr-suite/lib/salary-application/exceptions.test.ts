import { describe, expect, it } from 'vitest'
import { findSalaryExceptionForRule, type SalaryExceptionLabel } from './exceptions'

const labels: SalaryExceptionLabel[] = [
  { id: 'structure-1', code: 'STRUCT-1', name: 'Structuur 1' },
  { id: 'scale-1', code: 'S1', name: 'Schaal 1', structureId: 'structure-1' },
  { id: 'band-1', code: 'B1', name: 'Band 1', structureId: 'structure-1' },
]
const revisions = [
  { id: 'revision-old', salaryStructureId: 'structure-1', effectiveFrom: '2026-01-01', revisionNumber: 1, status: 'PUBLISHED' },
  { id: 'revision-future', salaryStructureId: 'structure-1', effectiveFrom: '2026-07-01', revisionNumber: 2, status: 'PUBLISHED' },
] as const
const context = {
  today: '2026-06-01', employeeName: 'Ada Lovelace', administrationName: 'LiquidHR BV', employmentNumber: 'E-001', structures: labels.slice(0, 1), scales: labels.slice(1, 2), bands: labels.slice(2), revisions,
  scaleValues: [{ revisionId: 'revision-old', salaryScaleId: 'scale-1', code: 'S1' }],
  steps: [{ revisionId: 'revision-old', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2500.00' }],
  bandValues: [{ revisionId: 'revision-old', salaryBandId: 'band-1', code: 'B1', minimumAmount: '2000.00', midpointAmount: '2500.00', maximumAmount: '3000.00' }],
}

describe('salary exceptions', () => {
  it('reports a disappeared scale step as high urgency without inventing a new amount', () => {
    const exception = findSalaryExceptionForRule({ ...context, row: { id: 'salary-1', employmentId: 'employment-1', employeeId: 'employee-1', validFrom: '2026-01-01', salaryRoute: 'SCALE_WITH_STEPS', salaryStructureId: 'structure-1', salaryScaleId: 'scale-1', salaryStepCode: 'A1', salaryBandId: null, fulltimeAmount: '2500.00' } })
    expect(exception).toMatchObject({ kind: 'SCALE_STEP_INVALID', severity: 'HIGH', invalidFrom: '2026-07-01', salaryAmount: '2500.00' })
  })

  it('reports a disappeared band as informative while keeping the salary amount', () => {
    const exception = findSalaryExceptionForRule({ ...context, row: { id: 'salary-2', employmentId: 'employment-1', employeeId: 'employee-1', validFrom: '2026-01-01', salaryRoute: 'SALARY_BAND', salaryStructureId: 'structure-1', salaryScaleId: null, salaryStepCode: null, salaryBandId: 'band-1', fulltimeAmount: '2400.00' } })
    expect(exception).toMatchObject({ kind: 'SALARY_BAND_INVALID', severity: 'INFO', invalidFrom: '2026-07-01', salaryAmount: '2400.00' })
  })

  it('does not create an exception when the logical rule exists in the future revision', () => {
    const exception = findSalaryExceptionForRule({
      ...context,
      scaleValues: [...context.scaleValues, { revisionId: 'revision-future', salaryScaleId: 'scale-1', code: 'S1' }],
      steps: [...context.steps, { revisionId: 'revision-future', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2700.00' }],
      row: { id: 'salary-3', employmentId: 'employment-1', employeeId: 'employee-1', validFrom: '2026-01-01', salaryRoute: 'SCALE_WITH_STEPS', salaryStructureId: 'structure-1', salaryScaleId: 'scale-1', salaryStepCode: 'A1', salaryBandId: null, fulltimeAmount: '2500.00' },
    })
    expect(exception).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { resolveSalaryBandAtDate, resolveSalaryScaleStepAtDate } from './resolution'

const revisions = [
  { id: 'revision-old', salaryStructureId: 'structure-1', effectiveFrom: '2026-01-01', revisionNumber: 1, status: 'PUBLISHED' },
  { id: 'revision-new', salaryStructureId: 'structure-1', effectiveFrom: '2026-07-01', revisionNumber: 2, status: 'PUBLISHED' },
  { id: 'revision-draft', salaryStructureId: 'structure-1', effectiveFrom: '2026-09-01', revisionNumber: 3, status: 'DRAFT' },
] as const

describe('salary revision resolution', () => {
  it('resolves the old and new logical scale step to their revision amount', () => {
    const oldStep = resolveSalaryScaleStepAtDate({
      salaryStructureId: 'structure-1', salaryScaleId: 'scale-1', stepCode: 'A1', asOf: '2026-06-30', revisions,
      scaleValues: [{ revisionId: 'revision-old', salaryScaleId: 'scale-1', code: 'S1' }, { revisionId: 'revision-new', salaryScaleId: 'scale-1', code: 'S1' }],
      steps: [
        { revisionId: 'revision-old', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2500.00' },
        { revisionId: 'revision-new', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2700.00' },
      ],
    })
    const newStep = resolveSalaryScaleStepAtDate({
      salaryStructureId: 'structure-1', salaryScaleId: 'scale-1', stepCode: 'a1', asOf: '2026-07-01', revisions,
      scaleValues: [{ revisionId: 'revision-old', salaryScaleId: 'scale-1', code: 'S1' }, { revisionId: 'revision-new', salaryScaleId: 'scale-1', code: 'S1' }],
      steps: [
        { revisionId: 'revision-old', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2500.00' },
        { revisionId: 'revision-new', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2700.00' },
      ],
    })
    expect(oldStep?.fulltimeAmount).toBe('2500.00')
    expect(oldStep?.revisionId).toBe('revision-old')
    expect(newStep?.fulltimeAmount).toBe('2700.00')
    expect(newStep?.revisionId).toBe('revision-new')
  })

  it('does not let a draft revision change the resolved amount', () => {
    const result = resolveSalaryScaleStepAtDate({
      salaryStructureId: 'structure-1', salaryScaleId: 'scale-1', stepCode: 'A1', asOf: '2026-09-01', revisions,
      scaleValues: [{ revisionId: 'revision-new', salaryScaleId: 'scale-1', code: 'S1' }, { revisionId: 'revision-draft', salaryScaleId: 'scale-1', code: 'S1' }],
      steps: [{ revisionId: 'revision-new', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2700.00' }, { revisionId: 'revision-draft', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '3000.00' }],
    })
    expect(result?.fulltimeAmount).toBe('2700.00')
    expect(result?.revisionId).toBe('revision-new')
  })

  it('resolves a band revision independently from the employee salary amount', () => {
    const oldBand = resolveSalaryBandAtDate({
      salaryStructureId: 'structure-1', salaryBandId: 'band-1', asOf: '2026-06-30', revisions,
      bandValues: [{ revisionId: 'revision-old', salaryBandId: 'band-1', code: 'B1', minimumAmount: '2000.00', midpointAmount: '2500.00', maximumAmount: '3000.00' }, { revisionId: 'revision-new', salaryBandId: 'band-1', code: 'B1', minimumAmount: '2100.00', midpointAmount: '2600.00', maximumAmount: '3200.00' }],
    })
    const newBand = resolveSalaryBandAtDate({
      salaryStructureId: 'structure-1', salaryBandId: 'band-1', asOf: '2026-07-01', revisions,
      bandValues: [{ revisionId: 'revision-old', salaryBandId: 'band-1', code: 'B1', minimumAmount: '2000.00', midpointAmount: '2500.00', maximumAmount: '3000.00' }, { revisionId: 'revision-new', salaryBandId: 'band-1', code: 'B1', minimumAmount: '2100.00', midpointAmount: '2600.00', maximumAmount: '3200.00' }],
    })
    expect(oldBand?.midpointAmount).toBe('2500.00')
    expect(newBand?.midpointAmount).toBe('2600.00')
  })

  it('returns no band or scale step when the logical item disappears', () => {
    expect(resolveSalaryBandAtDate({
      salaryStructureId: 'structure-1', salaryBandId: 'band-1', asOf: '2026-07-01', revisions,
      bandValues: [{ revisionId: 'revision-old', salaryBandId: 'band-1', code: 'B1', minimumAmount: '2000.00', midpointAmount: '2500.00', maximumAmount: '3000.00' }],
    })).toBeNull()
    expect(resolveSalaryScaleStepAtDate({
      salaryStructureId: 'structure-1', salaryScaleId: 'scale-1', stepCode: 'A1', asOf: '2026-07-01', revisions,
      scaleValues: [{ revisionId: 'revision-old', salaryScaleId: 'scale-1', code: 'S1' }],
      steps: [{ revisionId: 'revision-old', salaryScaleId: 'scale-1', stepCode: 'A1', fulltimeAmount: '2500.00' }],
    })).toBeNull()
  })
})

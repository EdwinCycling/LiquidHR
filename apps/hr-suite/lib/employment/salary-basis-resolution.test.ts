import { describe, expect, it } from 'vitest'
import { resolveEmploymentSalaryBasis } from './salary-basis-resolution'

const revisions = [
  { salaryStructureId: 'cao', effectiveFrom: '2026-09-01', revisionNumber: 4, status: 'PUBLISHED', salaryBasis: 'CAO_SCALE' },
  { salaryStructureId: 'cao', effectiveFrom: '2026-11-01', revisionNumber: 5, status: 'DRAFT', salaryBasis: 'CUSTOM_SCALE' },
  { salaryStructureId: 'custom', effectiveFrom: '2025-01-01', revisionNumber: 1, status: 'PUBLISHED', salaryBasis: 'CUSTOM_SCALE' },
]

describe('resolveEmploymentSalaryBasis', () => {
  it('uses the published CAO basis effective on the salary date', () => {
    expect(resolveEmploymentSalaryBasis({ route: 'SCALE_WITH_STEPS', salaryStructureId: 'cao', effectiveOn: '2026-11-01', revisions }))
      .toBe('CAO_SCALE')
  })

  it('keeps a generic scale as a custom scale', () => {
    expect(resolveEmploymentSalaryBasis({ route: 'SCALE_WITH_STEPS', salaryStructureId: 'custom', effectiveOn: '2026-11-01', revisions }))
      .toBe('CUSTOM_SCALE')
  })

  it('does not apply a future or unpublished revision early', () => {
    expect(resolveEmploymentSalaryBasis({ route: 'SCALE_WITH_STEPS', salaryStructureId: 'cao', effectiveOn: '2026-08-31', revisions }))
      .toBe('CUSTOM_SCALE')
  })

  it('preserves a saved CAO basis if revision options are unavailable', () => {
    expect(resolveEmploymentSalaryBasis({ route: 'SCALE_WITH_STEPS', salaryStructureId: 'cao', effectiveOn: '2026-11-01', revisions: [], existingBasis: 'CAO_SCALE' }))
      .toBe('CAO_SCALE')
  })

  it('maps non-scale routes directly to their salary basis', () => {
    expect(resolveEmploymentSalaryBasis({ route: 'MINIMUM_WAGE', salaryStructureId: null, effectiveOn: '2026-11-01', revisions }))
      .toBe('MINIMUM_WAGE')
  })
})

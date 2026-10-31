import { describe, expect, it } from 'vitest'
import { salaryStructureRevisionIdsForStructures, selectedSalaryStructureRevisionId, type SalaryStructureRevisionScope } from './catalog-read-scope'

const revisions: SalaryStructureRevisionScope[] = [
  { id: 'old', salary_structure_id: 'childcare', revision_number: 1, effective_from: '2025-01-01', status: 'PUBLISHED' },
  { id: 'current', salary_structure_id: 'childcare', revision_number: 2, effective_from: '2026-09-01', status: 'PUBLISHED' },
  { id: 'draft', salary_structure_id: 'childcare', revision_number: 3, effective_from: '2026-09-01', status: 'DRAFT' },
  { id: 'other', salary_structure_id: 'retail', revision_number: 1, effective_from: '2026-07-01', status: 'PUBLISHED' },
]

describe('selected salary structure revision read scope', () => {
  it('uses the explicitly selected revision when it belongs to the selected structure', () => {
    expect(selectedSalaryStructureRevisionId(revisions, 'childcare', 'old')).toBe('old')
  })

  it('uses the preferred revision when the detail route has no revision id', () => {
    expect(selectedSalaryStructureRevisionId(revisions, 'childcare', null)).toBe('draft')
  })

  it('does not read steps for a missing or mismatched structure revision', () => {
    expect(selectedSalaryStructureRevisionId(revisions, null, 'current')).toBeNull()
    expect(selectedSalaryStructureRevisionId(revisions, 'childcare', 'other')).toBeNull()
    expect(selectedSalaryStructureRevisionId(revisions, 'missing', null)).toBeNull()
  })

  it('includes every revision only for structures enabled in the administration', () => {
    expect(salaryStructureRevisionIdsForStructures(revisions, ['childcare', 'childcare'])).toEqual(['old', 'current', 'draft'])
    expect(salaryStructureRevisionIdsForStructures(revisions, [])).toEqual([])
  })
})

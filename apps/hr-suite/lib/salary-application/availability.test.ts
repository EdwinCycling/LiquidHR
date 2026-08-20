import { describe, expect, it } from 'vitest'
import { hasLaborConditionStructureFilter, resolveSalaryStructureIntersection } from './availability'

describe('salary structure availability', () => {
  it('uses the sole common structure when administration and CAO each have one', () => {
    expect(resolveSalaryStructureIntersection(['structure-1'], ['structure-1'])).toEqual(['structure-1'])
  })

  it('filters an administration catalog to one linked CAO structure', () => {
    expect(resolveSalaryStructureIntersection(['admin-1', 'admin-2'], ['admin-2'])).toEqual(['admin-2'])
  })

  it('returns the intersection for multiple administration and CAO structures', () => {
    expect(resolveSalaryStructureIntersection(['structure-1', 'structure-2', 'structure-3'], ['structure-2', 'structure-3', 'cao-only'])).toEqual(['structure-2', 'structure-3'])
  })

  it('applies the same rule to a company-specific agreement', () => {
    expect(resolveSalaryStructureIntersection(['company-structure', 'group-structure'], ['company-structure'])).toEqual(['company-structure'])
  })

  it('keeps the administration catalog when the CAO has zero links', () => {
    expect(resolveSalaryStructureIntersection(['structure-1', 'structure-2'], [])).toEqual(['structure-1', 'structure-2'])
    expect(resolveSalaryStructureIntersection(['structure-1', 'structure-2'])).toEqual(['structure-1', 'structure-2'])
    expect(hasLaborConditionStructureFilter([])).toBe(false)
    expect(hasLaborConditionStructureFilter(undefined)).toBe(false)
  })

  it('excludes a CAO-only structure and an administration-only structure', () => {
    expect(resolveSalaryStructureIntersection(['administration-only', 'shared'], ['shared', 'cao-only'])).toEqual(['shared'])
  })

  it('cannot return a structure outside the administration catalog', () => {
    expect(resolveSalaryStructureIntersection(['hr-group-a'], ['hr-group-b'])).toEqual([])
  })
})

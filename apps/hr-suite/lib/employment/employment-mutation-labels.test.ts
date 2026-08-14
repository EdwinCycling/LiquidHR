import { describe, expect, it } from 'vitest'
import { employmentMutationTranslationKey } from './employment-mutation-labels'

describe('employmentMutationTranslationKey', () => {
  it('resolves the salary-band label inside the salary application namespace', () => {
    expect(employmentMutationTranslationKey('salaryBand')).toBe('salaryApplication.salaryBand')
  })

  it('keeps ordinary employment labels at their existing namespace', () => {
    expect(employmentMutationTranslationKey('change')).toBe('change')
  })
})

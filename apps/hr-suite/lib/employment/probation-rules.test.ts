import { describe, expect, it } from 'vitest'
import { addCalendarMonths, getProbationRule, validateProbation } from './probation-rules'

describe('probation rules', () => {
  it('allows no probation for a fixed term of six months or less', () => {
    expect(getProbationRule({ durationType: 'DEFINITE', startsOn: '2026-01-01', endsOn: '2026-07-01' })).toMatchObject({ allowed: false, maximumMonths: 0 })
  })

  it('allows one month between six months and two years', () => {
    expect(getProbationRule({ durationType: 'DEFINITE', startsOn: '2026-01-01', endsOn: '2027-01-02' })).toMatchObject({ allowed: true, maximumMonths: 1 })
    expect(getProbationRule({ durationType: 'DEFINITE', startsOn: '2026-01-01', endsOn: '2027-01-02', caoAllowsTwoMonths: true })).toMatchObject({ allowed: true, maximumMonths: 2 })
    expect(getProbationRule({ durationType: 'DEFINITE', startsOn: '2026-01-01', endsOn: '2028-01-01' })).toMatchObject({ allowed: true, maximumMonths: 2 })
  })

  it('allows two months for an indefinite or two-year contract', () => {
    expect(getProbationRule({ durationType: 'INDEFINITE', startsOn: '2026-01-31' })).toMatchObject({ maximumMonths: 2 })
    expect(addCalendarMonths('2026-01-31', 2)).toBe('2026-03-31')
  })

  it('returns explicit validation codes for prohibited and excessive probation', () => {
    expect(validateProbation({ durationType: 'DEFINITE', startsOn: '2026-01-01', endsOn: '2026-07-01', probationApplies: true, probationEndsOn: '2026-02-01' })).toBe('PROBATION_NOT_ALLOWED')
    expect(validateProbation({ durationType: 'DEFINITE', startsOn: '2026-01-01', endsOn: '2027-01-01', probationApplies: true, probationEndsOn: '2026-03-01' })).toBe('PROBATION_MAXIMUM_EXCEEDED')
  })
})

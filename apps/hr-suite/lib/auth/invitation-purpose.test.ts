import { describe, expect, it } from 'vitest'
import { resolveEmployeeInvitationEligibility, resolveEmployeeInvitationPurpose } from './invitation-purpose'

describe('employee invitation purpose', () => {
  it.each([
    ['no employments', []],
    ['draft only', [{ startsOn: '2026-09-17', endsOn: null, recordStatus: 'DRAFT' }]],
    ['cancelled only', [{ startsOn: '2026-09-17', endsOn: null, recordStatus: 'CANCELLED' }]],
    ['past-ended confirmed only', [{ startsOn: '2026-09-01', endsOn: '2026-09-16', recordStatus: 'CONFIRMED' }]],
  ] as const)('rejects %s as non-invitable', (_label, employments) => {
    expect(resolveEmployeeInvitationEligibility('2026-09-17', employments)).toEqual({ status: 'EMPLOYMENT_REQUIRED', purpose: null })
    expect(() => resolveEmployeeInvitationPurpose('2026-09-17', employments)).toThrow('EMPLOYMENT_REQUIRED')
  })

  it('uses preboarding only for a future confirmed employment', () => {
    expect(resolveEmployeeInvitationPurpose('2026-09-17', [{
      startsOn: '2026-09-18', endsOn: null, recordStatus: 'CONFIRMED',
    }])).toBe('PREBOARDING_EMPLOYEE')
  })

  it('uses normal employee activation for an already employed employee', () => {
    expect(resolveEmployeeInvitationPurpose('2026-09-17', [{
      startsOn: '2026-09-01', endsOn: '2026-09-30', recordStatus: 'CONFIRMED',
    }])).toBe('EMPLOYEE_ACTIVATION')
  })

  it('does not let a future employment replace an active employment', () => {
    expect(resolveEmployeeInvitationPurpose('2026-09-17', [
      { startsOn: '2026-09-01', endsOn: '2026-09-30', recordStatus: 'CONFIRMED' },
      { startsOn: '2026-10-01', endsOn: null, recordStatus: 'CONFIRMED' },
    ])).toBe('EMPLOYEE_ACTIVATION')
  })
})

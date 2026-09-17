import { describe, expect, it } from 'vitest'
import { resolveEmployeeInvitationPurpose } from './invitation-purpose'

describe('employee invitation purpose', () => {
  it('uses preboarding only for a future confirmed employment', () => {
    expect(resolveEmployeeInvitationPurpose('2026-09-17', [{
      startsOn: '2026-09-18', endsOn: null, recordStatus: 'CONFIRMED',
    }])).toBe('PREBOARDING_EMPLOYEE')
  })

  it('uses normal employee activation for an already employed employee', () => {
    expect(resolveEmployeeInvitationPurpose('2026-09-17', [{
      startsOn: '2026-09-01', endsOn: null, recordStatus: 'CONFIRMED',
    }])).toBe('EMPLOYEE_ACTIVATION')
  })

  it('does not let a future employment replace an active employment', () => {
    expect(resolveEmployeeInvitationPurpose('2026-09-17', [
      { startsOn: '2026-09-01', endsOn: null, recordStatus: 'CONFIRMED' },
      { startsOn: '2026-10-01', endsOn: null, recordStatus: 'CONFIRMED' },
    ])).toBe('EMPLOYEE_ACTIVATION')
  })
})

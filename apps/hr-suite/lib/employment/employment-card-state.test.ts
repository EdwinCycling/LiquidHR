import { describe, expect, it } from 'vitest'
import { getEmploymentCardStatus, hasActiveEmployment } from './employment-card-state'

const today = '2026-07-29'

describe('employment card state', () => {
  it('marks a current employment active through its end date', () => {
    expect(getEmploymentCardStatus({ startsOn: '2026-01-01', endsOn: today, recordStatus: 'CONFIRMED' }, today)).toBe('ACTIVE')
  })

  it('marks future and ended records separately', () => {
    expect(getEmploymentCardStatus({ startsOn: '2026-08-01', endsOn: null, recordStatus: 'CONFIRMED' }, today)).toBe('FUTURE')
    expect(getEmploymentCardStatus({ startsOn: '2025-01-01', endsOn: '2026-07-28', recordStatus: 'CONFIRMED' }, today)).toBe('ENDED')
    expect(getEmploymentCardStatus({ startsOn: '2026-01-01', endsOn: null, recordStatus: 'CANCELLED' }, today)).toBe('ENDED')
  })

  it('detects when the employee has no active employment', () => {
    expect(hasActiveEmployment([
      { startsOn: '2024-01-01', endsOn: '2026-07-28', recordStatus: 'CONFIRMED' },
      { startsOn: '2026-08-01', endsOn: null, recordStatus: 'CONFIRMED' },
    ], today)).toBe(false)
  })
})

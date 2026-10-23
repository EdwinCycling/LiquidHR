import { describe, expect, it } from 'vitest'
import { formatProcessWorkDeadlineRemaining, projectProcessWorkDeadline } from './deadline-projection'

const active = { status: 'OPEN', instanceStatus: 'RUNNING' }

describe('process work deadline projection', () => {
  it('distinguishes no SLA, on track, due within 24 hours, and overdue', () => {
    const asOf = new Date('2026-10-23T12:00:00.000Z')
    expect(projectProcessWorkDeadline({ ...active, deadlineAt: null, asOf }).deadlineStatus).toBe('NO_DEADLINE')
    expect(projectProcessWorkDeadline({ ...active, deadlineAt: '2026-10-25T12:00:00.000Z', asOf }).deadlineStatus).toBe('ON_TRACK')
    expect(projectProcessWorkDeadline({ ...active, deadlineAt: '2026-10-24T12:00:00.000Z', asOf }).deadlineStatus).toBe('NEAR_DUE')
    expect(projectProcessWorkDeadline({ ...active, deadlineAt: '2026-10-23T11:59:59.000Z', asOf }).deadlineStatus).toBe('OVERDUE')
  })

  it('keeps the exact deadline on time and never marks completed work overdue', () => {
    const asOf = new Date('2026-10-23T12:00:00.000Z')
    const exact = projectProcessWorkDeadline({ ...active, deadlineAt: asOf.toISOString(), asOf })
    expect(exact).toEqual({ deadlineStatus: 'NEAR_DUE', deadlineRemainingSeconds: 0 })
    const completed = projectProcessWorkDeadline({ status: 'COMPLETED', instanceStatus: 'COMPLETED', deadlineAt: '2026-10-22T12:00:00.000Z', asOf })
    expect(completed).toEqual({ deadlineStatus: 'CLOSED', deadlineRemainingSeconds: null })
  })

  it('formats positive and negative remaining time in plain language', () => {
    const labels = {
      deadlineNoDeadline: 'no deadline', deadlineOnTrack: 'on track', deadlineNearDue: 'near due', deadlineClosed: 'closed',
      deadlineDueNow: 'deadline is now', deadlineRemaining: '{duration} left', deadlineOverdueBy: '{duration} overdue',
      deadlineDaysSingular: 'day', deadlineDaysPlural: 'days', deadlineHoursSingular: 'hour', deadlineHoursPlural: 'hours',
      deadlineMinutesSingular: 'minute', deadlineMinutesPlural: 'minutes',
    }
    expect(formatProcessWorkDeadlineRemaining(0, labels)).toBe('deadline is now')
    expect(formatProcessWorkDeadlineRemaining(3 * 3600, labels)).toBe('3 hours left')
    expect(formatProcessWorkDeadlineRemaining(-75, labels)).toBe('2 minutes overdue')
  })
})

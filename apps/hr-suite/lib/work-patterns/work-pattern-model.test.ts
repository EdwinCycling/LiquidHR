import { describe, expect, it } from 'vitest'
import { getPatternDay, validateWorkPattern } from './work-pattern-model'

const weekdays = Array.from({ length: 14 }, (_, index) => ({
  weekIndex: Math.floor(index / 7) + 1,
  isoWeekday: (index % 7) + 1,
  isWorkingDay: index % 7 < 5,
  startsAt: index % 7 < 5 ? '09:00' : null,
  endsAt: index % 7 < 5 ? '17:00' : null,
  breakMinutes: index % 7 < 5 ? 30 : 0,
  scheduledMinutes: index % 7 < 5 ? 450 : 0,
  note: null,
}))

describe('work pattern model', () => {
  it('projecteert een tweeweeks patroon vanaf de maandag-ankerweek', () => {
    expect(getPatternDay({ anchorDate: '2026-07-06', cycleWeeks: 2, days: weekdays }, '2026-07-06')?.weekIndex).toBe(1)
    expect(getPatternDay({ anchorDate: '2026-07-06', cycleWeeks: 2, days: weekdays }, '2026-07-13')?.weekIndex).toBe(2)
    expect(getPatternDay({ anchorDate: '2026-07-06', cycleWeeks: 2, days: weekdays }, '2026-07-20')?.weekIndex).toBe(1)
  })

  it('eist exact zeven dagen per cyclusweek en berekent het weekgemiddelde', () => {
    expect(validateWorkPattern({ cycleWeeks: 2, anchorDate: '2026-07-06', days: weekdays })).toEqual({
      valid: true,
      averageMinutesPerWeek: 2250,
      error: null,
    })
    expect(validateWorkPattern({ cycleWeeks: 2, anchorDate: '2026-07-07', days: weekdays.slice(0, 13) }).valid).toBe(false)
  })
})

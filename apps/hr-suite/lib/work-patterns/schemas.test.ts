import { describe, expect, it } from 'vitest'
import { workPatternPublishSchema } from './schemas'

const days = Array.from({ length: 7 }, (_, index) => ({
  weekIndex: 1, isoWeekday: index + 1, isWorkingDay: index < 5,
  startsAt: index < 5 ? '09:00' : null, endsAt: index < 5 ? '17:00' : null,
  breakMinutes: index < 5 ? 30 : 0, scheduledMinutes: index < 5 ? 450 : 0, note: null,
}))

describe('workPatternPublishSchema', () => {
  it('accepteert een compleet eenweeks patroon', () => expect(workPatternPublishSchema.safeParse({ name: 'Basis', cycleWeeks: 1, anchorDate: '2026-07-06', validFrom: '2026-07-06', validUntil: null, days }).success).toBe(true))
  it('weigert ontbrekende weekdagen', () => expect(workPatternPublishSchema.safeParse({ name: 'Basis', cycleWeeks: 1, anchorDate: '2026-07-06', validFrom: '2026-07-06', validUntil: null, days: days.slice(0, 6) }).success).toBe(false))
})

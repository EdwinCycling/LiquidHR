import { describe, expect, it } from 'vitest'
import { localDateForInstant, parseAiUsageQuery, resolveAiUsagePeriod } from './ai-usage-query'

describe('AI usage query state', () => {
  it('uses this month by default and rejects another report', () => {
    expect(parseAiUsageQuery(new URLSearchParams({ report: 'ai-usage' }))).toEqual({ report: 'ai-usage', period: 'this-month' })
    expect(parseAiUsageQuery(new URLSearchParams({ report: 'salary-overview' }))).toBeNull()
    expect(parseAiUsageQuery(new URLSearchParams({ report: 'ai-usage', period: 'last-year' }))).toEqual({ report: 'ai-usage', period: 'this-month' })
  })

  it('resolves period boundaries in the HR group timezone', () => {
    const now = new Date('2026-08-30T12:00:00.000Z')
    expect(resolveAiUsagePeriod('this-month', now, 'Europe/Amsterdam')).toMatchObject({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      startAt: '2026-07-31T22:00:00.000Z',
      endAt: '2026-08-31T22:00:00.000Z',
    })
    expect(resolveAiUsagePeriod('last-7-days', now, 'Europe/Amsterdam')).toMatchObject({ startDate: '2026-08-24', endDate: '2026-08-30' })
    expect(resolveAiUsagePeriod('last-30-days', now, 'Europe/Amsterdam')).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-30' })
    expect(resolveAiUsagePeriod('last-90-days', now, 'Europe/Amsterdam')).toMatchObject({ startDate: '2026-06-02', endDate: '2026-08-30' })
  })

  it('uses local dates across daylight-saving changes', () => {
    expect(localDateForInstant('2026-10-25T00:30:00.000Z', 'Europe/Amsterdam')).toBe('2026-10-25')
    expect(localDateForInstant('2026-10-25T23:30:00.000Z', 'Europe/Amsterdam')).toBe('2026-10-26')
  })
})

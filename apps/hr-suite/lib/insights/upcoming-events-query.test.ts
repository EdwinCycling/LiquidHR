import { describe, expect, it } from 'vitest'
import { parseUpcomingEventsQuery } from './upcoming-events-query'

describe('parseUpcomingEventsQuery', () => {
  it('gebruikt alle gebeurtenissen en twaalf weken als veilige standaard', () => {
    expect(parseUpcomingEventsQuery(new URLSearchParams())).toEqual({ types: ['BIRTHDAY', 'ANNIVERSARY', 'STARTER'], periodDays: 84, departmentIds: [] })
  })

  it('accepteert meerdere gebeurtenissen en afdelingen', () => {
    expect(parseUpcomingEventsQuery(new URLSearchParams('types=BIRTHDAY,STARTER&period=28&departments=11111111-1111-1111-8111-111111111111,22222222-2222-2222-8222-222222222222'))).toEqual({ types: ['BIRTHDAY', 'STARTER'], periodDays: 28, departmentIds: ['11111111-1111-1111-8111-111111111111', '22222222-2222-2222-8222-222222222222'] })
  })

  it('accepteert de periode van twaalf maanden', () => {
    expect(parseUpcomingEventsQuery(new URLSearchParams('period=365')).periodDays).toBe(365)
  })
})

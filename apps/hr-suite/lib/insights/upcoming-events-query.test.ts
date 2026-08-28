import { describe, expect, it } from 'vitest'
import { parseUpcomingEventsQuery, upcomingEventsQueryParams } from './upcoming-events-query'

describe('parseUpcomingEventsQuery', () => {
  it('gebruikt alle gebeurtenissen en twaalf weken als veilige standaard', () => {
    expect(parseUpcomingEventsQuery(new URLSearchParams())).toEqual({ types: ['BIRTHDAY', 'ANNIVERSARY', 'STARTER'], periodDays: 84, departmentIds: [] })
  })

  it('accepteert meerdere gebeurtenissen en afdelingen', () => {
    expect(parseUpcomingEventsQuery(new URLSearchParams('types=BIRTHDAY,STARTER&period=28&departments=11111111-1111-1111-8111-111111111111,22222222-2222-2222-8222-222222222222'))).toEqual({ types: ['BIRTHDAY', 'STARTER'], periodDays: 28, departmentIds: ['11111111-1111-1111-8111-111111111111', '22222222-2222-2222-8222-222222222222'] })
  })

  it('accepteert canonieke PostgreSQL-afdelings-UUIDs zonder RFC-variantlabel', () => {
    const departmentId = 'bdc6cc27-4faf-15c7-7a3e-e5174b8b5c92'
    expect(parseUpcomingEventsQuery(new URLSearchParams(`departmentIds=${departmentId}`)).departmentIds).toEqual([departmentId])
  })

  it('accepteert de periode van twaalf maanden', () => {
    expect(parseUpcomingEventsQuery(new URLSearchParams('period=365')).periodDays).toBe(365)
  })

  it('serialiseert filters met de canonical report- en arraynamen', () => {
    const query = parseUpcomingEventsQuery(new URLSearchParams('report=upcoming-events&types=BIRTHDAY&types=STARTER&departmentIds=11111111-1111-1111-8111-111111111111'))
    const params = upcomingEventsQueryParams(query)
    expect(params.get('report')).toBe('upcoming-events')
    expect(params.getAll('types')).toEqual(['BIRTHDAY', 'STARTER'])
    expect(params.getAll('departmentIds')).toEqual(['11111111-1111-1111-8111-111111111111'])
  })
})

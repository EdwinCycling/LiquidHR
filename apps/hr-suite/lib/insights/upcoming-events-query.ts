import { z } from 'zod'
import { databaseUuid } from '@/lib/validation/database-uuid'
import type { UpcomingEventType, UpcomingEventsQuery } from './upcoming-events'

const typeValues = ['BIRTHDAY', 'ANNIVERSARY', 'STARTER'] as const

export function parseUpcomingEventsQuery(params: URLSearchParams): UpcomingEventsQuery {
  const period = params.get('period')
  const types = [...new Set(params.getAll('types').flatMap((value) => value.split(',')).filter((value): value is UpcomingEventType => typeValues.includes(value as UpcomingEventType)))]
  const departments = [...new Set([
    ...params.getAll('departmentIds'),
    ...params.getAll('departmentId'),
    ...params.getAll('departments'),
  ].flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean)))]
  return {
    types: types.length ? types : [...typeValues],
    periodDays: period === '7' ? 7 : period === '28' ? 28 : period === '365' ? 365 : 84,
    departmentIds: z.array(databaseUuid).safeParse(departments).success ? departments : [],
  }
}

export function upcomingEventsQueryParams(query: UpcomingEventsQuery): URLSearchParams {
  const params = new URLSearchParams({ report: 'upcoming-events', period: String(query.periodDays) })
  for (const type of query.types) params.append('types', type)
  for (const departmentId of query.departmentIds) params.append('departmentIds', departmentId)
  return params
}

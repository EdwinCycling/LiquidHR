import { z } from 'zod'
import type { UpcomingEventType, UpcomingEventsQuery } from './upcoming-events'

const typeValues = ['BIRTHDAY', 'ANNIVERSARY', 'STARTER'] as const

export function parseUpcomingEventsQuery(params: URLSearchParams): UpcomingEventsQuery {
  const period = params.get('period')
  const types = (params.get('types') ?? '').split(',').filter((value): value is UpcomingEventType => typeValues.includes(value as UpcomingEventType))
  const departments = (params.get('departments') ?? '').split(',').filter(Boolean)
  return {
    types: types.length ? types : [...typeValues],
    periodDays: period === '7' ? 7 : period === '28' ? 28 : period === '365' ? 365 : 84,
    departmentIds: z.array(z.uuid()).safeParse(departments).success ? departments : [],
  }
}

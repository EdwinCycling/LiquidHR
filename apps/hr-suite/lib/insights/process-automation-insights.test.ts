import { describe, expect, it } from 'vitest'
import { parseProcessInsightsQuery } from './process-automation-insights'

describe('parseProcessInsightsQuery', () => {
  it('defaults to the last 30 inclusive HR calendar dates and first page', () => {
    const query = parseProcessInsightsQuery(new URLSearchParams(), new Date('2026-10-23T15:00:00.000Z'))
    expect(query).toEqual({ from: '2026-09-24', to: '2026-10-23', page: 1 })
  })

  it('keeps process and page filters in validated URL state', () => {
    const process = '00000000-0000-4000-8000-000000000101'
    const query = parseProcessInsightsQuery(new URLSearchParams({
      from: '2026-10-01',
      to: '2026-10-31',
      process,
      page: '3',
    }))
    expect(query).toEqual({ from: '2026-10-01', to: '2026-10-31', process, page: 3 })
  })

  it('rejects impossible dates, reversed periods, periods above 366 dates, and invalid page values', () => {
    expect(parseProcessInsightsQuery(new URLSearchParams({ from: '2026-02-30', to: '2026-03-01' }))).toBeNull()
    expect(parseProcessInsightsQuery(new URLSearchParams({ from: '2026-10-02', to: '2026-10-01' }))).toBeNull()
    expect(parseProcessInsightsQuery(new URLSearchParams({ from: '2025-10-22', to: '2026-10-23' }))).toBeNull()
    expect(parseProcessInsightsQuery(new URLSearchParams({ page: '0' }))).toBeNull()
    expect(parseProcessInsightsQuery(new URLSearchParams({ process: 'not-a-uuid' }))).toBeNull()
  })
})

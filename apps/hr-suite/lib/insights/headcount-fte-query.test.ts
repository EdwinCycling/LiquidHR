import { describe, expect, it } from 'vitest'
import { buildInsightApplyHref, canonicalInsightHref } from './query-seam'
import { defaultHeadcountFteQuery, headcountFteExportParams, headcountFteQueryParams, paginateHeadcountFteRows, parseHeadcountFteQuery } from './headcount-fte-query'

describe('Headcount & FTE query contract', () => {
  it('defaults to the latest twelve completed month-ends', () => {
    expect(defaultHeadcountFteQuery(new Date('2026-10-28T12:00:00Z'))).toMatchObject({ fromMonth: '2025-10', toMonth: '2026-09' })
  })

  it('paginates details in groups of 25 and clamps out-of-range requests', () => {
    const rows = Array.from({ length: 27 }, (_, index) => index)
    expect(paginateHeadcountFteRows(rows, 1).rows).toHaveLength(25)
    expect(paginateHeadcountFteRows(rows, 2)).toEqual({ page: 2, totalPages: 2, rows: [25, 26] })
    expect(paginateHeadcountFteRows(rows, 100).page).toBe(2)
    expect(paginateHeadcountFteRows([], 1)).toEqual({ page: 1, totalPages: 1, rows: [] })
  })

  it('round-trips period, scope filters and sorting through URL state', () => {
    const input = new URLSearchParams('report=headcount-fte&fromMonth=2025-03&toMonth=2025-09&administrations=a1&administrations=a2&departmentIds=d1&teamIds=m1&sortBy=fte&sortDirection=desc&page=3')
    const query = parseHeadcountFteQuery(input)
    expect(query).toMatchObject({ fromMonth: '2025-03', toMonth: '2025-09', administrationIds: ['a1', 'a2'], departmentIds: ['d1'], teamIds: ['m1'], sortBy: 'fte', sortDirection: 'desc', page: 3 })
    expect(query && parseHeadcountFteQuery(headcountFteQueryParams(query))).toEqual(query)
    expect(query && headcountFteExportParams(query).get('format')).toBe('csv')
    expect(query && headcountFteExportParams(query).has('page')).toBe(false)
  })

  it('rejects reversed, overlong and unfinished periods', () => {
    expect(parseHeadcountFteQuery(new URLSearchParams('report=headcount-fte&fromMonth=2025-09&toMonth=2025-01'))).toBeNull()
    expect(parseHeadcountFteQuery(new URLSearchParams('report=headcount-fte&fromMonth=2010-01&toMonth=2025-01'))).toBeNull()
    expect(parseHeadcountFteQuery(new URLSearchParams('report=headcount-fte&fromMonth=2020-12&toMonth=2021-01'))).toBeNull()
    const future = new Date()
    const month = `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, '0')}`
    expect(parseHeadcountFteQuery(new URLSearchParams(`report=headcount-fte&fromMonth=${month}&toMonth=${month}`))).toBeNull()
  })

  it('keeps the filters in the canonical Insights navigation and drops other report state', () => {
    const query = parseHeadcountFteQuery(new URLSearchParams('report=headcount-fte&fromMonth=2025-03&toMonth=2025-09&departmentIds=d1'))
    expect(query).not.toBeNull()
    const href = query ? buildInsightApplyHref(new URLSearchParams('report=employee-age&groupBy=age&teams=secret'), headcountFteQueryParams(query)) : '/insights'
    const params = new URL(href, 'https://liquidhr.invalid').searchParams
    expect(params.get('report')).toBe('headcount-fte')
    expect(params.get('departmentIds')).toBe('d1')
    expect(params.has('teams')).toBe(false)
    expect(canonicalInsightHref(params)).toContain('fromMonth=2025-03')
  })
})

import { describe, expect, it } from 'vitest'
import { buildInsightApplyHref, canonicalInsightHref } from './query-seam'
import { defaultJoinersLeaversQuery, joinersLeaversExportParams, joinersLeaversQueryParams, paginateJoinersLeaversRows, parseJoinersLeaversQuery } from './joiners-leavers-query'

describe('Joiners & Leavers query contract', () => {
  it('defaults to the latest twelve completed months', () => {
    expect(defaultJoinersLeaversQuery(new Date('2026-10-29T12:00:00Z'))).toMatchObject({ fromMonth: '2025-10', toMonth: '2026-09' })
  })

  it('round-trips period, scope, event-type, sorting and page state through the URL', () => {
    const params = new URLSearchParams('report=joiners-leavers&fromMonth=2025-03&toMonth=2025-09&administrations=a1&administrations=a2&departmentIds=d1&teamIds=m1&eventTypes=employment-start&eventTypes=reconciliation&sortBy=employeeName&sortDirection=asc&page=3')
    const query = parseJoinersLeaversQuery(params)
    expect(query).toMatchObject({
      fromMonth: '2025-03', toMonth: '2025-09', administrationIds: ['a1', 'a2'],
      departmentIds: ['d1'], teamIds: ['m1'], eventTypes: ['employment-start', 'reconciliation'],
      sortBy: 'employeeName', sortDirection: 'asc', page: 3,
    })
    expect(query && parseJoinersLeaversQuery(joinersLeaversQueryParams(query))).toEqual(query)
    expect(query && joinersLeaversExportParams(query).has('page')).toBe(false)
    expect(query && joinersLeaversExportParams(query).get('format')).toBe('csv')
  })

  it('rejects reversed, pre-coverage, overlong and unfinished periods', () => {
    expect(parseJoinersLeaversQuery(new URLSearchParams('report=joiners-leavers&fromMonth=2025-09&toMonth=2025-01'))).toBeNull()
    expect(parseJoinersLeaversQuery(new URLSearchParams('report=joiners-leavers&fromMonth=2020-12&toMonth=2021-01'))).toBeNull()
    expect(parseJoinersLeaversQuery(new URLSearchParams('report=joiners-leavers&fromMonth=2010-01&toMonth=2025-01'))).toBeNull()
    const currentMonth = new Date()
    const month = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`
    expect(parseJoinersLeaversQuery(new URLSearchParams(`report=joiners-leavers&fromMonth=${month}&toMonth=${month}`))).toBeNull()
  })

  it('keeps URL navigation scoped to this report and paginates detail rows in groups of 25', () => {
    const query = parseJoinersLeaversQuery(new URLSearchParams('report=joiners-leavers&fromMonth=2025-03&toMonth=2025-09&eventTypes=employment-end'))
    expect(query).not.toBeNull()
    const href = query ? buildInsightApplyHref(new URLSearchParams('report=employee-age&groupBy=age&teams=old'), joinersLeaversQueryParams(query)) : '/insights'
    const params = new URL(href, 'https://liquidhr.invalid').searchParams
    expect(params.get('report')).toBe('joiners-leavers')
    expect(params.get('eventTypes')).toBe('employment-end')
    expect(params.has('teams')).toBe(false)
    expect(canonicalInsightHref(params)).toContain('fromMonth=2025-03')

    const rows = Array.from({ length: 27 }, (_, index) => index)
    expect(paginateJoinersLeaversRows(rows, 1).rows).toHaveLength(25)
    expect(paginateJoinersLeaversRows(rows, 2).rows).toEqual([25, 26])
    expect(paginateJoinersLeaversRows(rows, 99).page).toBe(2)
  })
})

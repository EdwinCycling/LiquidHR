import { describe, expect, it } from 'vitest'
import {
  buildInsightApplyHref,
  buildInsightReportNavigationHref,
  canonicalInsightHref,
  canonicalInsightReportId,
  insightEmployeeDrilldownHref,
  normalizeInsightReturnPath,
} from './query-seam'

describe('Insights query and navigation seam', () => {
  it('canonicalises report aliases, scalar aliases and repeated arrays', () => {
    const canonical = new URL(canonicalInsightHref(new URLSearchParams('report=upcomingEvents&types=BIRTHDAY,STARTER&departments=d1,d2&departments=d1')), 'https://liquidhr.invalid')
    expect(canonical.searchParams.get('report')).toBe('upcoming-events')
    expect(canonical.searchParams.getAll('types')).toEqual(['BIRTHDAY', 'STARTER'])
    expect(canonical.searchParams.getAll('departmentIds')).toEqual(['d1', 'd2'])
    const employee = new URL(canonicalInsightHref(new URLSearchParams('report=employee-age&group=age&sort=name')), 'https://liquidhr.invalid')
    expect(employee.searchParams.get('groupBy')).toBe('age')
    expect(employee.searchParams.get('sortBy')).toBe('name')
    expect(canonicalInsightReportId('upcomingEvents')).toBe('upcoming-events')
  })

  it('removes owned state when switching reports and preserves presentation state', () => {
    const href = buildInsightReportNavigationHref(new URLSearchParams('report=salary-overview&asOfDate=2025-01-01&departments=d1&groupBy=department&view=trend'), 'upcoming-events')
    const url = new URL(href, 'https://liquidhr.invalid')
    expect(url.searchParams.get('report')).toBe('upcoming-events')
    expect(url.searchParams.get('view')).toBe('trend')
    expect(url.searchParams.has('asOfDate')).toBe(false)
    expect(url.searchParams.has('departmentIds')).toBe(false)
    expect(url.searchParams.has('groupBy')).toBe(false)
  })

  it('uses push-ready apply hrefs for applied data state without leaking the previous report', () => {
    const href = buildInsightApplyHref(new URLSearchParams('report=salary-overview&asOfDate=2025-01-01&view=trend'), new URLSearchParams('report=employee-age&groupBy=age&teams=IT%20%26%20Development'))
    const url = new URL(href, 'https://liquidhr.invalid')
    expect(url.searchParams.get('report')).toBe('employee-age')
    expect(url.searchParams.get('view')).toBe('trend')
    expect(url.searchParams.getAll('teams')).toEqual(['IT & Development'])
    expect(url.searchParams.has('asOfDate')).toBe(false)
  })

  it('keeps only an internal canonical Insights return path in drilldown context', () => {
    const returnTo = normalizeInsightReturnPath('/insights?report=employee-age&group=age&teams=IT%20%26%20Development')
    expect(returnTo).toBe('/insights?report=employee-age&groupBy=age&teams=IT+%26+Development')
    expect(normalizeInsightReturnPath('https://evil.example/steal')).toBe('/insights')
    const href = new URL(insightEmployeeDrilldownHref('employee/1', returnTo, 'absence'), 'https://liquidhr.invalid')
    expect(href.pathname).toBe('/employees/employee%2F1')
    expect(href.searchParams.get('from')).toBe('insights')
    expect(href.searchParams.get('tab')).toBe('absence')
    expect(href.searchParams.get('returnTo')).toBe(returnTo)
  })

  it('drops unknown report state instead of loading a report or carrying its filters forward', () => {
    const url = new URL(canonicalInsightHref(new URLSearchParams('report=not-a-report&teams=secret&keep=1')), 'https://liquidhr.invalid')
    expect(url.searchParams.get('report')).toBeNull()
    expect(url.searchParams.get('teams')).toBeNull()
    expect(url.searchParams.get('keep')).toBe('1')
  })

  it('removes known query keys owned by a different report from a direct URL', () => {
    const url = new URL(canonicalInsightHref(new URLSearchParams('report=upcoming-events&asOfDate=2025-01-01&departmentIds=d1')), 'https://liquidhr.invalid')
    expect(url.searchParams.has('asOfDate')).toBe(false)
    expect(url.searchParams.get('departmentIds')).toBe('d1')
  })
})

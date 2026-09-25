import { describe, expect, it } from 'vitest'
import { hasOrganizationChartResultFilter, resolveOrganizationChartPageQuery } from './page-state'

describe('organization chart page state', () => {
  it('uses today on a fresh page open instead of a stored historical date', () => {
    const query = resolveOrganizationChartPageQuery({}, { view: 'manager', date: '2026-07-19', role: 'LEAD' }, '2026-09-24')

    expect(query).toMatchObject({ view: 'manager', date: '2026-09-24', role: 'LEAD' })
  })

  it('keeps an explicit past or future date from the URL', () => {
    const query = resolveOrganizationChartPageQuery({ date: '2027-01-01' }, { date: '2026-07-19' }, '2026-09-24')

    expect(query.date).toBe('2027-01-01')
  })

  it('shows a result count only when a search or structural filter is active', () => {
    expect(hasOrganizationChartResultFilter({ date: '2026-09-24' })).toBe(false)
    expect(hasOrganizationChartResultFilter({ role: 'LEAD' })).toBe(true)
    expect(hasOrganizationChartResultFilter({ q: 'Sanne' })).toBe(true)
  })
})

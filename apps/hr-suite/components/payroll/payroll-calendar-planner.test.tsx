import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import enMessages from '@/messages/en/payrollProfessional.json'
import nlMessages from '@/messages/nl/payrollProfessional.json'
import { PayrollCalendarPlanner } from './payroll-calendar-planner'

describe('PayrollCalendarPlanner', () => {
  it('renders Dutch calendar controls and responsive period layout without internal labels', () => {
    const markup = renderToStaticMarkup(<PayrollCalendarPlanner
      defaultYear={2026}
      locale="nl"
      periods={[{
        year: 2026,
        month: null,
        periodNumber: 53,
        periodicity: 'WEEKLY',
        periodKind: 'REGULAR',
        startsOn: '2026-12-25',
        endsOn: '2026-12-31',
        status: 'OPEN',
        plannedPaymentDate: '2027-01-07',
      }]}
      labels={nlMessages as Readonly<Record<string, string>>}
    />)

    expect(markup).toContain('Salariskalender')
    expect(markup).toContain('Kalenderinstelling')
    expect(markup).toContain('Iedere vier weken')
    expect(markup).toContain('Jaaroverzicht berekenen')
    expect(markup).toContain('Wekelijks · Periode 53 · 2026')
    expect(markup).toContain('Betaaldatum:')
    expect(markup).toContain('sm:grid-cols-2')
    expect(markup).toContain('lg:grid-cols-2')
    const visibleText = markup.replace(/<[^>]*>/gu, ' ')
    expect(visibleText).not.toContain('REGULAR_SALARY')
    expect(visibleText).not.toContain('FOUR_WEEKLY')
  })

  it('renders English labels with the same responsive structure', () => {
    const markup = renderToStaticMarkup(<PayrollCalendarPlanner
      defaultYear={2026}
      locale="en"
      periods={[{
        year: 2026,
        month: null,
        periodNumber: 53,
        periodicity: 'WEEKLY',
        periodKind: 'REGULAR',
        startsOn: '2026-12-25',
        endsOn: '2026-12-31',
        status: 'OPEN',
        plannedPaymentDate: '2027-01-07',
      }]}
      labels={enMessages as Readonly<Record<string, string>>}
    />)

    expect(markup).toContain('Payroll calendar')
    expect(markup).toContain('Every four weeks')
    expect(markup).toContain('Calculate year overview')
    expect(markup).toContain('Weekly · Period 53 · 2026')
    expect(markup).toContain('Payment date:')
    expect(markup).toContain('sm:grid-cols-2')
    const visibleText = markup.replace(/<[^>]*>/gu, ' ')
    expect(visibleText).not.toContain('REGULAR_SALARY')
    expect(visibleText).not.toContain('FOUR_WEEKLY')
  })
})

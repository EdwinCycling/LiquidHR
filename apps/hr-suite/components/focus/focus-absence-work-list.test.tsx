// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FocusAbsenceWorkList } from './focus-absence-work-list'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('Focus absence work list', () => {
  it('shows the scoped manager item and the two allowed actions without medical data', () => {
    const markup = renderToStaticMarkup(<FocusAbsenceWorkList
      locale="nl"
      items={[{ caseId: '11111111-1111-4111-8111-111111111111', confirmationId: '22222222-2222-4222-8222-222222222222', employeeId: '33333333-3333-4333-8333-333333333333', employeeName: 'Lisa Test', firstAbsenceOn: '2026-09-19', status: 'PENDING' }]}
      labels={{ title: 'Ziekmeldingen', description: 'Bevestig een ziekmelding.', sickness: 'Ziekmelding', from: 'Vanaf', confirm: 'Bevestigen', correction: 'Terugsturen voor correctie', failed: 'Mislukt', correctionSent: 'Teruggestuurd' }}
    />)

    expect(markup).toContain('Lisa Test')
    expect(markup).toContain('Ziekmelding')
    expect(markup).toContain('19 september')
    expect(markup).toContain('Bevestigen')
    expect(markup).toContain('Terugsturen voor correctie')
    expect(markup).not.toContain('Goedkeuren')
    expect(markup).not.toContain('<textarea')
    expect(markup).not.toContain('diagnose')
  })
})

// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerformanceReviewDashboard } from './performance-review-dashboard'

const labels = { dashboard: 'Gespreksdashboard', waitingEmployee: 'Wacht op medewerker', waitingAdditionalReviewer: 'Wacht op aanvullende beoordelaar', waitingManager: 'Wacht op manager', waitingAcknowledgement: 'Wacht op bevestiging', waitingReviewerClose: 'Wacht op afsluiting', completedAgreed: 'Afgerond met akkoord', completedDisagreed: 'Voor gezien', closedOpen: 'Open bij gesloten ronde', nextActions: 'Volgende acties', noActions: 'Geen open acties', open: 'Open', cancelled: 'Geannuleerd' }

afterEach(() => vi.unstubAllGlobals())

describe('PerformanceReviewDashboard', () => {
  it('renders server-provided phase counts and next actions for the active role', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ phaseCounts: { WAITING_EMPLOYEE: 2, WAITING_MANAGER: 1, WAITING_ACKNOWLEDGEMENT: 0, COMPLETED_AGREED: 4, COMPLETED_DISAGREED: 1, CLOSED_OPEN: 2 }, nextActions: [{ id: 'dossier-1', title: 'Q4 gesprek Noah', phase: 'WAITING_EMPLOYEE', dueDate: '2026-12-01' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(createElement(PerformanceReviewDashboard, { role: 'manager', labels })) })
    await act(async () => { await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledWith('/api/performance-reviews/dashboard?role=manager')
    expect(host.textContent).toContain('2')
    expect(host.textContent).toContain('Q4 gesprek Noah')
    expect(host.querySelector('a[href="/conversations/dossier-1"]')).not.toBeNull()
    expect(host.textContent).toContain('Voor gezien')
    act(() => root.unmount())
    host.remove()
  })

  it('falls back to the role-filtered list when the dashboard endpoint is unavailable', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes('/dashboard')
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ items: [{ id: 'dossier-2', title: 'Zelfreflectie', phase: 'WAITING_EMPLOYEE' }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(createElement(PerformanceReviewDashboard, { role: 'employee', labels })) })
    await act(async () => { await Promise.resolve() })
    expect(host.textContent).toContain('Zelfreflectie')
    expect(host.textContent).toContain('1')
    act(() => root.unmount())
    host.remove()
  })
})

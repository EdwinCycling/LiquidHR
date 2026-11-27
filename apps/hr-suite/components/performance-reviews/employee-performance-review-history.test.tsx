// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmployeePerformanceReviewHistory } from './employee-performance-review-history'

afterEach(() => vi.unstubAllGlobals())

describe('EmployeePerformanceReviewHistory', () => {
  it('renders the submitted additional reviewer contribution in the employee history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [{
      id: 'dossier-1', title: 'Jaarlijks gesprek', phase: 'WAITING_REVIEWER_CLOSE',
      additionalReviewerContribution: 'Heeft het team geholpen met de nieuwe werkwijze.',
    }] }), { status: 200 })))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    await act(async () => { root.render(createElement(EmployeePerformanceReviewHistory, {
      employeeId: 'employee-1',
      labels: { empty: 'Geen gesprekken', status: 'Status', dueDate: 'Streefdatum', open: 'Open', additionalContribution: 'Bijdrage aanvullende beoordelaar' },
    })) })
    await act(async () => { await Promise.resolve() })

    expect(host.textContent).toContain('Bijdrage aanvullende beoordelaar')
    expect(host.textContent).toContain('Heeft het team geholpen met de nieuwe werkwijze.')
    expect(host.querySelector('a[href="/conversations/dossier-1"]')).not.toBeNull()
    act(() => root.unmount())
    host.remove()
  })
})

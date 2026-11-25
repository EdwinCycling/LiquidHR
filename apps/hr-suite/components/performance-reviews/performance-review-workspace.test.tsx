// @vitest-environment happy-dom

import { act, createElement, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PerformanceReviewWorkspace } from './performance-review-workspace'

type Labels = ComponentProps<typeof PerformanceReviewWorkspace>['labels']
const labels = new Proxy({}, { get: (_target, key: string | symbol) => typeof key === 'string' ? key : '' }) as Labels

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('PerformanceReviewWorkspace', () => {
  it('does not let a delayed dossier read clear a draft typed during initial loading', async () => {
    let resolveDossier: (response: Response) => void = () => undefined
    const dossierRead = new Promise<Response>((resolve) => { resolveDossier = resolve })
    let submittedBody = ''
    const initialSummary = { id: 'dossier-1', title: 'Ontwikkelgesprek 2026', employeeName: 'Noah Hendriks', phase: 'WAITING_EMPLOYEE', roundStatus: 'ACTIVE', version: 1 }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/performance-reviews?role=employee') return jsonResponse({ items: [initialSummary] })
      if (url === '/api/performance-reviews/dashboard?role=employee') return jsonResponse({ phaseCounts: {}, nextActions: [] })
      if (url === '/api/performance-reviews/dossiers/dossier-1' && !init?.method) return dossierRead
      if (url === '/api/performance-reviews' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { body?: string }
        submittedBody = body.body ?? ''
        return jsonResponse({ version: 2, phase: 'WAITING_EMPLOYEE' })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(createElement(PerformanceReviewWorkspace, { role: 'employee', summaries: [initialSummary], labels })) })

    const field = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="selfReflection"]')
    expect(field).not.toBeNull()
    const draft = 'Ik heb de overdracht verbeterd en wil volgend jaar mijn vakkennis verdiepen.'
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      valueSetter?.call(field, draft)
      field?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const saveButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'saveDraft')
    expect(saveButton).not.toBeNull()
    await act(async () => { saveButton?.click(); await Promise.resolve() })
    expect(submittedBody).toBe(draft)
    expect(field?.value).toBe(draft)

    resolveDossier(jsonResponse({ ...initialSummary, performance_review_submissions: [] }))
    await act(async () => { await dossierRead; await Promise.resolve() })
    expect(field?.value).toBe(draft)

    act(() => root.unmount())
    host.remove()
  })
})

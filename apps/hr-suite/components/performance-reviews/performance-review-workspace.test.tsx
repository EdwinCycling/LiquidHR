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

  it('shows manager attachments and exposes only released attachments to employees', async () => {
    const attachmentRows = [
      { id: 'attachment-private', original_filename: 'Managerconcept.pdf', content_type: 'application/pdf', file_size: 24, released_at: null },
      { id: 'attachment-released', original_filename: 'Gespreksafspraken.pdf', content_type: 'application/pdf', file_size: 32, released_at: '2026-11-25T12:00:00.000Z' },
    ]

    async function renderForRole(role: 'manager' | 'employee') {
      const dossierId = `dossier-${role}`
      const summary = { id: dossierId, title: 'Ontwikkelgesprek 2026', employeeName: 'Noah Hendriks', employeeId: 'employee-1', phase: role === 'manager' ? 'WAITING_MANAGER' : 'WAITING_ACKNOWLEDGEMENT', roundStatus: 'ACTIVE', version: 1 }
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === `/api/performance-reviews?role=${role}`) return jsonResponse({ items: [summary] })
        if (url === `/api/performance-reviews/dashboard?role=${role}`) return jsonResponse({ phaseCounts: {}, nextActions: [] })
        if (url === `/api/performance-reviews/dossiers/${dossierId}`) return jsonResponse({
          ...summary,
          performance_review_rounds: { title: summary.title, status: 'ACTIVE' },
          performance_review_submissions: [{ kind: 'MANAGER', body: 'We bespreken de voortgang.', submitted_at: '2026-11-25T12:00:00.000Z' }],
          performance_review_attachments: attachmentRows,
        })
        if (url === `/api/performance-reviews/dossiers/${dossierId}/private-note`) return jsonResponse([])
        if (url === '/api/continuous-appraisal?employeeId=employee-1') return jsonResponse({ items: [] })
        return jsonResponse({})
      }))
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
      await act(async () => {
        root.render(createElement(PerformanceReviewWorkspace, { role, summaries: [summary], labels }))
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      const text = host.textContent ?? ''
      act(() => root.unmount())
      host.remove()
      return text
    }

    const managerText = await renderForRole('manager')
    expect(managerText).toContain('Managerconcept.pdf')
    expect(managerText).toContain('Gespreksafspraken.pdf')

    const employeeText = await renderForRole('employee')
    expect(employeeText).not.toContain('Managerconcept.pdf')
    expect(employeeText).toContain('Gespreksafspraken.pdf')
  })
})

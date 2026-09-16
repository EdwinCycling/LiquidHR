// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiProgress } from '@/components/patterns/ai-progress'
import { EmployeeAiActions, type EmployeeAiActionLabels } from './employee-ai-actions'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels: EmployeeAiActionLabels = {
  title: 'AI-ondersteuning',
  description: 'Controleer het voorstel.',
  summary: 'Vat medewerker samen',
  conversation: 'Bereid gesprek voor',
  working: 'AI denkt mee…',
  reviewTitle: 'AI-voorstel beoordelen',
  cancel: 'Annuleren',
  copy: 'Kopiëren',
  copied: 'Gekopieerd',
  retry: 'Opnieuw proberen',
  failed: 'Het voorstel kon niet worden gemaakt.',
  saveToLogbook: 'Opslaan in Mijn logboek',
  savingToLogbook: 'Opslaan in Mijn logboek…',
  savedToLogbook: 'Opgeslagen in Mijn logboek',
  saveToLogbookFailed: 'Opslaan in Mijn logboek is niet gelukt.',
}

function mount(): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(<EmployeeAiActions employeeId="employee-1" labels={labels} locale="nl" />))
  return { host, root }
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function response(payload: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, json: async () => payload } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Employee AI actions', () => {
  it('uses the reusable animated progress surface', () => {
    const markup = renderToStaticMarkup(<AiProgress label={labels.working} />)

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('AI denkt mee…')
    expect(markup).toContain('animate-pulse')
  })

  it.each([
    ['summary', labels.summary],
    ['conversation', labels.conversation],
  ] as const)('lets the user save the reviewed %s proposal to the personal logbook', async (action, actionLabel) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      void _init
      return String(input) === '/api/logbook'
        ? response({ data: { id: 'logbook-entry-1' } }, 201)
        : response({ data: { proposedText: 'Een gecontroleerd AI-voorstel.' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { host, root } = mount()

    try {
      const actionButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === actionLabel) as HTMLButtonElement
      await act(async () => actionButton.click())
      await settle()

      const saveButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.saveToLogbook) as HTMLButtonElement
      expect(saveButton).toBeTruthy()
      expect(host.textContent).toContain('Een gecontroleerd AI-voorstel.')

      await act(async () => saveButton.click())
      await settle()

      expect(fetchMock).toHaveBeenCalledWith('/api/logbook', expect.objectContaining({ method: 'POST' }))
      const logbookCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/logbook')
      expect(JSON.parse(String(logbookCall?.[1]?.body))).toEqual({ title: actionLabel, description: 'Een gecontroleerd AI-voorstel.' })
      expect(host.textContent).toContain(labels.savedToLogbook)
      expect((host.querySelector('button[disabled]') as HTMLButtonElement).textContent).toContain(labels.savedToLogbook)
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})

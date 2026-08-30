// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { EmployeeNote } from '@/lib/employees/employee-notes-service'
import { EmployeeNotes } from './employee-notes'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = {
  title: 'Notities', accessNotice: 'Alleen HR Admin en Manager kunnen deze notities bekijken en bewerken.', empty: 'Nog geen notities voor deze medewerker.', add: 'Notitie toevoegen', edit: 'Wijzigen', remove: 'Verwijderen', noteTitle: 'Titel', description: 'Omschrijving', author: 'Door', createdAt: 'Datum en tijd', save: 'Notitie opslaan', cancel: 'Annuleren', close: 'Sluiten', moreActions: 'Meer acties', saving: 'Opslaan…', failed: 'Mislukt', saved: 'Notitie opgeslagen.', discardTitle: 'Wijzigingen negeren?', discardDescription: 'Je hebt wijzigingen aangebracht.', discardConfirm: 'Wijzigingen negeren', discardCancel: 'Terug naar formulier', deleteTitle: 'Notitie verwijderen?', deleteDescription: 'Deze notitie wordt verwijderd.', deleteConfirm: 'Verwijderen', deleteCancel: 'Annuleren',
  improveWithAi: 'Verbeter met AI', improveWriting: 'Verbeter schrijven', makeShorter: 'Maak korter', makeProfessional: 'Maak professioneler', aiWorking: 'Voorstel wordt gemaakt…', aiReviewTitle: 'AI-voorstel beoordelen', applyAi: 'Toepassen', cancelAi: 'Annuleren', aiFailed: 'Mislukt',
}

const note = {
  id: 'note-1', title: 'Proeftijd', description: 'Bespreek de evaluatie met de manager.', createdAt: '2026-08-20T09:00:00.000Z', updatedAt: '2026-08-20T09:00:00.000Z', authorName: 'Ada Lovelace',
} satisfies EmployeeNote

function changeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Employee notes Foundation contract', () => {
  it('renders a businesslike empty state and keeps write actions permission-gated', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeNotes, { canDelete: false, canImproveWithAi: false, canWrite: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' }))

    expect(markup).toContain('Notities')
    expect(markup).toContain('Alleen HR Admin en Manager')
    expect(markup).toContain('Nog geen notities voor deze medewerker.')
    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain('Notitie toevoegen')
  })

  it('keeps title primary and author/timestamp secondary in populated notes', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeNotes, { canDelete: true, canImproveWithAi: true, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [note], timeFormat: '24H' }))

    expect(markup).toContain('bg-surface')
    expect(markup).toContain('Proeftijd')
    expect(markup).toContain('Door: Ada Lovelace')
    expect(markup).toContain('Datum en tijd:')
    expect(markup).toContain('Wijzigen')
    expect(markup).toContain('Meer acties')
  })

  it('uses FormField with Foundation inputs for creating a note', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeNotes, { canDelete: false, canImproveWithAi: true, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())

    expect(document.body.querySelector('label[for]')).not.toBeNull()
    expect(document.body.querySelector('input[name="title"]')).not.toBeNull()
    expect(document.body.querySelector('textarea[name="description"]')).not.toBeNull()
    document.body.querySelector('[data-liquidhr-overlay-root]')?.remove()
    root.unmount()
    host.remove()
  })

  it('shows exactly the three AI transformations without adding AI to the title', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeNotes, { canDelete: false, canImproveWithAi: true, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' })))
    act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Notitie toevoegen')) as HTMLButtonElement).click())

    act(() => (document.querySelector('button[aria-label="Verbeter met AI"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[role="menu"]')?.textContent).toContain('Verbeter schrijven')
    expect(document.body.querySelector('[role="menu"]')?.textContent).toContain('Maak korter')
    expect(document.body.querySelector('[role="menu"]')?.textContent).toContain('Maak professioneler')
    expect(document.body.textContent).not.toContain('AI-voorstel beoordelen')
    expect(document.body.querySelector('input[name="title"]')?.outerHTML).not.toContain('ai-control')
    document.body.querySelector('[data-liquidhr-overlay-root]')?.remove()
    root.unmount()
    host.remove()
  })

  it('keeps the source while pending, applies locally, and saves only through the existing Save action', async () => {
    const sourceText = 'De cursus is afgerond.'
    let resolveResponse: ((value: Response) => void) | undefined
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/improve')) return new Promise<Response>((resolve) => { resolveResponse = resolve })
      return Promise.resolve({ ok: true, json: async () => ({ data: { updated: true } }) } as Response)
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    try {
      act(() => root.render(createElement(EmployeeNotes, { canDelete: false, canImproveWithAi: true, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' })))
      act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Notitie toevoegen')) as HTMLButtonElement).click())
      const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement
      await act(async () => {
        changeTextarea(textarea, sourceText)
        await Promise.resolve()
      })
      act(() => (document.querySelector('button[aria-label="Verbeter met AI"]') as HTMLButtonElement).click())
      act(() => (Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Verbeter schrijven')) as HTMLButtonElement).click())

      expect(textarea.value).toBe(sourceText)
      expect(document.body.textContent).toContain('Voorstel wordt gemaakt…')
      await act(async () => {
        resolveResponse?.({ ok: true, json: async () => ({ data: { proposedText: 'De cursus is succesvol afgerond.' } }) } as Response)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(textarea.value).toBe(sourceText)
      expect(document.body.textContent).toContain('AI-voorstel beoordelen')
      act(() => (Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Toepassen')) as HTMLButtonElement).click())
      expect(textarea.value).toBe('De cursus is succesvol afgerond.')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/employees/employee-1/notes/improve')

      await act(async () => {
        const saveButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Notitie opslaan')) as HTMLButtonElement
        const form = document.querySelector('form') as HTMLFormElement
        expect(saveButton.disabled).toBe(false)
        form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: saveButton }))
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/employees/employee-1/notes')
    } finally {
      globalThis.fetch = originalFetch
      document.body.querySelector('[data-liquidhr-overlay-root]')?.remove()
      root.unmount()
      host.remove()
    }
  })

  it('does not surface a stale proposal after the source changes', async () => {
    let resolveResponse: ((value: Response) => void) | undefined
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve })) as typeof fetch
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    try {
      act(() => root.render(createElement(EmployeeNotes, { canDelete: false, canImproveWithAi: true, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' })))
      act(() => (Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Notitie toevoegen')) as HTMLButtonElement).click())
      const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement
      await act(async () => {
        changeTextarea(textarea, 'Bron A')
        await Promise.resolve()
      })
      act(() => (document.querySelector('button[aria-label="Verbeter met AI"]') as HTMLButtonElement).click())
      act(() => (Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Verbeter schrijven')) as HTMLButtonElement).click())
      await act(async () => {
        changeTextarea(textarea, 'Bron B')
        await Promise.resolve()
      })
      resolveResponse?.({ ok: true, json: async () => ({ data: { proposedText: 'Voorstel voor A' } }) } as Response)
      await act(async () => { await Promise.resolve() })

      expect(textarea.value).toBe('Bron B')
      expect(document.body.textContent).not.toContain('Voorstel voor A')
    } finally {
      globalThis.fetch = originalFetch
      document.body.querySelector('[data-liquidhr-overlay-root]')?.remove()
      root.unmount()
      host.remove()
    }
  })
})

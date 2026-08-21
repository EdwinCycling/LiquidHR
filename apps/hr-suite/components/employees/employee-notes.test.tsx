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
}

const note = {
  id: 'note-1', title: 'Proeftijd', description: 'Bespreek de evaluatie met de manager.', createdAt: '2026-08-20T09:00:00.000Z', updatedAt: '2026-08-20T09:00:00.000Z', authorName: 'Ada Lovelace',
} satisfies EmployeeNote

describe('Employee notes Foundation contract', () => {
  it('renders a businesslike empty state and keeps write actions permission-gated', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeNotes, { canDelete: false, canWrite: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' }))

    expect(markup).toContain('Notities')
    expect(markup).toContain('Alleen HR Admin en Manager')
    expect(markup).toContain('Nog geen notities voor deze medewerker.')
    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain('Notitie toevoegen')
  })

  it('keeps title primary and author/timestamp secondary in populated notes', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeNotes, { canDelete: true, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [note], timeFormat: '24H' }))

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
    act(() => root.render(createElement(EmployeeNotes, { canDelete: false, canWrite: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', notes: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())

    expect(document.body.querySelector('label[for]')).not.toBeNull()
    expect(document.body.querySelector('input[name="title"]')).not.toBeNull()
    expect(document.body.querySelector('textarea[name="description"]')).not.toBeNull()
    document.body.querySelector('[data-liquidhr-overlay-root]')?.remove()
    root.unmount()
    host.remove()
  })
})

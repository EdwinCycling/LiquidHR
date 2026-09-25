// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { DocumentCategoryManager } from './catalog-managers'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = {
  code: 'Code', name: 'Naam', description: 'Omschrijving', add: 'Toevoegen', saving: 'Opslaan…', save: 'Opslaan',
  activate: 'Activeren', deactivate: 'Deactiveren', delete: 'Verwijderen', deleteConfirm: 'Categorie verwijderen?',
  deleteFailed: 'De categorie kon niet worden verwijderd.', inUse: 'Categorie is in gebruik.', failed: 'Opslaan mislukt.',
  empty: 'Geen categorieën.', cancel: 'Annuleren', close: 'Sluiten', toggle: 'Actief wisselen', edit: 'Bewerken',
  salarySensitive: 'Bevat salarisgegevens', duplicate: 'Deze categoriecode bestaat al.', invalid: 'Vul een geldige code en naam in.',
  discardTitle: 'Wijzigingen negeren?', discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.',
  discardConfirm: 'Wijzigingen negeren', discardCancel: 'Terug naar formulier',
  toggleConfirm: 'Je wijzigt de actieve status van deze categorie.',
} as unknown as Parameters<typeof DocumentCategoryManager>[0]['labels']

function mount(element: ReactNode): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, root }
}

function unmount(host: HTMLDivElement, root: Root): void {
  act(() => root.unmount())
  host.remove()
  document.querySelectorAll('[data-liquidhr-overlay-root]').forEach((element) => element.remove())
}

describe('DocumentCategoryManager', () => {
  it('shows a clear discard confirmation when cancelling a dirty category form', () => {
    const { host, root } = mount(<DocumentCategoryManager categories={[]} labels={labels} />)

    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.add)?.click())
    const code = document.querySelector('input') as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    valueSetter?.call(code, 'd01_cancel_test')
    act(() => code.dispatchEvent(new Event('input', { bubbles: true })))
    act(() => Array.from(document.querySelectorAll('button')).find((button) => button.textContent === labels.cancel)?.click())

    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
    const confirmation = dialogs.at(-1)
    expect(confirmation?.textContent).toContain(labels.discardTitle)
    expect(confirmation?.textContent).toContain(labels.discardDescription)
    expect(confirmation?.textContent).toContain(labels.discardConfirm)
    expect(confirmation?.textContent).toContain(labels.discardCancel)
    expect(confirmation?.textContent).not.toContain(labels.deleteFailed)

    act(() => Array.from(confirmation?.querySelectorAll('button') ?? []).find((button) => button.textContent === labels.discardConfirm)?.click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    unmount(host, root)
  })

  it('describes a category status change instead of showing the delete error', () => {
    const category = { id: 'category-1', code: 'D01_SALARY', name: 'D01 Salaris', description: null, requires_salary_permission: true, is_active: true }
    const { host, root } = mount(<DocumentCategoryManager categories={[category]} labels={labels} />)

    act(() => (host.querySelector('button[aria-label="Actief wisselen"]') as HTMLButtonElement).click())
    act(() => Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === labels.deactivate)?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const confirmation = Array.from(document.querySelectorAll('[role="dialog"]')).at(-1)
    expect(confirmation?.textContent).toContain(labels.toggleConfirm)
    expect(confirmation?.textContent).toContain(labels.deactivate)
    expect(confirmation?.textContent).not.toContain(labels.deleteFailed)
    unmount(host, root)
  })
})

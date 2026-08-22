// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { CompanyDocumentLibrary, type CompanyDocumentLibraryLabels } from './company-document-library'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const labels: CompanyDocumentLibraryLabels = {
  addedOn: 'Toegevoegd op', cancel: 'Annuleren', close: 'Sluiten', companyCreateDescription: 'Upload een document.', companyCreateTitle: 'Document toevoegen', companyDeleteDescription: 'Het document wordt verwijderd.', companyEmpty: 'Geen documenten.', companyInvalid: 'Ongeldig document.', companySave: 'Uploaden', companySubtitle: 'Documenten.', companyTitle: 'Bedrijfsdocumenten', delete: 'Verwijderen', deleteCancel: 'Annuleren', deleteConfirm: 'Verwijderen', deleteTitle: 'Document verwijderen?', discardCancel: 'Terug naar formulier', discardConfirm: 'Wijzigingen negeren', discardDescription: 'Wijzigingen gaan verloren.', discardTitle: 'Wijzigingen negeren?', download: 'Downloaden', failed: 'Mislukt', file: 'Bestand', fileRules: 'PDF of TXT.', fileSelected: 'Geselecteerd bestand', moreActions: 'Meer acties', saving: 'Uploaden…', titleLabel: 'Titel', unsupported: 'Geen preview.', upload: 'Document toevoegen', view: 'Bekijken',
}

const documents = [{ content_type: 'text/plain', created_at: '2026-08-22T10:00:00.000Z', file_size: 12, id: 'document-1', original_filename: 'handboek.txt', title: 'R2 document' }]

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

describe('CompanyDocumentLibrary Foundation v1.2 migration', () => {
  it('uses a dirty-protected FormDrawer for upload', () => {
    const { host, root } = mount(<CompanyDocumentLibrary canDelete canWrite documents={[]} labels={labels} locale="nl" />)
    act(() => (host.querySelector('button') as HTMLButtonElement).click())
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['document'], 'r2.txt', { type: 'text/plain' })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    const cancel = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === labels.cancel) as HTMLButtonElement
    act(() => cancel.click())
    expect(Array.from(document.querySelectorAll('[role="dialog"]')).at(-1)?.textContent).toContain(labels.discardTitle)
    unmount(host, root)
  })

  it('routes destructive action through ActionMenu and ConfirmDialog without window.confirm', () => {
    const confirm = vi.fn()
    vi.stubGlobal('confirm', confirm)
    const { host, root } = mount(<CompanyDocumentLibrary canDelete canWrite documents={documents} labels={labels} locale="nl" />)
    const menuTrigger = host.querySelector('button[aria-label="Meer acties: R2 document"]') as HTMLButtonElement
    act(() => menuTrigger.click())
    const deleteItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent === labels.delete) as HTMLElement
    act(() => deleteItem.click())
    expect(Array.from(document.querySelectorAll('[role="dialog"]')).at(-1)?.textContent).toContain(labels.deleteTitle)
    expect(confirm).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    unmount(host, root)
  })

  it('does not render mutation actions without write or delete capability', () => {
    const { host, root } = mount(<CompanyDocumentLibrary canDelete={false} canWrite={false} documents={documents} labels={labels} locale="nl" />)
    expect(host.textContent).not.toContain(labels.upload)
    act(() => (host.querySelector('button[aria-label="Meer acties: R2 document"]') as HTMLButtonElement).click())
    expect(Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent)).toEqual([labels.view, labels.download])
    unmount(host, root)
  })
})

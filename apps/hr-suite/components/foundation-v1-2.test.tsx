// @vitest-environment happy-dom

import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ActionMenu } from './ui/action-menu'
import { Dialog } from './ui/dialog'
import { Drawer } from './ui/drawer'
import { Pagination } from './ui/pagination'
import { ConfirmDialog } from './patterns/confirm-dialog'
import { CollectionPagination } from './patterns/collection-pagination'
import { CollectionToolbar } from './patterns/collection-toolbar'
import { DataTableShell } from './patterns/data-table-shell'
import { EntityList } from './patterns/entity-list'
import { FormDrawer } from './patterns/form-drawer'
import { FormActions } from './patterns/form-actions'
import { RowActions } from './patterns/row-actions'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)} type="button">Open</button><Dialog closeLabel="Sluiten" description="Korte uitleg" onOpenChange={setOpen} open={open} title="Testdialoog"><button type="button">Binnenste actie</button></Dialog></>
}

function DrawerHarness() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)} type="button">Open drawer</button><Drawer closeLabel="Sluiten" onOpenChange={setOpen} open={open} title="Testdrawer"><p>Drawer body</p></Drawer></>
}

function FormDrawerHarness({ dirty }: { dirty: boolean }) {
  const [open, setOpen] = useState(true)
  return <FormDrawer cancelLabel="Annuleren" closeLabel="Sluiten" dirty={dirty} dirtyProtection={{ description: 'Niet-opgeslagen wijzigingen gaan verloren.', discardLabel: 'Wijzigingen negeren', keepEditingLabel: 'Terug naar formulier', title: 'Wijzigingen negeren?' }} onOpenChange={setOpen} onSubmit={(event) => event.preventDefault()} open={open} saveLabel="Bewaren" title="Formulier"><input aria-label="Veld" name="field" /></FormDrawer>
}

describe('UX Foundation v1.2 interaction primitives', () => {
  it('provides dialog semantics, focus trap, Escape, backdrop close and focus restore', () => {
    const { host, root } = mount(<DialogHarness />)
    const trigger = host.querySelector('button') as HTMLButtonElement

    act(() => { trigger.focus(); trigger.click() })
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()

    const closeButton = dialog.querySelector('button[aria-label="Sluiten"]') as HTMLButtonElement
    const innerButton = Array.from(dialog.querySelectorAll('button')).find((button) => button !== closeButton) as HTMLButtonElement
    innerButton.focus()
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' })))
    expect(document.activeElement).toBe(closeButton)

    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    act(() => { trigger.focus(); trigger.click() })
    const overlay = document.querySelector('[data-liquidhr-overlay-root] > div') as HTMLDivElement
    act(() => overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    unmount(host, root)
  })

  it('does not steal focus on a closed ActionMenu mount and restores focus after use', () => {
    const external = document.createElement('button')
    external.type = 'button'
    document.body.append(external)
    external.focus()

    const { host, root } = mount(<ActionMenu items={[{ id: 'edit', label: 'Wijzigen', onSelect: () => undefined }]} label="Meer acties" />)
    expect(document.activeElement).toBe(external)

    const trigger = host.querySelector('button[aria-label="Meer acties"]') as HTMLButtonElement
    act(() => { trigger.focus(); trigger.click() })
    const menu = document.body.querySelector('[role="menu"]') as HTMLElement
    expect(menu).not.toBeNull()
    act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(document.activeElement).toBe(trigger)

    unmount(host, root)
    external.remove()
  })

  it('creates and cleans the Dialog portal root with the open lifecycle', () => {
    const { host, root } = mount(<DialogHarness />)
    expect(document.querySelectorAll('[data-liquidhr-overlay-root]')).toHaveLength(0)

    const trigger = host.querySelector('button') as HTMLButtonElement
    act(() => { trigger.focus(); trigger.click() })
    expect(document.querySelectorAll('[data-liquidhr-overlay-root]')).toHaveLength(1)

    act(() => (document.body.querySelector('button[aria-label="Sluiten"]') as HTMLButtonElement).click())
    expect(document.querySelectorAll('[data-liquidhr-overlay-root]')).toHaveLength(0)
    unmount(host, root)
  })

  it('keeps the drawer modal and restores focus after Escape', () => {
    const { host, root } = mount(<DrawerHarness />)
    const trigger = host.querySelector('button') as HTMLButtonElement
    act(() => { trigger.focus(); trigger.click() })
    const drawer = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(drawer).not.toBeNull()
    expect(document.querySelector('[data-liquidhr-overlay-root] > div')?.className).toContain('!p-0')
    expect(drawer.className).toContain('h-dvh')
    act(() => drawer.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    unmount(host, root)
  })

  it('renders confirm actions and keeps destructive confirmation pending-safe', () => {
    const { host, root } = mount(<ConfirmDialog cancelLabel="Annuleren" confirmLabel="Verwijderen" description="Definitief verwijderen" destructive onConfirm={() => undefined} onOpenChange={() => undefined} open title="Verwijderen?" />)
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).not.toBeNull()
    expect(dialog.textContent).toContain('Annuleren')
    expect(dialog.textContent).toContain('Verwijderen')
    expect((dialog.querySelector('button.ui-button-danger') as HTMLButtonElement)).not.toBeNull()
    expect(dialog.querySelector('button')?.textContent).toBe('Annuleren')
    unmount(host, root)
  })

  it('supports ActionMenu keyboard navigation, disabled items, selection and focus restore', () => {
    const onSelect = vi.fn()
    const { host, root } = mount(<ActionMenu items={[{ id: 'edit', label: 'Wijzigen', onSelect }, { disabled: true, id: 'disabled', label: 'Uitgeschakeld', onSelect }, { destructive: true, id: 'delete', label: 'Verwijderen', onSelect }]} label="Meer acties" />)
    const trigger = host.querySelector('button[aria-label="Meer acties"]') as HTMLButtonElement
    act(() => { trigger.focus(); trigger.click() })
    const menu = document.body.querySelector('[role="menu"]') as HTMLElement
    expect(document.activeElement?.getAttribute('data-action-menu-item')).toBe('edit')
    act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })))
    expect(document.activeElement?.getAttribute('data-action-menu-item')).toBe('delete')
    expect((document.body.querySelector('[data-action-menu-item="disabled"]') as HTMLButtonElement).disabled).toBe(true)
    act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    act(() => trigger.click())
    act(() => (document.body.querySelector('[data-action-menu-item="delete"]') as HTMLButtonElement).click())
    expect(onSelect).toHaveBeenCalledOnce()
    unmount(host, root)
  })

  it('marks the current page and disables pagination boundaries', () => {
    const middle = renderToStaticMarkup(<Pagination ariaLabel="Paginering" currentPage={3} nextLabel="Volgende" onPageChange={() => undefined} previousLabel="Vorige" totalPages={8} />)
    expect(middle).toContain('aria-current="page"')
    expect(middle).toContain('…')
    const first = renderToStaticMarkup(<Pagination ariaLabel="Paginering" currentPage={1} nextLabel="Volgende" onPageChange={() => undefined} previousLabel="Vorige" totalPages={2} />)
    expect(first).toMatch(/aria-label="Vorige"[^>]*disabled=""/)
    const last = renderToStaticMarkup(<Pagination ariaLabel="Paginering" currentPage={2} nextLabel="Volgende" onPageChange={() => undefined} previousLabel="Vorige" totalPages={2} />)
    expect(last).toMatch(/aria-label="Volgende"[^>]*disabled=""/)
  })

  it('composes collection toolbar, row actions, pagination and entity rows without a table engine', () => {
    const markup = renderToStaticMarkup(<>
      <CollectionToolbar actions={<button type="button">Context</button>} createAction={<button type="button">Toevoegen</button>} filters={<span>Filters</span>} search={<input aria-label="Zoeken" />} sort={<span>Sortering</span>} view={<span>Weergave</span>} />
      <RowActions menuItems={[{ id: 'delete', label: 'Verwijderen', onSelect: () => undefined }]} menuLabel="Meer acties" primaryAction={<button type="button">Wijzigen</button>} />
      <CollectionPagination pageSize={<span>50 per pagina</span>} resultRange={<span>1–50 van 347</span>} />
      <DataTableShell caption="Voorbeeld"><thead><tr><th>Naam</th></tr></thead><tbody><tr><td>Ada</td></tr></tbody></DataTableShell>
      <EntityList ariaLabel="Medewerkers" items={[{ actions: <button type="button">Open</button>, badges: <span>Actief</span>, id: '1', primary: 'Ada Lovelace', secondary: 'HR' }]} />
      <FormActions cancelLabel="Annuleren" onCancel={() => undefined} saveLabel="Bewaren" sticky />
    </>)
    expect(markup).toContain('Toevoegen')
    expect(markup).toContain('Meer acties')
    expect(markup).toContain('1–50 van 347')
    expect(markup).toContain('<table')
    expect(markup).toContain('Ada Lovelace')
    expect(markup).toContain('sticky')
  })
})

describe('UX Foundation v1.2 FormDrawer', () => {
  it('keeps header, scrollable form body and fixed actions together', () => {
    const { host, root } = mount(<FormDrawerHarness dirty={false} />)
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.querySelector('h2')?.textContent).toBe('Formulier')
    expect(dialog.querySelector('form')).not.toBeNull()
    expect(dialog.querySelector('footer')).not.toBeNull()
    expect(dialog.querySelector('button[type="submit"]')?.textContent).toContain('Bewaren')
    unmount(host, root)
  })

  it('opens dirty confirmation on close and closes directly when clean', () => {
    const dirtyMount = mount(<FormDrawerHarness dirty />)
    act(() => (document.body.querySelector('button[aria-label="Sluiten"]') as HTMLButtonElement).click())
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(2)
    act(() => (Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Terug naar formulier') as HTMLButtonElement).click())
    expect(document.body.querySelectorAll('[role="dialog"]').length).toBe(1)
    act(() => (document.body.querySelector('button[aria-label="Sluiten"]') as HTMLButtonElement).click())
    act(() => (Array.from(document.body.querySelectorAll('[role="dialog"] button')).find((button) => button.textContent === 'Wijzigingen negeren') as HTMLButtonElement).click())
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    unmount(dirtyMount.host, dirtyMount.root)

    const cleanMount = mount(<FormDrawerHarness dirty={false} />)
    act(() => (document.body.querySelector('button[aria-label="Sluiten"]') as HTMLButtonElement).click())
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    unmount(cleanMount.host, cleanMount.root)
  })
})

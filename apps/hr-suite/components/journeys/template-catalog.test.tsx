// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateCatalog, type TemplateCatalogRow } from './template-catalog'
import type { JourneyLabels } from '@/lib/journeys/labels'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { pushMock, refreshMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), refreshMock: vi.fn(), replaceMock: vi.fn() }))
let searchParamValue = ''

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/journeys',
  useRouter: () => ({ push: pushMock, refresh: refreshMock, replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(searchParamValue),
}))

const labels = {
  catalogTitle: 'Journey-templates', catalogSubtitle: 'Catalogus', search: 'Templates zoeken', newTemplate: 'Nieuwe template', noTemplates: 'Nog geen templates gevonden.', noResults: 'Geen resultaten.',
  name: 'Naam', key: 'Technische sleutel', type: 'Journey-type', nl: 'Nederlands', en: 'Engels', updated: 'Bijgewerkt', draft: 'Concept', published: 'Gepubliceerd', retired: 'Uitgefaseerd', create: 'Template maken', cancel: 'Annuleren', close: 'Sluiten', discardTitle: 'Wijzigingen verwerpen?', discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.', discardConfirm: 'Wijzigingen verwerpen', discardCancel: 'Verder bewerken',
  types: { ONBOARDING: 'Onboarding' },
} as JourneyLabels

const item: TemplateCatalogRow = {
  id: 'b4b241c2-6955-46f9-9ca0-c2c370533ade', key: 'onboarding', name: 'Onboarding', description: 'Nieuwe medewerker', journeyType: 'ONBOARDING', lifecycle: 'DRAFT', draftRevision: 1, publishedVersionNumber: null, updatedAt: '2026-08-24T10:00:00.000Z',
}

function mount(items: readonly TemplateCatalogRow[] = [item], canWrite = false): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(createElement(TemplateCatalog, { canWrite, items, labels, locale: 'nl' })))
  return { host, root }
}

function unmount(mounted: { host: HTMLDivElement; root: Root }): void {
  act(() => mounted.root.unmount())
  mounted.host.remove()
  document.querySelectorAll('[data-liquidhr-overlay-root]').forEach((element) => element.remove())
}

function buttonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((candidate) => candidate.textContent?.includes(text) || candidate.getAttribute('aria-label') === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

function setTextInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
  searchParamValue = ''
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Journey template catalog Foundation flow', () => {
  it('renders the catalog row as a Foundation entity link to the designer route', () => {
    const mounted = mount()

    const link = document.querySelector<HTMLAnchorElement>(`a[href="/settings/journeys/templates/${item.id}"]`)
    expect(link?.textContent).toContain(item.name)
    expect(document.querySelector('[aria-label="Nieuwe template"]')).toBeNull()

    unmount(mounted)
  })

  it('shows a distinct no-results state for URL search state', () => {
    searchParamValue = 'q=does-not-exist'
    const mounted = mount()

    expect(document.body.textContent).toContain(labels.noResults)
    expect(document.body.textContent).not.toContain(item.name)

    unmount(mounted)
  })

  it('uses FormDrawer semantics, prevents double submit, and protects dirty close', async () => {
    let resolveResponse: (response: Response) => void = () => undefined
    const responsePromise = new Promise<Response>((resolve) => { resolveResponse = resolve })
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(responsePromise)
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount([], true)

    act(() => buttonByText(document, labels.newTemplate).click())
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null
    expect(dialog).not.toBeNull()
    expect(dialog?.querySelector('form')).not.toBeNull()
    expect(dialog?.querySelector('form')?.id).toBeTruthy()
    expect(document.querySelector('[data-liquidhr-overlay-root] .h-dvh')).not.toBeNull()

    const inputs = [...(dialog?.querySelectorAll<HTMLInputElement>('input') ?? [])]
    act(() => {
      setTextInput(inputs[0]!, 'r4_jny_cat_test')
      setTextInput(inputs[1]!, 'R4 catalogus')
      setTextInput(inputs[2]!, 'R4 catalog')
    })
    act(() => buttonByText(dialog!, labels.close).click())
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2)
    act(() => buttonByText(document, labels.discardCancel).click())
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)

    const save = buttonByText(dialog!, labels.create)
    act(() => save.click())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(save.disabled).toBe(true)
    act(() => save.click())
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => resolveResponse(new Response(JSON.stringify({ data: { id: item.id } }), { status: 201 })))
    await act(async () => { await responsePromise })
    expect(pushMock).toHaveBeenCalledWith(`/settings/journeys/templates/${item.id}`)
    expect(refreshMock).toHaveBeenCalledOnce()

    unmount(mounted)
  })
})

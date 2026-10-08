// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ContextSelectionForm } from './context-selection-form'

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels = {
  eyebrow: 'Toegang',
  formTitle: 'Stel je werkcontext in',
  formDescription: 'Je keuze bepaalt welke klantomgeving en HR-groep je in deze sessie gebruikt.',
  tenantLabel: 'Klantomgeving',
  tenantDescription: 'Kies de klantomgeving waarvoor je vandaag werkt.',
  tenantPlaceholder: 'Kies een klantomgeving',
  hrGroupLabel: 'HR-groep',
  hrGroupDescription: 'Selecteer daarna de HR-groep binnen deze klantomgeving.',
  hrGroupPlaceholder: 'Kies een HR-groep',
  sessionHint: 'Je keuze wordt veilig opgeslagen voor deze sessie.',
  continue: 'Doorgaan',
  saving: 'Context opslaan…',
  invalid: 'Kies een geldige klantomgeving en HR-groep.',
  failed: 'De context kon niet worden opgeslagen. Kies opnieuw.',
}

const tenants = [{
  id: 'tenant-1',
  name: 'LiquidHR Test',
  slug: 'liquidhr-test',
  hrGroups: [{ id: 'group-1', name: 'HR Operations', code: 'HR-OPS' }],
}]

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(createElement(ContextSelectionForm, { labels, tenants })))
  return { host, unmount: () => act(() => root.unmount()) }
}

function chooseOption(host: HTMLElement, triggerIndex: number, label: string): void {
  const triggers = host.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]')
  act(() => triggers[triggerIndex]?.click())
  const option = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="option"]')).find((candidate) => candidate.textContent?.includes(label))
  expect(option).toBeDefined()
  act(() => option?.click())
}

describe('ContextSelectionForm UX states', () => {
  it('renders the hierarchy, helper text and accessible controls in the default state', () => {
    const markup = renderToStaticMarkup(<ContextSelectionForm labels={labels} tenants={tenants} />)

    expect(markup).toContain('data-testid="context-selection-card"')
    expect(markup).toContain(labels.formTitle)
    expect(markup).toContain(labels.tenantDescription)
    expect(markup).toContain(labels.hrGroupDescription)
    expect(markup).toContain('aria-required="true"')
    expect(markup).not.toContain('data-testid="context-selection-error"')
  })

  it('shows the inline validation alert when submitted without a complete selection', () => {
    const mounted = mount()

    act(() => (mounted.host.querySelector('button[type="submit"]') as HTMLButtonElement).click())

    expect(mounted.host.querySelector('[role="alert"]')?.textContent).toBe(labels.invalid)
    expect(mounted.host.querySelector('[data-testid="context-selection-error"]')).not.toBeNull()
    mounted.unmount()
  })

  it('shows the exact save failure and keeps the selection request scoped to the chosen IDs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount()

    chooseOption(mounted.host, 0, 'LiquidHR Test')
    chooseOption(mounted.host, 1, 'HR Operations')
    await act(async () => {
      ;(mounted.host.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/context/select', expect.objectContaining({
      body: JSON.stringify({ tenantId: 'tenant-1', hrGroupId: 'group-1' }),
    }))
    expect(mounted.host.querySelector('[role="alert"]')?.textContent).toBe(labels.failed)
    mounted.unmount()
    vi.unstubAllGlobals()
  })

  it('navigates to the start page after a successful context save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const mounted = mount()

    chooseOption(mounted.host, 0, 'LiquidHR Test')
    chooseOption(mounted.host, 1, 'HR Operations')
    await act(async () => {
      ;(mounted.host.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(mocks.push).toHaveBeenCalledWith('/dashboard/start')
    mounted.unmount()
    vi.unstubAllGlobals()
  })
  it('exposes the loading state while the context save is pending', async () => {
    let resolveResponse: ((response: { ok: boolean }) => void) | undefined
    const responsePromise = new Promise<{ ok: boolean }>((resolve) => { resolveResponse = resolve })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(responsePromise))
    const mounted = mount()

    chooseOption(mounted.host, 0, 'LiquidHR Test')
    chooseOption(mounted.host, 1, 'HR Operations')
    await act(async () => {
      ;(mounted.host.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(mounted.host.querySelector('[data-testid="context-selection-card"]')?.getAttribute('aria-busy')).toBe('true')
    expect((mounted.host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true)
    expect(mounted.host.textContent).toContain(labels.saving)

    resolveResponse?.({ ok: true })
    await act(async () => { await responsePromise })
    mounted.unmount()
    vi.unstubAllGlobals()
  })
})

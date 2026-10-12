// @vitest-environment happy-dom

import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { ContextSelectionForm } from './context-selection-form'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const tenants = [{
  id: '11111111-1111-4111-8111-111111111111',
  name: 'De Sterren holding',
  hrGroups: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Planeten', code: 'PLANETEN' }],
}, {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sterren service',
  hrGroups: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Nebula', code: 'NEBULA' }],
}]

const labels = {
  tenantLabel: 'Klantomgeving',
  tenantPlaceholder: 'Selecteer een omgeving',
  hrGroupLabel: 'HR-groep',
  hrGroupPlaceholder: 'Selecteer een HR-groep',
  contextLabel: 'Klantomgeving en HR-groep',
  contextPlaceholder: 'Selecteer een werkcontext',
  formTitle: 'Selecteer je omgeving',
  formDescription: 'Je gegevens volgen de gekozen HR-groep.',
  contextNote: 'Je bestaande rechten blijven van kracht.',
  continue: 'Doorgaan naar LiquidHR',
  invalid: 'Selecteer een geldige klantomgeving en HR-groep.',
  failed: 'De context kon niet worden opgeslagen. Kies opnieuw.',
}

describe('ContextSelectionForm', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('renders a native fallback form that can submit without client hydration', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(<ContextSelectionForm labels={labels} tenants={tenants} />)

    const form = host.querySelector<HTMLFormElement>('form')
    const select = host.querySelector<HTMLSelectElement>('select[name="selection"]')

    expect(form?.getAttribute('action')).toBe('/api/context/select')
    expect(form?.getAttribute('method')).toBe('post')
    expect(select?.required).toBe(true)
    expect(select?.options[1]?.value).toBe(`${tenants[0].id}|${tenants[0].hrGroups[0].id}`)
    expect(select?.options[1]?.textContent).toBe('De Sterren holding · Planeten')
    expect(select?.options[2]?.textContent).toBe('Sterren service · Nebula')
    expect(host.textContent).not.toContain('PLANETEN')
  })

  it('selects a tenant and HR group before submitting through the existing JSON flow', async () => {
    const element = <ContextSelectionForm labels={labels} tenants={tenants} />
    const host = document.createElement('div')
    host.innerHTML = renderToString(element)
    document.body.append(host)

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const root = await act(async () => hydrateRoot(host, element))

    try {
      const form = host.querySelector<HTMLFormElement>('form')
      let selects = Array.from(host.querySelectorAll<HTMLSelectElement>('select[aria-hidden="true"]'))
      expect(selects).toHaveLength(2)

      selects[0]!.value = tenants[1].id
      await act(async () => selects[0]!.dispatchEvent(new Event('change', { bubbles: true })))
      selects = Array.from(host.querySelectorAll<HTMLSelectElement>('select[aria-hidden="true"]'))
      expect(selects[1]?.value).toBe(tenants[1].hrGroups[0].id)
      await act(async () => form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

      expect(fetchMock).toHaveBeenCalledWith('/api/context/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: tenants[1].id, hrGroupId: tenants[1].hrGroups[0].id }),
      })
      expect(push).toHaveBeenCalledWith('/dashboard/start')
      expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/hydration failed|did not match|server rendered html/i)
    } finally {
      root.unmount()
      consoleError.mockRestore()
    }
  })
})

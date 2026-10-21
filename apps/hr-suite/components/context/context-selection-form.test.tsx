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
}]

const labels = {
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

  it('renders a native, named form that can submit without client hydration', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(<ContextSelectionForm labels={labels} tenants={tenants} />)

    const form = host.querySelector<HTMLFormElement>('form')
    const select = host.querySelector<HTMLSelectElement>('select[name="selection"]')

    expect(form?.getAttribute('action')).toBe('/api/context/select')
    expect(form?.getAttribute('method')).toBe('post')
    expect(select?.required).toBe(true)
    expect(select?.options[1]?.value).toBe(`${tenants[0].id}|${tenants[0].hrGroups[0].id}`)
    expect(select?.options[1]?.textContent).toBe('De Sterren holding · Planeten')
    expect(host.textContent).not.toContain('PLANETEN')
  })

  it('keeps the selected accessible context on the existing JSON flow after hydration', async () => {
    const element = <ContextSelectionForm labels={labels} tenants={tenants} />
    const host = document.createElement('div')
    host.innerHTML = renderToString(element)
    document.body.append(host)

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const root = await act(async () => hydrateRoot(host, element))

    try {
      const select = host.querySelector<HTMLSelectElement>('#context-selection')
      const form = host.querySelector<HTMLFormElement>('form')
      expect(select).not.toBeNull()

      select!.value = `${tenants[0].id}|${tenants[0].hrGroups[0].id}`
      await act(async () => select!.dispatchEvent(new Event('change', { bubbles: true })))
      await act(async () => form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

      expect(fetchMock).toHaveBeenCalledWith('/api/context/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: tenants[0].id, hrGroupId: tenants[0].hrGroups[0].id }),
      })
      expect(push).toHaveBeenCalledWith('/dashboard/start')
      expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/hydration failed|did not match|server rendered html/i)
    } finally {
      root.unmount()
      consoleError.mockRestore()
    }
  })
})

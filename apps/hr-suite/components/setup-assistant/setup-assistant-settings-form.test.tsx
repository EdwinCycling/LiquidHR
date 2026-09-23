// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetupAssistantSettingsForm } from './setup-assistant-settings-form'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

const labels = {
  title: 'Setup Assistent',
  description: 'Bepaal of de Setup Assistent zichtbaar is.',
  enabled: 'Setup Assistent tonen',
  enabledDescription: 'Toon de Setup Assistent.',
  saving: 'Opslaan…',
  saved: 'Instelling opgeslagen.',
  saveFailed: 'Opslaan mislukt.',
  readOnly: 'Alleen-lezen',
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('Setup Assistant Settings form', () => {
  it('re-enables the canonical setting through the existing endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount(createElement(SetupAssistantSettingsForm, { canWrite: true, initialEnabled: false, labels }))
    const toggle = mounted.host.querySelector('input[role="switch"]') as HTMLInputElement

    expect(toggle.checked).toBe(false)
    act(() => toggle.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledWith('/api/setup-assistant', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isEnabled: true }),
    })
    expect(toggle.checked).toBe(true)
    expect(refresh).toHaveBeenCalledOnce()

    mounted.unmount()
  })
})

// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetupAssistantFloating } from './setup-assistant-floating'
import { createSetupAssistantLabels } from '@/lib/setup-assistant/labels'
import type { SetupAssistantState } from '@/lib/setup-assistant/types'

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
  ...createSetupAssistantLabels((key) => key),
  edgeOpen: 'Open Setup Assistent',
  hide: 'Niet meer tonen',
  hideFailed: 'De Setup Assistent kon niet worden verborgen.',
}

function state(canWrite: boolean): SetupAssistantState {
  return {
    guideCode: 'CORE',
    isEnabled: true,
    canWrite,
    visibleStepKeys: ['BAS-003'],
    availableRelatedRouteKeys: [],
    completedStepKeys: [],
    suggestions: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('Setup Assistant visibility action', () => {
  it('hides the sidepanel through the canonical settings endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount(createElement(SetupAssistantFloating, { labels, state: state(true) }))
    const trigger = mounted.host.querySelector('button[aria-label="Open Setup Assistent"]') as HTMLButtonElement

    act(() => trigger.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Niet meer tonen')
    const hideButton = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Niet meer tonen')) as HTMLButtonElement

    act(() => hideButton.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fetchMock).toHaveBeenCalledWith('/api/setup-assistant', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isEnabled: false }),
    })
    expect(refresh).toHaveBeenCalledOnce()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(mounted.host.querySelector('button[aria-label="Open Setup Assistent"]')).toBeNull()

    mounted.unmount()
  })

  it('keeps the contextual hide action disabled without settings write access', async () => {
    const mounted = mount(createElement(SetupAssistantFloating, { labels, state: state(false) }))
    const trigger = mounted.host.querySelector('button[aria-label="Open Setup Assistent"]') as HTMLButtonElement

    act(() => trigger.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    const hideButton = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Niet meer tonen')) as HTMLButtonElement
    expect(hideButton.disabled).toBe(true)

    mounted.unmount()
  })
})

// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FocusPresentation, FOCUS_PRESENTATION_STORAGE_KEY } from './focus-presentation'
import nl from '@/messages/nl/focus.json'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const { router } = vi.hoisted(() => ({ router: { replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() } }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

let root: Root | undefined
let host: HTMLDivElement

function mount(presentation: 'FOCUS' | 'FULL' = 'FOCUS', isPreboarding = false, canOpenFull = true) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root!.render(<FocusPresentation presentation={presentation} isPreboarding={isPreboarding} canOpenFull={canOpenFull} labels={nl.presentation} />))
  return host
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  vi.restoreAllMocks()
})

describe('Focus browser presentation preference', () => {
  it('uses Full when the server defaults to Full and there is no saved preference', () => {
    mount('FULL')
    expect(router.replace).toHaveBeenCalledWith('/dashboard/start')
  })

  it('keeps an explicit Focus preference even when the server defaults to Full', () => {
    localStorage.setItem(FOCUS_PRESENTATION_STORAGE_KEY, 'FOCUS')
    mount('FULL')
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('respects saved Full for an employee or manager whose server default is Focus', () => {
    localStorage.setItem(FOCUS_PRESENTATION_STORAGE_KEY, 'FULL')
    mount('FOCUS')
    expect(router.replace).toHaveBeenCalledWith('/dashboard/start')
  })

  it('stays on Focus for the ordinary default', () => {
    mount()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('never exposes Full or redirects preboarding, even with inconsistent server data and saved Full', () => {
    localStorage.setItem(FOCUS_PRESENTATION_STORAGE_KEY, 'FULL')
    mount('FULL', true, true)
    expect(router.replace).not.toHaveBeenCalled()
    expect(host.querySelector('a[href="/dashboard/start"]')).toBeNull()
  })

  it('honours canOpenFull independently of the browser preference', () => {
    localStorage.setItem(FOCUS_PRESENTATION_STORAGE_KEY, 'FULL')
    mount('FULL', false, false)
    expect(router.replace).not.toHaveBeenCalled()
    expect(host.querySelector('a[href="/dashboard/start"]')).toBeNull()
  })

  it('renders Focus as an active status instead of a misleading action', () => {
    mount()
    expect(host.querySelector('a[href="/focus"]')).toBeNull()
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe('Focus')
  })

  it('persists Focus before following the link from Full', () => {
    mount('FULL')
    const link = host.querySelector<HTMLAnchorElement>('a[href="/focus"]')!
    let preferenceAtNavigation: string | null = null
    const stopNavigation = (event: MouseEvent) => {
      preferenceAtNavigation = localStorage.getItem(FOCUS_PRESENTATION_STORAGE_KEY)
      event.preventDefault()
    }
    document.addEventListener('click', stopNavigation, { once: true })
    act(() => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(preferenceAtNavigation).toBe('FOCUS')
  })

  it('falls back to the server default if storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('BLOCKED') })
    mount('FULL')
    expect(router.replace).toHaveBeenCalledWith('/dashboard/start')
  })
})

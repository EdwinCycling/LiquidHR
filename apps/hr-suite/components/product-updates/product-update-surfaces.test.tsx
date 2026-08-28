// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { ProductUpdateDrawerTrigger, type ProductUpdateSurfaceLabels } from './product-update-surfaces'
import type { ProductUpdate } from '@/lib/product-updates/service'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

const labels: ProductUpdateSurfaceLabels = {
  title: 'Wat is nieuw', subtitle: 'Nieuwe updates', open: 'Open wat is nieuw', close: 'Sluiten',
  kindNewFeature: 'Nieuwe functionaliteit', kindImprovement: 'Verbetering', giftWindow: 'Cadeauvenster',
  loginPopup: 'Popup bij inloggen', topBanner: 'Banner bovenaan', dateFrom: 'Tonen vanaf', dateUntil: 'Tonen tot',
  more: 'Bekijk alles', manage: 'Updates beheren', seen: 'Gezien', empty: 'Geen updates', unreadCount: '{count} ongelezen updates',
}

const update: ProductUpdate = {
  id: '00000000-0000-4000-8000-000000000001', tenantId: null, scope: 'GLOBAL', kind: 'NEW_FEATURE',
  title: 'Nieuwe werkruimte', summary: 'Een nieuwe update', content: 'Meer informatie', startsAt: '2026-08-28T10:00:00.000Z',
  endsAt: null, displayChannels: ['GIFT_WINDOW'], audienceRoles: ['TENANT_ADMIN'], isActive: true, createdAt: '2026-08-28T10:00:00.000Z',
}

describe('Product Updates drawer trigger', () => {
  it('shows no badge for zero unread updates and shows the count when unread', () => {
    const zero = mount(createElement(ProductUpdateDrawerTrigger, { collapsed: false, labels, locale: 'nl-NL', unreadCount: 0, updates: [] }))
    expect(zero.host.querySelector('.bg-destructive')).toBeNull()
    zero.unmount()

    const unread = mount(createElement(ProductUpdateDrawerTrigger, { collapsed: true, labels, locale: 'nl-NL', unreadCount: 3, updates: [update] }))
    expect(unread.host.querySelector('.bg-destructive')?.textContent).toBe('3')
    expect(unread.host.querySelector('button')?.getAttribute('aria-label')).toContain('3')
    unread.unmount()
  })

  it('opens the existing Drawer, marks updates seen and restores focus after Escape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const mounted = mount(createElement(ProductUpdateDrawerTrigger, { labels, locale: 'nl-NL', unreadCount: 1, updates: [update] }))
    const trigger = mounted.host.querySelector('button') as HTMLButtonElement
    act(() => trigger.focus())
    act(() => trigger.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Nieuwe werkruimte')
    expect(fetch).toHaveBeenCalledWith('/api/product-updates/seen', { method: 'POST' })
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    await act(async () => { await Promise.resolve() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    mounted.unmount()
  })
})

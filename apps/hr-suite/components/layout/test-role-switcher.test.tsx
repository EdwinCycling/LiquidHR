// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { TestRoleSwitcher, type TestRoleSwitchOption } from './test-role-switcher'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

const options: TestRoleSwitchOption[] = [
  { key: 'edwin', email: 'edwin@editsolutions.nl', label: 'Edwin — eigen account' },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test', label: 'Test HR Admin' },
]

describe('TestRoleSwitcher', () => {
  it('keeps the stable selector inside an accessible popover and restores focus', () => {
    const mounted = mount(createElement(TestRoleSwitcher, {
      currentEmail: 'HRADMIN.FIXTURE@LIQUIDHR.TEST',
      labels: { title: 'Testrol wisselen', hint: 'Je wordt opnieuw ingelogd.' },
      options,
    }))
    const trigger = mounted.host.querySelector('[data-testid="test-role-switch-trigger"]') as HTMLButtonElement

    expect(mounted.host.querySelector('#test-role-switch-target')).toBeNull()
    act(() => trigger.click())

    const popover = mounted.host.querySelector('[role="dialog"]')
    const select = mounted.host.querySelector('#test-role-switch-target') as HTMLSelectElement
    expect(popover).not.toBeNull()
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(select.value).toBe('hr-admin')
    expect(document.activeElement).toBe(select)

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(mounted.host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    mounted.unmount()
  })
})

// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { TestRoleSwitcher, type TestRoleSwitchOption } from './test-role-switcher'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(element: React.ReactElement) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, unmount: () => act(() => root.unmount()) }
}

const labels = { title: 'Testrol wisselen', hint: 'Je wordt opnieuw ingelogd als de gekozen testgebruiker.' }
const options: TestRoleSwitchOption[] = [
  { key: 'edwin', email: 'edwin@editsolutions.nl', label: 'Edwin — eigen account' },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test', label: 'Test HR Admin' },
  { key: 'manager', email: 'manager.fixture@liquidhr.test', label: 'Test Manager' },
  { key: 'employee', email: 'employee.fixture@liquidhr.test', label: 'Test Medewerker' },
]

describe('TestRoleSwitcher', () => {
  it('keeps the compact trigger, stable selector and submit flow inside an accessible popover', () => {
    const requestSubmit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => undefined)
    const mounted = mount(createElement(TestRoleSwitcher, { currentEmail: 'manager.fixture@liquidhr.test', labels, options }))
    const trigger = mounted.host.querySelector('[data-testid="test-role-switch-trigger"]') as HTMLButtonElement

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(mounted.host.querySelector('#test-role-switch-target')).toBeNull()

    act(() => trigger.click())

    const select = mounted.host.querySelector('#test-role-switch-target') as HTMLSelectElement
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(labels.title)
    expect(select.value).toBe('manager')
    expect(document.activeElement).toBe(select)

    act(() => {
      select.value = 'employee'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(requestSubmit).toHaveBeenCalledOnce()

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))
    expect(mounted.host.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    requestSubmit.mockRestore()
    mounted.unmount()
  })
})

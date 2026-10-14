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

const labels = { title: 'Testrol wisselen', hint: 'Je wordt opnieuw ingelogd als de gekozen testgebruiker.', returnToAdmin: 'Terug naar Test HR Admin' }
const options: TestRoleSwitchOption[] = [
  { key: 'edwin', email: 'edwin@editsolutions.nl', label: 'Edwin — eigen account' },
  { key: 'hr-admin', email: 'hradmin.fixture@liquidhr.test', label: 'Test HR Admin' },
  { key: 'manager', email: 'manager.fixture@liquidhr.test', label: 'Test Manager' },
  { key: 'employee', email: 'employee.fixture@liquidhr.test', label: 'Test Medewerker' },
  { key: 'payroll-lisa', email: 'lisa.test@liquidhr.test', label: 'Payroll · Lisa' },
  { key: 'payroll-jaap', email: 'jaap.test@liquidhr.test', label: 'Payroll · Jaap' },
  { key: 'payroll-frits', email: 'frits.test@liquidhr.test', label: 'Payroll · Frits' },
]

describe('TestRoleSwitcher', () => {
  it('keeps the compact trigger, stable selector and submit flow inside an accessible popover', () => {
    const requestSubmit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => undefined)
    const mounted = mount(createElement(TestRoleSwitcher, { currentEmail: 'manager.fixture@liquidhr.test', enabled: true, labels, options, returnToAdmin: false }))
    const trigger = mounted.host.querySelector('[data-testid="test-role-switch-trigger"]') as HTMLButtonElement

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(mounted.host.querySelector('#test-role-switch-target')).toBeNull()

    act(() => trigger.click())

    const select = mounted.host.querySelector('#test-role-switch-target') as HTMLSelectElement
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(labels.title)
    expect(select.value).toBe('manager')
    expect(Array.from(select.options).map((option) => option.value)).toContain('payroll-frits')
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

  it.each([
    'manager.fixture@liquidhr.test',
    'employee.fixture@liquidhr.test',
    'lisa.test@liquidhr.test',
    'jaap.test@liquidhr.test',
    'frits.test@liquidhr.test',
  ])('renders a server-posted return to Test HR Admin for %s without a browser credential', (email) => {
    const mounted = mount(createElement(TestRoleSwitcher, {
      currentEmail: email,
      enabled: false,
      labels,
      options,
      returnToAdmin: true,
    }))
    const form = mounted.host.querySelector('form')
    const button = mounted.host.querySelector('[data-testid="test-role-return-to-admin"]')

    expect(mounted.host.querySelector('[data-testid="test-role-switch-trigger"]')).toBeNull()
    expect(form?.getAttribute('action')).toBe('/api/auth/test-login')
    expect(form?.querySelector('input[name="persona"]')?.getAttribute('value')).toBe('hr-admin')
    expect(form?.querySelector('input[name="password"]')).toBeNull()
    expect(button?.getAttribute('aria-label')).toBe(labels.returnToAdmin)

    mounted.unmount()
  })
})

// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { EmployeeReminders } from './employee-reminders'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const labels = {
  title: 'Reminders voor medewerker', empty: 'Geen reminders voor deze medewerker.', add: 'Reminder toevoegen', edit: 'Wijzigen', remove: 'Verwijderen', titleLabel: 'Titel', descriptionLabel: 'Omschrijving', dateLabel: 'Datum en tijd', save: 'Reminder opslaan', saved: 'Opgeslagen', failed: 'Mislukt', futureTime: 'Kies een datum en tijd in de toekomst.', cancel: 'Annuleren', close: 'Reminder sluiten', moreActions: 'Meer reminderacties', personalReminder: 'Persoonlijk', hrReminder: 'HR', discardTitle: 'Wijzigingen negeren?', discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.', discardConfirm: 'Wijzigingen negeren', discardCancel: 'Terug naar formulier', deleteTitle: 'Reminder verwijderen?', deleteDescription: 'Deze reminder wordt definitief verwijderd.', deleteConfirm: 'Verwijderen', deleteCancel: 'Annuleren', shiftDayBack: 'Dag terug', shiftDayForward: 'Dag vooruit', shiftWeekForward: 'Week vooruit', shiftMonthForward: 'Maand vooruit',
}

const reminder = {
  recipientId: 'recipient-1', employeeId: 'employee-1', employeeName: 'Ada Lovelace', reminderId: 'reminder-1', title: 'Contract controleren', description: 'Controleer de looptijd.', remindAt: '2026-08-22T10:00:00.000Z', originalRemindAt: '2026-08-22T10:00:00.000Z', type: 'PERSONAL', targetType: 'SELF', recipientStatus: 'PENDING', reminderStatus: 'PUBLISHED', createdByUserId: 'user-1',
} satisfies ReminderItem

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('Employee reminders Foundation contract', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.querySelectorAll('[data-liquidhr-overlay-root]').forEach((element) => element.remove())
  })

  it('renders the Foundation empty state and keeps HR permission gating', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'HR', reminders: [], timeFormat: '24H' }))

    expect(markup).toContain('Reminders voor medewerker')
    expect(markup).toContain('Geen reminders voor deze medewerker.')
    expect(markup).toContain('border-dashed')
    expect(markup).not.toContain('Reminder toevoegen')
  })

  it('renders populated reminders as surfaces with edit actions in personal mode', () => {
    const markup = renderToStaticMarkup(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'PERSONAL', reminders: [reminder], timeFormat: '24H' }))

    expect(markup).toContain('bg-surface')
    expect(markup).toContain('Contract controleren')
    expect(markup).toContain('Wijzigen')
    expect(markup).toContain('Meer reminderacties')
  })

  it('uses a native datetime-local TextInput in the add form', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'PERSONAL', reminders: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())

    expect(document.body.querySelector('input[name="remindAt"][type="datetime-local"]')).not.toBeNull()
    expect(document.body.querySelector('textarea[name="description"]')).not.toBeNull()
    root.unmount()
    host.remove()
  })

  it('opens Add with a reminder time at least fifteen minutes ahead on the next quarter hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-21T09:18:50Z'))

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'PERSONAL', reminders: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())

    const input = document.body.querySelector('input[name="remindAt"][type="datetime-local"]') as HTMLInputElement
    const defaultDate = new Date(input.value)
    expect(defaultDate.getTime()).toBeGreaterThanOrEqual(new Date('2026-08-21T09:33:50Z').getTime())
    expect(defaultDate.getMinutes() % 15).toBe(0)
    expect(defaultDate.getSeconds()).toBe(0)

    act(() => root.unmount())
    host.remove()
  })

  it('keeps the drawer open and avoids POST when the reminder time has expired', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-21T09:18:50Z'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    refreshMock.mockClear()

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'PERSONAL', reminders: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    const titleInput = dialog.querySelector('input[name="title"]') as HTMLInputElement
    const dateInput = dialog.querySelector('input[name="remindAt"]') as HTMLInputElement
    act(() => {
      setInputValue(titleInput, 'Verlopen reminder')
      setInputValue(dateInput, '2026-08-21T08:00')
    })
    await act(async () => {
      ;(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('Kies een datum en tijd in de toekomst.')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(refreshMock).not.toHaveBeenCalled()

    act(() => root.unmount())
    host.remove()
  })

  it('posts a valid future reminder with the existing payload and refreshes after success', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-21T09:18:50Z'))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    refreshMock.mockClear()

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'PERSONAL', reminders: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    const titleInput = dialog.querySelector('input[name="title"]') as HTMLInputElement
    const dateInput = dialog.querySelector('input[name="remindAt"]') as HTMLInputElement
    act(() => {
      setInputValue(titleInput, 'Toekomstige reminder')
      setInputValue(dateInput, '2026-08-21T12:00')
    })
    await act(async () => {
      ;(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/reminders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'PERSONAL', title: 'Toekomstige reminder', description: '', remindAt: new Date('2026-08-21T12:00').toISOString() }),
    })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(refreshMock).toHaveBeenCalledOnce()

    act(() => root.unmount())
    host.remove()
  })

  it('publishes an HR reminder for the selected employee and refreshes after success', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-21T09:18:50Z'))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'hr-reminder-1' } }) })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    refreshMock.mockClear()

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'HR', reminders: [], timeFormat: '24H' })))

    act(() => [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Reminder toevoegen'))?.click())
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    const titleInput = dialog.querySelector('input[name="title"]') as HTMLInputElement
    const dateInput = dialog.querySelector('input[name="remindAt"]') as HTMLInputElement
    act(() => {
      setInputValue(titleInput, 'HR-reminder voor Maya')
      setInputValue(dateInput, '2026-08-21T12:00')
    })
    await act(async () => {
      ;(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/reminders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'HR', title: 'HR-reminder voor Maya', description: '', remindAt: new Date('2026-08-21T12:00').toISOString(), targetType: 'EMPLOYEES', targetIds: ['employee-1'] }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/reminders/hr-reminder-1/publish', { method: 'POST' })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(refreshMock).toHaveBeenCalledOnce()

    act(() => root.unmount())
    host.remove()
  })

  it('keeps an HR drawer open when publishing has no recipient', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'hr-reminder-2' } }) })
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetchMock)
    refreshMock.mockClear()

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: true, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'HR', reminders: [], timeFormat: '24H' })))

    act(() => [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Reminder toevoegen'))?.click())
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    const titleInput = dialog.querySelector('input[name="title"]') as HTMLInputElement
    act(() => setInputValue(titleInput, 'HR-reminder zonder ontvanger'))
    await act(async () => {
      ;(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('Mislukt')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(refreshMock).not.toHaveBeenCalled()

    act(() => root.unmount())
    host.remove()
  })

  it('keeps a failed save error inside the active drawer without refreshing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)
    refreshMock.mockClear()

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(createElement(EmployeeReminders, { canManageHr: false, dateFormat: 'DMY', employeeId: 'employee-1', labels, locale: 'nl-NL', mode: 'PERSONAL', reminders: [], timeFormat: '24H' })))

    act(() => (host.querySelector('button') as HTMLButtonElement).click())
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    const titleInput = dialog.querySelector('input[name="title"]') as HTMLInputElement
    act(() => {
      titleInput.value = 'Nieuwe reminder'
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
      titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      ;(dialog.querySelector('button[type="submit"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    const error = dialog.querySelector('[role="alert"]')
    expect(error?.textContent).toBe('Mislukt')
    expect(dialog.contains(error)).toBe(true)
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(refreshMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()

    act(() => root.unmount())
    host.remove()
  })
})

// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ReminderItem } from '@/lib/reminders/reminder-service'
import { EmployeeReminders } from './employee-reminders'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = {
  title: 'Reminders voor medewerker', empty: 'Geen reminders voor deze medewerker.', add: 'Reminder toevoegen', edit: 'Wijzigen', remove: 'Verwijderen', titleLabel: 'Titel', descriptionLabel: 'Omschrijving', dateLabel: 'Datum en tijd', save: 'Reminder opslaan', saved: 'Opgeslagen', failed: 'Mislukt', cancel: 'Annuleren', close: 'Reminder sluiten', moreActions: 'Meer reminderacties', personalReminder: 'Persoonlijk', hrReminder: 'HR', discardTitle: 'Wijzigingen negeren?', discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.', discardConfirm: 'Wijzigingen negeren', discardCancel: 'Terug naar formulier', deleteTitle: 'Reminder verwijderen?', deleteDescription: 'Deze reminder wordt definitief verwijderd.', deleteConfirm: 'Verwijderen', deleteCancel: 'Annuleren', shiftDayBack: 'Dag terug', shiftDayForward: 'Dag vooruit', shiftWeekForward: 'Week vooruit', shiftMonthForward: 'Maand vooruit',
}

const reminder = {
  recipientId: 'recipient-1', employeeId: 'employee-1', employeeName: 'Ada Lovelace', reminderId: 'reminder-1', title: 'Contract controleren', description: 'Controleer de looptijd.', remindAt: '2026-08-22T10:00:00.000Z', originalRemindAt: '2026-08-22T10:00:00.000Z', type: 'PERSONAL', targetType: 'SELF', recipientStatus: 'PENDING', reminderStatus: 'PUBLISHED', createdByUserId: 'user-1',
} satisfies ReminderItem

describe('Employee reminders Foundation contract', () => {
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
})

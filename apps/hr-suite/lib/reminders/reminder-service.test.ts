import { describe, expect, it } from 'vitest'
import { reminderActionUrl, reminderDatabaseError, toEmployeeTargetReminderItem, toReminderItem } from './reminder-service'

describe('reminderDatabaseError', () => {
  it.each([
    ['REMINDER_NOT_FOUND', 404],
    ['REMINDER_RECIPIENT_NOT_FOUND', 404],
    ['REMINDER_FORBIDDEN', 403],
    ['REMINDER_NO_RECIPIENTS', 409],
    ['REMINDER_NOT_DRAFT', 409],
    ['REMINDER_IN_PAST', 400],
  ] as const)('vertaalt %s naar HTTP %i', (code, status) => {
    expect(reminderDatabaseError({ message: code }).status).toBe(status)
  })

  it('lekt geen onbekende databasefout naar de client', () => {
    expect(reminderDatabaseError({ message: 'connection details' }).code).toBe('REMINDER_OPERATION_FAILED')
  })
})

describe('toReminderItem', () => {
  it('maakt een recipientresultaat geschikt voor de Tijdhub', () => {
    expect(toReminderItem({
      id: 'recipient-1', status: 'PENDING', effective_remind_at: '2026-07-16T12:00:00.000Z',
      reminders: {
        id: 'reminder-1', title: 'Contract controleren', description: null,
        remind_at: '2026-07-16T12:00:00.000Z', reminder_type: 'HR', target_type: 'EVERYONE',
        status: 'PUBLISHED', created_by_user_id: 'user-1',
      },
    })).toEqual({
      recipientId: 'recipient-1', employeeId: null, employeeName: null, reminderId: 'reminder-1', title: 'Contract controleren',
      description: null, remindAt: '2026-07-16T12:00:00.000Z', originalRemindAt: '2026-07-16T12:00:00.000Z',
      type: 'HR', targetType: 'EVERYONE', recipientStatus: 'PENDING', reminderStatus: 'PUBLISHED',
      createdByUserId: 'user-1',
    })
  })
})

describe('toEmployeeTargetReminderItem', () => {
  it('maakt een medewerkergerichte reminder zichtbaar zonder recipient-account', () => {
    expect(toEmployeeTargetReminderItem({
      id: 'target-1', employee_id: 'employee-1',
      employees: { id: 'employee-1', first_name: 'Maya', birth_name: 'Bos' },
      reminders: {
        id: 'reminder-1', title: 'Contract controleren', description: null,
        remind_at: '2026-08-22T10:00:00.000Z', reminder_type: 'HR', target_type: 'EMPLOYEES',
        status: 'PUBLISHED', created_by_user_id: 'user-1',
      },
    })).toMatchObject({
      recipientId: 'target:target-1', employeeId: 'employee-1', employeeName: 'Maya Bos',
      reminderId: 'reminder-1', remindAt: '2026-08-22T10:00:00.000Z', recipientStatus: 'PENDING',
    })
  })
})

describe('reminderActionUrl', () => {
  it('extracts protected Journey deep links from reminder descriptions', () => {
    expect(reminderActionUrl('Open /journeys/11111111-1111-4111-8111-111111111111#moment/22222222-2222-4222-8222-222222222222')).toBeUndefined()
    expect(reminderActionUrl('Open /journeys/11111111-1111-4111-8111-111111111111#moment-22222222-2222-4222-8222-222222222222')).toBe('/journeys/11111111-1111-4111-8111-111111111111#moment-22222222-2222-4222-8222-222222222222')
  })

  it('extracts protected recruitment application deep links', () => {
    expect(reminderActionUrl('Openen /recruitment/applications/11111111-1111-4111-8111-111111111111')).toBe('/recruitment/applications/11111111-1111-4111-8111-111111111111')
  })
})

import { describe, expect, it } from 'vitest'
import { reminderDatabaseError, toReminderItem } from './reminder-service'

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
      recipientId: 'recipient-1', reminderId: 'reminder-1', title: 'Contract controleren',
      description: null, remindAt: '2026-07-16T12:00:00.000Z', originalRemindAt: '2026-07-16T12:00:00.000Z',
      type: 'HR', targetType: 'EVERYONE', recipientStatus: 'PENDING', reminderStatus: 'PUBLISHED',
      createdByUserId: 'user-1',
    })
  })
})

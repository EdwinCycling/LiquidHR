import { describe, expect, it } from 'vitest'
import {
  hrReminderCreateSchema,
  personalReminderCreateSchema,
  recipientActionSchema,
  reminderUpdateSchema,
} from './schemas'

describe('personalReminderCreateSchema', () => {
  it('weigert een herinnering in het verleden', () => {
    expect(personalReminderCreateSchema.safeParse({
      title: 'Terugbellen',
      remindAt: '2020-01-01T10:00:00.000Z',
    }).success).toBe(false)
  })

  it('accepteert een toekomstige persoonlijke reminder', () => {
    expect(personalReminderCreateSchema.safeParse({
      title: 'Terugbellen',
      description: 'Bespreek de planning.',
      remindAt: '2099-01-01T10:00:00.000Z',
    }).success).toBe(true)
  })
})

describe('recipientActionSchema', () => {
  it('weigert uitstellen naar een tijdstip in het verleden', () => {
    expect(recipientActionSchema.safeParse({
      action: 'SNOOZE',
      remindAt: '2020-01-01T10:00:00.000Z',
    }).success).toBe(false)
  })

  it('accepteert gereedmelden en verbergen zonder extra velden', () => {
    expect(recipientActionSchema.safeParse({ action: 'COMPLETE' }).success).toBe(true)
    expect(recipientActionSchema.safeParse({ action: 'DISMISS' }).success).toBe(true)
    expect(recipientActionSchema.safeParse({ action: 'COMPLETE', userId: 'verboden' }).success).toBe(false)
  })
})

describe('hrReminderCreateSchema', () => {
  const base = {
    title: 'Controleer contracten',
    remindAt: '2099-01-01T10:00:00.000Z',
  }

  it('vereist doel-id’s voor afdelingen en medewerkers', () => {
    expect(hrReminderCreateSchema.safeParse({ ...base, targetType: 'DEPARTMENTS', targetIds: [] }).success).toBe(false)
    expect(hrReminderCreateSchema.safeParse({ ...base, targetType: 'EMPLOYEES' }).success).toBe(false)
  })

  it('weigert doel-id’s bij iedereen', () => {
    expect(hrReminderCreateSchema.safeParse({ ...base, targetType: 'EVERYONE', targetIds: ['verboden'] }).success).toBe(false)
  })

  it('dedupliceert geldige doel-id’s', () => {
    const result = hrReminderCreateSchema.parse({
      ...base,
      targetType: 'EMPLOYEES',
      targetIds: [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001',
      ],
    })
    if (result.targetType === 'EVERYONE') throw new Error('Onverwachte doelgroep')
    expect(result.targetIds).toEqual(['00000000-0000-4000-8000-000000000001'])
  })
})

describe('reminderUpdateSchema', () => {
  it('vereist minstens één wijziging en blokkeert statusvelden', () => {
    expect(reminderUpdateSchema.safeParse({}).success).toBe(false)
    expect(reminderUpdateSchema.safeParse({ status: 'PUBLISHED' }).success).toBe(false)
    expect(reminderUpdateSchema.safeParse({ title: 'Nieuwe titel' }).success).toBe(true)
  })
})

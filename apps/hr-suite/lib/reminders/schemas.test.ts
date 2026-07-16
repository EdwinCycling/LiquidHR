import { describe, expect, it } from 'vitest'
import { personalReminderCreateSchema, recipientActionSchema } from './schemas'

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
})

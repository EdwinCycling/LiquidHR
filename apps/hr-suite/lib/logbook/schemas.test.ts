import { describe, expect, it } from 'vitest'
import { aiTeamSummaryLogbookEntryCreateSchema, personalLogbookEntryCreateSchema, personalLogbookEntryUpdateSchema } from './schemas'

describe('personal logbook input contracts', () => {
  it('accepts only the reviewed title and description for manual entries', () => {
    expect(personalLogbookEntryCreateSchema.safeParse({ title: 'Gesprek', description: 'Vervolgactie.' }).success).toBe(true)
    expect(personalLogbookEntryCreateSchema.safeParse({ title: 'Gesprek', description: '', owner_user_id: 'other-user' }).success).toBe(false)
  })

  it('requires a session binding for an AI summary and allows partial edits', () => {
    expect(aiTeamSummaryLogbookEntryCreateSchema.safeParse({ title: 'Teamgesprek', description: 'Voorstel', sessionId: '00000000-0000-4000-8000-000000000001' }).success).toBe(true)
    expect(aiTeamSummaryLogbookEntryCreateSchema.safeParse({ title: 'Teamgesprek', description: 'Voorstel' }).success).toBe(false)
    expect(personalLogbookEntryUpdateSchema.safeParse({ description: 'Aangepast' }).success).toBe(true)
    expect(personalLogbookEntryUpdateSchema.safeParse({}).success).toBe(false)
  })
})

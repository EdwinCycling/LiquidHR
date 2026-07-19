import { describe, expect, it } from 'vitest'
import { documentMetadataSchema } from './schemas'

const valid = {
  title: 'Arbeidsovereenkomst', description: 'Getekende versie', tags: ['contract', 'getekend'],
  categoryId: '11111111-1111-4111-8111-111111111111', expiresOn: '2028-07-01',
  audiences: [{ type: 'EMPLOYEE' as const, targetId: '22222222-2222-4222-8222-222222222222' }],
  reminder: null,
}

describe('document metadata', () => {
  it('normalizes and deduplicates tags', () => {
    expect(documentMetadataSchema.parse({ ...valid, tags: [' Contract ', 'contract'] }).tags).toEqual(['contract'])
  })

  it('requires at least one visibility audience', () => {
    expect(() => documentMetadataSchema.parse({ ...valid, audiences: [] })).toThrow()
  })

  it('requires reminder time and targets together', () => {
    expect(() => documentMetadataSchema.parse({ ...valid, reminder: { remindAt: '2027-06-01T09:00:00.000Z', targets: [] } })).toThrow()
  })

  it('rejects department reminders for employee documents', () => {
    expect(() =>
      documentMetadataSchema.parse({
        ...valid,
        reminder: {
          remindAt: '2027-06-01T09:00:00.000Z',
          targets: [{ type: 'DEPARTMENT_BRANCH', targetId: '33333333-3333-4333-8333-333333333333' }],
        },
      }),
    ).toThrow()
  })
})

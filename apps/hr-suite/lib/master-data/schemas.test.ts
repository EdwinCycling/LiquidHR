import { describe, expect, it } from 'vitest'
import { endReasonCreateSchema, jobCreateSchema, salaryRevisionSchema } from './schemas'

const revision = {
  scaleId: '11111111-1111-4111-8111-111111111111', validFrom: '2026-07-01',
  validUntil: null, description: 'Nieuwe cao-bedragen',
  steps: [{ stepCode: '0', stepName: 'Trede 0', sequenceNumber: 0, fulltimeAmount: 3200, hourlyAmount: null, stepKind: 'REGULAR' as const }],
}

describe('master-data schemas', () => {
  it('requires at least one salary step', () => {
    expect(() => salaryRevisionSchema.parse({ ...revision, steps: [] })).toThrow()
  })

  it('rejects duplicate sequence numbers and step codes', () => {
    const duplicate = { ...revision, steps: [revision.steps[0], { ...revision.steps[0], stepCode: '1' }] }
    expect(() => salaryRevisionSchema.parse(duplicate)).toThrow()
  })

  it('accepts variable Dutch public-sector scale lengths', () => {
    const steps = Array.from({ length: 13 }, (_, index) => ({
      stepCode: String(index), stepName: `Trede ${index}`, sequenceNumber: index,
      fulltimeAmount: 3000 + index * 125, hourlyAmount: null, stepKind: index === 12 ? 'MAXIMUM' as const : 'REGULAR' as const,
    }))
    expect(salaryRevisionSchema.parse({ ...revision, steps }).steps).toHaveLength(13)
  })

  it('requires at least one tenant-owned job group', () => {
    expect(() => jobCreateSchema.parse({ code: 'HRADV', name: 'HR-adviseur', jobGroupIds: [] })).toThrow()
  })

  it('requires exactly one tenant-owned job group', () => {
    expect(() => jobCreateSchema.parse({
      code: 'HRADV', name: 'HR-adviseur', jobGroupIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
    })).toThrow()
  })

  it('normalizes the country code for a termination reason', () => {
    expect(endReasonCreateSchema.parse({ countryCode: 'nl', code: '30', nameNl: 'Einde contract', nameEn: 'End of contract' }).countryCode).toBe('NL')
  })

  it('rejects a termination reason without an ISO-2 country code', () => {
    expect(() => endReasonCreateSchema.parse({ countryCode: 'NLD', code: '30', nameNl: 'Einde contract', nameEn: 'End of contract' })).toThrow()
  })
})

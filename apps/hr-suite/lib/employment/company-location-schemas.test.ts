import { describe, expect, it } from 'vitest'
import { companyLocationMutationSchema } from './company-location-schemas'

const locationId = '11111111-1111-4111-8111-111111111111'
const placementId = '22222222-2222-4222-8222-222222222222'

describe('companyLocationMutationSchema', () => {
  it('accepteert een nieuwe locatieperiode zonder einddatumveld', () => {
    expect(companyLocationMutationSchema.safeParse({
      effectiveOn: '2026-09-01',
      locationId,
    }).success).toBe(true)
  })

  it('accepteert wijzigen van een bestaande periode', () => {
    expect(companyLocationMutationSchema.safeParse({
      placementId,
      effectiveOn: '2026-01-01',
      locationId,
    }).success).toBe(true)
  })

  it('weigert een ongeldige datum of ontbrekende locatie', () => {
    expect(companyLocationMutationSchema.safeParse({ effectiveOn: '01-09-2026', locationId }).success).toBe(false)
    expect(companyLocationMutationSchema.safeParse({ effectiveOn: '2026-09-01', locationId: null }).success).toBe(false)
  })
})

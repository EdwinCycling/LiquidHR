import { describe, expect, it } from 'vitest'
import { companyDataUpdateSchema } from './schemas'
import { toCompanyDataUpdatePayload } from './payloads'

describe('company data update payload', () => {
  it('laat de read-only id weg zodat PATCH de strikte input accepteert', () => {
    const company = {
      id: 'company-fixture-id',
      singleLocation: true,
      addressLine1: null,
      addressLine2: null,
      street: 'Keizersgracht',
      houseNumber: '100',
      houseNumberAddition: null,
      postalCode: '1015 AA',
      city: 'Amsterdam',
      region: 'Noord-Holland',
      countryCode: 'NL',
    }

    const payload = toCompanyDataUpdatePayload(company)

    expect(payload).not.toHaveProperty('id')
    expect(companyDataUpdateSchema.safeParse(payload).success).toBe(true)
  })
})

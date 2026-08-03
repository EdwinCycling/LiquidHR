import { describe, expect, it } from 'vitest'
import { companyDataUpdateSchema, locationCreateSchema } from './schemas'

describe('company data schemas', () => {
  it('accepteert een Nederlands bedrijfsadres', () => {
    const result = companyDataUpdateSchema.safeParse({
      singleLocation: true,
      street: 'Keizersgracht',
      houseNumber: '100',
      postalCode: '1015 AA',
      city: 'Amsterdam',
      countryCode: 'NL',
    })
    expect(result.success).toBe(true)
  })

  it('vereist de juiste adresvelden voor Nederland', () => {
    const result = companyDataUpdateSchema.safeParse({ singleLocation: true, city: 'Amsterdam', countryCode: 'NL' })
    expect(result.success).toBe(false)
  })

  it('accepteert een buitenlands locatieadres met adresregel', () => {
    const result = locationCreateSchema.safeParse({ name: 'Brussel', addressLine1: 'Rue de la Loi 16', addressLine2: '2e verdieping', city: 'Brussel', countryCode: 'BE', isActive: true })
    expect(result.success).toBe(true)
  })
})

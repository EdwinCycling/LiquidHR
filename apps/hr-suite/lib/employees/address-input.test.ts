import { describe, expect, it } from 'vitest'
import { addressSchema } from './schemas'

describe('address input contract', () => {
  it('accepts a Dutch address with the existing structured fields', () => {
    const result = addressSchema.safeParse({
      street: 'Kerkstraat', houseNumber: '12', addition: 'A', postalCode: '1234 ab', city: 'Utrecht',
      countryCode: 'nl', validFrom: '2026-07-25',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.countryCode).toBe('NL')
  })

  it('accepts an international address without a postcode or house number', () => {
    const result = addressSchema.safeParse({
      addressLine1: '10 Downing Street', addressLine2: 'Flat 2', city: 'London', countryCode: 'GB', validFrom: '2026-07-25',
    })
    expect(result.success).toBe(true)
  })

  it('requires structured Dutch address fields', () => {
    const result = addressSchema.safeParse({
      addressLine1: 'Some address', city: 'Utrecht', countryCode: 'NL', validFrom: '2026-07-25',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an end date before the start date', () => {
    const result = addressSchema.safeParse({
      addressLine1: '10 Downing Street', city: 'London', countryCode: 'GB', validFrom: '2026-07-26', validUntil: '2026-07-25',
    })
    expect(result.success).toBe(false)
  })
})

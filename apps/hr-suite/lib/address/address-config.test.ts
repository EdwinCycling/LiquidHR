import { describe, expect, it } from 'vitest'
import { getCountryAddressConfiguration, isCountryCode } from './address-config'

describe('address country configuration', () => {
  it('routes the Netherlands to PDOK and enables postcode lookup', () => {
    expect(getCountryAddressConfiguration('nl')).toMatchObject({ countryCode: 'NL', addressSearchProvider: 'pdok', supportsPostcodeLookup: true })
  })

  it('accepts ISO alpha-2 country codes only', () => {
    expect(isCountryCode('BE')).toBe(true)
    expect(isCountryCode('Belgium')).toBe(false)
  })
})

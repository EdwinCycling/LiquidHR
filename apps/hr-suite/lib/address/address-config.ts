export type AddressSearchProvider = 'pdok' | 'geoapify' | 'none'

export interface CountryAddressConfiguration {
  countryCode: string
  addressSearchProvider: AddressSearchProvider
  supportsAddressSearch: boolean
  supportsPostcodeLookup: boolean
  postalCodeRequired: boolean
  houseNumberRequired: boolean
  regionRequired: boolean
}

export const DEFAULT_COUNTRY_CODE = 'NL'

export function getCountryAddressConfiguration(countryCode: string): CountryAddressConfiguration {
  const normalized = countryCode.trim().toUpperCase()
  if (normalized === 'NL') {
    return {
      countryCode: normalized,
      addressSearchProvider: 'pdok',
      supportsAddressSearch: true,
      supportsPostcodeLookup: true,
      postalCodeRequired: true,
      houseNumberRequired: true,
      regionRequired: false,
    }
  }

  return {
    countryCode: normalized,
    addressSearchProvider: process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'none',
    supportsAddressSearch: Boolean(process.env.GEOAPIFY_API_KEY),
    supportsPostcodeLookup: false,
    postalCodeRequired: false,
    houseNumberRequired: false,
    regionRequired: false,
  }
}

export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value.trim().toUpperCase())
}

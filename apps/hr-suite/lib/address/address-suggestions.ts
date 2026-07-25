import { getCountryAddressConfiguration, type AddressSearchProvider } from './address-config'

export interface AddressSuggestion {
  label: string
  countryCode: string
  addressLine1: string
  addressLine2: string | null
  street: string | null
  houseNumber: string | null
  houseNumberAddition: string | null
  postalCode: string | null
  city: string | null
  region: string | null
  source: 'pdok' | 'geoapify'
  sourceReference: string | null
}

export class AddressProviderError extends Error {
  constructor(readonly provider: AddressSearchProvider) {
    super(`Address provider failed: ${provider}`)
    this.name = 'AddressProviderError'
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4_000) })
  if (!response.ok) throw new Error(`provider status ${response.status}`)
  return response.json()
}

function normalizePdokDocument(document: Record<string, unknown>): AddressSuggestion | null {
  const street = stringValue(document.straatnaam)
  const houseNumber = stringValue(document.huisnummer) ?? stringValue(document.huis_nlt)
  const postalCode = stringValue(document.postcode)
  const city = stringValue(document.woonplaatsnaam)
  const region = stringValue(document.provincienaam)
  const label = stringValue(document.weergavenaam) ?? [street, houseNumber, postalCode, city].filter(Boolean).join(', ')
  const addressLine1 = [street, houseNumber].filter(Boolean).join(' ')
  if (!label || !addressLine1 || !city) return null
  return {
    label,
    countryCode: 'NL',
    addressLine1,
    addressLine2: null,
    street,
    houseNumber,
    houseNumberAddition: null,
    postalCode,
    city,
    region,
    source: 'pdok',
    sourceReference: stringValue(document.id),
  }
}

async function searchPdok(query: string): Promise<AddressSuggestion[]> {
  const url = new URL('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free')
  url.searchParams.set('q', query)
  url.searchParams.set('rows', '5')
  url.searchParams.set('fq', 'type:adres')
  const payload = objectValue(await fetchJson(url.toString()))
  const response = objectValue(payload?.response)
  const documents = Array.isArray(response?.docs) ? response.docs : []
  return documents.map(objectValue).filter((item): item is Record<string, unknown> => item !== null)
    .map(normalizePdokDocument).filter((item): item is AddressSuggestion => item !== null)
}

function normalizeGeoapifyFeature(feature: unknown, countryCode: string): AddressSuggestion | null {
  const featureObject = objectValue(feature)
  const properties = objectValue(featureObject?.properties)
  if (!properties) return null
  const street = stringValue(properties.street)
  const houseNumber = stringValue(properties.housenumber)
  const postalCode = stringValue(properties.postcode)
  const city = stringValue(properties.city) ?? stringValue(properties.town) ?? stringValue(properties.village)
  const region = stringValue(properties.state)
  const addressLine1 = stringValue(properties.address_line1) ?? [street, houseNumber].filter(Boolean).join(' ')
  const label = stringValue(properties.formatted) ?? addressLine1
  if (!label || !addressLine1 || !city) return null
  return {
    label,
    countryCode,
    addressLine1,
    addressLine2: stringValue(properties.address_line2),
    street,
    houseNumber,
    houseNumberAddition: null,
    postalCode,
    city,
    region,
    source: 'geoapify',
    sourceReference: stringValue(properties.place_id),
  }
}

async function searchGeoapify(query: string, countryCode: string): Promise<AddressSuggestion[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) return []
  const url = new URL('https://api.geoapify.com/v1/geocode/search')
  url.searchParams.set('text', query)
  url.searchParams.set('filter', `countrycode:${countryCode.toLowerCase()}`)
  url.searchParams.set('limit', '5')
  url.searchParams.set('apiKey', apiKey)
  const payload = objectValue(await fetchJson(url.toString()))
  const features = Array.isArray(payload?.features) ? payload.features : []
  return features.map((feature) => normalizeGeoapifyFeature(feature, countryCode))
    .filter((item): item is AddressSuggestion => item !== null)
}

export async function searchAddressSuggestions(countryCode: string, query: string): Promise<AddressSuggestion[]> {
  const configuration = getCountryAddressConfiguration(countryCode)
  if (configuration.addressSearchProvider === 'pdok') return searchPdok(query)
  if (configuration.addressSearchProvider === 'geoapify') return searchGeoapify(query, configuration.countryCode)
  return []
}

export async function lookupDutchAddress(postalCode: string, houseNumber: string): Promise<AddressSuggestion[]> {
  return searchPdok(`${postalCode.trim()} ${houseNumber.trim()}`)
}

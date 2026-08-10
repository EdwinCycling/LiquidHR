import { z } from 'zod'
import { normalizeProviderHoliday, type NormalizedProviderHoliday } from './holiday-model'

const providerHolidaySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), localName: z.string(), name: z.string(), countryCode: z.string().length(2), global: z.boolean(), counties: z.array(z.string()).nullable(), launchYear: z.number().nullable(), types: z.array(z.string()) })
const providerCountrySchema = z.object({ countryCode: z.string().length(2), name: z.string().trim().min(1) })

export type HolidayCountry = { code: string; name: string }

export async function fetchAvailableHolidayCountries(): Promise<HolidayCountry[]> {
  const response = await fetch('https://date.nager.at/api/v3/AvailableCountries', { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('HOLIDAY_PROVIDER_UNAVAILABLE')
  const parsed = z.array(providerCountrySchema).safeParse(await response.json())
  if (!parsed.success) throw new Error('HOLIDAY_PROVIDER_INVALID_RESPONSE')
  return parsed.data
    .map((country) => ({ code: country.countryCode.toUpperCase(), name: country.name }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function fetchPublicHolidays(year: number, countryCode: string): Promise<NormalizedProviderHoliday[]> {
  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('HOLIDAY_PROVIDER_UNAVAILABLE')
  const parsed = z.array(providerHolidaySchema).safeParse(await response.json())
  if (!parsed.success) throw new Error('HOLIDAY_PROVIDER_INVALID_RESPONSE')
  return parsed.data.map(normalizeProviderHoliday)
}

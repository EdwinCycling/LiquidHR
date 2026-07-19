export type ProviderHoliday = {
  date: string
  localName: string
  name: string
  countryCode: string
  global: boolean
  counties: string[] | null
  launchYear: number | null
  types: string[]
}

export type NormalizedProviderHoliday = {
  date: string
  providerName: string
  displayName: string
  externalKey: string
  holidayTypes: string[]
  subdivisionCodes: string[]
}

function slugify(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function normalizeProviderHoliday(holiday: ProviderHoliday): NormalizedProviderHoliday {
  return {
    date: holiday.date,
    providerName: holiday.name,
    displayName: holiday.localName,
    externalKey: `${holiday.countryCode}:${holiday.date}:${slugify(holiday.name)}`,
    holidayTypes: holiday.types,
    subdivisionCodes: holiday.counties ?? [],
  }
}

type ExistingHolidayState = { externalKey: string | null; source: 'API' | 'MANUAL'; isActive: boolean }
type ImportedHolidayState = { externalKey: string }

export function mergeHolidayImport(input: { existing: readonly ExistingHolidayState[]; imported: readonly ImportedHolidayState[] }) {
  const activeState = new Map(
    input.existing.filter((holiday) => holiday.source === 'API' && holiday.externalKey).map((holiday) => [holiday.externalKey, holiday.isActive]),
  )
  return input.imported.map((holiday) => ({
    externalKey: holiday.externalKey,
    isActive: activeState.get(holiday.externalKey) ?? true,
  }))
}

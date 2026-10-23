const fallbackTimeZones = [
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
  'Europe/Rome', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Lisbon', 'Europe/Helsinki', 'Europe/Athens',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
]

const intlWithTimeZoneList = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }

export const HR_GROUP_TIME_ZONES = [...new Set([
  ...(intlWithTimeZoneList.supportedValuesOf?.('timeZone') ?? fallbackTimeZones),
  'UTC',
])]

const supportedTimeZones = new Set(HR_GROUP_TIME_ZONES)

export function isHrGroupTimeZone(value: string): boolean {
  return supportedTimeZones.has(value)
}

export function hrGroupTimeZoneLabel(value: string): string {
  if (value === 'UTC') return 'UTC'
  const city = value.split('/').pop()?.replace(/_/g, ' ')
  return city || value
}

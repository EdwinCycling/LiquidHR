export function parseRosterHoursInput(value: string): number {
  const match = value.trim().match(/^(\d{1,2})(?:[,:.](\d{2}))?$/)
  if (!match) return Number.NaN

  const hours = Number(match[1])
  const minutes = Number(match[2] ?? '0')
  if (minutes >= 60) return Number.NaN
  return hours + minutes / 60
}

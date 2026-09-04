import { parseDecimalInput } from './decimal-input'

export type RosterHoursInputMode = 'DECIMAL' | 'HOURS_MINUTES'

export function parseRosterHoursInput(value: string): number {
  const match = value.trim().match(/^(\d{1,2})(?:[,:.](\d{2}))?$/)
  if (!match) return Number.NaN

  const hours = Number(match[1])
  const minutes = Number(match[2] ?? '0')
  if (minutes >= 60) return Number.NaN
  return hours + minutes / 60
}

export function parseRosterHoursValue(value: string, mode: RosterHoursInputMode): number {
  return mode === 'HOURS_MINUTES' ? parseRosterHoursInput(value) : parseDecimalInput(value)
}

export function formatRosterHoursValue(value: number, mode: RosterHoursInputMode): string {
  if (!Number.isFinite(value)) return ''
  if (mode === 'HOURS_MINUTES') {
    const totalMinutes = Math.max(0, Math.round(value * 60))
    return `${Math.floor(totalMinutes / 60)},${String(totalMinutes % 60).padStart(2, '0')}`
  }
  return String(Math.round(value * 100) / 100)
}

export function convertRosterHoursInput(value: string, from: RosterHoursInputMode, to: RosterHoursInputMode): string {
  const parsed = parseRosterHoursValue(value, from)
  return Number.isFinite(parsed) ? formatRosterHoursValue(parsed, to) : value
}

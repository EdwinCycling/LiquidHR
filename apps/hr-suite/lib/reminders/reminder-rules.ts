export type ReminderTargetSummaryInput = {
  type: 'SELF' | 'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'
  ids?: string[]
}

export function formatReminderCountdown(now: Date, remindAt: Date, locale: string): string {
  const differenceInMinutes = Math.round((remindAt.getTime() - now.getTime()) / 60_000)
  const minuteLabel = locale.startsWith('nl') ? 'min.' : 'min'

  if (differenceInMinutes < 0) return `${Math.abs(differenceInMinutes)} ${minuteLabel} geleden`
  if (differenceInMinutes === 0) return 'nu'
  if (differenceInMinutes < 60) return `over ${differenceInMinutes} ${minuteLabel}`

  const differenceInHours = Math.floor(differenceInMinutes / 60)
  return `over ${differenceInHours} uur`
}

export function clockHandAngles(date: Date): { hour: number; minute: number; second: number } {
  const hours = date.getUTCHours() % 12
  const minutes = date.getUTCMinutes()
  const seconds = date.getUTCSeconds()

  return {
    hour: hours * 30 + minutes * 0.5,
    minute: minutes * 6,
    second: seconds * 6,
  }
}

export function summarizeTarget(input: ReminderTargetSummaryInput): {
  type: ReminderTargetSummaryInput['type']
  count: number
} {
  return {
    type: input.type,
    count: new Set(input.ids ?? []).size,
  }
}

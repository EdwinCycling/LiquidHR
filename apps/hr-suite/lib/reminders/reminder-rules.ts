export type ReminderTargetSummaryInput = {
  type: 'SELF' | 'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'
  ids?: string[]
}

export function formatReminderCountdown(now: Date, remindAt: Date, locale: string): string {
  const differenceInMinutes = Math.round((remindAt.getTime() - now.getTime()) / 60_000)
  const isDutch = locale.startsWith('nl')
  const minuteLabel = isDutch ? 'min.' : 'min'
  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const reminderDay = new Date(Date.UTC(remindAt.getUTCFullYear(), remindAt.getUTCMonth(), remindAt.getUTCDate()))

  if (differenceInMinutes < 0) {
    return isDutch
      ? `${Math.abs(differenceInMinutes)} ${minuteLabel} geleden`
      : `${Math.abs(differenceInMinutes)} ${minuteLabel} ago`
  }
  if (differenceInMinutes === 0) return isDutch ? 'nu' : 'now'
  if (reminderDay.getTime() === nextDay.getTime()) return isDutch ? 'morgen' : 'tomorrow'
  if (differenceInMinutes < 60) return `${isDutch ? 'over' : 'in'} ${differenceInMinutes} ${minuteLabel}`

  const differenceInHours = Math.floor(differenceInMinutes / 60)
  return isDutch
    ? `over ${differenceInHours} uur`
    : `in ${differenceInHours} ${differenceInHours === 1 ? 'hour' : 'hours'}`
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
    count: input.type === 'SELF' || input.type === 'EVERYONE'
      ? 1
      : new Set(input.ids ?? []).size,
  }
}

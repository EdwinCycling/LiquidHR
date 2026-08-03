export type ReminderTargetSummaryInput = {
  type: 'SELF' | 'EVERYONE' | 'DEPARTMENTS' | 'EMPLOYEES'
  ids?: string[]
}

export function formatReminderCountdown(now: Date, remindAt: Date, locale: string): string {
  const differenceInMinutes = Math.round((remindAt.getTime() - now.getTime()) / 60_000)
  const isDutch = locale.startsWith('nl')
  const dateLabel = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(remindAt)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const reminderDay = Date.UTC(remindAt.getUTCFullYear(), remindAt.getUTCMonth(), remindAt.getUTCDate())
  const dayDifference = Math.round((reminderDay - today) / 86_400_000)
  const dayLabel = Math.max(1, Math.round(Math.abs(differenceInMinutes) / 1_440))
  const relativeLabel = differenceInMinutes < 0
    ? isDutch ? `${dayLabel} ${dayLabel === 1 ? 'dag' : 'dagen'} geleden` : `${dayLabel} ${dayLabel === 1 ? 'day' : 'days'} ago`
    : dayDifference === 0
      ? isDutch ? 'vandaag' : 'today'
      : dayDifference === 1
        ? isDutch ? 'morgen' : 'tomorrow'
        : isDutch ? `over ${dayDifference} dagen` : `in ${dayDifference} days`

  return `${dateLabel} · ${relativeLabel}`
}

export function formatReminderDaysUntil(now: Date, remindAt: Date, locale: string): string {
  const differenceInMilliseconds = remindAt.getTime() - now.getTime()
  const isDutch = locale.startsWith('nl')
  if (differenceInMilliseconds <= 0) return isDutch ? 'nu actief' : 'active now'
  const days = Math.max(1, Math.ceil(differenceInMilliseconds / 86_400_000))
  if (isDutch) return `nog ${days} ${days === 1 ? 'dag' : 'dagen'}`
  return `in ${days} ${days === 1 ? 'day' : 'days'}`
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

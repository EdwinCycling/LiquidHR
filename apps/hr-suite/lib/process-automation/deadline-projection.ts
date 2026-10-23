import type { Translator } from '@/lib/i18n/translator'

export type ProcessWorkDeadlineStatus = 'NO_DEADLINE' | 'ON_TRACK' | 'NEAR_DUE' | 'OVERDUE' | 'CLOSED'

export interface ProcessWorkDeadlineProjection {
  readonly deadlineStatus: ProcessWorkDeadlineStatus
  readonly deadlineRemainingSeconds: number | null
}

export interface ProcessWorkDeadlineInput {
  readonly deadlineAt: string | null
  readonly status: string
  readonly instanceStatus: string
  readonly businessStatus?: string
  readonly asOf: Date
}

export interface ProcessWorkDeadlineLabels {
  readonly deadlineNoDeadline: string
  readonly deadlineOnTrack: string
  readonly deadlineNearDue: string
  readonly deadlineClosed: string
  readonly deadlineDueNow: string
  readonly deadlineRemaining: string
  readonly deadlineOverdueBy: string
  readonly deadlineDaysSingular: string
  readonly deadlineDaysPlural: string
  readonly deadlineHoursSingular: string
  readonly deadlineHoursPlural: string
  readonly deadlineMinutesSingular: string
  readonly deadlineMinutesPlural: string
}

export function createProcessWorkDeadlineLabels(t: Translator): ProcessWorkDeadlineLabels {
  return {
    deadlineNoDeadline: t('noDeadline'),
    deadlineOnTrack: t('onTrack'),
    deadlineNearDue: t('nearDue'),
    deadlineClosed: t('deadlineClosed'),
    deadlineDueNow: t('deadlineDueNow'),
    deadlineRemaining: t('deadlineRemaining'),
    deadlineOverdueBy: t('deadlineOverdueBy'),
    deadlineDaysSingular: t('deadlineUnits.day'),
    deadlineDaysPlural: t('deadlineUnits.days'),
    deadlineHoursSingular: t('deadlineUnits.hour'),
    deadlineHoursPlural: t('deadlineUnits.hours'),
    deadlineMinutesSingular: t('deadlineUnits.minute'),
    deadlineMinutesPlural: t('deadlineUnits.minutes'),
  }
}

export function processWorkDeadlineStatusLabel(
  status: ProcessWorkDeadlineStatus,
  remainingSeconds: number | null,
  labels: ProcessWorkDeadlineLabels,
): string {
  if (status === 'NO_DEADLINE') return labels.deadlineNoDeadline
  if (status === 'OVERDUE') return labels.deadlineOverdueBy.replace('{duration}', formatProcessWorkDeadlineDuration(Math.abs(remainingSeconds ?? 0), labels))
  if (status === 'CLOSED') return labels.deadlineClosed
  if (remainingSeconds === 0) return labels.deadlineDueNow
  const remaining = formatProcessWorkDeadlineRemaining(remainingSeconds ?? 0, labels)
  if (status === 'NEAR_DUE') return `${labels.deadlineNearDue} · ${remaining}`
  return `${labels.deadlineOnTrack} · ${remaining}`
}

const NEAR_DUE_WINDOW_SECONDS = 24 * 60 * 60
const terminalStatuses = new Set(['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'])

export function projectProcessWorkDeadline(input: ProcessWorkDeadlineInput): ProcessWorkDeadlineProjection {
  if (!input.deadlineAt) return { deadlineStatus: 'NO_DEADLINE', deadlineRemainingSeconds: null }

  if (terminalStatuses.has(input.businessStatus?.toUpperCase() ?? '')
    || terminalStatuses.has(input.status.toUpperCase())
    || terminalStatuses.has(input.instanceStatus.toUpperCase())) {
    return { deadlineStatus: 'CLOSED', deadlineRemainingSeconds: null }
  }

  const deadlineMilliseconds = Date.parse(input.deadlineAt)
  if (!Number.isFinite(deadlineMilliseconds)) return { deadlineStatus: 'NO_DEADLINE', deadlineRemainingSeconds: null }

  const remainingSeconds = Math.floor((deadlineMilliseconds - input.asOf.getTime()) / 1000)
  if (remainingSeconds < 0) return { deadlineStatus: 'OVERDUE', deadlineRemainingSeconds: remainingSeconds }
  if (remainingSeconds <= NEAR_DUE_WINDOW_SECONDS) return { deadlineStatus: 'NEAR_DUE', deadlineRemainingSeconds: remainingSeconds }
  return { deadlineStatus: 'ON_TRACK', deadlineRemainingSeconds: remainingSeconds }
}

export function formatProcessWorkDeadlineRemaining(seconds: number, labels: ProcessWorkDeadlineLabels): string {
  if (seconds === 0) return labels.deadlineDueNow

  const duration = formatProcessWorkDeadlineDuration(Math.abs(seconds), labels)
  return (seconds < 0 ? labels.deadlineOverdueBy : labels.deadlineRemaining).replace('{duration}', duration)
}

function formatProcessWorkDeadlineDuration(absoluteSeconds: number, labels: ProcessWorkDeadlineLabels): string {
  let amount: number
  let unit: string
  if (absoluteSeconds >= 24 * 60 * 60) {
    amount = Math.floor(absoluteSeconds / (24 * 60 * 60))
    unit = amount === 1 ? labels.deadlineDaysSingular : labels.deadlineDaysPlural
  } else if (absoluteSeconds >= 60 * 60) {
    amount = Math.floor(absoluteSeconds / (60 * 60))
    unit = amount === 1 ? labels.deadlineHoursSingular : labels.deadlineHoursPlural
  } else {
    amount = Math.max(1, Math.ceil(absoluteSeconds / 60))
    unit = amount === 1 ? labels.deadlineMinutesSingular : labels.deadlineMinutesPlural
  }

  return `${amount} ${unit}`
}

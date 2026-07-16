export interface TimelinePeriod {
  id: string
  validFrom: string
  validUntil: string | null
}

export class TimelineRuleError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'TimelineRuleError'
  }
}

export interface TimelineInsertionPlan {
  closePeriodId: string | null
  closeAt: string | null
  newValidUntil: string | null
  preservedPeriodIds: string[]
  isRetroactive: boolean
}

export function planTimelineInsertion(
  periods: TimelinePeriod[],
  effectiveDate: string,
  today = new Date().toISOString().slice(0, 10),
): TimelineInsertionPlan {
  const ordered = [...periods].sort((left, right) => left.validFrom.localeCompare(right.validFrom))
  if (ordered.some((period) => period.validFrom === effectiveDate)) {
    throw new TimelineRuleError('TIMELINE_EFFECTIVE_DATE_CONFLICT')
  }

  const containing = ordered.find(
    (period) =>
      period.validFrom < effectiveDate &&
      (period.validUntil === null || effectiveDate < period.validUntil),
  )
  const next = ordered.find((period) => period.validFrom > effectiveDate)

  return {
    closePeriodId: containing?.id ?? null,
    closeAt: containing ? effectiveDate : null,
    newValidUntil: containing?.validUntil ?? next?.validFrom ?? null,
    preservedPeriodIds: ordered
      .filter((period) => period.validFrom > effectiveDate)
      .map((period) => period.id),
    isRetroactive: effectiveDate < today,
  }
}

export interface TimelineRollbackPlan {
  deletePeriodIds: string[]
  restorePeriodIds: string[]
  restoreValidUntil: string | null
}

export function planLatestRollback(
  periods: TimelinePeriod[],
  requestedPeriodId: string,
): TimelineRollbackPlan {
  const requested = periods.find((period) => period.id === requestedPeriodId)
  if (!requested) throw new TimelineRuleError('TIMELINE_BLOCK_NOT_FOUND')

  const starts = [...new Set(periods.map((period) => period.validFrom))].sort()
  if (starts.length === 1) throw new TimelineRuleError('TIMELINE_LAST_REMAINING_BLOCK')
  const latestStart = starts.at(-1)
  if (requested.validFrom !== latestStart) {
    throw new TimelineRuleError('TIMELINE_ONLY_LATEST_CAN_ROLLBACK')
  }

  const previousStart = starts.at(-2)
  if (!previousStart || !latestStart) throw new TimelineRuleError('TIMELINE_ROLLBACK_INVALID')
  const latestGroup = periods.filter((period) => period.validFrom === latestStart)
  const previousGroup = periods.filter((period) => period.validFrom === previousStart)

  return {
    deletePeriodIds: latestGroup.map((period) => period.id),
    restorePeriodIds: previousGroup.map((period) => period.id),
    restoreValidUntil: latestGroup[0]?.validUntil ?? null,
  }
}


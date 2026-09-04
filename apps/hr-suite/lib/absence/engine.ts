const DAY_IN_MS = 86_400_000

export type AbsenceCaseRelationship = 'COMPOUND' | 'NEW_CASE'

export class AbsenceEngineError extends Error {
  constructor(public readonly code: 'ABSENCE_DATE_INVALID' | 'ABSENCE_DATE_ORDER_INVALID' | 'ABSENCE_DATE_IN_FUTURE' | 'ABSENCE_PERCENTAGE_INVALID' | 'ABSENCE_CAPACITY_HOURS_INVALID') {
    super(code)
    this.name = 'AbsenceEngineError'
  }
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AbsenceEngineError('ABSENCE_DATE_INVALID')
  const result = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) throw new AbsenceEngineError('ABSENCE_DATE_INVALID')
  return result
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: string, days: number): string {
  const result = parseDate(value)
  result.setUTCDate(result.getUTCDate() + days)
  return formatDate(result)
}

function dateDifferenceInDays(start: string, end: string): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / DAY_IN_MS)
}

export function isAbsenceActualDate(value: string, today: string): boolean {
  return parseDate(value).getTime() <= parseDate(today).getTime()
}

export function getAbsenceCaseRelationship(input: { previousRecoveredOn: string; newStartedOn: string }): AbsenceCaseRelationship {
  const gap = dateDifferenceInDays(input.previousRecoveredOn, input.newStartedOn)
  if (gap <= 0) throw new AbsenceEngineError('ABSENCE_DATE_ORDER_INVALID')
  return gap < 28 ? 'COMPOUND' : 'NEW_CASE'
}

export function countPriorAbsenceCases(input: {
  firstAbsenceDates: readonly string[]
  newFirstAbsenceOn: string
  threshold: number
}): { priorCount: number; isFrequentAbsence: boolean } {
  if (!Number.isInteger(input.threshold) || input.threshold < 1) throw new RangeError('Invalid absence threshold')
  const newDate = parseDate(input.newFirstAbsenceOn)
  const lowerBound = new Date(newDate)
  lowerBound.setUTCFullYear(lowerBound.getUTCFullYear() - 1)
  const priorCount = input.firstAbsenceDates.filter((value) => {
    const date = parseDate(value)
    return date >= lowerBound && date < newDate
  }).length
  return { priorCount, isFrequentAbsence: priorCount + 1 >= input.threshold }
}

export function calculateEffectiveClockStartOn(input: {
  rootStartOn: string
  recoveryGaps: readonly { recoveredOn: string; nextStartedOn: string }[]
}): string {
  let gapDays = 0
  for (const gap of input.recoveryGaps) {
    const days = dateDifferenceInDays(gap.recoveredOn, gap.nextStartedOn)
    if (days <= 0) throw new AbsenceEngineError('ABSENCE_DATE_ORDER_INVALID')
    gapDays += days - 1
  }
  return addDays(input.rootStartOn, gapDays)
}

export function getRecoveryWindowEnd(recoveredOn: string): string {
  return addDays(recoveredOn, 28)
}

export function validateAbsencePercentage(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100
}

export function assertAbsencePercentage(value: number): void {
  if (!validateAbsencePercentage(value)) throw new AbsenceEngineError('ABSENCE_PERCENTAGE_INVALID')
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function calculateAbsenceCapacity(input: {
  scheduledHoursPerWeek: number
  absencePercentage?: number
  absenceHoursPerWeek?: number
}): { absenceHoursPerWeek: number; absencePercentage: number } {
  if (!Number.isFinite(input.scheduledHoursPerWeek) || input.scheduledHoursPerWeek <= 0) {
    throw new AbsenceEngineError('ABSENCE_CAPACITY_HOURS_INVALID')
  }
  const hasPercentage = input.absencePercentage !== undefined
  const hasHours = input.absenceHoursPerWeek !== undefined
  if (hasPercentage === hasHours) throw new AbsenceEngineError('ABSENCE_CAPACITY_HOURS_INVALID')

  if (hasPercentage) {
    const percentage = input.absencePercentage as number
    assertAbsencePercentage(percentage)
    return {
      absenceHoursPerWeek: round(input.scheduledHoursPerWeek * percentage / 100, 4),
      absencePercentage: round(percentage, 4),
    }
  }

  const hours = input.absenceHoursPerWeek as number
  if (!Number.isFinite(hours) || hours <= 0 || hours > input.scheduledHoursPerWeek) {
    throw new AbsenceEngineError('ABSENCE_CAPACITY_HOURS_INVALID')
  }
  return {
    absenceHoursPerWeek: round(hours, 4),
    absencePercentage: round(hours / input.scheduledHoursPerWeek * 100, 4),
  }
}

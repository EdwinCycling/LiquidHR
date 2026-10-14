export const PAYROLL_CALENDAR_PERIODICITIES = [
  'MONTHLY',
  'FOUR_WEEKLY',
  'WEEKLY',
  'BIWEEKLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUAL',
] as const

export type PayrollCalendarPeriodicity = typeof PAYROLL_CALENDAR_PERIODICITIES[number]
export type PayrollCalendarYearAssignment = 'PERIOD_START' | 'PERIOD_END'

export type PayrollCalendarDateOffsetRule = {
  readonly kind: 'PERIOD_START_OFFSET_DAYS' | 'PERIOD_END_OFFSET_DAYS'
  readonly days: number
}

export type PayrollCalendarPaymentDateRule = PayrollCalendarDateOffsetRule | {
  readonly kind: 'MONTH_DAY'
  readonly monthsAfterPeriodEnd: number
  readonly dayOfMonth: number
  readonly shortMonth: 'LAST_DAY' | 'REJECT'
}

export type PayrollCalendarDefinition = {
  /** Opaque scope key used only for duplicate and overlap validation. */
  readonly scopeKey: string
  readonly calendarCode: string
  readonly name: string
  readonly version: number
  readonly periodicity: PayrollCalendarPeriodicity
  readonly calendarYear: number
  readonly status?: 'DRAFT' | 'ACTIVE' | 'RETIRED'
  readonly effectiveFrom: string
  readonly effectiveTo: string
  /** Required for week-based periodicities; it is a real period start, not a weekday guess. */
  readonly anchorDate?: string
  /** Required for week-based periodicities to settle which year owns a boundary period. */
  readonly yearAssignment?: PayrollCalendarYearAssignment
  readonly paymentDateRule?: PayrollCalendarPaymentDateRule
  readonly processingDeadlineRule?: PayrollCalendarDateOffsetRule
}

export type GeneratedPayrollPeriod = {
  readonly calendarCode: string
  readonly calendarVersion: number
  readonly periodicity: PayrollCalendarPeriodicity
  readonly calendarYear: number
  readonly periodNumber: number
  readonly startsOn: string
  readonly endsOn: string
  readonly plannedPaymentDate: string | null
  readonly processingDeadline: string | null
  readonly calculationCapability: 'MONTHLY_REGULAR_WAGE_ONLY' | 'NOT_FISCALLY_VALIDATED'
}

export type PayrollCalendarErrorCode =
  | 'CALENDAR_IDENTITY_INVALID'
  | 'CALENDAR_YEAR_INVALID'
  | 'CALENDAR_VERSION_INVALID'
  | 'CALENDAR_EFFECTIVE_RANGE_INVALID'
  | 'CALENDAR_PERIODICITY_UNSUPPORTED'
  | 'CALENDAR_ANCHOR_REQUIRED'
  | 'CALENDAR_YEAR_ASSIGNMENT_REQUIRED'
  | 'CALENDAR_DATE_INVALID'
  | 'CALENDAR_DATE_RULE_INVALID'
  | 'CALENDAR_EFFECTIVE_RANGE_INCOMPLETE'
  | 'CALENDAR_PERIODS_OVERLAP'
  | 'CALENDAR_VERSION_DUPLICATE'
  | 'CALENDAR_EFFECTIVE_RANGE_OVERLAP'
  | 'CALENDAR_REVISION_IDENTITY_INVALID'
  | 'CALENDAR_VERSION_INCREMENT_REQUIRED'

export class PayrollCalendarError extends Error {
  constructor(readonly code: PayrollCalendarErrorCode) {
    super(code)
    this.name = 'PayrollCalendarError'
  }
}

const DAY_MS = 86_400_000

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new PayrollCalendarError('CALENDAR_DATE_INVALID')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new PayrollCalendarError('CALENDAR_DATE_INVALID')
  }
  return date
}

function formatDate(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function validateDefinition(definition: PayrollCalendarDefinition): void {
  if (!definition.scopeKey.trim() || !/^[A-Z][A-Z0-9_-]{1,63}$/.test(definition.calendarCode) || !definition.name.trim()) {
    throw new PayrollCalendarError('CALENDAR_IDENTITY_INVALID')
  }
  if (!Number.isInteger(definition.calendarYear) || definition.calendarYear < 2000 || definition.calendarYear > 2200) {
    throw new PayrollCalendarError('CALENDAR_YEAR_INVALID')
  }
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new PayrollCalendarError('CALENDAR_VERSION_INVALID')
  const effectiveFrom = parseDate(definition.effectiveFrom)
  const effectiveTo = parseDate(definition.effectiveTo)
  if (effectiveFrom > effectiveTo) throw new PayrollCalendarError('CALENDAR_EFFECTIVE_RANGE_INVALID')
}

function paymentDateForPeriod(
  rule: PayrollCalendarPaymentDateRule | undefined,
  startsOn: string,
  endsOn: string,
): string | null {
  if (!rule) return null
  if (!('monthsAfterPeriodEnd' in rule)) {
    if (!Number.isInteger(rule.days) || rule.days < -31 || rule.days > 90) throw new PayrollCalendarError('CALENDAR_DATE_RULE_INVALID')
    const anchor = parseDate(rule.kind === 'PERIOD_START_OFFSET_DAYS' ? startsOn : endsOn)
    return formatDate(addDays(anchor, rule.days))
  }
  if (!Number.isInteger(rule.monthsAfterPeriodEnd) || rule.monthsAfterPeriodEnd < -1 || rule.monthsAfterPeriodEnd > 2
    || !Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
    throw new PayrollCalendarError('CALENDAR_DATE_RULE_INVALID')
  }
  const periodEnd = parseDate(endsOn)
  const targetMonth = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + rule.monthsAfterPeriodEnd, 1))
  const maximumDay = lastDayOfMonth(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth())
  if (rule.dayOfMonth > maximumDay && rule.shortMonth === 'REJECT') throw new PayrollCalendarError('CALENDAR_DATE_RULE_INVALID')
  return formatDate(new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(rule.dayOfMonth, maximumDay))))
}

function deadlineForPeriod(
  rule: PayrollCalendarDateOffsetRule | undefined,
  startsOn: string,
  endsOn: string,
): string | null {
  if (!rule) return null
  if (!Number.isInteger(rule.days) || rule.days < -31 || rule.days > 90) throw new PayrollCalendarError('CALENDAR_DATE_RULE_INVALID')
  const anchor = parseDate(rule.kind === 'PERIOD_START_OFFSET_DAYS' ? startsOn : endsOn)
  return formatDate(addDays(anchor, rule.days))
}

function makePeriod(definition: PayrollCalendarDefinition, periodNumber: number, startsOn: string, endsOn: string): GeneratedPayrollPeriod {
  const first = parseDate(startsOn)
  const last = parseDate(endsOn)
  const validFrom = parseDate(definition.effectiveFrom)
  const validTo = parseDate(definition.effectiveTo)
  const assignedDate = definition.yearAssignment === 'PERIOD_END' ? last : first
  if (assignedDate < validFrom || assignedDate > validTo) throw new PayrollCalendarError('CALENDAR_EFFECTIVE_RANGE_INCOMPLETE')
  return {
    calendarCode: definition.calendarCode,
    calendarVersion: definition.version,
    periodicity: definition.periodicity,
    calendarYear: definition.calendarYear,
    periodNumber,
    startsOn,
    endsOn,
    plannedPaymentDate: paymentDateForPeriod(definition.paymentDateRule, startsOn, endsOn),
    processingDeadline: deadlineForPeriod(definition.processingDeadlineRule, startsOn, endsOn),
    calculationCapability: definition.periodicity === 'MONTHLY' ? 'MONTHLY_REGULAR_WAGE_ONLY' : 'NOT_FISCALLY_VALIDATED',
  }
}

function generateMonthlyCalendar(definition: PayrollCalendarDefinition): readonly GeneratedPayrollPeriod[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const startsOn = formatDate(new Date(Date.UTC(definition.calendarYear, index, 1)))
    const endsOn = formatDate(new Date(Date.UTC(definition.calendarYear, index + 1, 0)))
    return makePeriod(definition, month, startsOn, endsOn)
  })
}

function generateCalendarMonths(definition: PayrollCalendarDefinition, monthsPerPeriod: number): readonly GeneratedPayrollPeriod[] {
  const periodCount = 12 / monthsPerPeriod
  return Array.from({ length: periodCount }, (_, index) => {
    const firstMonthIndex = index * monthsPerPeriod
    const startsOn = formatDate(new Date(Date.UTC(definition.calendarYear, firstMonthIndex, 1)))
    const endsOn = formatDate(new Date(Date.UTC(definition.calendarYear, firstMonthIndex + monthsPerPeriod, 0)))
    return makePeriod(definition, index + 1, startsOn, endsOn)
  })
}

function dayDistance(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

function generateAnchoredCalendar(definition: PayrollCalendarDefinition, periodDays: number): readonly GeneratedPayrollPeriod[] {
  if (!definition.anchorDate) throw new PayrollCalendarError('CALENDAR_ANCHOR_REQUIRED')
  if (!definition.yearAssignment) throw new PayrollCalendarError('CALENDAR_YEAR_ASSIGNMENT_REQUIRED')
  const anchor = parseDate(definition.anchorDate)
  const firstDayOfYear = new Date(Date.UTC(definition.calendarYear, 0, 1))
  const lastDayOfYear = new Date(Date.UTC(definition.calendarYear, 11, 31))
  const offset = definition.yearAssignment === 'PERIOD_START' ? 0 : periodDays - 1
  let periodIndex = Math.ceil((dayDistance(anchor, firstDayOfYear) - offset) / periodDays)
  const periods: GeneratedPayrollPeriod[] = []

  for (let attempts = 0; attempts < 60; attempts += 1, periodIndex += 1) {
    const start = addDays(anchor, periodIndex * periodDays)
    const end = addDays(start, periodDays - 1)
    if (definition.yearAssignment === 'PERIOD_START') {
      if (start > lastDayOfYear) break
      if (start < firstDayOfYear) continue
    } else {
      if (end > lastDayOfYear) break
      if (end < firstDayOfYear) continue
    }
    periods.push(makePeriod(definition, periods.length + 1, formatDate(start), formatDate(end)))
  }

  if (periods.length === 0) throw new PayrollCalendarError('CALENDAR_EFFECTIVE_RANGE_INCOMPLETE')
  return periods
}

export function generatePayrollCalendar(definition: PayrollCalendarDefinition): readonly GeneratedPayrollPeriod[] {
  validateDefinition(definition)
  if (!PAYROLL_CALENDAR_PERIODICITIES.includes(definition.periodicity)) {
    throw new PayrollCalendarError('CALENDAR_PERIODICITY_UNSUPPORTED')
  }
  if (definition.periodicity === 'MONTHLY') return generateMonthlyCalendar(definition)
  if (definition.periodicity === 'FOUR_WEEKLY') return generateAnchoredCalendar(definition, 28)
  if (definition.periodicity === 'WEEKLY') return generateAnchoredCalendar(definition, 7)
  if (definition.periodicity === 'BIWEEKLY') return generateAnchoredCalendar(definition, 14)
  if (definition.periodicity === 'QUARTERLY') return generateCalendarMonths(definition, 3)
  if (definition.periodicity === 'SEMI_ANNUAL') return generateCalendarMonths(definition, 6)
  return generateCalendarMonths(definition, 12)
}

export function assertPayrollPeriodsDoNotOverlap(periods: readonly Pick<GeneratedPayrollPeriod, 'startsOn' | 'endsOn'>[]): void {
  const ordered = [...periods].sort((left, right) => left.startsOn.localeCompare(right.startsOn) || left.endsOn.localeCompare(right.endsOn))
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]
    const current = ordered[index]
    if (previous && current && parseDate(current.startsOn) <= parseDate(previous.endsOn)) {
      throw new PayrollCalendarError('CALENDAR_PERIODS_OVERLAP')
    }
  }
}

export function validatePayrollCalendarConfigurations(configurations: readonly PayrollCalendarDefinition[]): void {
  const versions = new Set<string>()
  for (const configuration of configurations) {
    validateDefinition(configuration)
    const versionKey = [configuration.scopeKey, configuration.calendarCode, configuration.calendarYear, configuration.version].join('|')
    if (versions.has(versionKey)) throw new PayrollCalendarError('CALENDAR_VERSION_DUPLICATE')
    versions.add(versionKey)
  }

  const active = configurations.filter((configuration) => configuration.status === 'ACTIVE')
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    const left = active[leftIndex]
    if (!left) continue
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const right = active[rightIndex]
      if (!right || left.scopeKey !== right.scopeKey || left.calendarCode !== right.calendarCode) continue
      if (parseDate(left.effectiveFrom) <= parseDate(right.effectiveTo)
        && parseDate(right.effectiveFrom) <= parseDate(left.effectiveTo)) {
        throw new PayrollCalendarError('CALENDAR_EFFECTIVE_RANGE_OVERLAP')
      }
    }
  }
}

export type PayrollEmploymentPeriodCoverage = 'FULL_PERIOD' | 'PARTIAL_PERIOD' | 'NO_OVERLAP'

export function classifyEmploymentCoverage(input: {
  readonly periodStartsOn: string
  readonly periodEndsOn: string
  readonly employmentStartsOn: string
  readonly employmentEndsOn: string | null
}): PayrollEmploymentPeriodCoverage {
  const periodStart = parseDate(input.periodStartsOn)
  const periodEnd = parseDate(input.periodEndsOn)
  const employmentStart = parseDate(input.employmentStartsOn)
  const employmentEnd = input.employmentEndsOn ? parseDate(input.employmentEndsOn) : null
  if (periodStart > periodEnd || (employmentEnd && employmentStart > employmentEnd)) {
    throw new PayrollCalendarError('CALENDAR_DATE_INVALID')
  }
  if (employmentStart > periodEnd || (employmentEnd && employmentEnd < periodStart)) return 'NO_OVERLAP'
  if (employmentStart <= periodStart && (!employmentEnd || employmentEnd >= periodEnd)) return 'FULL_PERIOD'
  return 'PARTIAL_PERIOD'
}

function calendarConfigurationKey(configuration: PayrollCalendarDefinition): string {
  return JSON.stringify({
    periodicity: configuration.periodicity,
    calendarYear: configuration.calendarYear,
    effectiveFrom: configuration.effectiveFrom,
    effectiveTo: configuration.effectiveTo,
    anchorDate: configuration.anchorDate ?? null,
    yearAssignment: configuration.yearAssignment ?? null,
    paymentDateRule: configuration.paymentDateRule ?? null,
    processingDeadlineRule: configuration.processingDeadlineRule ?? null,
  })
}

export function assertCalendarRevisionIsSafe(
  current: PayrollCalendarDefinition,
  candidate: PayrollCalendarDefinition,
  persistedState: { readonly hasPeriods: boolean; readonly hasRuns: boolean },
): void {
  if (current.scopeKey !== candidate.scopeKey || current.calendarCode !== candidate.calendarCode
    || current.calendarYear !== candidate.calendarYear) {
    throw new PayrollCalendarError('CALENDAR_REVISION_IDENTITY_INVALID')
  }
  const changed = calendarConfigurationKey(current) !== calendarConfigurationKey(candidate)
  if (!changed) return
  if ((persistedState.hasPeriods || persistedState.hasRuns || current.status === 'ACTIVE')
    && candidate.version <= current.version) {
    throw new PayrollCalendarError('CALENDAR_VERSION_INCREMENT_REQUIRED')
  }
  if (candidate.version < current.version) throw new PayrollCalendarError('CALENDAR_VERSION_INCREMENT_REQUIRED')
}

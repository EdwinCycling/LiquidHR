import { z } from 'zod'

export const WVP_VERSION = 'WVP01_V1'
export const agreementCodes = ['UNCHANGED', 'ADAPTED_DUTIES', 'ADAPTED_HOURS', 'GRADUAL_BUILDUP', 'OTHER_SUITABLE_WORK'] as const
// PostgreSQL accepts every 128-bit UUID value; legacy Core rows may not carry RFC version/variant bits.
export const postgresUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
export const wvpCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('START'), caseId: postgresUuidSchema }).strict(),
  z.object({ action: z.literal('MILESTONE'), caseId: postgresUuidSchema, taskId: postgresUuidSchema, occurredOn: z.iso.date(), confirmed: z.literal(true), idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('AGREEMENT'), caseId: postgresUuidSchema, agreement: z.enum(agreementCodes), occurredOn: z.iso.date(), reviewOn: z.iso.date(), idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('ACKNOWLEDGE'), caseId: postgresUuidSchema, agreementId: postgresUuidSchema, idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('CLOSE'), caseId: postgresUuidSchema, idempotencyKey: z.string().uuid() }).strict(),
])
export type WvpCommand = z.infer<typeof wvpCommandSchema>

export interface WvpTaskSummary {
  readonly code: string
  readonly dueOn: string
  readonly status: string
}

export function nextWvpTask<T extends WvpTaskSummary>(tasks: readonly T[], currentMilestone: string | null, clockStart?: string): T | null {
  const open = tasks.filter(task => task.status === 'OPEN')
  const current = open.find(task => task.code === currentMilestone)
  if (current) return current
  const signalOn = (task: T) => clockStart ? wvpTaskSignalOn(task, clockStart) : task.dueOn
  return [...open].sort((left, right) => signalOn(left).localeCompare(signalOn(right)) || left.code.localeCompare(right.code))[0] ?? null
}

function date(value: string): Date {
  const parsed = z.iso.date().parse(value)
  return new Date(`${parsed}T00:00:00Z`)
}
export function addCalendarDays(value: string, days: number): string {
  const result = date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dutchRecognizedHolidays(year: number): Set<string> {
  const easter = easterSunday(year)
  const kingsDay = new Date(Date.UTC(year, 3, 27))
  if (kingsDay.getUTCDay() === 0) kingsDay.setUTCDate(26)
  return new Set([
    `${year}-01-01`,
    kingsDay.toISOString().slice(0, 10),
    `${year}-05-05`,
    `${year}-12-25`,
    `${year}-12-26`,
    addCalendarDays(easter, -2), // Goede Vrijdag
    addCalendarDays(easter, 1), // tweede Paasdag
    addCalendarDays(easter, 39), // Hemelvaartsdag
    addCalendarDays(easter, 50), // tweede Pinksterdag
  ])
}

function isDutchWorkingDay(value: string): boolean {
  const weekday = date(value).getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  const year = date(value).getUTCFullYear()
  return !dutchRecognizedHolidays(year).has(value)
}

function nextDutchWorkingDayOnOrAfter(value: string): string {
  let candidate = value
  for (let offset = 0; offset < 7; offset++) {
    if (isDutchWorkingDay(candidate)) return candidate
    candidate = addCalendarDays(candidate, 1)
  }
  throw new RangeError('No Dutch working day found within one week')
}

export interface WvpWeek42Timing {
  /** A two-week operational preparation reminder; it is not the statutory due date. */
  readonly preparationSignalOn: string
  /** Calendar day after 42 complete weeks, counted from the effective clock start. */
  readonly week42BoundaryOn: string
  /** First Dutch working day on or after the 42-week boundary, per UWV employer guidance. */
  readonly statutoryDeadlineOn: string
}

export function wvpWeek42Timing(clockStart: string): WvpWeek42Timing {
  date(clockStart)
  const week42BoundaryOn = addCalendarDays(clockStart, 42 * 7)
  const statutoryDeadlineOn = nextDutchWorkingDayOnOrAfter(week42BoundaryOn)
  return {
    preparationSignalOn: addCalendarDays(statutoryDeadlineOn, -14),
    week42BoundaryOn,
    statutoryDeadlineOn,
  }
}

export function wvpTaskSignalOn(task: Pick<WvpTaskSummary, 'code' | 'dueOn'>, clockStart: string): string {
  return task.code === 'WVP_WEEK_42' ? wvpWeek42Timing(clockStart).preparationSignalOn : task.dueOn
}

export function wvpTaskStatutoryDeadlineOn(task: Pick<WvpTaskSummary, 'code'>, clockStart: string): string | null {
  return task.code === 'WVP_WEEK_42' ? wvpWeek42Timing(clockStart).statutoryDeadlineOn : null
}

// De effectieve casusklok komt uitsluitend uit de canonieke verzuimbron.
// Weekgrenzen zijn signaleringsdeadlines, geen vrij instelbare werkdagen-SLA.
export function projectWvpMilestones(clockStart: string, analysisOn?: string) {
  date(clockStart)
  const planBoundary = addCalendarDays(clockStart, 56)
  const planDue = analysisOn ? [planBoundary, addCalendarDays(analysisOn, 14)].sort()[0] : planBoundary
  const milestones = [
    { code: 'WVP_WEEK_6', dueOn: addCalendarDays(clockStart, 42), kind: 'STATUTORY', owner: 'OCCUPATIONAL_PHYSICIAN' },
    { code: 'WVP_WEEK_8', dueOn: planDue, kind: 'STATUTORY', owner: 'EMPLOYER_EMPLOYEE' },
    { code: 'WVP_WEEK_42', dueOn: addCalendarDays(clockStart, 42 * 7), kind: 'SIGNAL', owner: 'HR' },
    { code: 'WVP_FIRST_YEAR_REVIEW', dueOn: addCalendarDays(clockStart, 364), kind: 'STATUTORY', owner: 'EMPLOYER_EMPLOYEE' },
    { code: 'WVP_FINAL_EVALUATION', dueOn: addCalendarDays(clockStart, 637), kind: 'STATUTORY', owner: 'EMPLOYER_EMPLOYEE' },
    { code: 'WVP_WIA_APPLICATION', dueOn: addCalendarDays(clockStart, 651), kind: 'SIGNAL', owner: 'EMPLOYEE' },
  ]
  for (let index = 1; index <= 16; index++) milestones.push({ code: `WVP_EVALUATION_6W_${String(index).padStart(2, '0')}`, dueOn: addCalendarDays(planDue, index * 42), kind: 'REVIEW', owner: 'EMPLOYER_EMPLOYEE' })
  return milestones.sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.code.localeCompare(right.code))
}

export type WvpDossierEvidenceStatus = 'RECORDED' | 'OPEN' | 'MISSING_EVENT' | 'CANCELLED' | 'UNKNOWN'

export interface WvpDossierEvidenceTask {
  readonly id: string
  readonly code: string
  readonly dueOn: string
  readonly status: string
}

export interface WvpDossierEvidenceEvent {
  readonly taskId: string | null
  readonly type: string
  readonly occurredOn: string
}

/**
 * Project the existing task/event data into an operational evidence index.
 * This is not a legal RIV-completeness assessment and never creates evidence.
 */
export function summarizeWvpDossierEvidence(
  tasks: readonly WvpDossierEvidenceTask[],
  events: readonly WvpDossierEvidenceEvent[],
  clockStart: string,
) {
  const ownerByCode = new Map(projectWvpMilestones(clockStart).map(milestone => [milestone.code, milestone.owner] as const))
  return tasks.map(task => {
    const linkedEvents = events.filter(event => event.taskId === task.id && event.type === 'MILESTONE')
    const event = linkedEvents[linkedEvents.length - 1] ?? null
    const status: WvpDossierEvidenceStatus = task.status === 'CANCELLED'
      ? 'CANCELLED'
      : task.status === 'OPEN'
        ? 'OPEN'
        : task.status === 'COMPLETED'
          ? event ? 'RECORDED' : 'MISSING_EVENT'
          : 'UNKNOWN'
    return { ...task, owner: ownerByCode.get(task.code) ?? null, event, readiness: status }
  })
}

export function wvpUrgency(dueOn: string, today: string): 'OVERDUE' | 'SOON' | 'PLANNED' {
  date(dueOn); date(today)
  return dueOn < today ? 'OVERDUE' : dueOn <= addCalendarDays(today, 7) ? 'SOON' : 'PLANNED'
}

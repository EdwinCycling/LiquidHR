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

export function nextWvpTask<T extends WvpTaskSummary>(tasks: readonly T[], currentMilestone: string | null): T | null {
  const open = tasks.filter(task => task.status === 'OPEN')
  const current = open.find(task => task.code === currentMilestone)
  if (current) return current
  return [...open].sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.code.localeCompare(right.code))[0] ?? null
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

// De effectieve casusklok komt uitsluitend uit de canonieke verzuimbron.
// Weekgrenzen zijn signaleringsdeadlines, geen vrij instelbare werkdagen-SLA.
export function projectWvpMilestones(clockStart: string, analysisOn?: string) {
  date(clockStart)
  const planBoundary = addCalendarDays(clockStart, 56)
  const planDue = analysisOn ? [planBoundary, addCalendarDays(analysisOn, 14)].sort()[0] : planBoundary
  const milestones = [
    { code: 'WVP_WEEK_6', dueOn: addCalendarDays(clockStart, 42), kind: 'STATUTORY', owner: 'OCCUPATIONAL_PHYSICIAN' },
    { code: 'WVP_WEEK_8', dueOn: planDue, kind: 'STATUTORY', owner: 'EMPLOYER_EMPLOYEE' },
    { code: 'WVP_WEEK_42', dueOn: addCalendarDays(clockStart, 294), kind: 'SIGNAL', owner: 'HR' },
    { code: 'WVP_FIRST_YEAR_REVIEW', dueOn: addCalendarDays(clockStart, 364), kind: 'STATUTORY', owner: 'EMPLOYER_EMPLOYEE' },
    { code: 'WVP_FINAL_EVALUATION', dueOn: addCalendarDays(clockStart, 637), kind: 'STATUTORY', owner: 'EMPLOYER_EMPLOYEE' },
    { code: 'WVP_WIA_APPLICATION', dueOn: addCalendarDays(clockStart, 651), kind: 'SIGNAL', owner: 'EMPLOYEE' },
  ]
  for (let index = 1; index <= 16; index++) milestones.push({ code: `WVP_EVALUATION_6W_${String(index).padStart(2, '0')}`, dueOn: addCalendarDays(planDue, index * 42), kind: 'REVIEW', owner: 'EMPLOYER_EMPLOYEE' })
  return milestones.sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.code.localeCompare(right.code))
}

export function wvpUrgency(dueOn: string, today: string): 'OVERDUE' | 'SOON' | 'PLANNED' {
  date(dueOn); date(today)
  return dueOn < today ? 'OVERDUE' : dueOn <= addCalendarDays(today, 7) ? 'SOON' : 'PLANNED'
}

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

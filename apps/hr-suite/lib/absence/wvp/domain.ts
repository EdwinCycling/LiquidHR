import { z } from 'zod'

export const WVP_VERSION = 'WVP01_V1'
export const agreementCodes = ['UNCHANGED', 'ADAPTED_DUTIES', 'ADAPTED_HOURS', 'GRADUAL_BUILDUP', 'OTHER_SUITABLE_WORK'] as const
export const wvpCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('START'), caseId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('MILESTONE'), caseId: z.string().uuid(), taskId: z.string().uuid(), occurredOn: z.iso.date(), confirmed: z.literal(true), idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('AGREEMENT'), caseId: z.string().uuid(), agreement: z.enum(agreementCodes), occurredOn: z.iso.date(), reviewOn: z.iso.date(), idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('ACKNOWLEDGE'), caseId: z.string().uuid(), agreementId: z.string().uuid(), idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal('CLOSE'), caseId: z.string().uuid(), idempotencyKey: z.string().uuid() }).strict(),
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

export function wvpUrgency(dueOn: string, today: string): 'OVERDUE' | 'SOON' | 'PLANNED' {
  date(dueOn); date(today)
  return dueOn < today ? 'OVERDUE' : dueOn <= addCalendarDays(today, 7) ? 'SOON' : 'PLANNED'
}

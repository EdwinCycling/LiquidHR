import { z } from 'zod'

// PostgreSQL accepteert alle canonieke UUID-tekstvormen, ook deterministische
// fixture-UUID's waarvan versie- en variantbits niet RFC-specifiek zijn.
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'ACTUAL_WORK_UUID_INVALID')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ACTUAL_WORK_DATE_INVALID')
const hours = z.string().trim().min(1).max(20)

const actualWorkEntryFields = z.object({
  employeeId: uuid,
  employmentId: uuid,
  entryId: uuid.nullable().optional(),
  workHourTypeId: uuid,
  entryGranularity: z.enum(['DAY', 'PERIOD']),
  subjectPeriodStart: date,
  subjectPeriodEnd: date.nullable().optional(),
  postingPeriodStart: date.nullable().optional(),
  hours,
  note: z.string().trim().max(500).nullable().optional(),
  correctionReason: z.string().trim().max(500).nullable().optional(),
})

export const actualWorkEntrySchema = actualWorkEntryFields.superRefine((value, context) => {
  if (value.entryId && (!value.correctionReason || value.correctionReason.length === 0)) {
    context.addIssue({ code: 'custom', path: ['correctionReason'], message: 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED' })
  }
})

// Bulk invoeren moet een directe EDIT in een open periode kunnen onderscheiden
// van een CORRECTION in een gesloten periode. De canonical RPC blijft voor
// beide operaties leidend; de service bepaalt de operatie pas na scopecontrole.
export const actualWorkBulkChangeSchema = actualWorkEntryFields.omit({ workHourTypeId: true, entryGranularity: true })

export const actualWorkBulkSaveSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'ACTUAL_WORK_MONTH_INVALID'),
  workHourTypeId: uuid,
  entryGranularity: z.enum(['DAY', 'PERIOD']),
  changes: z.array(actualWorkBulkChangeSchema).min(1).max(250),
})

const actualWorkTypeObject = z.object({
  code: z.string().trim().min(1).max(80).regex(/^[A-Z0-9_]+$/, 'ACTUAL_WORK_CODE_INVALID'),
  name: z.string().trim().min(1).max(160),
  family: z.enum(['WORK', 'ADDITIONAL', 'OVERTIME', 'TRANSPARENT']),
  validFrom: date,
  validUntil: date.nullable().optional(),
  entryGranularity: z.enum(['DAY', 'PERIOD', 'BOTH']),
  commentRequired: z.boolean(),
  futureEntryAllowed: z.boolean(),
  showInTeamOverview: z.boolean(),
  showInCalendar: z.boolean(),
  approvalRequired: z.boolean(),
  displayOrder: z.number().int().min(0).max(10_000),
  limits: z.array(z.object({
    scope: z.enum(['DAY', 'WEEK', 'MONTH']),
    maxHours: hours,
  })).max(3).default([]),
})

function validateActualWorkType(value: { validFrom?: string; validUntil?: string | null; limits?: ReadonlyArray<{ scope: string }> }, context: z.RefinementCtx): void {
  if (value.validUntil && value.validFrom && value.validUntil <= value.validFrom) {
    context.addIssue({ code: 'custom', path: ['validUntil'], message: 'ACTUAL_WORK_VALIDITY_INVALID' })
  }
  const limits = value.limits ?? []
  if (new Set(limits.map((limit) => limit.scope)).size !== limits.length) {
    context.addIssue({ code: 'custom', path: ['limits'], message: 'ACTUAL_WORK_LIMIT_DUPLICATE' })
  }
}

export const actualWorkTypeSchema = actualWorkTypeObject.superRefine(validateActualWorkType)
export const actualWorkTypeUpdateSchema = actualWorkTypeObject.partial().superRefine(validateActualWorkType)

export const actualWorkPeriodCloseSchema = z.object({
  periodStart: date,
  periodEnd: date,
})

export type ActualWorkEntryInput = z.infer<typeof actualWorkEntrySchema>
export type ActualWorkBulkSaveInput = z.infer<typeof actualWorkBulkSaveSchema>
export type ActualWorkTypeInput = z.infer<typeof actualWorkTypeSchema>

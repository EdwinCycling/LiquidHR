import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ABSENCE_DATE_INVALID')
const uuid = z.string().uuid('ABSENCE_ID_INVALID')
const idempotencyKey = z.string().trim().min(8).max(160)
const indicator = z.boolean().nullable().optional()

export const absenceCaseCreateSchema = z.object({
  employeeId: uuid,
  employmentId: uuid.optional(),
  startDate: isoDate,
  absencePercentage: z.number().finite().gt(0).lte(100).optional(),
  expectedRecoveryOn: isoDate.nullable().optional(),
  reportedAt: z.string().datetime({ offset: true }).optional(),
  hasSicknessBenefitSafetyNet: indicator,
  isWorkAccident: indicator,
  isThirdPartyTrafficAccident: indicator,
  idempotencyKey,
}).strict()

export const absenceCapacityChangeSchema = z.object({
  caseId: uuid,
  effectiveOn: isoDate,
  absencePercentage: z.number().finite().gt(0).lte(100),
  expectedNextReviewOn: isoDate.nullable().optional(),
  idempotencyKey,
}).strict()

export const absenceRecoverySchema = z.object({
  caseId: uuid,
  recoveredOn: isoDate,
  idempotencyKey,
}).strict()

export type AbsenceCaseCreateInput = z.infer<typeof absenceCaseCreateSchema>
export type AbsenceCapacityChangeInput = z.infer<typeof absenceCapacityChangeSchema>
export type AbsenceRecoveryInput = z.infer<typeof absenceRecoverySchema>

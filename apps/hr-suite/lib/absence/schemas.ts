import { z } from 'zod'
import { databaseUuid } from '@/lib/validation/database-uuid'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ABSENCE_DATE_INVALID').refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'ABSENCE_DATE_INVALID')
const uuid = databaseUuid
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
  inputMode: z.enum(['PERCENTAGE', 'HOURS']).optional(),
  absencePercentage: z.number().finite().gt(0).lte(100).optional(),
  absenceHoursPerWeek: z.number().finite().gt(0).optional(),
  expectedNextReviewOn: isoDate.nullable().optional(),
  idempotencyKey,
}).strict().refine((value) => {
  const percentageProvided = value.absencePercentage !== undefined
  const hoursProvided = value.absenceHoursPerWeek !== undefined
  return value.inputMode === 'HOURS'
    ? hoursProvided && !percentageProvided
    : percentageProvided && !hoursProvided
}, 'ABSENCE_CAPACITY_INPUT_INVALID')

export const absenceRecoverySchema = z.object({
  caseId: uuid,
  recoveredOn: isoDate,
  idempotencyKey,
}).strict()

export type AbsenceCaseCreateInput = z.infer<typeof absenceCaseCreateSchema>
export type AbsenceCapacityChangeInput = z.infer<typeof absenceCapacityChangeSchema>
export type AbsenceRecoveryInput = z.infer<typeof absenceRecoverySchema>

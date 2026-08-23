import { z } from 'zod'

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const goalStatus = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
export const talentGoalIdSchema = uuid

export const talentGoalCreateSchema = z.object({
  employeeId: uuid.optional(),
  capabilityId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  periodStart: isoDate,
  periodEnd: isoDate.nullable().optional(),
  progressPercent: z.number().int().min(0).max(100).default(0),
  status: z.enum(['DRAFT', 'ACTIVE']).default('DRAFT'),
}).strict().superRefine((value, context) => {
  if (value.periodEnd && value.periodEnd <= value.periodStart) context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'TALENT_GOAL_PERIOD_INVALID' })
})

export const talentGoalUpdateSchema = z.object({
  version: z.number().int().min(1),
  capabilityId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  periodStart: isoDate.optional(),
  periodEnd: isoDate.nullable().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  status: goalStatus.optional(),
}).strict().superRefine((value, context) => {
  if (value.periodStart && value.periodEnd && value.periodEnd <= value.periodStart) context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'TALENT_GOAL_PERIOD_INVALID' })
})

export const talentGoalListQuerySchema = z.object({
  goalId: uuid.optional(),
  employeeId: uuid.optional(),
  status: goalStatus.optional(),
}).strict()

export type TalentGoalCreateInput = z.infer<typeof talentGoalCreateSchema>
export type TalentGoalUpdateInput = z.infer<typeof talentGoalUpdateSchema>
export type TalentGoalListQuery = z.infer<typeof talentGoalListQuerySchema>

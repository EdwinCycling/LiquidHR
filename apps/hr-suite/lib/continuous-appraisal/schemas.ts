import { z } from 'zod'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const continuousAppraisalItemTypes = ['NOTE', 'ACTION', 'AGREEMENT', 'FEEDBACK', 'GOAL', 'MEETING_SUMMARY'] as const
export const continuousAppraisalStatuses = ['PLANNED', 'OPEN', 'WAITING', 'ACTIVE', 'DONE', 'CANCELLED', 'ARCHIVED'] as const
export const continuousAppraisalPriorities = ['LOW', 'MEDIUM', 'HIGH'] as const

const itemType = z.enum(continuousAppraisalItemTypes)
const itemStatus = z.enum(continuousAppraisalStatuses)
const priority = z.enum(continuousAppraisalPriorities)

export const continuousAppraisalCreateSchema = z.object({
  employeeId: uuid,
  itemType,
  goalKind: z.enum(['GOAL', 'DEVELOPMENT']).nullable().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10000),
  occurredOn: isoDate,
  dueOn: isoDate.nullable().optional(),
  nextMeetingOn: isoDate.nullable().optional(),
  itemStatus: itemStatus.default('OPEN'),
  priority: priority.nullable().optional(),
  ownerEmployeeId: uuid.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.itemType === 'GOAL' && !value.goalKind) context.addIssue({ code: 'custom', path: ['goalKind'], message: 'CONTINUOUS_APPRAISAL_GOAL_KIND_REQUIRED' })
  if (value.itemType !== 'GOAL' && value.goalKind) context.addIssue({ code: 'custom', path: ['goalKind'], message: 'CONTINUOUS_APPRAISAL_GOAL_KIND_NOT_ALLOWED' })
  if (value.dueOn && value.dueOn < value.occurredOn) context.addIssue({ code: 'custom', path: ['dueOn'], message: 'CONTINUOUS_APPRAISAL_DUE_BEFORE_OCCURRED' })
})

export const continuousAppraisalUpdateSchema = z.object({
  version: z.number().int().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  dueOn: isoDate.nullable().optional(),
  nextMeetingOn: isoDate.nullable().optional(),
  itemStatus: itemStatus.optional(),
  priority: priority.nullable().optional(),
  ownerEmployeeId: uuid.nullable().optional(),
}).strict()

export const continuousAppraisalCommentSchema = z.object({
  body: z.string().trim().min(1).max(100),
}).strict()

export const continuousAppraisalListQuerySchema = z.object({
  employeeId: uuid.optional(),
  search: z.string().trim().max(100).optional(),
  itemType,
  itemStatus,
}).partial().strict()

export type ContinuousAppraisalCreateInput = z.infer<typeof continuousAppraisalCreateSchema>
export type ContinuousAppraisalUpdateInput = z.infer<typeof continuousAppraisalUpdateSchema>
export type ContinuousAppraisalCommentInput = z.infer<typeof continuousAppraisalCommentSchema>
export type ContinuousAppraisalListQuery = z.infer<typeof continuousAppraisalListQuerySchema>

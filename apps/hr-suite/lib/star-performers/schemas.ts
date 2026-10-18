import { z } from 'zod'

const databaseUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export const starPerformerQuerySchema = z.object({
  level: z.enum(['job', 'job-group']).default('job'),
  q: z.string().trim().max(100).default(''),
  jobId: databaseUuidSchema.optional(),
  jobGroupId: databaseUuidSchema.optional(),
  tagId: databaseUuidSchema.optional(),
  minStars: z.enum(['1', '2', '3', '4', '5']).optional(),
}).strict()

export const starPerformerWorkspaceQuerySchema = z.object({
  perspective: z.enum(['top-talent', 'key-employees']).default('top-talent'),
  area: z.enum(['overview', 'employees', 'key-roles', 'development', 'insights']).default('overview'),
  insight: z.enum(['top-talent', 'key-employees', 'skills', 'skill-gaps', 'development']).default('top-talent'),
  q: z.string().trim().max(100).default(''),
  departmentId: databaseUuidSchema.optional(),
  jobId: databaseUuidSchema.optional(),
  jobGroupId: databaseUuidSchema.optional(),
  period: databaseUuidSchema.optional(),
  status: z.enum(['all', 'high-high', 'assessed', 'not-assessed']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export const starPerformerTagCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict()

export const starPerformerTagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
}).strict()

export const starPerformerAssessmentSchema = z.object({
  employeeId: databaseUuidSchema,
  jobId: databaseUuidSchema.optional(),
  jobGroupId: databaseUuidSchema.optional(),
  criticalityLevel: z.number().int().min(1).max(5),
  tagIds: z.array(databaseUuidSchema).max(25).default([]),
}).strict().superRefine((value, context) => {
  const scopeCount = Number(Boolean(value.jobId)) + Number(Boolean(value.jobGroupId))
  if (scopeCount !== 1) {
    context.addIssue({
      code: 'custom',
      message: 'STAR_PERFORMER_SCOPE_INVALID',
      path: ['jobId'],
    })
  }
})

export type StarPerformerQuery = z.infer<typeof starPerformerQuerySchema>
export type StarPerformerWorkspaceQuery = z.infer<typeof starPerformerWorkspaceQuerySchema>
export type StarPerformerInsightArea = StarPerformerWorkspaceQuery['insight']
export type StarPerformerTagCreateInput = z.infer<typeof starPerformerTagCreateSchema>
export type StarPerformerTagUpdateInput = z.infer<typeof starPerformerTagUpdateSchema>
export type StarPerformerAssessmentInput = z.infer<typeof starPerformerAssessmentSchema>

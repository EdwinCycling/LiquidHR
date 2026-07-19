import { z } from 'zod'

export const starPerformerQuerySchema = z.object({
  level: z.enum(['job', 'job-group']).default('job'),
  q: z.string().trim().max(100).default(''),
  jobId: z.string().uuid().optional(),
  jobGroupId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  minStars: z.enum(['1', '2', '3', '4', '5']).optional(),
}).strict()

export const starPerformerTagCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict()

export const starPerformerTagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
}).strict()

export const starPerformerAssessmentSchema = z.object({
  employeeId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  jobGroupId: z.string().uuid().optional(),
  criticalityLevel: z.number().int().min(1).max(5),
  tagIds: z.array(z.string().uuid()).max(25).default([]),
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
export type StarPerformerTagCreateInput = z.infer<typeof starPerformerTagCreateSchema>
export type StarPerformerTagUpdateInput = z.infer<typeof starPerformerTagUpdateSchema>
export type StarPerformerAssessmentInput = z.infer<typeof starPerformerAssessmentSchema>

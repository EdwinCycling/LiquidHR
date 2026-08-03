import { z } from 'zod'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const responseType = z.enum(['SELF', 'MANAGER'])
const responseStatus = z.enum(['DRAFT', 'SUBMITTED', 'LOCKED', 'FINALIZED'])
const cycleStatus = z.enum(['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'])

export const talentAssessmentCycleCreateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  opensOn: isoDate,
  closesOn: isoDate,
  items: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    prompt: z.string().trim().min(1).max(2000),
    capabilityId: uuid.nullable().optional(),
    sortOrder: z.number().int().min(1).max(100),
    maxScore: z.number().int().min(1).max(10),
    isRequired: z.boolean().default(true),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (value.closesOn <= value.opensOn) context.addIssue({ code: 'custom', path: ['closesOn'], message: 'ASSESSMENT_CLOSE_MUST_BE_AFTER_OPEN' })
  if (new Set(value.items.map((item) => item.sortOrder)).size !== value.items.length) context.addIssue({ code: 'custom', path: ['items'], message: 'ASSESSMENT_ITEM_ORDER_DUPLICATE' })
})

export const talentAssessmentCycleUpdateSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  opensOn: isoDate.optional(),
  closesOn: isoDate.optional(),
  status: cycleStatus.optional(),
}).strict().superRefine((value, context) => {
  if (value.opensOn && value.closesOn && value.closesOn <= value.opensOn) context.addIssue({ code: 'custom', path: ['closesOn'], message: 'ASSESSMENT_CLOSE_MUST_BE_AFTER_OPEN' })
})

export const talentAssessmentResponseSaveSchema = z.object({
  cycleId: uuid,
  responseId: uuid.optional(),
  responseType,
  subjectEmployeeId: uuid.optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
  version: z.number().int().min(1).optional(),
  answers: z.array(z.object({
    itemId: uuid,
    score: z.number().int().min(0).max(10).nullable().optional(),
    answerText: z.string().trim().max(4000).nullable().optional(),
  }).strict()).max(100),
  privateNote: z.string().trim().max(4000).nullable().optional(),
}).strict()

export const talentAssessmentResponseCommandSchema = z.object({
  status: responseStatus,
  version: z.number().int().min(1),
}).strict()

export const talentAssessmentListQuerySchema = z.object({
  cycleId: uuid.optional(),
  responseType: responseType.optional(),
}).strict()

export type TalentAssessmentCycleCreateInput = z.infer<typeof talentAssessmentCycleCreateSchema>
export type TalentAssessmentCycleUpdateInput = z.infer<typeof talentAssessmentCycleUpdateSchema>
export type TalentAssessmentResponseSaveInput = z.infer<typeof talentAssessmentResponseSaveSchema>
export type TalentAssessmentResponseCommandInput = z.infer<typeof talentAssessmentResponseCommandSchema>
export type TalentAssessmentListQuery = z.infer<typeof talentAssessmentListQuerySchema>

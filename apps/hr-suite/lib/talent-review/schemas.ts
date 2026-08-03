import { z } from 'zod'
import { GRID_VALUES } from './rules'

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const gridValue = z.enum(GRID_VALUES)

export const talentReviewCampaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  startsOn: isoDate,
  endsOn: isoDate,
  previousCampaignId: uuid.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.endsOn <= value.startsOn) context.addIssue({ code: 'custom', path: ['endsOn'], message: 'TALENT_REVIEW_END_MUST_BE_AFTER_START' })
})

export const talentReviewCampaignUpdateSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  startsOn: isoDate.optional(),
  endsOn: isoDate.optional(),
  previousCampaignId: uuid.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.startsOn && value.endsOn && value.endsOn <= value.startsOn) context.addIssue({ code: 'custom', path: ['endsOn'], message: 'TALENT_REVIEW_END_MUST_BE_AFTER_START' })
})

export const talentReviewScoreSaveSchema = z.object({
  employeeId: uuid,
  performanceScore: gridValue.nullable().optional(),
  potentialScore: gridValue.nullable().optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
  version: z.number().int().min(1).optional(),
}).strict()

export const talentReviewListQuerySchema = z.object({ campaignId: uuid.optional() }).strict()
export const talentReviewReminderSchema = z.object({ assignmentId: uuid }).strict()

export type TalentReviewCampaignCreateInput = z.infer<typeof talentReviewCampaignCreateSchema>
export type TalentReviewCampaignUpdateInput = z.infer<typeof talentReviewCampaignUpdateSchema>
export type TalentReviewScoreSaveInput = z.infer<typeof talentReviewScoreSaveSchema>
export type TalentReviewListQuery = z.infer<typeof talentReviewListQuerySchema>
export type TalentReviewReminderInput = z.infer<typeof talentReviewReminderSchema>

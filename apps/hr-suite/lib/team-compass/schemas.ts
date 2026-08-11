import { z } from 'zod'

// Supabase/Postgres UUID columns also contain legacy deterministic GUIDs whose
// version/variant bits are not RFC-4122 compliant. The database still enforces
// the 8-4-4-4-12 GUID shape, so the API must validate that shape without
// rejecting existing tenant identifiers.
const uuid = z.guid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const teamCompassCampaignSchema = z.object({
  campaignId: uuid.nullable().default(null),
  expectedVersion: z.number().int().positive().nullable().default(null),
  questionnaireVersionId: uuid,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).default(''),
  personalMessage: z.string().trim().max(800).default(''),
  startsOn: isoDate,
  endsOn: isoDate,
  anonymityThreshold: z.number().int().min(5).max(50).default(5),
  departmentIds: z.array(uuid).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (value.endsOn < value.startsOn) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'TEAM_COMPASS_CAMPAIGN_DATE_INVALID' })
  }
  if ((value.campaignId === null) !== (value.expectedVersion === null)) {
    context.addIssue({ code: 'custom', path: ['expectedVersion'], message: 'TEAM_COMPASS_VERSION_INVALID' })
  }
})

export const teamCompassTransitionSchema = z.object({
  action: z.enum(['START', 'CLOSE', 'ARCHIVE']),
  expectedVersion: z.number().int().positive(),
}).strict()

export const teamCompassAnswerSchema = z.object({
  questionId: uuid,
  innerScore: z.number().int().min(1).max(5),
  outerScore: z.number().int().min(1).max(5),
}).strict()

export const teamCompassResponseSchema = z.object({
  expectedVersion: z.number().int().positive(),
  answers: z.array(teamCompassAnswerSchema).min(1).max(40),
  submit: z.boolean(),
  shareOuter: z.boolean().default(false),
  shareInner: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (new Set(value.answers.map((answer) => answer.questionId)).size !== value.answers.length) {
    context.addIssue({ code: 'custom', path: ['answers'], message: 'TEAM_COMPASS_ANSWERS_DUPLICATE' })
  }
  if (value.submit && value.answers.length !== 40) {
    context.addIssue({ code: 'custom', path: ['answers'], message: 'TEAM_COMPASS_ANSWERS_INCOMPLETE' })
  }
  if (value.shareInner && !value.shareOuter) {
    context.addIssue({ code: 'custom', path: ['shareInner'], message: 'TEAM_COMPASS_INNER_SHARING_REQUIRES_OUTER' })
  }
})

export type TeamCompassCampaignInput = z.infer<typeof teamCompassCampaignSchema>
export type TeamCompassResponseInput = z.infer<typeof teamCompassResponseSchema>
export type TeamCompassTransitionInput = z.infer<typeof teamCompassTransitionSchema>

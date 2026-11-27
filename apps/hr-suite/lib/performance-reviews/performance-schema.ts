import { z } from 'zod'

const date = z.iso.date()
const text = z.string().trim().min(1).max(10000)
const version = z.number().int().positive()
const ratingOption = z.object({ score: z.number().int().positive(), label: z.string().trim().min(1).max(160), description: text }).strict()
const questionSetRoundConfig = z.object({
  enabled: z.boolean(),
  defaults: z.object({ EMPLOYEE: z.uuid().nullable(), GV: z.uuid().nullable(), AB: z.uuid().nullable() }).strict(),
}).strict()

export const roundSchema = z.object({
  title: z.string().trim().min(1).max(160),
  introduction: text,
  roundType: z.string().trim().min(1).max(80).default('DEVELOPMENT'),
  periodStart: date,
  periodEnd: date,
  startDate: date,
  dueDate: date.nullable().optional(),
  rating: z.object({ options: z.array(ratingOption) }).strict().nullable(),
  additionalReviewerEnabled: z.boolean().default(false),
  questionSets: questionSetRoundConfig.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.periodStart > value.periodEnd) ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'PERIOD_ORDER_INVALID' })
  if (value.dueDate && value.dueDate < value.startDate) ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'DUE_DATE_BEFORE_START' })
  if (value.rating) {
    const scores = value.rating.options.map(option => option.score).sort((a, b) => a - b)
    if (![4, 5, 10].includes(scores.length) || scores.some((score, index) => score !== index + 1)) {
      ctx.addIssue({ code: 'custom', path: ['rating', 'options'], message: 'RATING_SCALE_INVALID' })
    }
  }
})

export const managerSubmissionSchema = z.object({
  version,
  body: text,
  meetingDate: date.nullable().optional(),
  score: z.number().int().positive().optional(),
  ratingExplanation: text.optional(),
}).strict()

export const acknowledgementSchema = z.discriminatedUnion('decision', [
  z.object({ version, decision: z.literal('AGREE') }).strict(),
  z.object({ version, decision: z.literal('DISAGREE'), reason: text }).strict(),
])

export const additionalReviewerSubmissionSchema = z.object({
  version,
  body: text,
}).strict()

export const reviewerRoleAssignmentSchema = z.object({
  version,
  reviewerEmployeeId: z.uuid(),
  additionalReviewerEmployeeId: z.uuid().nullable(),
  reason: text,
  preserveDrafts: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  if (value.additionalReviewerEmployeeId === value.reviewerEmployeeId) {
    ctx.addIssue({ code: 'custom', path: ['additionalReviewerEmployeeId'], message: 'REVIEWERS_MUST_BE_DIFFERENT' })
  }
})

export const roleFlipPreviewSchema = z.object({
  scope: z.enum(['ALL', 'FILTERED', 'SELECTED']),
  participantIds: z.array(z.uuid()).max(1000).optional(),
  search: z.string().trim().max(160).optional(),
  phase: z.string().trim().max(60).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.scope === 'SELECTED' && (!value.participantIds || value.participantIds.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['participantIds'], message: 'SELECTION_REQUIRED' })
  }
})

export const roleFlipApplySchema = z.object({
  participantIds: z.array(z.uuid()).min(1).max(1000),
  previewHash: z.string().regex(/^[a-f0-9]{32}$/iu),
  reason: text,
  preserveDrafts: z.boolean().default(false),
}).strict()

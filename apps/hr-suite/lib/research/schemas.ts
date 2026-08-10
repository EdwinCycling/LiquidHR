import { z } from 'zod'

export const researchTargetModeSchema = z.enum(['ALL', 'DEPARTMENTS', 'LOCATIONS', 'ENTITIES', 'EMPLOYEES'])
export const surveyQuestionTypeSchema = z.enum(['TEXT_SINGLE', 'TEXT_MULTI', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'NUMBER', 'DATE', 'DATETIME', 'MATRIX'])
export const enpsQuestionTypeSchema = z.enum(['SCALE_10', 'LIKERT_5', 'LIKERT_4', 'OPEN_TEXT', 'YES_NO'])
export const enpsScaleTypeSchema = z.enum(['LIKERT_5', 'LIKERT_4', 'SCALE_10'])

export const enpsBankCategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(255),
}).strict()

export const enpsBankQuestionInputSchema = z.object({
  categoryId: z.string().uuid(),
  text: z.string().trim().min(2).max(2000),
  type: enpsQuestionTypeSchema,
}).strict()

const targetSchema = z.object({
  mode: researchTargetModeSchema,
  ids: z.array(z.string().uuid()).max(500),
}).strict().superRefine((target, context) => {
  if (target.mode === 'ALL' && target.ids.length > 0) context.addIssue({ code: 'custom', message: 'TARGET_ALL_WITH_IDS', path: ['ids'] })
  if (target.mode !== 'ALL' && target.ids.length === 0) context.addIssue({ code: 'custom', message: 'TARGET_SELECTION_REQUIRED', path: ['ids'] })
  if (new Set(target.ids).size !== target.ids.length) context.addIssue({ code: 'custom', message: 'TARGET_DUPLICATE', path: ['ids'] })
})

const campaignWindowSchema = z.object({
  title: z.string().trim().min(3).max(255),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  target: targetSchema,
}).superRefine((campaign, context) => {
  if (Date.parse(campaign.endsAt) <= Date.parse(campaign.startsAt)) {
    context.addIssue({ code: 'custom', message: 'CAMPAIGN_END_BEFORE_START', path: ['endsAt'] })
  }
})

const surveyQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().trim().min(2).max(2000),
  type: surveyQuestionTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(255)).max(20).default([]),
  rows: z.array(z.object({
    id: z.string().uuid().optional(),
    label: z.string().trim().min(1).max(255),
    required: z.boolean().default(false),
  }).strict()).max(30).default([]),
}).strict().superRefine((question, context) => {
  const choice = question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE'
  if (choice && question.options.length < 2) context.addIssue({ code: 'custom', message: 'QUESTION_OPTIONS_REQUIRED', path: ['options'] })
  if (question.type === 'MATRIX' && (question.options.length < 2 || question.rows.length === 0)) {
    context.addIssue({ code: 'custom', message: 'MATRIX_CONFIGURATION_REQUIRED' })
  }
  if (new Set(question.options.map((option) => option.toLocaleLowerCase())).size !== question.options.length) {
    context.addIssue({ code: 'custom', message: 'QUESTION_OPTION_DUPLICATE', path: ['options'] })
  }
})

export const surveyInputSchema = campaignWindowSchema.and(z.object({
  description: z.string().trim().max(5000),
  isAnonymous: z.boolean(),
  questions: z.array(surveyQuestionSchema).min(1).max(100),
}).strict())

const enpsCampaignQuestionSchema = z.object({
  bankQuestionId: z.string().uuid(),
  order: z.number().int().min(1).max(150),
  type: enpsQuestionTypeSchema,
  mandatory: z.boolean(),
  enabled: z.boolean(),
}).strict()

export const enpsCampaignInputSchema = campaignWindowSchema.and(z.object({
  reminderIntervalDays: z.number().int().min(1).max(30),
  scaleType: enpsScaleTypeSchema,
  questions: z.array(enpsCampaignQuestionSchema).min(1).max(150),
}).strict()).superRefine((campaign, context) => {
  const mandatory = campaign.questions.filter((question) => question.mandatory)
  if (mandatory.length !== 1 || mandatory[0]?.order !== 1 || mandatory[0].type !== 'SCALE_10' || !mandatory[0].enabled) {
    context.addIssue({ code: 'custom', message: 'ENPS_MANDATORY_QUESTION_INVALID', path: ['questions'] })
  }
  if (new Set(campaign.questions.map((question) => question.bankQuestionId)).size !== campaign.questions.length) {
    context.addIssue({ code: 'custom', message: 'ENPS_QUESTION_DUPLICATE', path: ['questions'] })
  }
})

export const researchAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid().optional(),
  matrixRowId: z.string().uuid().optional(),
  value: z.string().max(10000).optional(),
}).strict().refine((answer) => answer.optionId !== undefined || answer.value !== undefined, 'ANSWER_VALUE_REQUIRED')

export const researchSubmissionSchema = z.object({
  answers: z.array(researchAnswerSchema).min(1).max(1000),
}).strict().superRefine((submission, context) => {
  const keys = submission.answers.map((answer) => `${answer.questionId}:${answer.matrixRowId ?? ''}:${answer.optionId ?? ''}`)
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'ANSWER_DUPLICATE', path: ['answers'] })
})

export const researchReminderSchema = z.object({
  employeeId: z.string().uuid().optional(),
}).strict()

export type SurveyInput = z.infer<typeof surveyInputSchema>
export type EnpsCampaignInput = z.infer<typeof enpsCampaignInputSchema>
export type ResearchSubmission = z.infer<typeof researchSubmissionSchema>
export type ResearchTargetMode = z.infer<typeof researchTargetModeSchema>
export type SurveyQuestionType = z.infer<typeof surveyQuestionTypeSchema>
export type EnpsQuestionType = z.infer<typeof enpsQuestionTypeSchema>
export type EnpsBankCategoryInput = z.infer<typeof enpsBankCategoryInputSchema>
export type EnpsBankQuestionInput = z.infer<typeof enpsBankQuestionInputSchema>

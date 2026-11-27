import { z } from 'zod'

const localizedLabelSchema = z.object({
  nl: z.string().trim().min(1).max(1000),
  en: z.string().trim().min(1).max(1000),
}).strict()

const optionSchema = z.object({ id: z.uuid(), label: localizedLabelSchema }).strict()
const scaleSizeSchema = z.union([z.literal(4), z.literal(5), z.literal(10)])
const questionBase = { id: z.uuid(), prompt: localizedLabelSchema, help: localizedLabelSchema.optional(), required: z.boolean() }

const shortTextQuestionSchema = z.object({ ...questionBase, type: z.literal('SHORT_TEXT') }).strict()
const longTextQuestionSchema = z.object({ ...questionBase, type: z.literal('LONG_TEXT') }).strict()
const choiceQuestionSchema = z.object({
  ...questionBase,
  type: z.enum(['SINGLE_CHOICE', 'MULTI_CHOICE']),
  options: z.array(optionSchema).min(2).max(30),
}).strict()
const binaryQuestionSchema = z.object({
  ...questionBase,
  type: z.literal('YES_NO'),
  variant: z.enum(['YES_NO', 'AGREE_DISAGREE']),
}).strict()
const scaleQuestionSchema = z.object({
  ...questionBase,
  type: z.literal('SCALE'),
  scale: scaleSizeSchema,
  labels: z.array(z.object({ value: z.number().int().positive(), label: localizedLabelSchema }).strict()).max(10).default([]),
}).strict().superRefine((question, context) => {
  const values = question.labels.map((label) => label.value)
  if (values.some((value) => value > question.scale) || new Set(values).size !== values.length) {
    context.addIssue({ code: 'custom', path: ['labels'], message: 'QUESTION_SCALE_LABELS_INVALID' })
  }
})
const matrixQuestionSchema = z.discriminatedUnion('matrixMode', [
  z.object({
    ...questionBase,
    type: z.literal('MATRIX'),
    matrixMode: z.literal('CHOICE'),
    rows: z.array(optionSchema).min(1).max(30),
    options: z.array(optionSchema).min(2).max(20),
  }).strict(),
  z.object({
    ...questionBase,
    type: z.literal('MATRIX'),
    matrixMode: z.literal('SCALE'),
    rows: z.array(optionSchema).min(1).max(30),
    scale: scaleSizeSchema,
    labels: z.array(z.object({ value: z.number().int().positive(), label: localizedLabelSchema }).strict()).max(10).default([]),
  }).strict().superRefine((question, context) => {
    const values = question.labels.map((label) => label.value)
    if (values.some((value) => value > question.scale) || new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', path: ['labels'], message: 'QUESTION_SCALE_LABELS_INVALID' })
    }
  }),
])

export const performanceReviewQuestionSchema = z.discriminatedUnion('type', [
  shortTextQuestionSchema,
  longTextQuestionSchema,
  choiceQuestionSchema,
  binaryQuestionSchema,
  scaleQuestionSchema,
  matrixQuestionSchema,
])

export const performanceReviewQuestionSetSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  status: z.enum(['DRAFT', 'AVAILABLE']).default('DRAFT'),
  version: z.number().int().positive().optional(),
  questions: z.array(performanceReviewQuestionSchema).min(1).max(80),
}).strict().superRefine((set, context) => {
  const ids = set.questions.map((question) => question.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['questions'], message: 'QUESTION_ID_DUPLICATE' })
  for (const [questionIndex, question] of set.questions.entries()) {
    const options = question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE'
      ? question.options
      : question.type === 'MATRIX' && question.matrixMode === 'CHOICE' ? question.options : []
    const rows = question.type === 'MATRIX' ? question.rows : []
    for (const [list, values] of [['options', options], ['rows', rows]] as const) {
      const ids = values.map((item) => item.id)
      if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['questions', questionIndex, list], message: 'QUESTION_OPTION_ID_DUPLICATE' })
      for (const language of ['nl', 'en'] as const) {
        const labels = values.map((item) => item.label[language].toLocaleLowerCase())
        if (new Set(labels).size !== labels.length) context.addIssue({ code: 'custom', path: ['questions', questionIndex, list], message: 'QUESTION_OPTION_DUPLICATE' })
      }
    }
  }
})

export const questionAnswersSchema = z.record(z.string().uuid(), z.unknown()).superRefine((answers, context) => {
  for (const [questionId, answer] of Object.entries(answers)) {
    if (!questionId || answer === undefined || answer === null) context.addIssue({ code: 'custom', path: [questionId], message: 'QUESTION_ANSWER_INVALID' })
  }
})

export type LocalizedQuestionLabel = z.infer<typeof localizedLabelSchema>
export type PerformanceReviewQuestion = z.infer<typeof performanceReviewQuestionSchema>
export type PerformanceReviewQuestionSet = z.infer<typeof performanceReviewQuestionSetSchema>
export type QuestionAnswers = Record<string, unknown>

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object' && value !== null) return Object.values(value).some(isFilled)
  return false
}

function answerMatches(question: PerformanceReviewQuestion, value: unknown): boolean {
  if (question.type === 'SHORT_TEXT') return typeof value === 'string' && value.trim().length <= 500
  if (question.type === 'LONG_TEXT') return typeof value === 'string' && value.length <= 5000
  if (question.type === 'YES_NO') return question.variant === 'YES_NO' ? value === 'YES' || value === 'NO' : value === 'AGREE' || value === 'DISAGREE'
  if (question.type === 'SINGLE_CHOICE') return typeof value === 'string' && question.options.some((option) => option.id === value)
  if (question.type === 'MULTI_CHOICE') return Array.isArray(value) && value.every((item) => typeof item === 'string' && question.options.some((option) => option.id === item)) && new Set(value).size === value.length
  if (question.type === 'SCALE') return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= question.scale
  if (question.type !== 'MATRIX' || typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const answers = value as Record<string, unknown>
  if (Object.keys(answers).some((rowId) => !question.rows.some((row) => row.id === rowId))) return false
  if (question.matrixMode === 'CHOICE') return Object.values(answers).every((entry) => typeof entry === 'string' && question.options.some((option) => option.id === entry))
  return Object.values(answers).every((entry) => typeof entry === 'number' && Number.isInteger(entry) && entry >= 1 && entry <= question.scale)
}

export function validatePerformanceReviewAnswers(
  questions: readonly PerformanceReviewQuestion[],
  answers: QuestionAnswers,
  requireComplete: boolean,
): { valid: boolean; missingQuestionIds: string[] } {
  const questionIds = new Set(questions.map((question) => question.id))
  if (Object.keys(answers).some((id) => !questionIds.has(id))) return { valid: false, missingQuestionIds: [] }
  const missingQuestionIds = questions.filter((question) => {
    const value = answers[question.id]
    if (value === undefined || !isFilled(value)) return requireComplete && question.required
    if (!answerMatches(question, value)) return true
    if (question.type === 'MATRIX' && question.required && Object.keys(value as object).length !== question.rows.length) return requireComplete
    return false
  }).map((question) => question.id)
  return { valid: missingQuestionIds.length === 0, missingQuestionIds }
}

export function emptyQuestionAnswers(): QuestionAnswers {
  return {}
}

import { z } from 'zod'

export const CHATGPT_FOCUS_PLAN_SCHEMA = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict()

export const CHATGPT_FOCUS_PLANS_OUTPUT_SCHEMA = z.object({
  plans: z.array(CHATGPT_FOCUS_PLAN_SCHEMA),
}).strict()

export type ChatGptFocusPlan = z.infer<typeof CHATGPT_FOCUS_PLAN_SCHEMA>

const projectionFields = [
  'periodStart',
  'periodEnd',
  'progressPercent',
  'status',
  'completedAt',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Pick and validate the only plan fields allowed in this ChatGPT widget. */
export function projectChatGptFocusPlan(value: unknown): ChatGptFocusPlan | null {
  if (!isRecord(value)) return null
  const result = CHATGPT_FOCUS_PLAN_SCHEMA.safeParse({
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    progressPercent: value.progressPercent,
    status: value.status,
    completedAt: value.completedAt,
  })
  return result.success ? result.data : null
}

export function projectChatGptFocusPlans(value: unknown): ChatGptFocusPlan[] | null {
  if (!isRecord(value) || !Array.isArray(value.plans)) return null
  const plans = value.plans.map(projectChatGptFocusPlan)
  return plans.every((plan): plan is ChatGptFocusPlan => plan !== null) ? plans : null
}

/** Rebuild a selected row so neither its source object nor extra fields can leak into model context. */
export function projectSelectedChatGptFocusPlan(value: unknown): ChatGptFocusPlan {
  const plan = projectChatGptFocusPlan(value)
  if (!plan) throw new Error('CHATGPT_FOCUS_PLAN_INVALID')
  return plan
}

export function sameChatGptFocusPlan(left: ChatGptFocusPlan, right: ChatGptFocusPlan): boolean {
  return projectionFields.every((field) => left[field] === right[field])
}

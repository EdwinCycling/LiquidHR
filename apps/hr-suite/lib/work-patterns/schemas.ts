import { z } from 'zod'
import { validateWorkPattern } from './work-pattern-model'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()
const daySchema = z.object({
  weekIndex: z.number().int().min(1).max(4),
  isoWeekday: z.number().int().min(1).max(7),
  isWorkingDay: z.boolean(),
  startsAt: timeOnly,
  endsAt: timeOnly,
  breakMinutes: z.number().int().min(0).max(1440),
  scheduledMinutes: z.number().int().min(0).max(1440),
  note: z.string().trim().max(240).nullable(),
}).strict()

export const workPatternPublishSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cycleWeeks: z.number().int().min(1).max(4),
  anchorDate: dateOnly,
  validFrom: dateOnly,
  validUntil: dateOnly.nullable(),
  days: z.array(daySchema).min(7).max(28),
}).strict().superRefine((value, context) => {
  const validation = validateWorkPattern(value)
  if (!validation.valid) context.addIssue({ code: 'custom', path: ['days'], message: validation.error ?? 'WORK_PATTERN_INVALID' })
  if (value.validUntil && value.validUntil <= value.validFrom) context.addIssue({ code: 'custom', path: ['validUntil'], message: 'WORK_PATTERN_PERIOD_INVALID' })
})

export type WorkPatternPublishInput = z.infer<typeof workPatternPublishSchema>

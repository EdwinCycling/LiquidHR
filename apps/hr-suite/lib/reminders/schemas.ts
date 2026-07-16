import { z } from 'zod'

const futureDateTime = z.string().datetime({ offset: true }).refine(
  (value) => new Date(value).getTime() > Date.now(),
  'REMINDER_TIME_MUST_BE_FUTURE',
)

export const personalReminderCreateSchema = z.object({
  title: z.string().trim().min(1, 'REMINDER_TITLE_REQUIRED').max(160),
  description: z.string().trim().max(2_000).optional(),
  remindAt: futureDateTime,
}).strict()

export const recipientActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('COMPLETE') }).strict(),
  z.object({ action: z.literal('DISMISS') }).strict(),
  z.object({ action: z.literal('SNOOZE'), remindAt: futureDateTime }).strict(),
])

export type PersonalReminderCreateInput = z.infer<typeof personalReminderCreateSchema>
export type RecipientActionInput = z.infer<typeof recipientActionSchema>

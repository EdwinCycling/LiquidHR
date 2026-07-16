import { z } from 'zod'

const futureDateTime = z.string().datetime({ offset: true }).refine(
  (value) => new Date(value).getTime() > Date.now(),
  'REMINDER_TIME_MUST_BE_FUTURE',
)

const reminderFields = {
  title: z.string().trim().min(1, 'REMINDER_TITLE_REQUIRED').max(160),
  description: z.string().trim().max(2_000).optional(),
  remindAt: futureDateTime,
}

export const personalReminderCreateSchema = z.object({
  ...reminderFields,
}).strict()

const targetIds = z.array(z.string().uuid()).min(1).max(200)
  .transform((values) => [...new Set(values)])

export const hrReminderCreateSchema = z.discriminatedUnion('targetType', [
  z.object({ ...reminderFields, targetType: z.literal('EVERYONE') }).strict(),
  z.object({ ...reminderFields, targetType: z.literal('DEPARTMENTS'), targetIds }).strict(),
  z.object({ ...reminderFields, targetType: z.literal('EMPLOYEES'), targetIds }).strict(),
])

export const reminderUpdateSchema = z.object({
  title: reminderFields.title.optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  remindAt: futureDateTime.optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  'REMINDER_UPDATE_REQUIRED',
)

export const recipientActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('COMPLETE') }).strict(),
  z.object({ action: z.literal('DISMISS') }).strict(),
  z.object({ action: z.literal('SNOOZE'), remindAt: futureDateTime }).strict(),
])

export type PersonalReminderCreateInput = z.infer<typeof personalReminderCreateSchema>
export type HrReminderCreateInput = z.infer<typeof hrReminderCreateSchema>
export type ReminderUpdateInput = z.infer<typeof reminderUpdateSchema>
export type RecipientActionInput = z.infer<typeof recipientActionSchema>

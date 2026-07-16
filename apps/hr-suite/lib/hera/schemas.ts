import { z } from 'zod'

export const userMessageSchema = z.object({
  content: z.string().trim().min(1).max(8_000),
})

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
})

export const renameConversationSchema = z.object({
  title: z.string().trim().min(1).max(160),
})

export const memoryItemSchema = z.object({
  content: z.string().trim().min(1).max(1_000),
  category: z.enum(['PREFERENCE', 'WORKING_CONTEXT']),
  sourceConversationId: z.string().uuid().optional(),
})

export const reminderDraftSchema = z.object({
  title: z.string().trim().min(1).max(180),
  remindAt: z.string().datetime({ offset: true }),
  description: z.string().trim().max(2_000).optional(),
})

export type UserMessageInput = z.infer<typeof userMessageSchema>
export type CreateConversationInput = z.infer<typeof createConversationSchema>
export type RenameConversationInput = z.infer<typeof renameConversationSchema>
export type MemoryItemInput = z.infer<typeof memoryItemSchema>
export type ReminderDraftInput = z.infer<typeof reminderDraftSchema>

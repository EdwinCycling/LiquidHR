import { z } from 'zod'
import { timelineMutationSchema } from '@/lib/employment/detail-schemas'
import { addressSchema } from '@/lib/employees/schemas'
import { placementUpdateSchema } from '@/lib/organization/schemas'

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

export const addressChangeDraftSchema = z.object({
  employeeId: z.string().uuid(),
  addressId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  input: addressSchema,
}).strict()

export const employmentTimelineDraftSchema = z.object({
  employmentId: z.string().uuid(),
  mutation: timelineMutationSchema,
}).strict()

export const placementChangeDraftSchema = z.object({
  placementId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  input: placementUpdateSchema,
}).strict()

const currentValueSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))

export const addressChangeProposalSchema = addressChangeDraftSchema.extend({
  currentValue: currentValueSchema,
})

export const employmentTimelineProposalSchema = employmentTimelineDraftSchema.extend({
  currentValue: currentValueSchema,
})

export const placementChangeProposalSchema = placementChangeDraftSchema.extend({
  currentValue: currentValueSchema,
})

export type UserMessageInput = z.infer<typeof userMessageSchema>
export type CreateConversationInput = z.infer<typeof createConversationSchema>
export type RenameConversationInput = z.infer<typeof renameConversationSchema>
export type MemoryItemInput = z.infer<typeof memoryItemSchema>
export type ReminderDraftInput = z.infer<typeof reminderDraftSchema>

import { z } from 'zod'

export const setupAssistantEnabledSchema = z.object({
  isEnabled: z.boolean(),
}).strict()

export const setupAssistantCompletionSchema = z.object({
  stepKey: z.string().trim().min(1).max(120),
  isCompleted: z.boolean(),
}).strict()

export type SetupAssistantEnabledInput = z.infer<typeof setupAssistantEnabledSchema>
export type SetupAssistantCompletionInput = z.infer<typeof setupAssistantCompletionSchema>

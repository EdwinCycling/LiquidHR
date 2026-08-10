import { z } from 'zod'

export const moduleSelectionSchema = z.object({
  enabled: z.array(z.enum(['HERA', 'DOCUMENTS', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS'])).max(6),
}).strict()

export type ModuleSelectionInput = z.infer<typeof moduleSelectionSchema>

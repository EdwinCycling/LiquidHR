import { z } from 'zod'

export const moduleSelectionSchema = z.object({
  enabled: z.array(z.enum(['HERA', 'DOCUMENTS', 'REMINDERS', 'TALENT', 'TEAM_COMPASS'])).max(5),
}).strict()

export type ModuleSelectionInput = z.infer<typeof moduleSelectionSchema>

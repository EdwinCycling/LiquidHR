import { z } from 'zod'

export const moduleSelectionSchema = z.object({
  enabled: z.array(z.enum(['HERA', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS'])).max(6),
}).strict()

export type ModuleSelectionInput = z.infer<typeof moduleSelectionSchema>

import { z } from 'zod'

export const moduleSelectionSchema = z.object({
  enabled: z.array(z.enum(['HERA', 'REMINDERS', 'TALENT', 'SURVEYS', 'ENPS', 'TEAM_COMPASS', 'JOURNEYS', 'RECRUITMENT', 'PAYROLL'])).max(9),
}).strict()

export type ModuleSelectionInput = z.infer<typeof moduleSelectionSchema>

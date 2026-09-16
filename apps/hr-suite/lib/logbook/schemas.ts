import { z } from 'zod'

export const personalLogbookEntryCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000),
}).strict()

export const personalLogbookEntryUpdateSchema = personalLogbookEntryCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'LOGBOOK_UPDATE_REQUIRED',
)

export const aiTeamSummaryLogbookEntryCreateSchema = personalLogbookEntryCreateSchema.extend({
  sessionId: z.string().uuid(),
}).strict()

export type PersonalLogbookEntryCreateInput = z.infer<typeof personalLogbookEntryCreateSchema>
export type PersonalLogbookEntryUpdateInput = z.infer<typeof personalLogbookEntryUpdateSchema>
export type AiTeamSummaryLogbookEntryCreateInput = z.infer<typeof aiTeamSummaryLogbookEntryCreateSchema>

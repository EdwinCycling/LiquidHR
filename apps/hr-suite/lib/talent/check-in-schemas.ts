import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const entryType = z.enum(['EMPLOYEE_REFLECTION', 'MANAGER_OBSERVATION', 'FOLLOW_UP'])

export const talentCheckInCreateSchema = z.object({
  entryType,
  body: z.string().trim().min(1).max(4000),
  followUpTitle: z.string().trim().min(1).max(160).nullable().optional(),
  followUpDueOn: isoDate.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.entryType === 'FOLLOW_UP' && !value.followUpTitle) context.addIssue({ code: 'custom', path: ['followUpTitle'], message: 'TALENT_CHECKIN_FOLLOW_UP_TITLE_REQUIRED' })
  if (value.entryType !== 'FOLLOW_UP' && value.followUpTitle) context.addIssue({ code: 'custom', path: ['followUpTitle'], message: 'TALENT_CHECKIN_FOLLOW_UP_TITLE_NOT_ALLOWED' })
})

export const talentCheckInUpdateSchema = z.object({
  version: z.number().int().min(1),
  body: z.string().trim().min(1).max(4000).optional(),
  followUpTitle: z.string().trim().min(1).max(160).nullable().optional(),
  followUpDueOn: isoDate.nullable().optional(),
  status: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).optional(),
}).strict()

export type TalentCheckInCreateInput = z.infer<typeof talentCheckInCreateSchema>
export type TalentCheckInUpdateInput = z.infer<typeof talentCheckInUpdateSchema>

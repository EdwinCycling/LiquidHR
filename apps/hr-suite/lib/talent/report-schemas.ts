import { z } from 'zod'

export const talentReportModeSchema = z.enum(['admin', 'manager', 'self'])
export const talentReportQuerySchema = z.object({
  mode: talentReportModeSchema.default('manager'),
  employeeId: z.string().uuid().optional(),
  goalStatus: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED']).optional(),
  recordStatus: z.enum(['DRAFT', 'RELEASED', 'EXPIRED', 'ARCHIVED']).optional(),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict().superRefine((value, context) => {
  if (value.periodFrom && value.periodTo && value.periodTo < value.periodFrom) context.addIssue({ code: 'custom', path: ['periodTo'], message: 'TALENT_REPORT_PERIOD_INVALID' })
})

export type TalentReportMode = z.infer<typeof talentReportModeSchema>
export type TalentReportQuery = z.infer<typeof talentReportQuerySchema>

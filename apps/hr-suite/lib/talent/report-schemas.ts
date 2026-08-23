import { z } from 'zod'

export const talentReportModeSchema = z.enum(['admin', 'manager', 'self'])
export const talentReportTypeSchema = z.enum(['all', 'goals', 'capabilities'])
export const talentReportTimeframeSchema = z.enum(['all', 'current', 'history'])
export const talentReportQuerySchema = z.object({
  mode: talentReportModeSchema.default('manager'),
  reportType: talentReportTypeSchema.default('all'),
  timeframe: talentReportTimeframeSchema.default('all'),
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

export type TalentReportSearchParams = Record<string, string | string[] | undefined>

export function parseTalentReportQuery(mode: TalentReportMode, params: TalentReportSearchParams): TalentReportQuery {
  const entries = Object.entries(params).flatMap(([key, value]) => {
    if (typeof value === 'string') return [[key, value] as const]
    if (Array.isArray(value) && typeof value[0] === 'string') return [[key, value[0]] as const]
    return []
  })
  const parsed = talentReportQuerySchema.safeParse({ ...Object.fromEntries(entries), mode })
  return parsed.success ? parsed.data : { mode, reportType: 'all', timeframe: 'all' }
}

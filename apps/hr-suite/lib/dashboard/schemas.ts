import { z } from 'zod'

export const dashboardWidgetWidthSchema = z.enum(['HALF', 'TWO_THIRDS', 'FULL'])

export const dashboardWidgetTypeSchema = z.enum([
  'WELCOME',
  'MY_REMINDERS',
  'ORGANIZATION_OVERVIEW',
  'EMPLOYEE_OVERVIEW',
  'MY_PROFILE', 'PROFILE_COMPLETENESS', 'MY_EMERGENCY_CONTACTS', 'EMPLOYEE_DIRECTORY', 'UPCOMING_BIRTHDAYS', 'HEADCOUNT_BY_DEPARTMENT', 'GENDER_DISTRIBUTION', 'EDUCATION_MIX', 'NATIONALITY_DISTRIBUTION',
  'MY_CONTRACT_DETAILS', 'CONTRACT_TYPE_MIX', 'EXPIRING_CONTRACTS', 'PROBATION_ALERTS', 'UPCOMING_STARTS', 'CURRENT_MONTH_ENDS', 'AVERAGE_TENURE', 'EMPLOYMENT_STATUS_MIX', 'EMPLOYMENT_CHANGE_TIMELINE',
  'MY_RECENT_DOCUMENTS', 'EXPIRING_DOCUMENTS', 'DOCUMENTS_BY_CATEGORY', 'DOCUMENTS_PER_EMPLOYEE', 'DOCUMENT_REMINDER_STATUS',
  'MY_SALARY_HISTORY', 'AVERAGE_SALARY_BY_DEPARTMENT', 'SALARY_SCALE_OCCUPANCY', 'PAYMENT_TYPE_MIX', 'COST_ALLOCATION_MIX', 'SALARY_CHANGE_TIMELINE',
  'MY_WEEKLY_ROSTER', 'WEEKDAY_HOURS', 'FTE_BY_DEPARTMENT', 'ROSTER_COVERAGE_BY_DEPARTMENT', 'UPCOMING_HOLIDAYS', 'ACTIVE_REMINDERS', 'ORGANIZATION_SUMMARY', 'WORK_PATTERNS_BY_DEPARTMENT',
])

export const dashboardWidgetSettingsSchema = z.object({ width: dashboardWidgetWidthSchema.optional() }).passthrough().default({})

export const dashboardCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const dashboardRenameSchema = dashboardCreateSchema

export const dashboardWidgetSchema = z.object({
  id: z.string().uuid().optional(),
  type: dashboardWidgetTypeSchema,
  position: z.number().int().min(0).max(50),
  settings: dashboardWidgetSettingsSchema,
})

export const dashboardLayoutSchema = z.object({
  widgets: z.array(dashboardWidgetSchema).max(20).superRefine((widgets, context) => {
    const positions = new Set<number>()
    widgets.forEach((widget, index) => {
      if (positions.has(widget.position)) context.addIssue({ code: 'custom', message: 'DASHBOARD_POSITION_DUPLICATE', path: [index, 'position'] })
      positions.add(widget.position)
    })
  }),
})

export type DashboardWidgetType = z.infer<typeof dashboardWidgetTypeSchema>
export type DashboardCreateInput = z.infer<typeof dashboardCreateSchema>
export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>

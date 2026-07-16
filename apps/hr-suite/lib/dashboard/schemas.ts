import { z } from 'zod'

export const dashboardWidgetTypeSchema = z.enum([
  'WELCOME',
  'MY_REMINDERS',
  'ORGANIZATION_OVERVIEW',
  'EMPLOYEE_OVERVIEW',
])

export const dashboardCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const dashboardRenameSchema = dashboardCreateSchema

export const dashboardWidgetSchema = z.object({
  id: z.string().uuid().optional(),
  type: dashboardWidgetTypeSchema,
  position: z.number().int().min(0).max(50),
  settings: z.record(z.string(), z.unknown()).default({}),
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

import { z } from 'zod'
const toggle = z.enum(['0', '1']).default('1')
const calendarIdentifier = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  q: z.string().trim().max(100).default(''),
  department: calendarIdentifier.optional(),
  employee: calendarIdentifier.optional(),
  jobGroup: calendarIdentifier.optional(),
  job: calendarIdentifier.optional(),
  week: z.string().regex(/^[1-9]\d*$/).optional(),
  type: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  size: z.enum(['10', '25', 'all']).optional(),
  page: z.string().regex(/^[1-9]\d*$/).optional(),
  showWeekendsAndHolidays: toggle,
  showReminders: toggle,
  showScheduledHours: toggle,
  showWeekNumbers: toggle,
  showDayOccupancy: toggle,
}).strict()
export type CalendarQuery=z.infer<typeof calendarQuerySchema>

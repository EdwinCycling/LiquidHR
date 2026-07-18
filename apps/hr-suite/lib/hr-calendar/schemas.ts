import { z } from 'zod'
export const calendarQuerySchema=z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),q:z.string().trim().max(100).default(''),department:z.string().uuid().optional(),employee:z.string().uuid().optional(),type:z.array(z.string().trim().min(1).max(80)).max(20).default([])}).strict()
export type CalendarQuery=z.infer<typeof calendarQuerySchema>

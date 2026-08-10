import { z } from 'zod'

export const companyActivitySchema = z.object({
  year: z.number().int().min(2000).max(2200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(160),
}).strict().superRefine((value, context) => {
  if (!value.date.startsWith(`${value.year}-`)) context.addIssue({ code: 'custom', path: ['date'], message: 'COMPANY_ACTIVITY_YEAR_MISMATCH' })
})

export type CompanyActivityInput = z.infer<typeof companyActivitySchema>

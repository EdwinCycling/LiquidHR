import { z } from 'zod'

export const companyActivitySchema = z.object({
  year: z.number().int().min(2000).max(2200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(160),
}).strict().superRefine((value, context) => {
  if (!value.date.startsWith(`${value.year}-`)) context.addIssue({ code: 'custom', path: ['date'], message: 'COMPANY_ACTIVITY_YEAR_MISMATCH' })
})

export const companyActivityUpdateSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  isActive: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.date && !value.date.startsWith(`${value.year}-`)) context.addIssue({ code: 'custom', path: ['date'], message: 'COMPANY_ACTIVITY_YEAR_MISMATCH' })
  if (value.date === undefined && value.name === undefined && value.isActive === undefined) context.addIssue({ code: 'custom', path: [], message: 'COMPANY_ACTIVITY_UPDATE_EMPTY' })
})

export type CompanyActivityInput = z.infer<typeof companyActivitySchema>
export type CompanyActivityUpdateInput = z.infer<typeof companyActivityUpdateSchema>

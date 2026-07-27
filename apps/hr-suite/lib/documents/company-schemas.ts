import { z } from 'zod'

export const companyDocumentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
}).strict()

export const payslipPeriodSchema = z.object({
  periodLabel: z.string().trim().min(1).max(80),
  calendarYear: z.number().int().min(2000).max(2200),
  employmentId: z.string().uuid(),
  importSource: z.enum(['NMBRS', 'LOKET', 'MANUAL_IMPORT']),
}).strict()

export type CompanyDocumentMetadataInput = z.infer<typeof companyDocumentMetadataSchema>
export type PayslipPeriodInput = z.infer<typeof payslipPeriodSchema>

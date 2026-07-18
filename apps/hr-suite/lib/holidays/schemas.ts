import { z } from 'zod'

const countryCode = z.string().trim().length(2).transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{2}$/))
const base = { year: z.number().int().min(2000).max(2200), countryCode }

export const holidayImportSchema = z.object(base).strict()
export const holidayManualSchema = z.object({ ...base, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: z.string().trim().min(1).max(160) }).strict().superRefine((value, context) => { if (!value.date.startsWith(`${value.year}-`)) context.addIssue({ code: 'custom', path: ['date'], message: 'HOLIDAY_YEAR_MISMATCH' }) })
export const holidayUpdateSchema = z.object({ isActive: z.boolean().optional(), displayName: z.string().trim().min(1).max(160).optional() }).strict().refine((value) => value.isActive !== undefined || value.displayName !== undefined)

export type HolidayImportInput = z.infer<typeof holidayImportSchema>
export type HolidayManualInput = z.infer<typeof holidayManualSchema>
export type HolidayUpdateInput = z.infer<typeof holidayUpdateSchema>

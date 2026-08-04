import { z } from 'zod'

export const absenceSettingsSchema = z.object({
  frequentAbsenceThreshold: z.coerce.number().int().min(1).max(20),
  defaultCaseManagerEmployeeId: z.string().uuid().nullable().optional(),
  employeeSelfReportEnabled: z.coerce.boolean().default(false),
})

export type AbsenceSettingsInput = z.infer<typeof absenceSettingsSchema>

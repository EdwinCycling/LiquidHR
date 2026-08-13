import { z } from 'zod'

export const retentionSettingsSchema = z.object({ retentionDays: z.number().int().min(1).max(3650) }).strict()

export function retentionWarning(retentionDays: number): string | null {
  return retentionDays > 365 ? 'Een termijn boven 365 dagen moet door de organisatie zelf kunnen worden onderbouwd.' : null
}

export function buildRetentionImpact(input: { readonly retentionDays: number; readonly terminalApplications: number; readonly earliestDueAt: string | null }): { readonly retentionDays: number; readonly terminalApplications: number; readonly earliestDueAt: string | null; readonly recomputesDueDates: true } {
  retentionSettingsSchema.parse({ retentionDays: input.retentionDays })
  return { ...input, recomputesDueDates: true }
}

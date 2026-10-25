import { z } from 'zod'
import { databaseUuid } from '@/lib/validation/database-uuid'

const date = z.string().date().refine(value => value >= '2000-01-01' && value <= '2200-12-31')
export const workCalendarConfigSchema = z.object({
  name: z.string().trim().min(1).max(120),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(values => new Set(values).size === values.length),
  validFrom: date,
  validUntil: date,
  holidayIds: z.array(databaseUuid).max(500).refine(values => new Set(values).size === values.length),
  exceptions: z.array(z.object({ date, isWorkday: z.boolean(), label: z.string().trim().min(1).max(160) }).strict()).max(1000),
  holidaySelectionConfirmed: z.literal(true),
  reason: z.string().trim().min(1).max(500),
}).strict().superRefine((value, ctx) => {
  if (value.validUntil < value.validFrom || Date.parse(value.validUntil)-Date.parse(value.validFrom) > 3660*86400000) ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'WORK_CALENDAR_RANGE_INVALID' })
  if (new Set(value.exceptions.map(day => day.date)).size !== value.exceptions.length) ctx.addIssue({ code: 'custom', path: ['exceptions'], message: 'WORK_CALENDAR_DUPLICATE_DATE' })
  if (value.exceptions.some(day => day.date < value.validFrom || day.date > value.validUntil)) ctx.addIssue({ code: 'custom', path: ['exceptions'], message: 'WORK_CALENDAR_RANGE_INVALID' })
})
export const publishWorkCalendarSchema = z.object({ administrationId: databaseUuid.nullable(), expectedRevision: z.number().int().nonnegative(), config: workCalendarConfigSchema }).strict()
export const previewWorkCalendarSchema = z.object({ versionId: databaseUuid, date, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), days: z.number().int().min(1).max(3660) }).strict()
export const workCalendarModelSchema = z.object({
  effectiveVersionId: databaseUuid.nullable(),
  calendars: z.array(z.object({
    id: databaseUuid,
    administrationId: databaseUuid.nullable(),
    revision: z.number().int(),
    version: z.object({ id: databaseUuid, name: z.string(), time_zone: z.string(), weekdays: z.array(z.number()), valid_from: z.string(), valid_until: z.string(), created_at: z.string(), reason: z.string() }),
    exceptions: z.array(z.object({ date: z.string(), isWorkday: z.boolean(), label: z.string(), sourceHolidayId: databaseUuid.nullable() })),
    history: z.array(z.object({ revision: z.number(), created_at: z.string(), reason: z.string() })),
  })),
})
export const workCalendarPreviewSchema = z.object({ deadlineAt: z.string(), calendarVersionId: databaseUuid, revision: z.number(), timeZone: z.string(), countedDates: z.array(z.string()), skippedDates: z.array(z.string()) })
export type WorkCalendarModel = z.infer<typeof workCalendarModelSchema>
export type WorkCalendarConfig = z.infer<typeof workCalendarConfigSchema>
export type WorkCalendarPreview = z.infer<typeof workCalendarPreviewSchema>
export type HolidayChoice = { id: string; date: string; label: string }

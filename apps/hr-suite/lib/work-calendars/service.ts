import type { Json } from '@scope/db'
import { NextResponse } from 'next/server'
import { permissionErrorResponse, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { workCalendarModelSchema, workCalendarPreviewSchema, type HolidayChoice, type WorkCalendarConfig } from './schemas'

export class WorkCalendarError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code) }
}
function databaseError(error: { message: string; code?: string }): never {
  if (error.code === 'PGRST202' || error.code === '42P01') throw new WorkCalendarError('WORK_CALENDAR_UNAVAILABLE', 503)
  const known = error.message.match(/(?:WORK_CALENDAR|SLA_WORKDAY_CALENDAR|SLA_TIME_ZONE)_[A-Z_]+/)?.[0]
  const code = known ?? (error.code === '23505' ? 'WORK_CALENDAR_DUPLICATE_DATE' : error.code?.startsWith('22') ? 'WORK_CALENDAR_INPUT_INVALID' : 'WORK_CALENDAR_OPERATION_FAILED')
  throw new WorkCalendarError(code, code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('STALE') || code.includes('DUPLICATE') || code.startsWith('SLA_') ? 409 : code==='WORK_CALENDAR_OPERATION_FAILED' ? 500 : 400)
}
async function context() {
  const auth = await requirePermission('process-definition:write')
  return { auth, groupId: requireHrGroupId(auth), supabase: await createClient() }
}
export async function getWorkCalendars() {
  const { auth, groupId, supabase } = await context()
  const { data, error } = await supabase.rpc('get_work_calendars', { requested_hr_group_id: groupId, requested_administration_id: auth.administrationId })
  if (error) databaseError(error)
  const parsed = workCalendarModelSchema.safeParse(data)
  if (!parsed.success) throw new WorkCalendarError('WORK_CALENDAR_OPERATION_FAILED',500)
  return parsed.data
}
export async function publishWorkCalendar(input: { administrationId: string | null; expectedRevision: number; config: WorkCalendarConfig }) {
  const { auth, groupId, supabase } = await context()
  if (input.administrationId !== null && input.administrationId !== auth.administrationId) throw new WorkCalendarError('WORK_CALENDAR_FORBIDDEN',403)
  const { error } = await supabase.rpc('publish_work_calendar', { requested_hr_group_id: groupId, requested_administration_id: input.administrationId, requested_expected_revision: input.expectedRevision, requested_config: input.config as Json })
  if (error) databaseError(error)
  return getWorkCalendars()
}
export async function previewWorkCalendar(input: { versionId: string; date: string; time: string; days: number }) {
  const { supabase } = await context()
  const { data, error } = await supabase.rpc('preview_work_calendar_deadline', { requested_version_id: input.versionId, requested_local_start: `${input.date}T${input.time}:00`, requested_days: input.days })
  if (error) databaseError(error)
  const parsed = workCalendarPreviewSchema.safeParse(data)
  if (!parsed.success) throw new WorkCalendarError('WORK_CALENDAR_OPERATION_FAILED',500)
  return parsed.data
}
export async function listWorkCalendarHolidays(from: string, until: string): Promise<HolidayChoice[]> {
  const { auth, groupId, supabase } = await context()
  await requirePermission('holidays:read')
  const { data, error } = await supabase.from('holidays').select('id,holiday_date,display_name,provider_name,holiday_calendars!inner(country_code)')
    .eq('tenant_id',auth.tenantId).eq('hr_group_id',groupId).eq('is_active',true).eq('holiday_calendars.country_code','NL')
    .gte('holiday_date',from).lte('holiday_date',until).order('holiday_date').limit(1000)
  if (error) databaseError(error)
  return (data ?? []).map(row => ({ id: row.id, date: row.holiday_date, label: row.display_name ?? row.provider_name }))
}
export function workCalendarErrorResponse(error: unknown) {
  return permissionErrorResponse(error) ?? (error instanceof WorkCalendarError
    ? NextResponse.json({ code: error.code },{ status: error.status })
    : NextResponse.json({ code: 'WORK_CALENDAR_OPERATION_FAILED' },{ status: 500 }))
}

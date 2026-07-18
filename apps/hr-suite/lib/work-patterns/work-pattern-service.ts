import type { Json } from '@scope/db'
import { NextResponse } from 'next/server'
import { permissionErrorResponse, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { WorkPatternPublishInput } from './schemas'

export class WorkPatternError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'WorkPatternError' }
}

function databaseError(message: string): never {
  const code = message.match(/WORK_PATTERN_[A-Z_]+/)?.[0] ?? 'WORK_PATTERN_OPERATION_FAILED'
  const status = code.includes('NOT_FOUND') ? 404 : code.includes('FORBIDDEN') ? 403 : code.includes('OVERLAP') || code.includes('MISMATCH') ? 409 : 400
  throw new WorkPatternError(code, status)
}

async function employmentForAction(employmentId: string, permission: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('employments').select('id, tenant_id, administration_id, employee_id').eq('id', employmentId).is('deleted_at', null).maybeSingle()
  if (error || !data) throw new WorkPatternError('WORK_PATTERN_EMPLOYMENT_NOT_FOUND', 404)
  const auth = await requirePermission(permission, data.employee_id)
  if (auth.tenantId !== data.tenant_id || auth.administrationId !== data.administration_id) throw new WorkPatternError('WORK_PATTERN_EMPLOYMENT_NOT_FOUND', 404)
  return data
}

export async function listEmploymentWorkPatterns(employmentId: string) {
  await employmentForAction(employmentId, 'work-schedule:read')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_work_patterns').select('*, employment_work_pattern_days(*)').eq('employment_id', employmentId).order('valid_from', { ascending: false }).limit(100)
  if (error) databaseError(error.message)
  return data ?? []
}

export async function publishEmploymentWorkPattern(employmentId: string, input: WorkPatternPublishInput): Promise<string> {
  await employmentForAction(employmentId, 'work-schedule:write')
  const payload = {
    name: input.name,
    cycle_weeks: input.cycleWeeks,
    anchor_date: input.anchorDate,
    valid_from: input.validFrom,
    valid_until: input.validUntil,
    days: input.days.map((day) => ({ week_index: day.weekIndex, iso_weekday: day.isoWeekday, is_working_day: day.isWorkingDay, starts_at: day.startsAt, ends_at: day.endsAt, break_minutes: day.breakMinutes, scheduled_minutes: day.scheduledMinutes, note: day.note })),
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_employment_work_pattern', { requested_employment_id: employmentId, requested_payload: payload as Json })
  if (error || !data) databaseError(error?.message ?? 'WORK_PATTERN_OPERATION_FAILED')
  return data
}

export function workPatternErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof WorkPatternError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'WORK_PATTERN_OPERATION_FAILED' }, { status: 500 })
}

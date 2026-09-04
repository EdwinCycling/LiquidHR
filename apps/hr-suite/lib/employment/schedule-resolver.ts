import type { Tables } from '@scope/db'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type EmploymentScheduleScope = Pick<
  Tables<'employments'>,
  'tenant_id' | 'administration_id' | 'employee_id' | 'id'
>

export type EmploymentScheduleRow = Pick<
  Tables<'employment_schedules'>,
  'valid_from' | 'valid_until' | 'average_hours_per_week' | 'fulltime_hours_per_week'
  | 'monday_hours' | 'tuesday_hours' | 'wednesday_hours' | 'thursday_hours'
  | 'friday_hours' | 'saturday_hours' | 'sunday_hours'
>

export async function getEffectiveEmploymentSchedule(
  supabase: SupabaseServerClient,
  employment: EmploymentScheduleScope,
  date: string,
): Promise<EmploymentScheduleRow | null> {
  const result = await supabase
    .from('employment_schedules')
    .select('valid_from, valid_until, average_hours_per_week, fulltime_hours_per_week, monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours')
    .eq('tenant_id', employment.tenant_id)
    .eq('administration_id', employment.administration_id)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .lte('valid_from', date)
    .or(`valid_until.is.null,valid_until.gt.${date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (result.error) throw result.error
  return result.data
}

export async function getEffectiveEmploymentHoursPerWeek(
  supabase: SupabaseServerClient,
  employment: EmploymentScheduleScope,
  date: string,
): Promise<number | null> {
  const schedule = await getEffectiveEmploymentSchedule(supabase, employment, date)
  if (!schedule) return null
  const hours = Number(schedule.average_hours_per_week)
  return Number.isFinite(hours) && hours > 0 ? hours : null
}

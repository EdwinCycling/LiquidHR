import type { Database } from '@scope/db'
import { requireAuthContext, requireAnyPermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getPatternDay, type WorkPatternDay } from '@/lib/work-patterns/work-pattern-model'
import { assertLeaveReadScope, LeaveServiceError, getLeaveBalanceReport } from './leave-service'
import { projectApprovedLeave, type LeaveProjectionAllocation, type LeaveProjectionRequest, type LeaveProjectionScheduleDay, type LeaveDayProjection } from './calendar-projection'

type PatternRow = Database['public']['Tables']['employment_work_patterns']['Row'] & {
  employment_work_pattern_days: Array<Database['public']['Tables']['employment_work_pattern_days']['Row']>
}

type ScheduleRow = Pick<Database['public']['Tables']['employment_schedules']['Row'],
  | 'friday_hours'
  | 'monday_hours'
  | 'saturday_hours'
  | 'sunday_hours'
  | 'thursday_hours'
  | 'tuesday_hours'
  | 'valid_from'
  | 'valid_until'
  | 'wednesday_hours'
>

export type LeaveOverviewDay = LeaveDayProjection & {
  typeName: string
  colorCode: string
}

function databaseError(error: { message?: string } | null): never {
  throw new LeaveServiceError(error?.message ?? 'LEAVE_OVERVIEW_FAILED', 500)
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date)
  return dates
}

function clampRange(startDate: string, endDate: string, yearStart: string, yearEnd: string): [string, string] | null {
  const start = startDate > yearStart ? startDate : yearStart
  const end = endDate < yearEnd ? endDate : yearEnd
  return start <= end ? [start, end] : null
}

function scheduleDayForDate(patterns: readonly PatternRow[], schedules: readonly ScheduleRow[], date: string): LeaveProjectionScheduleDay | undefined {
  const pattern = patterns.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until > date))
  if (pattern) {
    const projected = getPatternDay({
      anchorDate: pattern.anchor_date,
      cycleWeeks: pattern.cycle_weeks,
      days: pattern.employment_work_pattern_days.map((day): WorkPatternDay => ({
        weekIndex: day.week_index,
        isoWeekday: day.iso_weekday,
        isWorkingDay: day.is_working_day,
        startsAt: day.starts_at,
        endsAt: day.ends_at,
        breakMinutes: day.break_minutes,
        scheduledMinutes: day.scheduled_minutes,
        note: day.note,
      })),
    }, date)
    if (projected) return { date, scheduledMinutes: projected.scheduledMinutes, isWorkingDay: projected.isWorkingDay }
  }
  const schedule = schedules.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until >= date))
  if (!schedule) return undefined
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const hours = weekday === 0
    ? schedule.sunday_hours
    : weekday === 1
      ? schedule.monday_hours
      : weekday === 2
        ? schedule.tuesday_hours
        : weekday === 3
          ? schedule.wednesday_hours
          : weekday === 4
            ? schedule.thursday_hours
            : weekday === 5
              ? schedule.friday_hours
              : schedule.saturday_hours
  const scheduledMinutes = Math.round(Number(hours ?? 0) * 60)
  return { date, scheduledMinutes, isWorkingDay: scheduledMinutes > 0 }
}

export async function getLeaveYearOverview(input: { employmentId: string; year: number }) {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  const yearStart = `${input.year}-01-01`
  const yearEnd = `${input.year}-12-31`
  const employmentResult = await supabase
    .from('employments')
    .select('id,employee_id,employment_number,hr_group_id,starts_on,ends_on,record_status,deleted_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId ?? '')
    .eq('id', input.employmentId)
    .maybeSingle()
  if (employmentResult.error) databaseError(employmentResult.error)
  const employment = employmentResult.data
  if (!employment || employment.record_status !== 'CONFIRMED' || employment.deleted_at !== null) throw new LeaveServiceError('LEAVE_EMPLOYMENT_NOT_FOUND', 404)
  await assertLeaveReadScope(context, supabase, employment.employee_id)
  await requireAnyPermission(['leave:read', 'employee:read'], employment.employee_id)

  const reportAsOfDate = employment.ends_on && employment.ends_on < yearEnd ? employment.ends_on : yearEnd
  const [reportResult, requestsResult, patternsResult, schedulesResult, holidaysResult] = await Promise.all([
    getLeaveBalanceReport({ employmentId: employment.id, asOfDate: reportAsOfDate }),
    supabase.from('leave_requests').select('id,employee_id,employment_id,request_mode,time_mode,specific_start,specific_end,start_date,end_date,requested_minutes,status').eq('tenant_id', context.tenantId).eq('hr_group_id', employment.hr_group_id).eq('employment_id', employment.id).eq('status', 'APPROVED').lte('start_date', yearEnd).gte('end_date', yearStart).limit(5000),
    supabase.from('employment_work_patterns').select('id,employee_id,employment_id,name,cycle_weeks,anchor_date,average_minutes_per_week,valid_from,valid_until,created_at,updated_at,employment_work_pattern_days(week_index,iso_weekday,is_working_day,starts_at,ends_at,break_minutes,scheduled_minutes,note)').eq('tenant_id', context.tenantId).eq('employment_id', employment.id).order('valid_from', { ascending: false }).limit(1000),
    supabase.from('employment_schedules').select('monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours,valid_from,valid_until').eq('tenant_id', context.tenantId).eq('employment_id', employment.id).lte('valid_from', yearEnd).or(`valid_until.is.null,valid_until.gte.${yearStart}`).order('valid_from', { ascending: false }).limit(1000),
    supabase.from('holidays').select('holiday_date').eq('tenant_id', context.tenantId).eq('hr_group_id', employment.hr_group_id).eq('is_active', true).gte('holiday_date', yearStart).lte('holiday_date', yearEnd).limit(500),
  ])
  if (requestsResult.error || patternsResult.error || schedulesResult.error || holidaysResult.error) databaseError(requestsResult.error ?? patternsResult.error ?? schedulesResult.error ?? holidaysResult.error)
  const requests = requestsResult.data ?? []
  const requestIds = requests.map((request) => request.id)
  const allocationsResult = requestIds.length
    ? await supabase.from('leave_request_allocations').select('request_id,leave_type_id,allocated_hours,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', employment.hr_group_id).eq('employment_id', employment.id).in('request_id', requestIds).limit(5000)
    : { data: [], error: null }
  if (allocationsResult.error) databaseError(allocationsResult.error)
  const allocationTypeIds = [...new Set((allocationsResult.data ?? []).map((allocation) => allocation.leave_type_id))]
  const leaveTypesResult = allocationTypeIds.length
    ? await supabase.from('leave_types').select('id,name,color_code').eq('tenant_id', context.tenantId).eq('hr_group_id', employment.hr_group_id).in('id', allocationTypeIds).limit(500)
    : { data: [], error: null }
  if (leaveTypesResult.error) databaseError(leaveTypesResult.error)

  const patterns = (patternsResult.data ?? []) as PatternRow[]
  const schedules = (schedulesResult.data ?? []) as ScheduleRow[]
  const scheduleDays = new Map<string, LeaveProjectionScheduleDay>()
  for (const request of requests) {
    const range = clampRange(request.start_date, request.end_date, yearStart, yearEnd)
    if (!range) continue
    for (const date of dateRange(request.start_date, request.end_date)) {
      const day = scheduleDayForDate(patterns, schedules, date)
      if (day) scheduleDays.set(date, day)
    }
  }
  const projected = projectApprovedLeave({
    requests: requests.map((request): LeaveProjectionRequest => ({
      id: request.id,
      employeeId: request.employee_id,
      employmentId: request.employment_id,
      startDate: request.start_date,
      endDate: request.end_date,
      requestMode: request.request_mode,
      timeMode: request.time_mode,
      specificStart: request.specific_start,
      specificEnd: request.specific_end,
      requestedMinutes: request.requested_minutes,
      status: request.status,
    })),
    allocations: (allocationsResult.data ?? []).map((allocation): LeaveProjectionAllocation => ({
      requestId: allocation.request_id,
      leaveTypeId: allocation.leave_type_id,
      allocatedHours: Number(allocation.allocated_hours),
      sortOrder: allocation.sort_order,
    })),
    scheduleDaysByEmployment: new Map([[employment.id, scheduleDays]]),
    holidayDates: new Set((holidaysResult.data ?? []).map((holiday) => holiday.holiday_date)),
  })
  const leaveTypeById = new Map((leaveTypesResult.data ?? []).map((type) => [type.id, type]))
  const days: LeaveOverviewDay[] = projected
    .filter((day) => day.date >= yearStart && day.date <= yearEnd)
    .flatMap((day) => {
      const type = leaveTypeById.get(day.leaveTypeId)
      return type ? [{ ...day, typeName: type.name, colorCode: type.color_code }] : []
    })
  return {
    report: reportResult.report,
    employmentSelection: reportResult.employmentSelection,
    employment: { id: employment.id, employmentNumber: employment.employment_number, startsOn: employment.starts_on, endsOn: employment.ends_on },
    days,
  }
}

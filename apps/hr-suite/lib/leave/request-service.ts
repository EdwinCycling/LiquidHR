import type { Tables } from '@scope/db'
import { requirePermission, requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { LeaveServiceError } from './leave-service'
import type { LeaveRequestConfirmInput, LeaveRequestPreviewQuery } from './schemas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type EmploymentRow = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'tenant_id' | 'administration_id' | 'starts_on' | 'ends_on' | 'record_status'>
type ScheduleRow = Pick<Tables<'employment_schedules'>, 'valid_from' | 'valid_until' | 'monday_hours' | 'tuesday_hours' | 'wednesday_hours' | 'thursday_hours' | 'friday_hours' | 'saturday_hours' | 'sunday_hours'>

export type LeaveRequestPreview = {
  employeeId: string
  employmentId: string
  startDate: string
  endDate: string
  fullDayMinutes: number
  halfDayMinutes: number
  types: Array<{
    id: string
    name: string
    colorCode: string
    entitlementMode: string
    currentBalanceHours: number | null
    projectedEndBalanceHours: number | null
    annualLimitHours: number | null
    status: 'AVAILABLE' | 'UNLIMITED' | 'NO_BALANCE'
  }>
  priorityRules: Array<{ id: string; name: string; itemCount: number }>
}

function databaseError(error: { message?: string } | null): never {
  const message = error?.message ?? 'LEAVE_OPERATION_FAILED'
  const code = message.match(/LEAVE_[A-Z_]+/)?.[0]
  throw new LeaveServiceError(code ?? 'LEAVE_OPERATION_FAILED', 500)
}

function isActiveOn(employment: EmploymentRow, date: string): boolean {
  return employment.record_status === 'CONFIRMED' && employment.starts_on <= date && (employment.ends_on === null || employment.ends_on >= date)
}

async function loadEmployment(
  supabase: SupabaseServerClient,
  context: Awaited<ReturnType<typeof requireAuthContext>>,
  input: LeaveRequestPreviewQuery | LeaveRequestConfirmInput,
): Promise<EmploymentRow> {
  const administrationId = context.administrationId
  if (!administrationId) throw new LeaveServiceError('LEAVE_ADMINISTRATION_REQUIRED', 400)
  const date = input.startDate
  let query = supabase
    .from('employments')
    .select('id, employee_id, tenant_id, administration_id, starts_on, ends_on, record_status')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .eq('employee_id', input.employeeId)
    .eq('record_status', 'CONFIRMED')
  if (input.employmentId) query = query.eq('id', input.employmentId)
  const result = await query.order('starts_on', { ascending: false }).limit(100)
  if (result.error) databaseError(result.error)
  const options = result.data.filter((row) => isActiveOn(row, date))
  if (options.length === 0) throw new LeaveServiceError('LEAVE_EMPLOYMENT_REQUIRED', 400)
  if (options.length > 1 && !input.employmentId) {
    throw new LeaveServiceError('LEAVE_EMPLOYMENT_SELECTION_REQUIRED', 409, {
      options: options.map((row) => ({ id: row.id, startsOn: row.starts_on, endsOn: row.ends_on })),
    })
  }
  return options[0]
}

function hoursForDay(schedule: ScheduleRow | null, date: string): number {
  if (!schedule) return 0
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return Number(day === 0 ? schedule.sunday_hours ?? 0 : day === 1 ? schedule.monday_hours ?? 0 : day === 2 ? schedule.tuesday_hours ?? 0 : day === 3 ? schedule.wednesday_hours ?? 0 : day === 4 ? schedule.thursday_hours ?? 0 : day === 5 ? schedule.friday_hours ?? 0 : schedule.saturday_hours ?? 0)
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) dates.push(date)
  return dates
}

async function effectiveSchedule(supabase: SupabaseServerClient, employment: EmploymentRow, date: string): Promise<ScheduleRow | null> {
  const result = await supabase
    .from('employment_schedules')
    .select('valid_from, valid_until, monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours')
    .eq('tenant_id', employment.tenant_id)
    .eq('administration_id', employment.administration_id)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .lte('valid_from', date)
    .or(`valid_until.is.null,valid_until.gte.${date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (result.error) databaseError(result.error)
  return result.data
}

export async function getLeaveRequestPreview(input: LeaveRequestPreviewQuery): Promise<LeaveRequestPreview> {
  const supabase = await createClient()
  const context = await requirePermission('leave:request', input.employeeId)
  const employment = await loadEmployment(supabase, context, input)
  const endDate = input.endDate ?? input.startDate
  if (!isActiveOn(employment, endDate)) throw new LeaveServiceError('LEAVE_EMPLOYMENT_DATE_INVALID', 400)
  const dates = dateRange(input.startDate, endDate)
  const [scheduleRows, holidays] = await Promise.all([
    Promise.all(dates.map((date) => effectiveSchedule(supabase, employment, date))),
    supabase
      .from('holidays')
      .select('holiday_date')
      .eq('tenant_id', context.tenantId)
      .eq('administration_id', employment.administration_id)
      .eq('is_active', true)
      .in('holiday_date', dates),
  ])
  if (holidays.error) databaseError(holidays.error)
  const holidayDates = new Set(holidays.data.map((holiday) => holiday.holiday_date))
  const fullDayMinutes = scheduleRows.reduce((sum, schedule, index) => sum + (holidayDates.has(dates[index]) ? 0 : Math.round(hoursForDay(schedule, dates[index]) * 60)), 0)
  const settings = await supabase.from('leave_settings').select('half_day_minutes').eq('tenant_id', context.tenantId).eq('administration_id', employment.administration_id).maybeSingle()
  if (settings.error) databaseError(settings.error)
  const halfDayMinutes = settings.data?.half_day_minutes ?? 240
  const [types, buckets, transactions, priorityRules, priorityItems] = await Promise.all([
    supabase.from('leave_types').select('id, name, color_code, entitlement_mode, annual_hours_cap, weekly_hours_cap_factor').eq('tenant_id', context.tenantId).eq('administration_id', employment.administration_id).eq('is_active', true).order('name').limit(500),
    supabase.from('leave_balance_buckets').select('id, leave_type_id, total_accrued, total_taken, total_expired, expiration_date').eq('tenant_id', context.tenantId).eq('administration_id', employment.administration_id).eq('employee_id', employment.employee_id).eq('employment_id', employment.id).limit(2000),
    supabase.from('leave_accrual_transactions').select('leave_type_id, amount, transaction_type, transaction_date').eq('tenant_id', context.tenantId).eq('administration_id', employment.administration_id).eq('employee_id', employment.employee_id).eq('employment_id', employment.id).lte('transaction_date', '2100-12-31').limit(5000),
    supabase.from('leave_priority_rules').select('id, name, valid_from, valid_until').eq('tenant_id', context.tenantId).eq('administration_id', employment.administration_id).eq('is_active', true).lte('valid_from', input.startDate).or(`valid_until.is.null,valid_until.gte.${input.startDate}`).order('name').limit(100),
    supabase.from('leave_priority_rule_items').select('priority_rule_id').eq('tenant_id', context.tenantId).eq('administration_id', employment.administration_id).limit(1000),
  ])
  if (types.error) databaseError(types.error)
  if (buckets.error) databaseError(buckets.error)
  if (transactions.error) databaseError(transactions.error)
  if (priorityRules.error) databaseError(priorityRules.error)
  if (priorityItems.error) databaseError(priorityItems.error)
  const currentBalances = new Map<string, number>()
  for (const transaction of transactions.data) currentBalances.set(transaction.leave_type_id, (currentBalances.get(transaction.leave_type_id) ?? 0) + Number(transaction.amount))
  const bucketBalances = new Map<string, number>()
  for (const bucket of buckets.data) bucketBalances.set(bucket.leave_type_id, (bucketBalances.get(bucket.leave_type_id) ?? 0) + Number(bucket.total_accrued) - Number(bucket.total_taken) - Number(bucket.total_expired))
  return {
    employeeId: employment.employee_id,
    employmentId: employment.id,
    startDate: input.startDate,
    endDate,
    fullDayMinutes,
    halfDayMinutes,
    types: types.data.map((type) => {
      const unlimited = type.entitlement_mode === 'UNLIMITED'
      const balance = unlimited ? null : (bucketBalances.get(type.id) ?? currentBalances.get(type.id) ?? 0)
      return {
        id: type.id,
        name: type.name,
        colorCode: type.color_code,
        entitlementMode: type.entitlement_mode,
        currentBalanceHours: balance,
        projectedEndBalanceHours: balance,
        annualLimitHours: type.entitlement_mode === 'ANNUAL_HOURS_CAP' ? Number(type.annual_hours_cap ?? 0) : type.entitlement_mode === 'WEEKLY_HOURS_FACTOR_CAP' ? null : null,
        status: unlimited ? 'UNLIMITED' : balance && balance > 0 ? 'AVAILABLE' : 'NO_BALANCE',
      }
    }),
    priorityRules: priorityRules.data.map((rule) => ({ id: rule.id, name: rule.name, itemCount: priorityItems.data.filter((item) => item.priority_rule_id === rule.id).length })),
  }
}

export async function confirmLeaveRequest(input: LeaveRequestConfirmInput): Promise<{ requestId: string; employmentId: string }> {
  const supabase = await createClient()
  const context = await requirePermission('leave:request', input.employeeId)
  const employment = await loadEmployment(supabase, context, input)
  const result = await supabase.rpc('confirm_leave_request', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: employment.administration_id,
    requested_employee_id: employment.employee_id,
    requested_employment_id: employment.id,
    requested_mode: input.mode,
    requested_priority_rule_id: input.priorityRuleId ?? null,
    requested_leave_type_id: input.leaveTypeId ?? null,
    requested_start_date: input.startDate,
    requested_end_date: input.endDate,
    requested_time_mode: input.timeMode,
    requested_specific_start: input.specificStart ?? null,
    requested_specific_end: input.specificEnd ?? null,
    requested_idempotency_key: input.idempotencyKey,
  })
  if (result.error || !result.data) databaseError(result.error)
  return { requestId: result.data, employmentId: employment.id }
}

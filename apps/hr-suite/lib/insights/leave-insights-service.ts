import type { Tables } from '@scope/db'
import { requireAnyPermission, requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'
import { getPatternDay, type WorkPatternDay } from '@/lib/work-patterns/work-pattern-model'
import { projectApprovedLeave, type LeaveProjectionAllocation, type LeaveProjectionRequest, type LeaveProjectionScheduleDay } from '@/lib/leave/calendar-projection'
import { calculateLeaveInsightsReport } from './leave-insights-calculations'
import type {
  LeaveInsightsAllocationFact,
  LeaveInsightsAbsenceFact,
  LeaveInsightsBucketFact,
  LeaveInsightsEmployeeSetFact,
  LeaveInsightsEmployeeSetMemberFact,
  LeaveInsightsEmploymentFact,
  LeaveInsightsExceptionFact,
  LeaveInsightsFinancialValuationFact,
  LeaveInsightsLeaveTypeFact,
  LeaveInsightsPriorityItemFact,
  LeaveInsightsPriorityRuleFact,
  LeaveInsightsProfileAssignmentFact,
  LeaveInsightsProfileFact,
  LeaveInsightsProjectedDayFact,
  LeaveInsightsRequestFact,
  LeaveInsightsRuleFact,
  LeaveInsightsScheduleDayFact,
  LeaveInsightsRulePauseTypeFact,
  LeaveInsightsTransactionFact,
  LeaveInsightsFacts,
  LeaveInsightsQuery,
  LeaveInsightsReport,
  LeaveInsightsView,
} from './leave-insights-types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type EmploymentRow = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'employment_number' | 'administration_id' | 'hr_group_id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at'>
type EmployeeRow = Pick<Tables<'employees'>, 'id' | 'employee_number' | 'first_name' | 'birth_name_prefix' | 'birth_name' | 'deleted_at'>
type OrganizationRow = Pick<Tables<'employee_organizations'>, 'employee_id' | 'employment_id' | 'department_id' | 'direct_manager_id' | 'effective_from' | 'effective_to'>
type DepartmentRow = Pick<Tables<'departments'>, 'id' | 'name' | 'is_active'>
type ScheduleRow = Pick<Tables<'employment_schedules'>, 'employment_id' | 'valid_from' | 'valid_until' | 'monday_hours' | 'tuesday_hours' | 'wednesday_hours' | 'thursday_hours' | 'friday_hours' | 'saturday_hours' | 'sunday_hours' | 'part_time_factor' | 'fulltime_hours_per_week'>
type PatternRow = Pick<Tables<'employment_work_patterns'>, 'id' | 'employment_id' | 'anchor_date' | 'cycle_weeks' | 'valid_from' | 'valid_until'> & {
  employment_work_pattern_days: Array<Pick<Tables<'employment_work_pattern_days'>, 'week_index' | 'iso_weekday' | 'is_working_day' | 'starts_at' | 'ends_at' | 'break_minutes' | 'scheduled_minutes' | 'note'>>
}
type SalaryRow = Pick<Tables<'employment_salaries'>, 'employment_id' | 'valid_from' | 'valid_until' | 'hourly_rate' | 'salary_basis'>
type EmployeeSetRow = Pick<Tables<'employee_sets'>, 'id' | 'leave_profile_id' | 'priority' | 'name' | 'is_active'>
type EmployeeSetMemberRow = Pick<Tables<'employee_set_members'>, 'employee_set_id' | 'employee_id' | 'valid_from' | 'valid_until'>
type PauseTypeRow = Pick<Tables<'leave_accrual_rule_pause_types'>, 'accrual_rule_id' | 'pause_leave_type_id'>
type AbsenceCaseRow = Pick<Tables<'absence_cases'>, 'employment_id' | 'first_absence_on' | 'status' | 'archived_at'>

export class LeaveInsightsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'LeaveInsightsServiceError'
  }
}

function fail(error: { message?: string } | null): never {
  throw new LeaveInsightsServiceError(error?.message?.includes('FORBIDDEN') ? 'FORBIDDEN' : 'LEAVE_INSIGHTS_QUERY_FAILED', error?.message?.includes('FORBIDDEN') ? 403 : 500)
}

function employeeName(employee: EmployeeRow): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ') || employee.employee_number || employee.id
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function activeOn(validFrom: string, validUntil: string | null, date: string): boolean {
  return validFrom <= date && (validUntil === null || validUntil > date)
}

function latestOrganization(rows: readonly OrganizationRow[], employmentId: string, date: string): OrganizationRow | null {
  return rows
    .filter((row) => row.employment_id === employmentId && activeOn(row.effective_from, row.effective_to, date))
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0] ?? null
}

function scheduleDayForDate(patterns: readonly PatternRow[], schedules: readonly ScheduleRow[], employmentId: string, date: string): LeaveInsightsScheduleDayFact {
  const pattern = patterns
    .filter((candidate) => candidate.employment_id === employmentId && activeOn(candidate.valid_from, candidate.valid_until, date))
    .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0]
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
    if (projected) return { employmentId, date, scheduledHours: Math.max(0, projected.scheduledMinutes / 60), isWorkingDay: projected.isWorkingDay }
  }
  const schedule = schedules
    .filter((candidate) => candidate.employment_id === employmentId && activeOn(candidate.valid_from, candidate.valid_until, date))
    .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0]
  if (!schedule) return { employmentId, date, scheduledHours: 0, isWorkingDay: false }
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const hours = weekday === 0 ? schedule.sunday_hours
    : weekday === 1 ? schedule.monday_hours
      : weekday === 2 ? schedule.tuesday_hours
        : weekday === 3 ? schedule.wednesday_hours
          : weekday === 4 ? schedule.thursday_hours
            : weekday === 5 ? schedule.friday_hours
              : schedule.saturday_hours
  const scheduledHours = Number(hours ?? 0)
  return { employmentId, date, scheduledHours: Number.isFinite(scheduledHours) && scheduledHours > 0 ? scheduledHours : 0, isWorkingDay: scheduledHours > 0 }
}

async function permittedEmployeeIds(context: AuthContext, supabase: SupabaseServerClient): Promise<ReadonlySet<string> | null> {
  if (context.activeRoles.includes('TENANT_ADMIN') || context.activeRoles.includes('HR_ADMIN')) return null
  if (context.activeRoles.includes('DIRECT_MANAGER')) return new Set(await listDirectTeamEmployeeIds(context, supabase))
  return context.employeeId ? new Set([context.employeeId]) : new Set()
}

function uniqueFinancialValuations(rows: readonly SalaryRow[], asOfDate: string, employmentIds: ReadonlySet<string>): LeaveInsightsFinancialValuationFact[] {
  const byEmployment = new Map<string, SalaryRow>()
  for (const row of rows) {
    if (!employmentIds.has(row.employment_id) || !activeOn(row.valid_from, row.valid_until, asOfDate)) continue
    const current = byEmployment.get(row.employment_id)
    if (!current || row.valid_from > current.valid_from) byEmployment.set(row.employment_id, row)
  }
  return [...byEmployment.values()].map((row) => ({
    employmentId: row.employment_id,
    valuationDate: asOfDate,
    hourlyRate: row.hourly_rate !== null && Number.isFinite(Number(row.hourly_rate)) ? Number(row.hourly_rate) : null,
    basisLabel: row.salary_basis,
  }))
}

export async function getLeaveInsightsReport(query: LeaveInsightsQuery): Promise<LeaveInsightsReport> {
  const context = await requirePermission('report-leave:read')
  await requireAnyPermission(['employee:read'])
  const hrGroupId = requireHrGroupId(context)
  const administrationId = context.administrationId
  if (!administrationId) throw new LeaveInsightsServiceError('INSIGHTS_ADMINISTRATION_REQUIRED', 400)
  const financeAuthorized = context.permissions.includes('report-leave-provision:read') && context.permissions.includes('salary:read')
  const supabase = await createClient()
  const permittedIds = await permittedEmployeeIds(context, supabase)
  const emptyFacts = (): LeaveInsightsFacts => ({ employments: [], leaveTypes: [], profiles: [], employeeSets: [], employeeSetMembers: [], assignments: [], rules: [], rulePauseTypes: [], exceptions: [], buckets: [], transactions: [], requests: [], allocations: [], priorityRules: [], priorityItems: [], scheduleDays: [], projectedDays: [], holidays: new Set(), yearControls: [], financialValuations: [], absences: [] })
  if (permittedIds && permittedIds.size === 0) {
    return calculateLeaveInsightsReport({ query, facts: emptyFacts() })
  }

  let employmentQuery = supabase.from('employments')
    .select('id,employee_id,employment_number,administration_id,hr_group_id,starts_on,ends_on,record_status,deleted_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('administration_id', administrationId)
    .eq('record_status', 'CONFIRMED')
    .lte('starts_on', query.periodEnd)
    .or(`ends_on.is.null,ends_on.gte.${query.periodStart}`)
    .limit(5000)
  if (permittedIds) employmentQuery = employmentQuery.in('employee_id', [...permittedIds])
  const includeDeleted = query.view === 'exceptions' || query.view === 'mutations'
  if (!includeDeleted) employmentQuery = employmentQuery.is('deleted_at', null)
  const employmentsResult = await employmentQuery
  if (employmentsResult.error) fail(employmentsResult.error)
  const employmentRows = (employmentsResult.data ?? []) as EmploymentRow[]
  const employmentIds = employmentRows.map((row) => row.id)
  if (employmentIds.length === 0) {
    return calculateLeaveInsightsReport({ query, facts: emptyFacts() })
  }

  const transactionEnd = query.asOfDate > query.periodEnd ? query.asOfDate : query.periodEnd
  const [employeesResult, organizationsResult, departmentsResult, leaveTypesResult, profilesResult, assignmentsResult, rulesResult, exceptionsResult, bucketsResult, transactionsResult, requestsResult, schedulesResult, patternsResult, holidaysResult, priorityRulesResult, priorityItemsResult, controlsResult, salariesResult, employeeSetsResult, employeeSetMembersResult, pauseTypesResult] = await Promise.all([
    supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name,deleted_at').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', [...new Set(employmentRows.map((row) => row.employee_id))]).limit(5000),
    supabase.from('employee_organizations').select('employee_id,employment_id,department_id,direct_manager_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).in('employment_id', employmentIds).limit(10000),
    supabase.from('departments').select('id,name,is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1000),
    supabase.from('leave_types').select('id,name,color_code,entitlement_mode,annual_hours_cap,annual_hours_fte_cap').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1000),
    supabase.from('leave_profiles').select('id,name,is_active,is_group_default').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(1000),
    supabase.from('employment_leave_profiles').select('employment_id,leave_profile_id,valid_from,valid_until').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).limit(10000),
    supabase.from('leave_accrual_rules').select('id,leave_profile_id,leave_type_id,valid_from,valid_until,accrual_basis,accrual_frequency,accrual_timing,accrual_amount,accrual_rate,expiration_months').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(10000),
    supabase.from('leave_accrual_exceptions').select('employment_id,leave_type_id,valid_from,valid_until,no_accrual,accrual_amount,expiration_months,reason').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).limit(10000),
    supabase.from('leave_balance_buckets').select('id,employment_id,leave_type_id,accrual_year,source_accrual_year,accrual_reference_date,expiration_date,cohort_key,total_accrued,total_taken,total_expired').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).limit(20000),
    supabase.from('leave_accrual_transactions').select('id,employment_id,leave_type_id,bucket_id,transaction_type,amount,transaction_date,reason,actor_user_id,actor_display_name,source_type,source_key,created_at').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).lte('transaction_date', transactionEnd).limit(50000),
    supabase.from('leave_requests').select('id,employee_id,employment_id,request_mode,time_mode,start_date,end_date,specific_start,specific_end,requested_minutes,status,priority_rule_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).lte('start_date', query.periodEnd).gte('end_date', query.periodStart).limit(20000),
    supabase.from('employment_schedules').select('employment_id,valid_from,valid_until,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours,part_time_factor,fulltime_hours_per_week').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).in('employment_id', employmentIds).lte('valid_from', query.periodEnd).or(`valid_until.is.null,valid_until.gt.${query.periodStart}`).limit(10000),
    supabase.from('employment_work_patterns').select('id,employment_id,anchor_date,cycle_weeks,valid_from,valid_until,employment_work_pattern_days(week_index,iso_weekday,is_working_day,starts_at,ends_at,break_minutes,scheduled_minutes,note)').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).in('employment_id', employmentIds).lte('valid_from', query.periodEnd).or(`valid_until.is.null,valid_until.gt.${query.periodStart}`).limit(10000),
    supabase.from('holidays').select('holiday_date').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).gte('holiday_date', query.periodStart).lte('holiday_date', query.periodEnd).or(`administration_id.is.null,administration_id.eq.${administrationId}`).limit(1000),
    supabase.from('leave_priority_rules').select('id,leave_profile_id,valid_from,valid_until,is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1000),
    supabase.from('leave_priority_rule_items').select('priority_rule_id,leave_type_id,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(10000),
    supabase.from('leave_year_controls').select('administration_id,year,status').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).eq('year', query.year).limit(10),
    financeAuthorized
      ? supabase.from('employment_salaries').select('employment_id,valid_from,valid_until,hourly_rate,salary_basis').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).in('employment_id', employmentIds).lte('valid_from', query.asOfDate).or(`valid_until.is.null,valid_until.gt.${query.asOfDate}`).limit(10000)
      : Promise.resolve({ data: [] as SalaryRow[], error: null }),
    supabase.from('employee_sets').select('id,leave_profile_id,priority,name,is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1000),
    supabase.from('employee_set_members').select('employee_set_id,employee_id,valid_from,valid_until').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employee_id', [...new Set(employmentRows.map((row) => row.employee_id))]).limit(10000),
    supabase.from('leave_accrual_rule_pause_types').select('accrual_rule_id,pause_leave_type_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(10000),
  ])
  const results = [employeesResult, organizationsResult, departmentsResult, leaveTypesResult, profilesResult, assignmentsResult, rulesResult, exceptionsResult, bucketsResult, transactionsResult, requestsResult, schedulesResult, patternsResult, holidaysResult, priorityRulesResult, priorityItemsResult, controlsResult, salariesResult, employeeSetsResult, employeeSetMembersResult, pauseTypesResult]
  const firstError = results.find((result) => result.error)
  if (firstError?.error) fail(firstError.error)

  const employees = (employeesResult.data ?? []) as EmployeeRow[]
  const organizations = (organizationsResult.data ?? []) as OrganizationRow[]
  const departments = (departmentsResult.data ?? []) as DepartmentRow[]
  const departmentNames = new Map(departments.map((row) => [row.id, row.name]))
  const employeeNames = new Map(employees.map((row) => [row.id, employeeName(row)]))
  const employeeById = new Map(employees.map((row) => [row.id, row]))
  const assignments: LeaveInsightsProfileAssignmentFact[] = (assignmentsResult.data ?? []).map((row) => ({ employmentId: row.employment_id, profileId: row.leave_profile_id, validFrom: row.valid_from, validUntil: row.valid_until }))
  const profiles: LeaveInsightsProfileFact[] = (profilesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, isActive: row.is_active, isGroupDefault: row.is_group_default }))
  const profileDefaults = new Set((profilesResult.data ?? []).filter((row) => row.is_group_default && row.is_active).map((row) => row.id))
  const employmentFacts: LeaveInsightsEmploymentFact[] = employmentRows.flatMap((row) => {
    const employee = employeeById.get(row.employee_id)
    if (!employee) return []
    const organization = latestOrganization(organizations, row.id, query.asOfDate)
    const profileAssignment = assignments.filter((assignment) => assignment.employmentId === row.id && activeOn(assignment.validFrom, assignment.validUntil, query.asOfDate)).sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0]
    const activeSet = (employeeSetMembersResult.data as EmployeeSetMemberRow[] | null ?? [])
      .filter((member) => member.employee_id === row.employee_id && activeOn(member.valid_from, member.valid_until, query.asOfDate))
      .map((member) => ({ member, set: (employeeSetsResult.data as EmployeeSetRow[] | null ?? []).find((candidate) => candidate.id === member.employee_set_id && candidate.is_active) }))
      .filter((candidate): candidate is { member: EmployeeSetMemberRow; set: EmployeeSetRow } => candidate.set !== undefined)
      .sort((left, right) => left.set.priority - right.set.priority || left.set.name.localeCompare(right.set.name) || left.set.id.localeCompare(right.set.id))[0]?.set
    const profileId = profileAssignment?.profileId ?? activeSet?.leave_profile_id ?? [...profileDefaults][0] ?? null
    const profileName = profileId ? profiles.find((profile) => profile.id === profileId)?.name ?? null : null
    return [{
      employeeId: row.employee_id,
      employeeNumber: employee.employee_number,
      employeeName: employeeName(employee),
      employmentId: row.id,
      employmentNumber: row.employment_number,
      administrationId: row.administration_id,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      departmentId: organization?.department_id ?? null,
      departmentName: organization ? departmentNames.get(organization.department_id) ?? null : null,
      managerId: organization?.direct_manager_id ?? null,
      managerName: organization?.direct_manager_id ? employeeNames.get(organization.direct_manager_id) ?? null : null,
      profileId,
      profileName,
      partTimeFactor: (() => {
        const schedule = (schedulesResult.data as ScheduleRow[] | null ?? [])
          .filter((candidate) => candidate.employment_id === row.id && activeOn(candidate.valid_from, candidate.valid_until, query.asOfDate))
          .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0]
        const factor = schedule?.part_time_factor
        return factor !== undefined && factor !== null && Number.isFinite(Number(factor)) ? Number(factor) : null
      })(),
      deletedAt: row.deleted_at,
    }]
  })
  const leaveTypes: LeaveInsightsLeaveTypeFact[] = (leaveTypesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, colorCode: row.color_code, entitlementMode: row.entitlement_mode, annualHoursCap: row.annual_hours_cap, annualHoursFteCap: row.annual_hours_fte_cap }))
  const rules: LeaveInsightsRuleFact[] = (rulesResult.data ?? []).map((row) => ({ id: row.id, profileId: row.leave_profile_id, leaveTypeId: row.leave_type_id, validFrom: row.valid_from, validUntil: row.valid_until, accrualBasis: row.accrual_basis, accrualFrequency: row.accrual_frequency, accrualTiming: row.accrual_timing, accrualAmount: row.accrual_amount, accrualRate: row.accrual_rate, expirationMonths: row.expiration_months }))
  const exceptions: LeaveInsightsExceptionFact[] = (exceptionsResult.data ?? []).map((row) => ({ employmentId: row.employment_id, leaveTypeId: row.leave_type_id, validFrom: row.valid_from, validUntil: row.valid_until, noAccrual: row.no_accrual, accrualAmount: row.accrual_amount, expirationMonths: row.expiration_months, reason: row.reason }))
  const buckets: LeaveInsightsBucketFact[] = (bucketsResult.data ?? []).map((row) => ({ id: row.id, employmentId: row.employment_id, leaveTypeId: row.leave_type_id, accrualYear: row.accrual_year, sourceAccrualYear: row.source_accrual_year, accrualReferenceDate: row.accrual_reference_date, expirationDate: row.expiration_date, cohortKey: row.cohort_key, totalAccrued: Number(row.total_accrued), totalTaken: Number(row.total_taken), totalExpired: Number(row.total_expired) }))
  const transactions: LeaveInsightsTransactionFact[] = (transactionsResult.data ?? []).map((row) => ({ id: row.id, employmentId: row.employment_id, leaveTypeId: row.leave_type_id, bucketId: row.bucket_id, transactionType: row.transaction_type, amount: Number(row.amount), transactionDate: row.transaction_date, reason: row.reason, actorUserId: row.actor_user_id, actorDisplayName: row.actor_display_name, sourceType: row.source_type, sourceKey: row.source_key, createdAt: row.created_at }))
  const requests: LeaveInsightsRequestFact[] = (requestsResult.data ?? []).map((row) => ({ id: row.id, employeeId: row.employee_id, employmentId: row.employment_id, requestMode: row.request_mode, timeMode: row.time_mode, startDate: row.start_date, endDate: row.end_date, specificStart: row.specific_start, specificEnd: row.specific_end, requestedMinutes: row.requested_minutes, status: row.status, priorityRuleId: row.priority_rule_id }))
  const requestIds = requests.map((request) => request.id)
  const allocationsResult = requestIds.length
    ? await supabase.from('leave_request_allocations').select('request_id,employment_id,leave_type_id,bucket_id,allocated_hours,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('request_id', requestIds).limit(30000)
    : { data: [], error: null }
  if (allocationsResult.error) fail(allocationsResult.error)
  const allocations: LeaveInsightsAllocationFact[] = (allocationsResult.data ?? []).map((row) => ({ requestId: row.request_id, employmentId: row.employment_id, leaveTypeId: row.leave_type_id, bucketId: row.bucket_id, allocatedHours: Number(row.allocated_hours), sortOrder: row.sort_order }))
  const schedules = (schedulesResult.data ?? []) as ScheduleRow[]
  const patterns = (patternsResult.data ?? []) as unknown as PatternRow[]
  const scheduleDays: LeaveInsightsScheduleDayFact[] = employmentFacts.flatMap((employment) => dateRange(query.periodStart, query.periodEnd).map((date) => scheduleDayForDate(patterns, schedules, employment.employmentId, date)))
  const scheduleDaysByEmployment = new Map<string, ReadonlyMap<string, LeaveProjectionScheduleDay>>()
  for (const employment of employmentFacts) {
    const days = scheduleDays.filter((day) => day.employmentId === employment.employmentId)
    scheduleDaysByEmployment.set(employment.employmentId, new Map(days.map((day) => [day.date, { date: day.date, scheduledMinutes: Math.round(day.scheduledHours * 60), isWorkingDay: day.isWorkingDay }])))
  }
  const projectedDays = projectApprovedLeave({
    requests: requests.map((request): LeaveProjectionRequest => ({ id: request.id, employeeId: request.employeeId, employmentId: request.employmentId, startDate: request.startDate, endDate: request.endDate, requestMode: request.requestMode, timeMode: request.timeMode, specificStart: request.specificStart, specificEnd: request.specificEnd, requestedMinutes: request.requestedMinutes, status: request.status })),
    allocations: allocations.map((allocation): LeaveProjectionAllocation => ({ requestId: allocation.requestId, leaveTypeId: allocation.leaveTypeId, allocatedHours: allocation.allocatedHours, sortOrder: allocation.sortOrder })),
    scheduleDaysByEmployment,
    holidayDates: new Set((holidaysResult.data ?? []).map((holiday) => holiday.holiday_date)),
  }).map((day): LeaveInsightsProjectedDayFact => ({ requestId: day.requestId, employeeId: day.employeeId, employmentId: day.employmentId, date: day.date, leaveTypeId: day.leaveTypeId, hours: day.hours, requestMode: day.requestMode, timeMode: day.timeMode }))
  const priorityRules: LeaveInsightsPriorityRuleFact[] = (priorityRulesResult.data ?? []).map((row) => ({ id: row.id, profileId: row.leave_profile_id, validFrom: row.valid_from, validUntil: row.valid_until, isActive: row.is_active }))
  const priorityItems: LeaveInsightsPriorityItemFact[] = (priorityItemsResult.data ?? []).map((row) => ({ priorityRuleId: row.priority_rule_id, leaveTypeId: row.leave_type_id, sortOrder: row.sort_order }))
  const yearControls = (controlsResult.data ?? []).map((row) => ({ administrationId: row.administration_id ?? administrationId, year: row.year, status: row.status }))
  const financialValuations = uniqueFinancialValuations((salariesResult.data ?? []) as SalaryRow[], query.asOfDate, new Set(employmentIds))
  const employeeSets: LeaveInsightsEmployeeSetFact[] = ((employeeSetsResult.data ?? []) as EmployeeSetRow[]).map((row) => ({ id: row.id, leaveProfileId: row.leave_profile_id, priority: row.priority, name: row.name, isActive: row.is_active }))
  const employeeSetMembers: LeaveInsightsEmployeeSetMemberFact[] = ((employeeSetMembersResult.data ?? []) as EmployeeSetMemberRow[]).map((row) => ({ employeeSetId: row.employee_set_id, employeeId: row.employee_id, validFrom: row.valid_from, validUntil: row.valid_until }))
  const rulePauseTypes: LeaveInsightsRulePauseTypeFact[] = ((pauseTypesResult.data ?? []) as PauseTypeRow[]).map((row) => ({ accrualRuleId: row.accrual_rule_id, pauseLeaveTypeId: row.pause_leave_type_id }))
  const absenceResult = context.permissions.includes('absence:read')
    ? await supabase.from('absence_cases').select('employment_id,first_absence_on,status,archived_at').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).eq('pending_confirmation', false).in('employment_id', employmentIds).lte('first_absence_on', query.periodEnd).limit(10000)
    : { data: [], error: null }
  if (absenceResult.error) fail(absenceResult.error)
  const absences: LeaveInsightsAbsenceFact[] = (absenceResult.data as AbsenceCaseRow[] | null ?? [])
    .filter((row) => row.archived_at === null)
    .map((row) => ({ employmentId: row.employment_id, firstAbsenceOn: row.first_absence_on, status: row.status }))
  const facts: LeaveInsightsFacts = { employments: employmentFacts, leaveTypes, profiles, employeeSets, employeeSetMembers, assignments, rules, rulePauseTypes, exceptions, buckets, transactions, requests, allocations, priorityRules, priorityItems, scheduleDays, projectedDays, holidays: new Set((holidaysResult.data ?? []).map((holiday) => holiday.holiday_date)), yearControls, financialValuations, absences }
  return calculateLeaveInsightsReport({ query, facts })
}

export function leaveInsightsView(value: string | null): LeaveInsightsView {
  return value === 'balances' || value === 'expiry' || value === 'usage' || value === 'capacity' || value === 'accrual' || value === 'mutations' || value === 'finance' || value === 'contract-end' || value === 'year-close' || value === 'exceptions' ? value : 'overview'
}

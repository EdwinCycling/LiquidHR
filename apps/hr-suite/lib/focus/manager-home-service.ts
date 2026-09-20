import 'server-only'

import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type FocusManagerTimeMode = 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'

export interface FocusManagerWeekRange {
  start: string
  end: string
}

export interface FocusManagerSickItem {
  employeeId: string
  employeeName: string
  firstAbsenceOn: string
  days: number
  pendingConfirmation: boolean
}

export interface FocusManagerVacationItem {
  employeeId: string
  employeeName: string
  startDate: string
  endDate: string
  overlapStartDate: string
  timeMode: FocusManagerTimeMode
  specificStart: string | null
  specificEnd: string | null
}

export interface FocusManagerHomeData {
  weekStart: string
  weekEnd: string
  sick: FocusManagerSickItem[]
  vacation: FocusManagerVacationItem[]
  vacationTotal: number
}

export interface FocusManagerSickCandidate {
  employeeId: string
  employeeName: string
  status: string
  firstAbsenceOn: string
  pendingConfirmation: boolean
}

export interface FocusManagerVacationCandidate {
  id: string
  employeeId: string
  employeeName: string
  startDate: string
  endDate: string
  timeMode: FocusManagerTimeMode
  specificStart: string | null
  specificEnd: string | null
}

export interface FocusManagerVacationAllocation {
  requestId: string
  leaveTypeId: string
}

export interface FocusManagerLeaveType {
  id: string
  family: 'VACATION' | 'OTHER'
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function mondayWeekRange(today: string): FocusManagerWeekRange {
  const date = new Date(`${today}T00:00:00.000Z`)
  const day = date.getUTCDay() || 7
  const monday = addDays(today, 1 - day)
  return { start: monday, end: addDays(monday, 6) }
}

export function inclusiveCalendarDays(startDate: string, endDate: string): number {
  if (startDate > endDate) return 0
  const start = Date.parse(`${startDate}T00:00:00.000Z`)
  const end = Date.parse(`${endDate}T00:00:00.000Z`)
  return Math.floor((end - start) / 86_400_000) + 1
}

export function selectSickItems(
  candidates: readonly FocusManagerSickCandidate[],
  today: string,
): FocusManagerSickItem[] {
  const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })
  return candidates
    .filter((candidate) => candidate.status === 'ACTIVE' && candidate.firstAbsenceOn <= today)
    .map((candidate) => ({
      employeeId: candidate.employeeId,
      employeeName: candidate.employeeName,
      firstAbsenceOn: candidate.firstAbsenceOn,
      days: inclusiveCalendarDays(candidate.firstAbsenceOn, today),
      pendingConfirmation: candidate.pendingConfirmation,
    }))
    .sort((left, right) => collator.compare(left.employeeName, right.employeeName) || left.firstAbsenceOn.localeCompare(right.firstAbsenceOn))
}

export function selectVacationItems(input: {
  candidates: readonly FocusManagerVacationCandidate[]
  allocations: readonly FocusManagerVacationAllocation[]
  leaveTypes: readonly FocusManagerLeaveType[]
  week: FocusManagerWeekRange
}): FocusManagerVacationItem[] {
  const vacationTypeIds = new Set(input.leaveTypes.filter((type) => type.family === 'VACATION').map((type) => type.id))
  const vacationRequestIds = new Set(input.allocations.filter((allocation) => vacationTypeIds.has(allocation.leaveTypeId)).map((allocation) => allocation.requestId))
  const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })

  return input.candidates
    .filter((candidate) => vacationRequestIds.has(candidate.id) && candidate.startDate <= input.week.end && candidate.endDate >= input.week.start)
    .map((candidate) => ({
      employeeId: candidate.employeeId,
      employeeName: candidate.employeeName,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      overlapStartDate: candidate.startDate < input.week.start ? input.week.start : candidate.startDate,
      timeMode: candidate.timeMode,
      specificStart: candidate.specificStart,
      specificEnd: candidate.specificEnd,
    }))
    .sort((left, right) => left.overlapStartDate.localeCompare(right.overlapStartDate) || collator.compare(left.employeeName, right.employeeName))
}

function emptyManagerHome(week: FocusManagerWeekRange): FocusManagerHomeData {
  return { weekStart: week.start, weekEnd: week.end, sick: [], vacation: [], vacationTotal: 0 }
}

export async function loadFocusManagerHomeForContext(
  context: AuthContext,
  today: string,
  existingClient?: SupabaseServerClient,
): Promise<FocusManagerHomeData> {
  const week = mondayWeekRange(today)
  if (!context.administrationId || !context.hrGroupId) return emptyManagerHome(week)

  const supabase = existingClient ?? await createClient()
  const hrGroupId = requireHrGroupId(context)
  const employeeIds = await listDirectTeamEmployeeIds(context, supabase)
  if (employeeIds.length === 0) return emptyManagerHome(week)

  const [employeesResult, absenceCasesResult, leaveRequestsResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id,first_name,birth_name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .in('id', employeeIds)
      .is('deleted_at', null)
      .limit(1000),
    supabase
      .from('absence_cases')
      .select('employee_id,status,first_absence_on,pending_confirmation')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('administration_id', context.administrationId)
      .in('employee_id', employeeIds)
      .eq('status', 'ACTIVE')
      .is('archived_at', null)
      .lte('first_absence_on', today)
      .limit(3000),
    supabase
      .from('leave_requests')
      .select('id,employee_id,start_date,end_date,time_mode,specific_start,specific_end')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('administration_id', context.administrationId)
      .eq('status', 'APPROVED')
      .in('employee_id', employeeIds)
      .lte('start_date', week.end)
      .gte('end_date', week.start)
      .limit(5000),
  ])
  if (employeesResult.error) throw employeesResult.error
  if (absenceCasesResult.error) throw absenceCasesResult.error
  if (leaveRequestsResult.error) throw leaveRequestsResult.error

  const employeeNames = new Map((employeesResult.data ?? []).map((employee) => [employee.id, `${employee.first_name} ${employee.birth_name}`.trim()]))
  const leaveRequests = (leaveRequestsResult.data ?? []).flatMap((request): FocusManagerVacationCandidate[] => {
    const employeeName = employeeNames.get(request.employee_id)
    return employeeName ? [{
      id: request.id,
      employeeId: request.employee_id,
      employeeName,
      startDate: request.start_date,
      endDate: request.end_date,
      timeMode: request.time_mode,
      specificStart: request.specific_start,
      specificEnd: request.specific_end,
    }] : []
  })
  const requestIds = leaveRequests.map((request) => request.id)
  const allocationsResult = requestIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('leave_request_allocations')
      .select('request_id,leave_type_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('administration_id', context.administrationId)
      .in('request_id', requestIds)
      .limit(10000)
  if (allocationsResult.error) throw allocationsResult.error
  const allocationRows = allocationsResult.data ?? []
  const allocationTypeIds = [...new Set(allocationRows.map((allocation) => allocation.leave_type_id))]
  const resolvedLeaveTypes = requestIds.length === 0 || allocationTypeIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('leave_types')
      .select('id,family')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .in('id', allocationTypeIds)
      .limit(1000)
  if (resolvedLeaveTypes.error) throw resolvedLeaveTypes.error
  const allocations = allocationRows.map((allocation) => ({ requestId: allocation.request_id, leaveTypeId: allocation.leave_type_id }))

  const sick = selectSickItems((absenceCasesResult.data ?? []).map((row) => ({
    employeeId: row.employee_id,
    employeeName: employeeNames.get(row.employee_id) ?? row.employee_id,
    status: row.status,
    firstAbsenceOn: row.first_absence_on,
    pendingConfirmation: row.pending_confirmation,
  })), today)
  const vacation = selectVacationItems({
    candidates: leaveRequests,
    allocations,
    leaveTypes: resolvedLeaveTypes.data ?? [],
    week,
  })
  return { weekStart: week.start, weekEnd: week.end, sick, vacation, vacationTotal: vacation.length }
}

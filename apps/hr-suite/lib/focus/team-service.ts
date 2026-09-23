import 'server-only'

import { getRequestAuthorizationContext, requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type FocusTeamCellStatus = 'PRESENT' | 'ABSENT' | 'AVAILABLE' | 'OFF' | 'LEAVE'
export type FocusTeamViewerMode = 'EMPLOYEE' | 'MANAGER'

export interface FocusTeamCalendarCell {
  date: string
  status: FocusTeamCellStatus
  scheduledMinutes: number
}

export interface FocusTeamCalendarMember {
  employeeId: string
  employeeName: string
  avatarUrl: string | null
  employmentId: string | null
  activeAbsenceCaseId: string | null
  cells: FocusTeamCalendarCell[]
}

export interface FocusTeamCalendar {
  month: string
  dates: string[]
  selectedDate: string
  members: FocusTeamCalendarMember[]
  viewerMode: FocusTeamViewerMode
  canReportAbsence: boolean
  canRecoverAbsence: boolean
  canActAs: boolean
}

function validMonth(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7)
}

function calendarDates(month: string): string[] {
  const first = new Date(`${month}-01T00:00:00.000Z`)
  const mondayOffset = (first.getUTCDay() + 6) % 7
  first.setUTCDate(first.getUTCDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first)
    date.setUTCDate(first.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

function validSelectedDate(value: string | undefined, month: string, dates: readonly string[]): string {
  if (value && dates.includes(value) && value.startsWith(month)) return value
  const today = new Date().toISOString().slice(0, 10)
  if (today.startsWith(month) && dates.includes(today)) return today
  return `${month}-01`
}

function activeOn(date: string, startsOn: string, endsOn: string | null): boolean {
  return startsOn <= date && (endsOn === null || endsOn >= date)
}

function legacyScheduledMinutes(schedule: {
  sunday_hours: number | null
  monday_hours: number | null
  tuesday_hours: number | null
  wednesday_hours: number | null
  thursday_hours: number | null
  friday_hours: number | null
  saturday_hours: number | null
}, date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  const hours = [schedule.sunday_hours, schedule.monday_hours, schedule.tuesday_hours, schedule.wednesday_hours, schedule.thursday_hours, schedule.friday_hours, schedule.saturday_hours][day] ?? 0
  return Math.max(0, Math.round(Number(hours) * 60))
}

async function employeeIdsForViewer(context: AuthContext, subjectEmployeeId?: string, supabase?: SupabaseServerClient): Promise<string[]> {
  const client = supabase ?? await createClient()
  const groupId = requireHrGroupId(context)
  if (subjectEmployeeId && subjectEmployeeId !== context.employeeId) {
    const team = await client.from('employee_organizations').select('employee_id').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).eq('direct_manager_id', subjectEmployeeId).limit(500)
    if (team.error) throw team.error
    return [...new Set([subjectEmployeeId, ...team.data.map((row) => row.employee_id)])]
  }
  if (context.activeRoles.includes('DIRECT_MANAGER') && !context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')) {
    const directIds = await listDirectTeamEmployeeIds(context, client)
    return [...new Set([...(context.employeeId ? [context.employeeId] : []), ...directIds])]
  }
  if (context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN') || context.permissions.includes('organization-chart:read')) {
    const result = await client.from('employees').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).limit(1000)
    if (result.error) throw result.error
    return result.data.map((row) => row.id)
  }
  return context.employeeId ? [context.employeeId] : []
}

export async function listFocusManagerEmployeeIds(context: AuthContext, supabase?: SupabaseServerClient): Promise<string[]> {
  return employeeIdsForViewer(context, undefined, supabase)
}

export async function loadFocusTeamCalendar(monthInput?: string, options?: { subjectEmployeeId?: string; privacyMode?: FocusTeamViewerMode; selectedDate?: string }): Promise<FocusTeamCalendar> {
  const requestContext = await getRequestAuthorizationContext()
  return loadFocusTeamCalendarForContext(requestContext.context, monthInput, { ...options, supabase: requestContext.supabase })
}

export async function loadFocusTeamCalendarForContext(
  context: AuthContext,
  monthInput?: string,
  options?: { subjectEmployeeId?: string; privacyMode?: FocusTeamViewerMode; selectedDate?: string; supabase?: SupabaseServerClient },
): Promise<FocusTeamCalendar> {
  const month = validMonth(monthInput)
  const dates = calendarDates(month)
  const selectedDate = validSelectedDate(options?.selectedDate, month, dates)
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]
  const supabase = options?.supabase ?? await createClient()
  const groupId = requireHrGroupId(context)
  const viewerMode = options?.privacyMode ?? (context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN' || role === 'DIRECT_MANAGER') ? 'MANAGER' : 'EMPLOYEE')
  const employeeIds = await employeeIdsForViewer(context, options?.subjectEmployeeId, supabase)
  const empty: FocusTeamCalendar = { month, dates, selectedDate, members: [], viewerMode, canReportAbsence: viewerMode === 'MANAGER' && context.permissions.includes('absence:write'), canRecoverAbsence: viewerMode === 'MANAGER' && context.permissions.includes('absence:recover'), canActAs: context.permissions.includes('focus:act-as-employee') }
  if (!employeeIds.length) return empty

  const [employeesResult, employmentsResult] = await Promise.all([
    supabase.from('employees').select('id,first_name,birth_name,avatar_url').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).in('id', employeeIds).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).limit(1000),
    supabase.from('employments').select('id,employee_id,starts_on,ends_on,is_primary').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).in('employee_id', employeeIds).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', endDate).or(`ends_on.is.null,ends_on.gte.${startDate}`).limit(3000),
  ])
  if (employeesResult.error) throw employeesResult.error
  if (employmentsResult.error) throw employmentsResult.error
  const employments = employmentsResult.data ?? []
  const employmentIds = employments.map((employment) => employment.id)
  const [schedulesResult, leaveResult, absenceCasesResult] = await Promise.all([
    employmentIds.length ? supabase.from('employment_schedules').select('employment_id,valid_from,valid_until,sunday_hours,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours').in('employment_id', employmentIds).lte('valid_from', endDate).or(`valid_until.is.null,valid_until.gte.${startDate}`).limit(5000) : Promise.resolve({ data: [], error: null }),
    supabase.from('leave_requests').select('employee_id,start_date,end_date').eq('tenant_id', context.tenantId).in('status', ['PENDING', 'CHANGES_REQUESTED', 'APPROVED']).in('employee_id', employeeIds).lte('start_date', endDate).gte('end_date', startDate).limit(10000),
    supabase.from('absence_cases').select('id,employee_id,status,pending_confirmation').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).in('employee_id', employeeIds).in('status', ['ACTIVE', 'RECOVERY_WINDOW']).is('archived_at', null).lte('first_absence_on', endDate).limit(3000),
  ])
  if (schedulesResult.error || leaveResult.error || absenceCasesResult.error) throw schedulesResult.error ?? leaveResult.error ?? absenceCasesResult.error
  const absenceCases = absenceCasesResult.data ?? []
  const spellsResult = absenceCases.length ? await supabase.from('absence_spells').select('case_id,started_on,recovered_on').eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).in('case_id', absenceCases.map((row) => row.id)).lte('started_on', endDate).limit(5000) : { data: [], error: null }
  if (spellsResult.error) throw spellsResult.error

  const employmentsByEmployee = new Map<string, typeof employments>()
  for (const employment of employments) employmentsByEmployee.set(employment.employee_id, [...(employmentsByEmployee.get(employment.employee_id) ?? []), employment])
  const schedulesByEmployment = new Map<string, NonNullable<typeof schedulesResult.data>>()
  for (const schedule of schedulesResult.data ?? []) schedulesByEmployment.set(schedule.employment_id, [...(schedulesByEmployment.get(schedule.employment_id) ?? []), schedule])
  const absenceEmployeeByCase = new Map(absenceCases.map((row) => [row.id, row.employee_id]))
  const confirmedAbsenceCaseIds = new Set(absenceCases.filter((row) => !row.pending_confirmation).map((row) => row.id))
  const openActiveAbsenceCaseIds = new Set(
    (spellsResult.data ?? [])
      .filter((spell) => spell.recovered_on === null && confirmedAbsenceCaseIds.has(spell.case_id))
      .map((spell) => spell.case_id),
  )
  const absenceSpells = (spellsResult.data ?? []).flatMap((spell) => {
    const employeeId = absenceEmployeeByCase.get(spell.case_id)
    return employeeId ? [{ employeeId, startedOn: spell.started_on, recoveredOn: spell.recovered_on }] : []
  })
  const leaveRequests = leaveResult.data ?? []
  const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })
  const employees = [...(employeesResult.data ?? [])].sort((left, right) => collator.compare(`${left.first_name} ${left.birth_name}`, `${right.first_name} ${right.birth_name}`))
  const members = employees.map((employee): FocusTeamCalendarMember => {
    const employeeEmployments = employmentsByEmployee.get(employee.id) ?? []
    const cells = dates.map((date): FocusTeamCalendarCell => {
      const employment = [...employeeEmployments].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || right.starts_on.localeCompare(left.starts_on)).find((item) => activeOn(date, item.starts_on, item.ends_on))
      const schedule = employment ? (schedulesByEmployment.get(employment.id) ?? []).find((item) => activeOn(date, item.valid_from, item.valid_until)) : undefined
      const scheduledMinutes = schedule ? legacyScheduledMinutes(schedule, date) : 0
      const isAbsent = absenceSpells.some((spell) => spell.employeeId === employee.id && spell.startedOn <= date && (spell.recoveredOn === null || spell.recoveredOn >= date))
      const isOnLeave = leaveRequests.some((leave) => leave.employee_id === employee.id && leave.start_date <= date && leave.end_date >= date)
      const detailedStatus: FocusTeamCellStatus = isAbsent ? 'ABSENT' : isOnLeave ? 'LEAVE' : scheduledMinutes > 0 ? 'AVAILABLE' : 'OFF'
      return { date, status: viewerMode === 'EMPLOYEE' ? (detailedStatus === 'ABSENT' ? 'ABSENT' : 'PRESENT') : detailedStatus, scheduledMinutes }
    })
    return { employeeId: employee.id, employeeName: `${employee.first_name} ${employee.birth_name}`.trim(), avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url), employmentId: employeeEmployments.find((item) => activeOn(selectedDate, item.starts_on, item.ends_on))?.id ?? null, activeAbsenceCaseId: absenceCases.find((item) => item.employee_id === employee.id && item.status === 'ACTIVE' && openActiveAbsenceCaseIds.has(item.id))?.id ?? null, cells }
  })
  return { ...empty, members }
}

import 'server-only'

import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { getEmployeeDirectoryDetail, type EmployeeDirectoryDetail } from '@/lib/employee-directory/service'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'
import { getPatternDay, type WorkPatternDay } from '@/lib/work-patterns/work-pattern-model'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type TeamAvailabilityStatus = 'AVAILABLE' | 'OFF' | 'LEAVE' | 'ABSENT'

export interface StartPageTeamAvailabilityCell {
  status: TeamAvailabilityStatus
  scheduledMinutes: number
}

export interface StartPageTeamAvailabilityMember {
  employeeId: string
  employeeName: string
  avatarUrl: string | null
  cells: StartPageTeamAvailabilityCell[]
}

export interface StartPageTeamAvailability {
  dates: string[]
  members: StartPageTeamAvailabilityMember[]
}

interface AvailabilityDateRange {
  dates: string[]
  startDate: string
  endDate: string
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function availabilityDateRange(): AvailabilityDateRange {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return isoDate(date)
  })
  return { dates, startDate: dates[0], endDate: dates[dates.length - 1] }
}

function isActiveOn(date: string, startsOn: string, endsOn: string | null): boolean {
  return startsOn <= date && (endsOn === null || endsOn >= date)
}

function scheduledMinutesFromLegacySchedule(schedule: {
  sunday_hours: number | null
  monday_hours: number | null
  tuesday_hours: number | null
  wednesday_hours: number | null
  thursday_hours: number | null
  friday_hours: number | null
  saturday_hours: number | null
}, date: string): number {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  const hours = [schedule.sunday_hours, schedule.monday_hours, schedule.tuesday_hours, schedule.wednesday_hours, schedule.thursday_hours, schedule.friday_hours, schedule.saturday_hours][weekday] ?? 0
  return Math.max(0, Math.round(Number(hours) * 60))
}

export async function loadTeamAvailability(auth: AuthContext, requestedTeamEmployeeIds?: string[], existingClient?: SupabaseServerClient): Promise<StartPageTeamAvailability> {
  const range = availabilityDateRange()
  const teamEmployeeIds = requestedTeamEmployeeIds ?? await listDirectTeamEmployeeIds(auth, existingClient)
  const empty = { dates: range.dates, members: [] }
  if (!auth.administrationId || !teamEmployeeIds.length) return empty

  try {
    const supabase = existingClient ?? await createClient()
    const hrGroupId = requireHrGroupId(auth)
    const [employeesResult, employmentsResult] = await Promise.all([
      supabase.from('employees').select('id,first_name,birth_name,avatar_url').eq('tenant_id', auth.tenantId).in('id', teamEmployeeIds).eq('is_archived', false).is('deleted_at', null).limit(500),
      supabase.from('employments').select('id,employee_id,starts_on,ends_on,is_primary').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('record_status', 'CONFIRMED').is('deleted_at', null).in('employee_id', teamEmployeeIds).lte('starts_on', range.endDate).or(`ends_on.is.null,ends_on.gte.${range.startDate}`).order('starts_on', { ascending: false }).limit(1000),
    ])
    if (employeesResult.error || employmentsResult.error) return empty

    const employments = employmentsResult.data ?? []
    const employmentIds = employments.map((employment) => employment.id)
    const [patternsResult, schedulesResult, leaveResult, absenceCasesResult] = await Promise.all([
      employmentIds.length
        ? supabase.from('employment_work_patterns').select('id,employee_id,employment_id,cycle_weeks,anchor_date,valid_from,valid_until,employment_work_pattern_days(week_index,iso_weekday,is_working_day,starts_at,ends_at,break_minutes,scheduled_minutes,note)').in('employment_id', employmentIds).lte('valid_from', range.endDate).or(`valid_until.is.null,valid_until.gte.${range.startDate}`).order('valid_from', { ascending: false }).limit(2000)
        : Promise.resolve({ data: [], error: null }),
      employmentIds.length
        ? supabase.from('employment_schedules').select('employment_id,valid_from,valid_until,sunday_hours,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours').in('employment_id', employmentIds).lte('valid_from', range.endDate).or(`valid_until.is.null,valid_until.gte.${range.startDate}`).order('valid_from', { ascending: false }).limit(2000)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('leave_requests').select('employee_id,start_date,end_date').eq('tenant_id', auth.tenantId).eq('administration_id', auth.administrationId).eq('status', 'APPROVED').in('employee_id', teamEmployeeIds).lte('start_date', range.endDate).gte('end_date', range.startDate).limit(5000),
      supabase.from('absence_cases').select('id,employee_id').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('employee_id', teamEmployeeIds).in('status', ['ACTIVE', 'RECOVERY_WINDOW']).is('archived_at', null).lte('first_absence_on', range.endDate).limit(2000),
    ])
    if (patternsResult.error || schedulesResult.error || leaveResult.error || absenceCasesResult.error) return empty

    const absenceCases = absenceCasesResult.data ?? []
    const absenceSpellsResult = absenceCases.length
      ? await supabase.from('absence_spells').select('case_id,started_on,recovered_on').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('case_id', absenceCases.map((item) => item.id)).is('recovered_on', null).lte('started_on', range.endDate).limit(3000)
      : { data: [], error: null }
    if (absenceSpellsResult.error) return empty

    const absenceEmployeeByCaseId = new Map(absenceCases.map((item) => [item.id, item.employee_id]))
    const absenceSpells = (absenceSpellsResult.data ?? []).flatMap((spell) => {
      const employeeId = absenceEmployeeByCaseId.get(spell.case_id)
      return employeeId ? [{ employeeId, startedOn: spell.started_on, recoveredOn: spell.recovered_on }] : []
    })
    const employmentsByEmployee = new Map<string, typeof employments>()
    for (const employment of employments) employmentsByEmployee.set(employment.employee_id, [...(employmentsByEmployee.get(employment.employee_id) ?? []), employment])
    const patternsByEmployment = new Map<string, NonNullable<typeof patternsResult.data>>()
    for (const pattern of patternsResult.data ?? []) patternsByEmployment.set(pattern.employment_id, [...(patternsByEmployment.get(pattern.employment_id) ?? []), pattern])
    const schedulesByEmployment = new Map<string, NonNullable<typeof schedulesResult.data>>()
    for (const schedule of schedulesResult.data ?? []) schedulesByEmployment.set(schedule.employment_id, [...(schedulesByEmployment.get(schedule.employment_id) ?? []), schedule])
    const leaveRequests = leaveResult.data ?? []
    const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })
    const employees = [...(employeesResult.data ?? [])].sort((left, right) => collator.compare([left.first_name, left.birth_name].filter(Boolean).join(' '), [right.first_name, right.birth_name].filter(Boolean).join(' ')))
    const directorySchedulesByEmployee = new Map<string, NonNullable<EmployeeDirectoryDetail['schedule']>>()
    const employeesNeedingRosterFallback = employees.filter((employee) => {
      const employeeEmploymentIds = (employmentsByEmployee.get(employee.id) ?? []).map((employment) => employment.id)
      return !employeeEmploymentIds.some((employmentId) => (patternsByEmployment.get(employmentId)?.length ?? 0) > 0 || (schedulesByEmployment.get(employmentId)?.length ?? 0) > 0)
    })
    await Promise.all(employeesNeedingRosterFallback.map(async (employee) => {
      try {
        const detail = await getEmployeeDirectoryDetail(employee.id, { context: auth, supabase })
        if (detail.schedule?.length) directorySchedulesByEmployee.set(employee.id, detail.schedule)
      } catch {
        // De startpagina blijft bruikbaar als de bestaande directoryprojectie niet beschikbaar is.
      }
    }))

    return {
      dates: range.dates,
      members: employees.map((employee) => {
        const employeeEmployments = employmentsByEmployee.get(employee.id) ?? []
        const cells = range.dates.map((date): StartPageTeamAvailabilityCell => {
          const employment = [...employeeEmployments].sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || right.starts_on.localeCompare(left.starts_on)).find((item) => isActiveOn(date, item.starts_on, item.ends_on))
          const pattern = employment
            ? (patternsByEmployment.get(employment.id) ?? []).find((item) => isActiveOn(date, item.valid_from, item.valid_until))
            : undefined
          const projected = pattern
            ? getPatternDay({ anchorDate: pattern.anchor_date, cycleWeeks: pattern.cycle_weeks, days: pattern.employment_work_pattern_days.map((day): WorkPatternDay => ({ weekIndex: day.week_index, isoWeekday: day.iso_weekday, isWorkingDay: day.is_working_day, startsAt: day.starts_at, endsAt: day.ends_at, breakMinutes: day.break_minutes, scheduledMinutes: day.scheduled_minutes, note: day.note })) }, date)
            : null
          const legacySchedule = employment
            ? (schedulesByEmployment.get(employment.id) ?? []).find((item) => isActiveOn(date, item.valid_from, item.valid_until))
            : undefined
          const directorySchedule = directorySchedulesByEmployee.get(employee.id)
          const isoWeekday = new Date(`${date}T00:00:00.000Z`).getUTCDay() || 7
          const directoryDay = directorySchedule?.find((day) => day.isoWeekday === isoWeekday)
          const scheduledMinutes = projected
            ? projected.isWorkingDay ? Math.max(0, projected.scheduledMinutes) : 0
            : legacySchedule ? scheduledMinutesFromLegacySchedule(legacySchedule, date) : directoryDay?.isWorkingDay ? Math.max(0, directoryDay.scheduledMinutes) : 0
          const hasLeave = leaveRequests.some((request) => request.employee_id === employee.id && request.start_date <= date && request.end_date >= date)
          const hasAbsence = absenceSpells.some((spell) => spell.employeeId === employee.id && spell.startedOn <= date && (spell.recoveredOn === null || spell.recoveredOn >= date))
          const status: TeamAvailabilityStatus = hasAbsence ? 'ABSENT' : hasLeave ? 'LEAVE' : scheduledMinutes > 0 ? 'AVAILABLE' : 'OFF'
          return { status, scheduledMinutes }
        })
        return { employeeId: employee.id, employeeName: [employee.first_name, employee.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ').trim() || 'Onbekende medewerker', avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url), cells }
      }),
    }
  } catch {
    return empty
  }
}

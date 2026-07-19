import 'server-only'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { buildMonthDays } from './calendar-model'
import { getPatternDay, type WorkPatternDay } from '@/lib/work-patterns/work-pattern-model'
import { listCalendarHrEvents } from '@/lib/hr-events/service'
import { employeeAvatarHref } from '@/lib/employees/employee-service'

export type CalendarWorkDay = { isWorkingDay: boolean; startsAt: string | null; endsAt: string | null; scheduledMinutes: number }
export type CalendarReminder = { id: string; employeeId: string | null; date: string; title: string }
export interface CalendarJobGroupOption { id: string; code: string; name: string }
export interface CalendarJobOption { id: string; code: string; name: string; jobGroupId: string | null }

export async function loadUnifiedCalendar(month: string) {
  const auth = await requirePermission('hr-calendar:read')
  if (!auth.administrationId) throw new Error('ADMINISTRATION_REQUIRED')
  const administrationId = auth.administrationId
  const days = buildMonthDays(month)
  const from = days[0]
  const toDate = new Date(`${from}T00:00:00.000Z`); toDate.setUTCMonth(toDate.getUTCMonth() + 1); const to = toDate.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const referenceDate = from <= today && today < to ? today : from
  const supabase = await createClient()
  const employmentsResult = await supabase.from('employments').select('id,employee_id').eq('administration_id', administrationId).is('deleted_at', null).lt('starts_on', to).or(`ends_on.is.null,ends_on.gte.${from}`).limit(2000)
  if (employmentsResult.error) throw new Error('HR_CALENDAR_EMPLOYMENTS_FAILED')
  const employments = employmentsResult.data ?? []
  const employeeIds = [...new Set(employments.map((employment) => employment.employee_id))]
  const employmentIds = employments.map((employment) => employment.id)
  const empty = { employees: [], departments: [], holidays: [], reminders: [], generalReminders: [], events: [], jobGroups: [], jobs: [] }
  if (!employeeIds.length) return empty

  const [employeesResult, organizationsResult, departmentsResult, patternsResult, holidaysResult, recipientsResult, generalResult, hrData] = await Promise.all([
    supabase.from('employees').select('id,employee_number,first_name,birth_name,avatar_url,is_archived').in('id', employeeIds).eq('is_archived', false).order('birth_name').limit(2000),
    supabase.from('employee_organizations').select('employee_id,department_id,job_id,job_title,effective_from').in('employee_id', employeeIds).eq('administration_id', administrationId).lte('effective_from', to).or(`effective_to.is.null,effective_to.gte.${from}`).order('effective_from', { ascending: false }).limit(4000),
    supabase.from('departments').select('id,code,name').eq('administration_id', administrationId).eq('is_active', true).order('code').limit(500),
    supabase.from('employment_work_patterns').select('id,employee_id,employment_id,name,cycle_weeks,anchor_date,average_minutes_per_week,valid_from,valid_until,employment_work_pattern_days(week_index,iso_weekday,is_working_day,starts_at,ends_at,break_minutes,scheduled_minutes,note)').in('employment_id', employmentIds).lt('valid_from', to).or(`valid_until.is.null,valid_until.gte.${from}`).order('valid_from', { ascending: false }).limit(2000),
    supabase.from('holidays').select('id,holiday_date,display_name,provider_name,source').eq('administration_id', administrationId).eq('is_active', true).gte('holiday_date', from).lt('holiday_date', to).order('holiday_date').limit(400),
    supabase.from('reminder_recipients').select('id,employee_id,effective_remind_at,reminder_id').not('employee_id', 'is', null).gte('effective_remind_at', `${from}T00:00:00Z`).lt('effective_remind_at', `${to}T00:00:00Z`).limit(5000),
    supabase.from('reminders').select('id,title,remind_at').eq('administration_id', administrationId).eq('status', 'PUBLISHED').eq('target_type', 'EVERYONE').gte('remind_at', `${from}T00:00:00Z`).lt('remind_at', `${to}T00:00:00Z`).limit(500),
    listCalendarHrEvents(month),
  ])
  const failed = [employeesResult, organizationsResult, departmentsResult, patternsResult, holidaysResult, recipientsResult, generalResult].find((result) => result.error)
  if (failed?.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const latestOrganizationByEmployee = new Map<string, NonNullable<typeof organizationsResult.data>[number]>()
  for (const organization of organizationsResult.data ?? []) {
    if (!latestOrganizationByEmployee.has(organization.employee_id)) latestOrganizationByEmployee.set(organization.employee_id, organization)
  }
  const jobIds = [...new Set((organizationsResult.data ?? []).flatMap((organization) => organization.job_id ? [organization.job_id] : []))]
  const jobsResult = jobIds.length
    ? await supabase.from('jobs').select('id,job_group_id,code').eq('administration_id', administrationId).in('id', jobIds).limit(2000)
    : { data: [], error: null }
  if (jobsResult.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const jobGroupIds = [...new Set((jobsResult.data ?? []).map((job) => job.job_group_id))]
  const [jobRevisionsResult, jobGroupsResult] = await Promise.all([
    jobIds.length
      ? supabase.from('job_revisions').select('job_id,name,valid_from,valid_until').eq('administration_id', administrationId).in('job_id', jobIds).lte('valid_from', referenceDate).or(`valid_until.is.null,valid_until.gt.${referenceDate}`).order('valid_from', { ascending: false }).limit(4000)
      : Promise.resolve({ data: [], error: null }),
    jobGroupIds.length
      ? supabase.from('job_groups').select('id,code,name').eq('administration_id', administrationId).in('id', jobGroupIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (jobRevisionsResult.error || jobGroupsResult.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const reminderIds = [...new Set((recipientsResult.data ?? []).map((recipient) => recipient.reminder_id))]
  const remindersResult = reminderIds.length ? await supabase.from('reminders').select('id,title').in('id', reminderIds).limit(5000) : { data: [], error: null }
  if (remindersResult.error) throw new Error('HR_CALENDAR_REMINDERS_FAILED')
  const reminderTitle = new Map((remindersResult.data ?? []).map((reminder) => [reminder.id, reminder.title]))
  const departmentByEmployee = new Map<string, string>()
  for (const organization of organizationsResult.data ?? []) if (!departmentByEmployee.has(organization.employee_id)) departmentByEmployee.set(organization.employee_id, organization.department_id)
  const jobById = new Map((jobsResult.data ?? []).map((job) => [job.id, job]))
  const jobGroupById = new Map((jobGroupsResult.data ?? []).map((group) => [group.id, group]))
  const latestJobRevisionByJobId = new Map<string, string>()
  for (const revision of jobRevisionsResult.data ?? []) {
    if (!latestJobRevisionByJobId.has(revision.job_id)) latestJobRevisionByJobId.set(revision.job_id, revision.name)
  }
  const patternsByEmployee = new Map<string, NonNullable<typeof patternsResult.data>>()
  for (const pattern of patternsResult.data ?? []) patternsByEmployee.set(pattern.employee_id, [...(patternsByEmployee.get(pattern.employee_id) ?? []), pattern])
  const employees = (employeesResult.data ?? []).map((employee) => {
    const organization = latestOrganizationByEmployee.get(employee.id)
    const job = organization?.job_id ? jobById.get(organization.job_id) : undefined
    const jobGroup = job?.job_group_id ? jobGroupById.get(job.job_group_id) : undefined
    const patterns = patternsByEmployee.get(employee.id) ?? []
    const workDays: Record<string, CalendarWorkDay> = {}
    for (const date of days) {
      const pattern = patterns.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until > date))
      if (!pattern) continue
      const projected = getPatternDay({ anchorDate: pattern.anchor_date, cycleWeeks: pattern.cycle_weeks, days: pattern.employment_work_pattern_days.map((day): WorkPatternDay => ({ weekIndex: day.week_index, isoWeekday: day.iso_weekday, isWorkingDay: day.is_working_day, startsAt: day.starts_at, endsAt: day.ends_at, breakMinutes: day.break_minutes, scheduledMinutes: day.scheduled_minutes, note: day.note })) }, date)
      if (projected) workDays[date] = { isWorkingDay: projected.isWorkingDay, startsAt: projected.startsAt, endsAt: projected.endsAt, scheduledMinutes: projected.scheduledMinutes }
    }
    return {
      ...employee,
      avatar_url: employeeAvatarHref(employee.id, employee.avatar_url),
      departmentId: departmentByEmployee.get(employee.id) ?? null,
      averageMinutesPerWeek: patterns[0]?.average_minutes_per_week ?? 0,
      jobId: organization?.job_id ?? null,
      jobName: organization?.job_id ? (latestJobRevisionByJobId.get(organization.job_id) ?? organization.job_title ?? job?.code ?? null) : (organization?.job_title ?? null),
      jobGroupId: job?.job_group_id ?? null,
      jobGroupName: jobGroup?.name ?? null,
      workDays,
    }
  })
  const reminders: CalendarReminder[] = (recipientsResult.data ?? []).flatMap((recipient) => recipient.employee_id ? [{ id: recipient.id, employeeId: recipient.employee_id, date: recipient.effective_remind_at.slice(0, 10), title: reminderTitle.get(recipient.reminder_id) ?? '' }] : [])
  const collator = new Intl.Collator('nl-NL', { sensitivity: 'base' })
  const jobs: CalendarJobOption[] = [...new Map(
    employees
      .filter((employee) => employee.jobId && employee.jobName)
      .map((employee) => [employee.jobId!, {
        id: employee.jobId!,
        code: jobById.get(employee.jobId!)?.code ?? employee.jobName!,
        name: employee.jobName!,
        jobGroupId: employee.jobGroupId,
      }]),
  ).values()].sort((left, right) => collator.compare(left.name, right.name))
  const jobGroups: CalendarJobGroupOption[] = [...new Map(
    employees
      .filter((employee) => employee.jobGroupId && employee.jobGroupName)
      .map((employee) => [employee.jobGroupId!, {
        id: employee.jobGroupId!,
        code: jobGroupById.get(employee.jobGroupId!)?.code ?? employee.jobGroupName!,
        name: employee.jobGroupName!,
      }]),
  ).values()].sort((left, right) => collator.compare(left.name, right.name))
  return {
    employees,
    departments: departmentsResult.data ?? [],
    holidays: holidaysResult.data ?? [],
    reminders,
    generalReminders: (generalResult.data ?? []).map((reminder) => ({ id: reminder.id, employeeId: null, date: reminder.remind_at.slice(0, 10), title: reminder.title })),
    events: hrData.events,
    jobGroups,
    jobs,
  }
}

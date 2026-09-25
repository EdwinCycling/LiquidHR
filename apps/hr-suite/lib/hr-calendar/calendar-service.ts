import 'server-only'
import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { buildMonthDays } from './calendar-model'
import { getPatternDay, type WorkPatternDay } from '@/lib/work-patterns/work-pattern-model'
import { listCalendarHrEvents } from '@/lib/hr-events/service'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { projectApprovedLeave, type LeaveProjectionAllocation, type LeaveProjectionRequest, type LeaveProjectionScheduleDay } from '@/lib/leave/calendar-projection'

export type CalendarWorkDay = { isWorkingDay: boolean; startsAt: string | null; endsAt: string | null; scheduledMinutes: number }
export type CalendarReminder = { id: string; employeeId: string | null; date: string; title: string }
export type CalendarAbsencePeriod = { employeeId: string; caseId: string; startedOn: string; expectedRecoveryOn: string | null }
export type CalendarCompanyActivity = { id: string; name: string; activity_date: string }
export type CalendarTypeEventKind = 'LEAVE' | 'WORK_HOUR' | 'OVERTIME' | 'TRANSPARENT'
export interface CalendarTypeEvent {
  id: string
  employeeId: string
  employmentId: string
  date: string
  kind: CalendarTypeEventKind
  typeId: string
  typeName: string
  colorCode: string
  hours: number
  requestId?: string
  requestMode?: 'DIRECT' | 'PRIORITY'
  timeMode?: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'SPECIFIC_HOURS'
  specificStart?: string | null
  specificEnd?: string | null
}
export interface CalendarJobGroupOption { id: string; code: string; name: string }
export interface CalendarJobOption { id: string; code: string; name: string; jobGroupId: string | null }

export async function loadUnifiedCalendar(month: string) {
  const auth = await requirePermission('hr-calendar:read')
  if (!auth.administrationId) throw new Error('ADMINISTRATION_REQUIRED')
  const administrationId = auth.administrationId
  const hrGroupId = requireHrGroupId(auth)
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
  const empty = { employees: [], departments: [], holidays: [], companyActivities: [], reminders: [], generalReminders: [], events: [], calendarEvents: [], absencePeriods: [], jobGroups: [], jobs: [] }
  if (!employeeIds.length) return empty
  let canReadAbsence = true
  try { await requirePermission('absence:read') } catch (error) {
    if (error instanceof AuthorizationError) canReadAbsence = false
    else throw error
  }

  const [employeesResult, organizationsResult, departmentsResult, holidaysResult, companyActivitiesResult, recipientsResult, generalResult, absenceCasesResult, leaveRequestsResult, hrData] = await Promise.all([
    supabase.from('employees').select('id,employee_number,first_name,birth_name,avatar_url,is_archived').in('id', employeeIds).eq('is_archived', false).order('birth_name').limit(2000),
    supabase.from('employee_organizations').select('employee_id,department_id,job_id,job_title,effective_from').in('employee_id', employeeIds).eq('administration_id', administrationId).lte('effective_from', to).or(`effective_to.is.null,effective_to.gte.${from}`).order('effective_from', { ascending: false }).limit(4000),
    supabase.from('departments').select('id,code,name').eq('tenant_id', auth.tenantId).eq('is_active', true).order('code').limit(500),
    supabase.from('holidays').select('id,holiday_date,display_name,provider_name,source').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).gte('holiday_date', from).lt('holiday_date', to).order('holiday_date').limit(400),
    supabase.from('company_activities').select('id,name,activity_date').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).gte('activity_date', from).lt('activity_date', to).order('activity_date').limit(400),
    supabase.from('reminder_recipients').select('id,employee_id,effective_remind_at,reminder_id').not('employee_id', 'is', null).gte('effective_remind_at', `${from}T00:00:00Z`).lt('effective_remind_at', `${to}T00:00:00Z`).limit(5000),
    supabase.from('reminders').select('id,title,remind_at').eq('administration_id', administrationId).eq('status', 'PUBLISHED').eq('target_type', 'EVERYONE').gte('remind_at', `${from}T00:00:00Z`).lt('remind_at', `${to}T00:00:00Z`).limit(500),
    canReadAbsence ? supabase.from('absence_cases').select('id,employee_id').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('status', 'ACTIVE').is('archived_at', null).in('employee_id', employeeIds).lte('first_absence_on', to).limit(2000) : Promise.resolve({ data: [], error: null }),
    supabase.from('leave_requests').select('id,employee_id,employment_id,request_mode,time_mode,specific_start,specific_end,start_date,end_date,requested_minutes,status').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).eq('status', 'APPROVED').lt('start_date', to).gte('end_date', from).limit(5000),
    listCalendarHrEvents(month),
  ])
  const failed = [employeesResult, organizationsResult, departmentsResult, holidaysResult, recipientsResult, generalResult, absenceCasesResult].find((result) => result.error)
  if (failed?.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  if (leaveRequestsResult.error) throw new Error('HR_CALENDAR_LEAVE_EVENTS_FAILED')
  const companyActivitiesError = companyActivitiesResult.error?.message ?? ''
  if (companyActivitiesResult.error && !(companyActivitiesError.includes('company_activities') && (companyActivitiesError.includes('does not exist') || companyActivitiesError.includes('schema cache') || companyActivitiesError.includes('Could not find the table')))) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const leaveEmploymentIds = [...new Set((leaveRequestsResult.data ?? []).map((request) => request.employment_id))]
  const [patternsResult, schedulesResult] = await Promise.all([
    leaveEmploymentIds.length
      ? supabase.from('employment_work_patterns').select('id,employee_id,employment_id,name,cycle_weeks,anchor_date,average_minutes_per_week,valid_from,valid_until,employment_work_pattern_days(week_index,iso_weekday,is_working_day,starts_at,ends_at,break_minutes,scheduled_minutes,note)').eq('tenant_id', auth.tenantId).eq('administration_id', administrationId).in('employment_id', leaveEmploymentIds).lt('valid_from', to).or(`valid_until.is.null,valid_until.gt.${from}`).order('valid_from', { ascending: false }).limit(10000)
      : Promise.resolve({ data: [], error: null }),
    leaveEmploymentIds.length
      ? supabase.from('employment_schedules').select('id,employee_id,employment_id,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours,average_hours_per_week,fulltime_hours_per_week,valid_from,valid_until').eq('tenant_id', auth.tenantId).eq('administration_id', administrationId).in('employment_id', leaveEmploymentIds).lte('valid_from', to).or(`valid_until.is.null,valid_until.gte.${from}`).order('valid_from', { ascending: false }).limit(10000)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (patternsResult.error || schedulesResult.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const absenceCaseRows = absenceCasesResult.data ?? []
  const absenceSpellResult = canReadAbsence && absenceCaseRows.length ? await supabase.from('absence_spells').select('id,case_id,started_on,expected_recovery_on,recovered_on').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('case_id', absenceCaseRows.map((row) => row.id)).is('recovered_on', null).order('started_on', { ascending: false }) : { data: [], error: null }
  if (absenceSpellResult.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const employeeByCaseId = new Map(absenceCaseRows.map((row) => [row.id, row.employee_id]))
  const absencePeriods: CalendarAbsencePeriod[] = (absenceSpellResult.data ?? []).flatMap((spell) => { const employeeId = employeeByCaseId.get(spell.case_id); return employeeId ? [{ employeeId, caseId: spell.case_id, startedOn: spell.started_on, expectedRecoveryOn: spell.expected_recovery_on }] : [] })
  const latestOrganizationByEmployee = new Map<string, NonNullable<typeof organizationsResult.data>[number]>()
  for (const organization of organizationsResult.data ?? []) {
    if (!latestOrganizationByEmployee.has(organization.employee_id)) latestOrganizationByEmployee.set(organization.employee_id, organization)
  }
  const jobIds = [...new Set((organizationsResult.data ?? []).flatMap((organization) => organization.job_id ? [organization.job_id] : []))]
  const jobsResult = jobIds.length
    ? await supabase.from('jobs').select('id,job_group_id,code').eq('tenant_id', auth.tenantId).in('id', jobIds).limit(2000)
    : { data: [], error: null }
  if (jobsResult.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const jobGroupIds = [...new Set((jobsResult.data ?? []).map((job) => job.job_group_id))]
  const [jobRevisionsResult, jobGroupsResult] = await Promise.all([
    jobIds.length
      ? supabase.from('job_revisions').select('job_id,name,valid_from,valid_until').eq('tenant_id', auth.tenantId).in('job_id', jobIds).lte('valid_from', referenceDate).or(`valid_until.is.null,valid_until.gt.${referenceDate}`).order('valid_from', { ascending: false }).limit(4000)
      : Promise.resolve({ data: [], error: null }),
    jobGroupIds.length
      ? supabase.from('job_groups').select('id,code,name').eq('tenant_id', auth.tenantId).in('id', jobGroupIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (jobRevisionsResult.error || jobGroupsResult.error) throw new Error('HR_CALENDAR_CONTEXT_FAILED')
  const reminderIds = [...new Set((recipientsResult.data ?? []).map((recipient) => recipient.reminder_id))]
  const remindersResult = reminderIds.length ? await supabase.from('reminders').select('id,title').in('id', reminderIds).limit(5000) : { data: [], error: null }
  if (remindersResult.error) throw new Error('HR_CALENDAR_REMINDERS_FAILED')
  const workEntriesResult = await supabase.from('employment_work_hour_entries').select('id,employee_id,employment_id,work_hour_type_id,work_date,hours,entry_granularity').eq('administration_id', administrationId).in('employment_id', employmentIds).eq('entry_granularity', 'DAY').eq('status', 'APPROVED').gte('work_date', from).lt('work_date', to).limit(5000)
  if (workEntriesResult.error) throw new Error('HR_CALENDAR_LEAVE_EVENTS_FAILED')
  const requestIds = (leaveRequestsResult.data ?? []).map((row) => row.id)
  const leaveAllocationsResult = requestIds.length
    ? await supabase.from('leave_request_allocations').select('request_id,employment_id,leave_type_id,allocated_hours,sort_order').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('request_id', requestIds).limit(5000)
    : { data: [], error: null }
  if (leaveAllocationsResult.error) throw new Error('HR_CALENDAR_LEAVE_EVENTS_FAILED')
  const leaveTypeIds = [...new Set((leaveAllocationsResult.data ?? []).map((row) => row.leave_type_id))]
  const workHourTypeIds = [...new Set((workEntriesResult.data ?? []).map((row) => row.work_hour_type_id))]
  const [leaveTypesResult, workHourTypesResult] = await Promise.all([
    leaveTypeIds.length ? supabase.from('leave_types').select('id,name,color_code').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('id', leaveTypeIds).limit(500) : Promise.resolve({ data: [], error: null }),
    workHourTypeIds.length ? supabase.from('work_hour_types').select('id,name,color_code,category,family,pin_in_calendar,show_in_calendar').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).or('administration_id.is.null,administration_id.eq.' + administrationId).in('id', workHourTypeIds).limit(500) : Promise.resolve({ data: [], error: null }),
  ])
  if (leaveTypesResult.error || workHourTypesResult.error) throw new Error('HR_CALENDAR_LEAVE_EVENTS_FAILED')
  const leaveTypeById = new Map((leaveTypesResult.data ?? []).map((row) => [row.id, row]))
  const workHourTypeById = new Map((workHourTypesResult.data ?? []).map((row) => [row.id, row]))
  type PatternRow = NonNullable<typeof patternsResult.data>[number]
  const patternsByEmployment = new Map<string, PatternRow[]>()
  for (const pattern of patternsResult.data ?? []) patternsByEmployment.set(pattern.employment_id, [...(patternsByEmployment.get(pattern.employment_id) ?? []), pattern])
  type ScheduleRow = NonNullable<typeof schedulesResult.data>[number]
  const schedulesByEmployment = new Map<string, ScheduleRow[]>()
  for (const schedule of schedulesResult.data ?? []) schedulesByEmployment.set(schedule.employment_id, [...(schedulesByEmployment.get(schedule.employment_id) ?? []), schedule])
  const scheduleHoursForDate = (schedule: ScheduleRow, date: string): number => {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay()
    return Number(day === 0 ? schedule.sunday_hours ?? 0 : day === 1 ? schedule.monday_hours ?? 0 : day === 2 ? schedule.tuesday_hours ?? 0 : day === 3 ? schedule.wednesday_hours ?? 0 : day === 4 ? schedule.thursday_hours ?? 0 : day === 5 ? schedule.friday_hours ?? 0 : schedule.saturday_hours ?? 0)
  }
  const scheduleDayForDate = (employmentId: string, date: string): LeaveProjectionScheduleDay | undefined => {
    const pattern = patternsByEmployment.get(employmentId)?.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until > date))
    if (pattern) {
      const projected = getPatternDay({ anchorDate: pattern.anchor_date, cycleWeeks: pattern.cycle_weeks, days: pattern.employment_work_pattern_days.map((day): WorkPatternDay => ({ weekIndex: day.week_index, isoWeekday: day.iso_weekday, isWorkingDay: day.is_working_day, startsAt: day.starts_at, endsAt: day.ends_at, breakMinutes: day.break_minutes, scheduledMinutes: day.scheduled_minutes, note: day.note })) }, date)
      if (projected) return { date, scheduledMinutes: projected.scheduledMinutes, isWorkingDay: projected.isWorkingDay }
    }
    const schedule = schedulesByEmployment.get(employmentId)?.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until >= date))
    if (!schedule) return undefined
    const scheduledMinutes = Math.round(scheduleHoursForDate(schedule, date) * 60)
    return { date, scheduledMinutes, isWorkingDay: scheduledMinutes > 0 }
  }
  const scheduleDaysByEmployment = new Map<string, Map<string, LeaveProjectionScheduleDay>>()
  const addDate = (value: string, amount: number): string => {
    const date = new Date(`${value}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + amount)
    return date.toISOString().slice(0, 10)
  }
  for (const request of leaveRequestsResult.data ?? []) {
    const scheduleDays = scheduleDaysByEmployment.get(request.employment_id) ?? new Map<string, LeaveProjectionScheduleDay>()
    for (let date = request.start_date; date <= request.end_date; date = addDate(date, 1)) {
      const scheduleDay = scheduleDayForDate(request.employment_id, date)
      if (scheduleDay) scheduleDays.set(date, scheduleDay)
    }
    scheduleDaysByEmployment.set(request.employment_id, scheduleDays)
  }
  const projectionRequests: LeaveProjectionRequest[] = (leaveRequestsResult.data ?? []).map((request) => ({
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
  }))
  const projectionAllocations: LeaveProjectionAllocation[] = (leaveAllocationsResult.data ?? []).map((allocation) => ({
    requestId: allocation.request_id,
    leaveTypeId: allocation.leave_type_id,
    allocatedHours: Number(allocation.allocated_hours),
    sortOrder: allocation.sort_order,
  }))
  const projectedLeave = projectApprovedLeave({
    requests: projectionRequests,
    allocations: projectionAllocations,
    scheduleDaysByEmployment,
    holidayDates: new Set((holidaysResult.data ?? []).map((holiday) => holiday.holiday_date)),
  })
  const calendarEvents: CalendarTypeEvent[] = [
    ...projectedLeave.flatMap((row) => {
      const leaveType = leaveTypeById.get(row.leaveTypeId)
      return leaveType ? [{
        id: `leave-${row.id}`,
        employeeId: row.employeeId,
        employmentId: row.employmentId,
        date: row.date,
        kind: 'LEAVE' as const,
        typeId: leaveType.id,
        typeName: leaveType.name,
        colorCode: leaveType.color_code,
        hours: row.hours,
        requestId: row.requestId,
        requestMode: row.requestMode,
        timeMode: row.timeMode,
        specificStart: row.specificStart,
        specificEnd: row.specificEnd,
      }] : []
    }),
    ...(workEntriesResult.data ?? []).flatMap((row) => {
      const workHourType = workHourTypeById.get(row.work_hour_type_id)
      if (!workHourType || (!workHourType.show_in_calendar && !(workHourType.family !== 'TRANSPARENT' && workHourType.pin_in_calendar))) return []
      return [{ id: 'work-' + row.id, employeeId: row.employee_id, employmentId: row.employment_id, date: row.work_date, kind: workHourType.family === 'OVERTIME' ? 'OVERTIME' as const : workHourType.family === 'TRANSPARENT' ? 'TRANSPARENT' as const : 'WORK_HOUR' as const, typeId: workHourType.id, typeName: workHourType.name, colorCode: workHourType.color_code, hours: Number(row.hours) }]
    }),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.employeeId.localeCompare(right.employeeId) || left.id.localeCompare(right.id))
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
    const schedules = schedulesByEmployment.get(employments.find((employment) => employment.employee_id === employee.id)?.id ?? '') ?? []
    const workDays: Record<string, CalendarWorkDay> = {}
    for (const date of days) {
      const pattern = patterns.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until > date))
      if (pattern) {
        const projected = getPatternDay({ anchorDate: pattern.anchor_date, cycleWeeks: pattern.cycle_weeks, days: pattern.employment_work_pattern_days.map((day): WorkPatternDay => ({ weekIndex: day.week_index, isoWeekday: day.iso_weekday, isWorkingDay: day.is_working_day, startsAt: day.starts_at, endsAt: day.ends_at, breakMinutes: day.break_minutes, scheduledMinutes: day.scheduled_minutes, note: day.note })) }, date)
        if (projected) {
          workDays[date] = { isWorkingDay: projected.isWorkingDay, startsAt: projected.startsAt, endsAt: projected.endsAt, scheduledMinutes: projected.scheduledMinutes }
          continue
        }
      }
      const schedule = schedules.find((candidate) => candidate.valid_from <= date && (!candidate.valid_until || candidate.valid_until >= date))
      if (!schedule) continue
      const scheduledMinutes = Math.round(scheduleHoursForDate(schedule, date) * 60)
      workDays[date] = { isWorkingDay: scheduledMinutes > 0, startsAt: null, endsAt: null, scheduledMinutes }
    }
    return {
      ...employee,
      avatar_url: employeeAvatarHref(employee.id, employee.avatar_url),
      departmentId: departmentByEmployee.get(employee.id) ?? null,
      averageMinutesPerWeek: patterns[0]?.average_minutes_per_week ?? (schedules[0]?.average_hours_per_week ? Number(schedules[0].average_hours_per_week) * 60 : 0),
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
    companyActivities: companyActivitiesResult.error ? [] : companyActivitiesResult.data ?? [],
    reminders,
    generalReminders: (generalResult.data ?? []).map((reminder) => ({ id: reminder.id, employeeId: null, date: reminder.remind_at.slice(0, 10), title: reminder.title })),
    events: hrData.events,
    calendarEvents,
    absencePeriods,
    jobGroups,
    jobs,
  }
}

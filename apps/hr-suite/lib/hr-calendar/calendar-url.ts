export interface HrCalendarQuery {
  month: string
  q?: string
  department?: string
  employee?: string
  jobGroup?: string
  job?: string
  week?: string
  size?: string
  page?: string
  showWeekendsAndHolidays?: string
  showReminders?: string
  showScheduledHours?: string
  showWeekNumbers?: string
  showDayOccupancy?: string
}

export interface HrCalendarMonthQuery {
  q: string
  department?: string
  employee?: string
  week?: string
  jobGroup?: string
  job?: string
  size?: string
  showWeekendsAndHolidays: boolean
  showReminders: boolean
  showScheduledHours: boolean
  showWeekNumbers: boolean
  showDayOccupancy: boolean
}

export function buildHrCalendarUrl(query: HrCalendarQuery): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (!value) continue
    params.set(key, value)
  }

  return `/hr-calendar?${params.toString()}`
}

export function buildHrCalendarMonthUrl(month: string, query: HrCalendarMonthQuery): string {
  return buildHrCalendarUrl({
    month,
    q: query.q.trim() || undefined,
    department: query.department,
    employee: query.employee,
    jobGroup: query.jobGroup,
    job: query.job,
    size: query.size === '10' ? undefined : query.size,
    showWeekendsAndHolidays: query.showWeekendsAndHolidays ? undefined : '0',
    showReminders: query.showReminders ? undefined : '0',
    showScheduledHours: query.showScheduledHours ? undefined : '0',
    showWeekNumbers: query.showWeekNumbers ? '1' : undefined,
    showDayOccupancy: query.showDayOccupancy ? '1' : undefined,
  })
}

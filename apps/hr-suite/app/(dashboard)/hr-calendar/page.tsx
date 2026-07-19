import Link from 'next/link'
import { Bell } from 'lucide-react'
import { HrCalendarFilterPanel } from '@/components/hr-calendar/hr-calendar-filter-panel'
import { HrMonthCalendar } from '@/components/hr-calendar/hr-month-calendar'
import { HrCalendarPageSizeSelect } from '@/components/hr-calendar/hr-calendar-page-size-select'
import { HrCalendarWeekSelect } from '@/components/hr-calendar/hr-calendar-week-select'
import {
  formatCalendarMonth,
  getCalendarWeekOptions,
  getEmployeePageSize,
} from '@/lib/hr-calendar/calendar-model'
import { loadUnifiedCalendar } from '@/lib/hr-calendar/calendar-service'
import { calendarQuerySchema } from '@/lib/hr-calendar/schemas'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getStoredHrCalendarFilterPanelOpen } from '@/lib/preferences/hr-calendar'
import { getUserPreferences } from '@/lib/preferences/server'

interface Props {
  searchParams: Promise<{
    month?: string
    q?: string
    department?: string
    employee?: string
    jobGroup?: string
    job?: string
    week?: string
    type?: string | string[]
    size?: string
    page?: string
    showWeekendsAndHolidays?: string
    showReminders?: string
    showScheduledHours?: string
    showWeekNumbers?: string
    showDayOccupancy?: string
  }>
}

function shift(month: string, amount: number) {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return date.toISOString().slice(0, 7)
}

function href(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (!value) continue
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry)
      continue
    }
    params.set(key, value)
  }
  return `?${params.toString()}`
}

export default async function HrCalendarPage({ searchParams }: Props) {
  const rawQuery = await searchParams
  const currentDate = new Date().toISOString().slice(0, 10)
  const currentMonth = currentDate.slice(0, 7)
  const currentYear = Number(currentDate.slice(0, 4))
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawQuery.month ?? '') ? rawQuery.month! : currentMonth

  const parsed = calendarQuerySchema.parse({
    month,
    q: rawQuery.q ?? '',
    department: rawQuery.department,
    employee: rawQuery.employee,
    jobGroup: rawQuery.jobGroup,
    job: rawQuery.job,
    week: rawQuery.week,
    type: Array.isArray(rawQuery.type) ? rawQuery.type : rawQuery.type ? [rawQuery.type] : [],
    size: rawQuery.size,
    page: rawQuery.page,
    showWeekendsAndHolidays: rawQuery.showWeekendsAndHolidays === '0' ? '0' : '1',
    showReminders: rawQuery.showReminders === '0' ? '0' : '1',
    showScheduledHours: rawQuery.showScheduledHours === '0' ? '0' : '1',
    showWeekNumbers: rawQuery.showWeekNumbers === '1' ? '1' : '0',
    showDayOccupancy: rawQuery.showDayOccupancy === '1' ? '1' : '0',
  })

  const [data, t, locale, filterPanelOpen, preferences] = await Promise.all([
    loadUnifiedCalendar(month),
    getTranslator('hrCalendar'),
    getLocale(),
    getStoredHrCalendarFilterPanelOpen(),
    getUserPreferences(),
  ])

  const weekOptions = getCalendarWeekOptions(currentYear, preferences.weekNumberingSystem)
  const selectedWeekNumber = parsed.showWeekNumbers === '1' && parsed.week
    ? Number(parsed.week)
    : undefined
  const selectedWeekOption = selectedWeekNumber
    ? weekOptions.find((option) => option.weekNumber === selectedWeekNumber)
    : undefined
  const selectedWeekStartDate = selectedWeekOption?.startDate

  const q = parsed.q.toLocaleLowerCase('nl-NL')
  const filtered = data.employees.filter((employee) => (
    (!parsed.department || employee.departmentId === parsed.department)
    && (!parsed.employee || employee.id === parsed.employee)
    && (!parsed.jobGroup || employee.jobGroupId === parsed.jobGroup)
    && (!parsed.job || employee.jobId === parsed.job)
    && (
      !q
      || `${employee.employee_number} ${employee.first_name} ${employee.birth_name} ${employee.jobGroupName ?? ''} ${employee.jobName ?? ''}`
        .toLocaleLowerCase('nl-NL')
        .includes(q)
    )
  ))

  const size = getEmployeePageSize(parsed.size, filtered.length)
  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(size, 1)))
  const page = Math.min(Math.max(Number(parsed.page) || 1, 1), totalPages)
  const employees = filtered.slice((page - 1) * size, page * size)
  const visibleIds = new Set(employees.map((employee) => employee.id))
  const events = data.events.filter((event) => (
    visibleIds.has(event.employeeId)
    && (parsed.type.length === 0 || parsed.type.includes(event.eventType))
  ))
  const reminders = data.reminders.filter((reminder) => reminder.employeeId && visibleIds.has(reminder.employeeId))

  const eventLabels = {
    EMPLOYMENT_STARTED: t('eventEmploymentStarted'),
    EMPLOYMENT_ENDED: t('eventEmploymentEnded'),
    INCOME_RELATIONSHIP_CHANGED: t('eventIncomeRelationship'),
    ORGANIZATION_CHANGED: t('eventOrganization'),
    LABOR_CONDITIONS_CHANGED: t('eventLabor'),
    SCHEDULE_CHANGED: t('eventSchedule'),
    SALARY_CHANGED: t('eventSalary'),
    COST_ALLOCATION_CHANGED: t('eventCost'),
    DOCUMENT_ADDED: t('eventDocumentAdded'),
    DOCUMENT_EXPIRES: t('eventDocumentExpires'),
  }

  const base = {
    month,
    q: parsed.q || undefined,
    department: parsed.department,
    employee: parsed.employee,
    jobGroup: parsed.jobGroup,
    job: parsed.job,
    type: parsed.type,
    size: parsed.size,
    page: parsed.page,
    week: selectedWeekOption ? String(selectedWeekOption.weekNumber) : undefined,
    showWeekendsAndHolidays: parsed.showWeekendsAndHolidays === '0' ? '0' : undefined,
    showReminders: parsed.showReminders === '0' ? '0' : undefined,
    showScheduledHours: parsed.showScheduledHours === '0' ? '0' : undefined,
    showWeekNumbers: parsed.showWeekNumbers === '1' ? '1' : undefined,
    showDayOccupancy: parsed.showDayOccupancy === '1' ? '1' : undefined,
  } satisfies Record<string, string | string[] | undefined>

  return (
    <section className="w-full px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('title')}</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link className="button-secondary" href={href({ ...base, month: currentMonth, page: undefined, week: undefined })}>
            {t('today')}
          </Link>
          <Link className="button-secondary" href={href({ ...base, month: shift(month, -1), week: undefined })}>
            {t('previousMonth')}
          </Link>
          <span className="rounded-lg bg-muted px-4 py-2 font-semibold">
            {formatCalendarMonth(month, locale)}
          </span>
          <Link className="button-secondary" href={href({ ...base, month: shift(month, 1), week: undefined })}>
            {t('nextMonth')}
          </Link>
          {parsed.showWeekNumbers === '1' ? (
            <HrCalendarWeekSelect
              currentYear={currentYear}
              labels={{
                week: t('week'),
                weekSelectPlaceholder: t('weekSelectPlaceholder'),
              }}
              month={month}
              options={weekOptions}
              query={{
                q: parsed.q,
                department: parsed.department,
                employee: parsed.employee,
                jobGroup: parsed.jobGroup,
                job: parsed.job,
                type: parsed.type,
                size: parsed.size,
                page: parsed.page,
                showWeekendsAndHolidays: parsed.showWeekendsAndHolidays === '1',
                showReminders: parsed.showReminders === '1',
                showScheduledHours: parsed.showScheduledHours === '1',
                showWeekNumbers: true,
                showDayOccupancy: parsed.showDayOccupancy === '1',
              }}
              selectedWeek={selectedWeekOption?.weekNumber}
            />
          ) : null}
        </nav>
      </header>

      <HrCalendarFilterPanel
        departments={data.departments}
        employees={data.employees}
        initialOpen={filterPanelOpen}
        jobGroups={data.jobGroups}
        jobs={data.jobs}
        labels={{
          showFilters: t('showFilters'),
          hideFilters: t('hideFilters'),
          resetDefaults: t('resetDefaults'),
          search: t('search'),
          searchPlaceholder: t('searchPlaceholder'),
          department: t('department'),
          employee: t('employee'),
          all: t('all'),
          dataToShow: t('dataToShow'),
          weekNumbers: t('weekNumbers'),
          weekNumbersHint: t('weekNumbersHint'),
          dayOccupancy: t('dayOccupancy'),
          dayOccupancyHint: t('dayOccupancyHint'),
          weekendHoliday: t('weekendHoliday'),
          weekendHolidayHint: t('weekendHolidayHint'),
          reminders: t('personReminders'),
          remindersHint: t('personRemindersHint'),
          scheduledHours: t('scheduledHours'),
          scheduledHoursHint: t('scheduledHoursHint'),
          leave: t('leave'),
          leaveHint: t('leaveHint'),
          absence: t('absence'),
          absenceHint: t('absenceHint'),
          statusToday: t('statusToday'),
          sickToday: t('sickToday'),
          leaveToday: t('leaveToday'),
          notAvailableYet: t('notAvailableYet'),
          jobGroup: t('jobGroup'),
          job: t('job'),
        }}
        month={month}
        query={{
          q: parsed.q,
          department: parsed.department,
          employee: parsed.employee,
          jobGroup: parsed.jobGroup,
          job: parsed.job,
          week: selectedWeekOption ? String(selectedWeekOption.weekNumber) : undefined,
          type: parsed.type,
          showWeekendsAndHolidays: parsed.showWeekendsAndHolidays === '1',
          showReminders: parsed.showReminders === '1',
          showScheduledHours: parsed.showScheduledHours === '1',
          showWeekNumbers: parsed.showWeekNumbers === '1',
          showDayOccupancy: parsed.showDayOccupancy === '1',
        }}
      />

      {data.generalReminders.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-surface px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <Bell size={15} />
            {t('generalReminders')}
          </span>
          {data.generalReminders.map((reminder) => (
            <span className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground" key={reminder.id}>
              {reminder.date.slice(8, 10)} · {reminder.title}
            </span>
          ))}
        </div>
      ) : null}

      <HrMonthCalendar
        employees={employees}
        events={events}
        generalReminders={data.generalReminders}
        holidays={data.holidays}
        labels={{
          noEvents: t('noEvents'),
          workHours: t('workHours'),
          nonWorking: t('nonWorking'),
          hoursPerWeek: t('hoursPerWeek'),
          holiday: t('holiday'),
          reminder: t('reminder'),
          generalReminders: t('generalReminders'),
          dayDetails: t('dayDetails'),
          employeeDayDetails: t('employeeDayDetails'),
          actionsLater: t('actionsLater'),
          close: t('close'),
          week: t('week'),
          weekShort: t('weekShort'),
          weekOverview: t('weekOverview'),
          selectedEmployees: t('selectedEmployees'),
          noWeekItemsYet: t('noWeekItemsYet'),
          job: t('job'),
          jobGroup: t('jobGroup'),
          dayOccupancy: t('dayOccupancy'),
          dayOccupancyPersons: t('dayOccupancyPersons'),
          dayOccupancyHours: t('dayOccupancyHours'),
          dayOccupancyPercentage: t('dayOccupancyPercentage'),
          openEmployeeCard: t('openEmployeeCard'),
          employeeSection: t('employee'),
          employeesSection: t('selectedEmployees'),
          actionsSection: t('actions'),
          events: eventLabels,
        }}
        locale={locale}
        month={month}
        reminders={reminders}
        selectedWeekStartDate={selectedWeekStartDate}
        showReminders={parsed.showReminders === '1'}
        showScheduledHours={parsed.showScheduledHours === '1'}
        showDayOccupancy={parsed.showDayOccupancy === '1'}
        showWeekNumbers={parsed.showWeekNumbers === '1'}
        showWeekendsAndHolidays={parsed.showWeekendsAndHolidays === '1'}
        todayDate={currentDate}
        weekNumberingSystem={preferences.weekNumberingSystem}
      />

      <footer className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <span>
            {t('paginationSummary', {
              from: filtered.length ? String((page - 1) * size + 1) : '0',
              to: String(Math.min(page * size, filtered.length)),
              total: String(filtered.length),
            })}
          </span>
          <HrCalendarPageSizeSelect
            currentSize={parsed.size ?? '10'}
            labels={{ pageSize: t('pageSize'), allMax100: t('allMax100') }}
            month={month}
            query={{
              q: parsed.q,
              department: parsed.department,
              employee: parsed.employee,
              jobGroup: parsed.jobGroup,
              job: parsed.job,
              week: selectedWeekOption ? String(selectedWeekOption.weekNumber) : undefined,
              type: parsed.type,
              showWeekendsAndHolidays: parsed.showWeekendsAndHolidays === '1',
              showReminders: parsed.showReminders === '1',
              showScheduledHours: parsed.showScheduledHours === '1',
              showWeekNumbers: parsed.showWeekNumbers === '1',
              showDayOccupancy: parsed.showDayOccupancy === '1',
            }}
          />
        </div>
        <nav className="flex w-full gap-2 sm:w-auto">
          <Link
            aria-disabled={page === 1}
            className={`button-secondary flex-1 sm:flex-none ${page === 1 ? 'pointer-events-none opacity-45' : ''}`}
            href={href({ ...base, page: String(page - 1) })}
          >
            {t('previous')}
          </Link>
          <Link
            aria-disabled={page === totalPages}
            className={`button-secondary flex-1 sm:flex-none ${page === totalPages ? 'pointer-events-none opacity-45' : ''}`}
            href={href({ ...base, page: String(page + 1) })}
          >
            {t('next')}
          </Link>
        </nav>
      </footer>
    </section>
  )
}

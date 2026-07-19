'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, Filter, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CalendarJobGroupOption, CalendarJobOption } from '@/lib/hr-calendar/calendar-service'

interface Option {
  id: string
  code: string
  name: string
}

interface EmployeeOption {
  id: string
  employee_number: string
  first_name: string
  birth_name: string
}

interface HrCalendarFilterPanelLabels {
  showFilters: string
  hideFilters: string
  resetDefaults: string
  search: string
  searchPlaceholder: string
  department: string
  employee: string
  all: string
  dataToShow: string
  weekNumbers: string
  weekNumbersHint: string
  dayOccupancy: string
  dayOccupancyHint: string
  weekendHoliday: string
  weekendHolidayHint: string
  reminders: string
  remindersHint: string
  scheduledHours: string
  scheduledHoursHint: string
  leave: string
  leaveHint: string
  absence: string
  absenceHint: string
  statusToday: string
  sickToday: string
  leaveToday: string
  notAvailableYet: string
  jobGroup: string
  job: string
}

interface HrCalendarFilterPanelProps {
  month: string
  query: {
    q: string
    department?: string
    employee?: string
    jobGroup?: string
    job?: string
    week?: string
    type: string[]
    showWeekendsAndHolidays: boolean
    showReminders: boolean
    showScheduledHours: boolean
    showWeekNumbers: boolean
    showDayOccupancy: boolean
  }
  departments: Option[]
  employees: EmployeeOption[]
  jobGroups: CalendarJobGroupOption[]
  jobs: CalendarJobOption[]
  initialOpen: boolean
  labels: HrCalendarFilterPanelLabels
}

type CalendarFilters = HrCalendarFilterPanelProps['query']

export function HrCalendarFilterPanel({
  month,
  query,
  departments,
  employees,
  jobGroups,
  jobs,
  initialOpen,
  labels,
}: HrCalendarFilterPanelProps) {
  const router = useRouter()
  const [filtersOpen, setFiltersOpen] = useState(initialOpen)
  const [searchValue, setSearchValue] = useState(query.q)
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false)
  const [todayFiltersOpen, setTodayFiltersOpen] = useState(false)

  const visibleJobs = useMemo(
    () => query.jobGroup ? jobs.filter((job) => job.jobGroupId === query.jobGroup) : jobs,
    [jobs, query.jobGroup],
  )

  function replaceFilters(next: Partial<CalendarFilters>) {
    const merged: CalendarFilters = { ...query, ...next }
    if (next.jobGroup !== undefined && merged.job) {
      const jobStillValid = jobs.some((job) => job.id === merged.job && (!merged.jobGroup || job.jobGroupId === merged.jobGroup))
      if (!jobStillValid) merged.job = undefined
    }
    const params = new URLSearchParams()
    params.set('month', month)
    const search = merged.q.trim()
    if (search) params.set('q', search)
    if (merged.department) params.set('department', merged.department)
    if (merged.employee) params.set('employee', merged.employee)
    if (merged.jobGroup) params.set('jobGroup', merged.jobGroup)
    if (merged.job) params.set('job', merged.job)
    if (merged.week && merged.showWeekNumbers) params.set('week', merged.week)
    for (const type of merged.type) params.append('type', type)
    if (!merged.showWeekendsAndHolidays) params.set('showWeekendsAndHolidays', '0')
    if (!merged.showReminders) params.set('showReminders', '0')
    if (!merged.showScheduledHours) params.set('showScheduledHours', '0')
    if (merged.showWeekNumbers) params.set('showWeekNumbers', '1')
    if (merged.showDayOccupancy) params.set('showDayOccupancy', '1')
    router.replace(`/hr-calendar?${params.toString()}`)
  }

  function toggleFilters() {
    setFiltersOpen((current) => {
      const next = !current
      void fetch('/api/preferences/hr-calendar', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filterPanelOpen: next }),
      })
      return next
    })
  }

  function resetDefaults() {
    setSearchValue('')
    router.replace(`/hr-calendar?month=${month}`)
  }

  const inputCardClass = 'rounded-xl border bg-background/80 p-3.5'
  const toggleCardClass = 'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors'

  return (
    <div className="my-5 rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-expanded={filtersOpen}
            className="button-secondary inline-flex min-h-10 items-center gap-2 px-3"
            onClick={toggleFilters}
            type="button"
          >
            <Filter aria-hidden="true" className="h-4 w-4" />
            {filtersOpen ? labels.hideFilters : labels.showFilters}
          </button>
          <button className="button-secondary inline-flex min-h-10 items-center gap-2 px-3" onClick={resetDefaults} type="button">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {labels.resetDefaults}
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="mt-4 border-t pt-4">
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
            <div className={`${inputCardClass} grid gap-3 md:grid-cols-2 xl:grid-cols-6`}>
              <label className="text-sm font-medium md:col-span-2 xl:col-span-6">
                {labels.search}
                <div className="relative mt-1">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="form-field h-10 min-h-10 pl-10"
                    onBlur={() => {
                      if (searchValue.trim() !== query.q.trim()) replaceFilters({ q: searchValue.trim() || '', job: query.job, jobGroup: query.jobGroup })
                    }}
                    onChange={(event) => setSearchValue(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        replaceFilters({ q: searchValue.trim() || '', job: query.job, jobGroup: query.jobGroup })
                      }
                    }}
                    placeholder={labels.searchPlaceholder}
                    value={searchValue}
                  />
                </div>
              </label>

              <label className="text-sm font-medium xl:col-span-2">
                {labels.department}
                <select className="form-field mt-1" onChange={(event) => replaceFilters({ department: event.currentTarget.value || undefined, job: query.job, jobGroup: query.jobGroup })} value={query.department ?? ''}>
                  <option value="">{labels.all}</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} · {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium xl:col-span-2">
                {labels.jobGroup}
                <select
                  className="form-field mt-1"
                  onChange={(event) => {
                    const jobGroup = event.currentTarget.value || undefined
                    const currentJobStillValid = query.job ? jobs.some((job) => job.id === query.job && (!jobGroup || job.jobGroupId === jobGroup)) : false
                    replaceFilters({ jobGroup, job: currentJobStillValid ? query.job : undefined })
                  }}
                  value={query.jobGroup ?? ''}
                >
                  <option value="">{labels.all}</option>
                  {jobGroups.map((jobGroup) => (
                    <option key={jobGroup.id} value={jobGroup.id}>
                      {jobGroup.code} · {jobGroup.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium xl:col-span-2">
                {labels.job}
                <select className="form-field mt-1" onChange={(event) => replaceFilters({ job: event.currentTarget.value || undefined, jobGroup: query.jobGroup })} value={query.job ?? ''}>
                  <option value="">{labels.all}</option>
                  {visibleJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.code} · {job.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium xl:col-span-6">
                {labels.employee}
                <select className="form-field mt-1" onChange={(event) => replaceFilters({ employee: event.currentTarget.value || undefined, job: query.job, jobGroup: query.jobGroup })} value={query.employee ?? ''}>
                  <option value="">{labels.all}</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_number} · {employee.first_name} {employee.birth_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3">
              <CollapsibleSection
                isOpen={displayOptionsOpen}
                onToggle={() => setDisplayOptionsOpen((current) => !current)}
                title={labels.dataToShow}
              >
                <div className="grid gap-2.5">
                  <ToggleCard
                    checked={query.showWeekNumbers}
                    description={labels.weekNumbersHint}
                    label={labels.weekNumbers}
                    onChange={() => replaceFilters({
                      showWeekNumbers: !query.showWeekNumbers,
                      week: query.showWeekNumbers ? undefined : query.week,
                      job: query.job,
                      jobGroup: query.jobGroup,
                    })}
                    toggleCardClass={toggleCardClass}
                  />
                  <ToggleCard
                    checked={query.showWeekendsAndHolidays}
                    description={labels.weekendHolidayHint}
                    label={labels.weekendHoliday}
                    onChange={() => replaceFilters({ showWeekendsAndHolidays: !query.showWeekendsAndHolidays, job: query.job, jobGroup: query.jobGroup })}
                    toggleCardClass={toggleCardClass}
                  />
                  <ToggleCard
                    checked={query.showReminders}
                    description={labels.remindersHint}
                    label={labels.reminders}
                    onChange={() => replaceFilters({ showReminders: !query.showReminders, job: query.job, jobGroup: query.jobGroup })}
                    toggleCardClass={toggleCardClass}
                  />
                  <ToggleCard
                    checked={query.showScheduledHours}
                    description={labels.scheduledHoursHint}
                    label={labels.scheduledHours}
                    onChange={() => replaceFilters({ showScheduledHours: !query.showScheduledHours, job: query.job, jobGroup: query.jobGroup })}
                    toggleCardClass={toggleCardClass}
                  />
                  <ToggleCard
                    checked={query.showDayOccupancy}
                    description={labels.dayOccupancyHint}
                    label={labels.dayOccupancy}
                    onChange={() => replaceFilters({ showDayOccupancy: !query.showDayOccupancy, job: query.job, jobGroup: query.jobGroup })}
                    toggleCardClass={toggleCardClass}
                  />
                  <DisabledCard description={labels.leaveHint} label={labels.leave} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
                  <DisabledCard description={labels.absenceHint} label={labels.absence} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                isOpen={todayFiltersOpen}
                onToggle={() => setTodayFiltersOpen((current) => !current)}
                title={labels.statusToday}
              >
                <div className="grid gap-2.5">
                  <DisabledCard description={labels.notAvailableYet} label={labels.sickToday} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
                  <DisabledCard description={labels.notAvailableYet} label={labels.leaveToday} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
                </div>
              </CollapsibleSection>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-background/80 p-3">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}

function ToggleCard({
  checked,
  label,
  description,
  onChange,
  toggleCardClass,
}: {
  checked: boolean
  label: string
  description: string
  onChange: () => void
  toggleCardClass: string
}) {
  return (
    <label className={`${toggleCardClass} ${checked ? 'border-primary/40 bg-accent/40' : 'border-border'}`}>
      <input checked={checked} className="mt-1 h-4 w-4 rounded border" onChange={onChange} type="checkbox" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

function DisabledCard({
  label,
  description,
  note,
  toggleCardClass,
}: {
  label: string
  description: string
  note: string
  toggleCardClass: string
}) {
  return (
    <div className={`${toggleCardClass} cursor-not-allowed border-border opacity-70`}>
      <span className="mt-1 h-4 w-4 rounded border bg-muted" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
        <span className="mt-2 inline-flex items-center rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{note}</span>
      </span>
    </div>
  )
}

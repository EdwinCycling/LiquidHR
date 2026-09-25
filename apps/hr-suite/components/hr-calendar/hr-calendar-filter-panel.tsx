'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, Filter, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { FilterBar } from '@/components/patterns/filter-bar'
import { ActionMenu } from '@/components/ui/action-menu'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { buildHrCalendarMonthUrl, buildHrCalendarUrl } from '@/lib/hr-calendar/calendar-url'
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
  actions: string
  filters: string
  month: string
  showFilters: string
  hideFilters: string
  search: string
  searchPlaceholder: string
  department: string
  employee: string
  all: string
  dataToShow: string
  activeFilters: string
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
    showWeekendsAndHolidays: boolean
    showReminders: boolean
    showScheduledHours: boolean
    showWeekNumbers: boolean
    showDayOccupancy: boolean
    size?: string
  }
  departments: Option[]
  employees: EmployeeOption[]
  jobGroups: CalendarJobGroupOption[]
  jobs: CalendarJobOption[]
  actions: Array<{ id: string; label: string; href: string }>
  weekSelect?: ReactNode
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
  actions,
  weekSelect,
  labels,
}: HrCalendarFilterPanelProps) {
  const router = useRouter()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(query.q)
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false)

  const visibleJobs = useMemo(
    () => query.jobGroup ? jobs.filter((job) => job.jobGroupId === query.jobGroup) : jobs,
    [jobs, query.jobGroup],
  )

  const activeFilters = useMemo(() => {
    const filters: string[] = []
    if (query.q) filters.push(`${labels.search}: ${query.q}`)
    const department = departments.find((option) => option.id === query.department)
    if (department) filters.push(`${labels.department}: ${department.name}`)
    const employee = employees.find((option) => option.id === query.employee)
    if (employee) filters.push(`${labels.employee}: ${employee.first_name} ${employee.birth_name}`)
    const jobGroup = jobGroups.find((option) => option.id === query.jobGroup)
    if (jobGroup) filters.push(`${labels.jobGroup}: ${jobGroup.name}`)
    const job = jobs.find((option) => option.id === query.job)
    if (job) filters.push(`${labels.job}: ${job.name}`)
    if (query.week && query.showWeekNumbers) filters.push(`${labels.weekNumbers}: ${query.week}`)
    if (!query.showReminders) filters.push(labels.reminders)
    if (!query.showScheduledHours) filters.push(labels.scheduledHours)
    if (query.showDayOccupancy) filters.push(labels.dayOccupancy)
    if (!query.showWeekendsAndHolidays) filters.push(labels.weekendHoliday)
    return filters
  }, [departments, employees, jobGroups, jobs, labels, query])

  function replaceFilters(next: Partial<CalendarFilters>) {
    const merged: CalendarFilters = { ...query, ...next }
    if (next.jobGroup !== undefined && merged.job) {
      const jobStillValid = jobs.some((job) => job.id === merged.job && (!merged.jobGroup || job.jobGroupId === merged.jobGroup))
      if (!jobStillValid) merged.job = undefined
    }
    router.replace(buildHrCalendarUrl({
      month,
      q: merged.q.trim() || undefined,
      department: merged.department,
      employee: merged.employee,
      jobGroup: merged.jobGroup,
      job: merged.job,
      week: merged.week && merged.showWeekNumbers ? merged.week : undefined,
      size: merged.size === '10' ? undefined : merged.size,
      showWeekendsAndHolidays: merged.showWeekendsAndHolidays ? undefined : '0',
      showReminders: merged.showReminders ? undefined : '0',
      showScheduledHours: merged.showScheduledHours ? undefined : '0',
      showWeekNumbers: merged.showWeekNumbers ? '1' : undefined,
      showDayOccupancy: merged.showDayOccupancy ? '1' : undefined,
    }))
  }

  function toggleFilters() {
    setFiltersOpen((current) => !current)
  }

  function changeMonth(nextMonth: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth)) return
    router.replace(buildHrCalendarMonthUrl(nextMonth, query))
  }

  const toggleCardClass = 'flex items-start gap-3 rounded-[var(--radius-control)] border border-border-subtle px-3 py-2.5 text-sm'

  return (
    <div className="my-5 space-y-3">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <div className="min-w-[3.5rem] flex-1">
          <DropdownSelect aria-label={labels.employee} className="border-border-subtle bg-surface-subtle px-2 text-xs sm:px-3 sm:text-sm" onChange={(event) => replaceFilters({ employee: event.currentTarget.value || undefined, job: query.job, jobGroup: query.jobGroup })} placeholder={labels.all} searchable searchPlaceholder={labels.search} value={query.employee ?? ''}>
            <option value="">{labels.all}</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} · {employee.first_name} {employee.birth_name}</option>)}
          </DropdownSelect>
        </div>
        <label className="sr-only" htmlFor="hr-calendar-month">{labels.month}</label>
        <TextInput aria-label={labels.month} className="w-[6.5rem] shrink-0 border-border-subtle bg-surface-subtle px-2 text-xs sm:w-36 sm:px-3 sm:text-sm" id="hr-calendar-month" onChange={(event) => changeMonth(event.currentTarget.value)} type="month" value={month} />
        <ActionMenu className="shrink-0" items={actions} label={labels.actions} />
        <Button aria-expanded={filtersOpen} aria-label={filtersOpen ? labels.hideFilters : labels.showFilters} className="shrink-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm" onClick={toggleFilters} type="button" variant="secondary">
          <Filter aria-hidden="true" />
          <span className="hidden sm:inline">{labels.filters}</span>
          {activeFilters.length ? <span aria-label={`${activeFilters.length}`} className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground">{activeFilters.length}</span> : null}
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {filtersOpen && activeFilters.length ? (
        <div aria-label={labels.activeFilters} className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{labels.activeFilters}</span>
          {activeFilters.map((filter) => <span className="max-w-full truncate rounded-full border border-border-subtle bg-surface-subtle px-2.5 py-1" key={filter}>{filter}</span>)}
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
          <FilterBar className="min-w-0">
            <label className="grid min-w-0 flex-1 basis-full gap-1.5 text-xs font-medium xl:basis-[calc(100%-1rem)]">
              <span>{labels.search}</span>
              <TextInput
                aria-label={labels.search}
                leadingIcon={<Search aria-hidden="true" />}
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
            </label>

            <label className="grid min-w-0 flex-1 basis-full gap-1.5 text-xs font-medium sm:basis-[calc(50%-0.75rem)] xl:basis-[calc(25%-0.75rem)]">
              <span>{labels.department}</span>
              <DropdownSelect aria-label={labels.department} onChange={(event) => replaceFilters({ department: event.currentTarget.value || undefined, job: query.job, jobGroup: query.jobGroup })} placeholder={labels.all} searchable searchPlaceholder={labels.search} value={query.department ?? ''}>
                <option value="">{labels.all}</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}
              </DropdownSelect>
            </label>

            <label className="grid min-w-0 flex-1 basis-full gap-1.5 text-xs font-medium sm:basis-[calc(50%-0.75rem)] xl:basis-[calc(25%-0.75rem)]">
              <span>{labels.jobGroup}</span>
              <DropdownSelect aria-label={labels.jobGroup} onChange={(event) => {
                const jobGroup = event.currentTarget.value || undefined
                const currentJobStillValid = query.job ? jobs.some((job) => job.id === query.job && (!jobGroup || job.jobGroupId === jobGroup)) : false
                replaceFilters({ jobGroup, job: currentJobStillValid ? query.job : undefined })
              }} placeholder={labels.all} searchable searchPlaceholder={labels.search} value={query.jobGroup ?? ''}>
                <option value="">{labels.all}</option>
                {jobGroups.map((jobGroup) => <option key={jobGroup.id} value={jobGroup.id}>{jobGroup.code} · {jobGroup.name}</option>)}
              </DropdownSelect>
            </label>

            <label className="grid min-w-0 flex-1 basis-full gap-1.5 text-xs font-medium sm:basis-[calc(50%-0.75rem)] xl:basis-[calc(25%-0.75rem)]">
              <span>{labels.job}</span>
              <DropdownSelect aria-label={labels.job} onChange={(event) => replaceFilters({ job: event.currentTarget.value || undefined, jobGroup: query.jobGroup })} placeholder={labels.all} searchable searchPlaceholder={labels.search} value={query.job ?? ''}>
                <option value="">{labels.all}</option>
                {visibleJobs.map((job) => <option key={job.id} value={job.id}>{job.code} · {job.name}</option>)}
              </DropdownSelect>
            </label>

          </FilterBar>

          <div className="grid gap-3">
            <CollapsibleSection isOpen={displayOptionsOpen} onToggle={() => setDisplayOptionsOpen((current) => !current)} title={labels.dataToShow}>
              <div className="grid gap-2.5">
                {weekSelect}
                <ToggleCard checked={query.showWeekNumbers} description={labels.weekNumbersHint} label={labels.weekNumbers} onChange={() => replaceFilters({ showWeekNumbers: !query.showWeekNumbers, week: query.showWeekNumbers ? undefined : query.week, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showWeekendsAndHolidays} description={labels.weekendHolidayHint} label={labels.weekendHoliday} onChange={() => replaceFilters({ showWeekendsAndHolidays: !query.showWeekendsAndHolidays, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showReminders} description={labels.remindersHint} label={labels.reminders} onChange={() => replaceFilters({ showReminders: !query.showReminders, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showScheduledHours} description={labels.scheduledHoursHint} label={labels.scheduledHours} onChange={() => replaceFilters({ showScheduledHours: !query.showScheduledHours, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showDayOccupancy} description={labels.dayOccupancyHint} label={labels.dayOccupancy} onChange={() => replaceFilters({ showDayOccupancy: !query.showDayOccupancy, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <DisabledCard description={labels.absenceHint} label={labels.absence} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
              </div>
            </CollapsibleSection>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CollapsibleSection({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-surface)] border border-border-subtle bg-surface-subtle p-3">
      <button aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 text-left" onClick={onToggle} type="button">
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}

function ToggleCard({ checked, label, description, onChange, toggleCardClass }: { checked: boolean; label: string; description: string; onChange: () => void; toggleCardClass: string }) {
  return (
    <label className={`${toggleCardClass} ${checked ? 'border-primary/40 bg-accent/40' : 'bg-surface'}`}>
      <input checked={checked} className="mt-1 size-4 shrink-0 accent-primary" onChange={onChange} type="checkbox" />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

function DisabledCard({ label, description, note, toggleCardClass }: { label: string; description: string; note: string; toggleCardClass: string }) {
  return (
    <div className={`${toggleCardClass} cursor-not-allowed bg-surface opacity-70`}>
      <span aria-hidden="true" className="mt-1 size-4 shrink-0 rounded border bg-muted" />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
        <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{note}</span>
      </span>
    </div>
  )
}

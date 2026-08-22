'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, Filter, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { FilterBar } from '@/components/patterns/filter-bar'
import { PageToolbar } from '@/components/patterns/page-toolbar'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
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
  eventTypes: string
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
  eventTypes: Array<{ value: string; label: string }>
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
  eventTypes,
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
    if (query.type.length) {
      const typeLabels = query.type.map((type) => eventTypes.find((option) => option.value === type)?.label ?? type)
      filters.push(`${labels.eventTypes}: ${typeLabels.join(', ')}`)
    }
    if (query.week && query.showWeekNumbers) filters.push(`${labels.weekNumbers}: ${query.week}`)
    if (!query.showReminders) filters.push(labels.reminders)
    if (!query.showScheduledHours) filters.push(labels.scheduledHours)
    if (query.showDayOccupancy) filters.push(labels.dayOccupancy)
    if (!query.showWeekendsAndHolidays) filters.push(labels.weekendHoliday)
    return filters
  }, [departments, employees, eventTypes, jobGroups, jobs, labels, query])

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

  function toggleType(type: string) {
    replaceFilters({ type: query.type.includes(type) ? query.type.filter((value) => value !== type) : [...query.type, type] })
  }

  const toggleCardClass = 'flex items-start gap-3 rounded-[var(--radius-control)] border border-border-subtle px-3 py-2.5 text-sm'

  return (
    <div className="my-5 space-y-3">
      <PageToolbar
        end={activeFilters.length ? (
          <div aria-label={labels.activeFilters} className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{labels.activeFilters}</span>
            {activeFilters.map((filter) => <span className="max-w-full truncate rounded-full border border-border-subtle bg-surface-subtle px-2.5 py-1" key={filter}>{filter}</span>)}
          </div>
        ) : undefined}
        start={(
          <>
            <Button aria-expanded={filtersOpen} onClick={toggleFilters} type="button" variant="secondary">
              <Filter aria-hidden="true" />
              {filtersOpen ? labels.hideFilters : labels.showFilters}
              {activeFilters.length ? <span aria-label={`${activeFilters.length}`} className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground">{activeFilters.length}</span> : null}
            </Button>
            <Button onClick={resetDefaults} type="button" variant="secondary">
              <RotateCcw aria-hidden="true" />
              {labels.resetDefaults}
            </Button>
          </>
        )}
      />

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

            <label className="grid min-w-0 flex-1 basis-full gap-1.5 text-xs font-medium sm:basis-[calc(50%-0.75rem)] xl:basis-[calc(25%-0.75rem)]">
              <span>{labels.employee}</span>
              <DropdownSelect aria-label={labels.employee} onChange={(event) => replaceFilters({ employee: event.currentTarget.value || undefined, job: query.job, jobGroup: query.jobGroup })} placeholder={labels.all} searchable searchPlaceholder={labels.search} value={query.employee ?? ''}>
                <option value="">{labels.all}</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} · {employee.first_name} {employee.birth_name}</option>)}
              </DropdownSelect>
            </label>

            <fieldset className="grid basis-full gap-2 border-t border-border-subtle pt-3">
              <legend className="text-xs font-semibold text-foreground">{labels.eventTypes}</legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {eventTypes.map((eventType) => (
                  <label className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-border-subtle px-3 py-2 text-xs font-medium" key={eventType.value}>
                    <input checked={query.type.includes(eventType.value)} className="mt-0.5 size-4 shrink-0 accent-primary" onChange={() => toggleType(eventType.value)} type="checkbox" />
                    <span className="min-w-0">{eventType.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </FilterBar>

          <div className="grid gap-3">
            <CollapsibleSection isOpen={displayOptionsOpen} onToggle={() => setDisplayOptionsOpen((current) => !current)} title={labels.dataToShow}>
              <div className="grid gap-2.5">
                <ToggleCard checked={query.showWeekNumbers} description={labels.weekNumbersHint} label={labels.weekNumbers} onChange={() => replaceFilters({ showWeekNumbers: !query.showWeekNumbers, week: query.showWeekNumbers ? undefined : query.week, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showWeekendsAndHolidays} description={labels.weekendHolidayHint} label={labels.weekendHoliday} onChange={() => replaceFilters({ showWeekendsAndHolidays: !query.showWeekendsAndHolidays, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showReminders} description={labels.remindersHint} label={labels.reminders} onChange={() => replaceFilters({ showReminders: !query.showReminders, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showScheduledHours} description={labels.scheduledHoursHint} label={labels.scheduledHours} onChange={() => replaceFilters({ showScheduledHours: !query.showScheduledHours, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <ToggleCard checked={query.showDayOccupancy} description={labels.dayOccupancyHint} label={labels.dayOccupancy} onChange={() => replaceFilters({ showDayOccupancy: !query.showDayOccupancy, job: query.job, jobGroup: query.jobGroup })} toggleCardClass={toggleCardClass} />
                <DisabledCard description={labels.absenceHint} label={labels.absence} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
              </div>
            </CollapsibleSection>

            <CollapsibleSection isOpen={todayFiltersOpen} onToggle={() => setTodayFiltersOpen((current) => !current)} title={labels.statusToday}>
              <div className="grid gap-2.5">
                <DisabledCard description={labels.notAvailableYet} label={labels.sickToday} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
                <DisabledCard description={labels.notAvailableYet} label={labels.leaveToday} note={labels.notAvailableYet} toggleCardClass={toggleCardClass} />
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

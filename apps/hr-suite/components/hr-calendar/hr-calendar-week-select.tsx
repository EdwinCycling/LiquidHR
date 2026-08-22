'use client'

import { useRouter } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'

interface HrCalendarWeekSelectProps {
  currentYear: number
  month: string
  selectedWeek?: number
  options: Array<{
    weekNumber: number
    startDate: string
  }>
  query: {
    q: string
    department?: string
    employee?: string
    jobGroup?: string
    job?: string
    type: string[]
    size?: '10' | '25' | 'all'
    page?: string
    showWeekendsAndHolidays: boolean
    showReminders: boolean
    showScheduledHours: boolean
    showWeekNumbers: boolean
    showDayOccupancy: boolean
  }
  labels: {
    week: string
    weekSelectPlaceholder: string
    searchWeek: string
  }
}

export function HrCalendarWeekSelect({
  currentYear,
  month,
  selectedWeek,
  options,
  query,
  labels,
}: HrCalendarWeekSelectProps) {
  const router = useRouter()

  function updateWeek(value: string) {
    const params = new URLSearchParams()
    const weekNumber = Number(value)
    const selectedOption = options.find((option) => option.weekNumber === weekNumber)

    params.set('month', selectedOption ? selectedOption.startDate.slice(0, 7) : month)
    if (query.q.trim()) params.set('q', query.q.trim())
    if (query.department) params.set('department', query.department)
    if (query.employee) params.set('employee', query.employee)
    if (query.jobGroup) params.set('jobGroup', query.jobGroup)
    if (query.job) params.set('job', query.job)
    for (const type of query.type) params.append('type', type)
    if (query.size && query.size !== '10') params.set('size', query.size)
    if (query.page) params.set('page', query.page)
    if (!query.showWeekendsAndHolidays) params.set('showWeekendsAndHolidays', '0')
    if (!query.showReminders) params.set('showReminders', '0')
    if (!query.showScheduledHours) params.set('showScheduledHours', '0')
    if (query.showWeekNumbers) params.set('showWeekNumbers', '1')
    if (query.showDayOccupancy) params.set('showDayOccupancy', '1')
    if (selectedOption) params.set('week', String(selectedOption.weekNumber))

    router.replace(`/hr-calendar?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{labels.week}</span>
      <DropdownSelect
        aria-label={labels.week}
        className="min-w-36"
        onChange={(event) => updateWeek(event.currentTarget.value)}
        placeholder={labels.weekSelectPlaceholder}
        searchable
        searchPlaceholder={labels.searchWeek}
        value={selectedWeek ? String(selectedWeek) : ''}
      >
        <option value="">{labels.weekSelectPlaceholder}</option>
        {options.map((option) => (
          <option key={`${currentYear}-${option.weekNumber}`} value={option.weekNumber}>
            {labels.week} {option.weekNumber}
          </option>
        ))}
      </DropdownSelect>
    </label>
  )
}

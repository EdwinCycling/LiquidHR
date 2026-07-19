'use client'

import { useRouter } from 'next/navigation'

interface HrCalendarPageSizeSelectProps {
  month: string
  currentSize: '10' | '25' | 'all'
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
  labels: {
    pageSize: string
    allMax100: string
  }
}

export function HrCalendarPageSizeSelect({
  month,
  currentSize,
  query,
  labels,
}: HrCalendarPageSizeSelectProps) {
  const router = useRouter()

  function updateSize(size: '10' | '25' | 'all') {
    const params = new URLSearchParams()
    params.set('month', month)
    if (query.q.trim()) params.set('q', query.q.trim())
    if (query.department) params.set('department', query.department)
    if (query.employee) params.set('employee', query.employee)
    if (query.jobGroup) params.set('jobGroup', query.jobGroup)
    if (query.job) params.set('job', query.job)
    if (query.week && query.showWeekNumbers) params.set('week', query.week)
    for (const type of query.type) params.append('type', type)
    if (size !== '10') params.set('size', size)
    if (!query.showWeekendsAndHolidays) params.set('showWeekendsAndHolidays', '0')
    if (!query.showReminders) params.set('showReminders', '0')
    if (!query.showScheduledHours) params.set('showScheduledHours', '0')
    if (query.showWeekNumbers) params.set('showWeekNumbers', '1')
    if (query.showDayOccupancy) params.set('showDayOccupancy', '1')
    router.replace(`/hr-calendar?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
      <span className="truncate">{labels.pageSize}</span>
      <select
        className="form-field h-8 min-h-8 w-20 px-2 text-xs sm:w-24 sm:text-sm"
        onChange={(event) => updateSize(event.currentTarget.value as '10' | '25' | 'all')}
        value={currentSize}
      >
        <option value="10">10</option>
        <option value="25">25</option>
        <option value="all">{labels.allMax100}</option>
      </select>
    </label>
  )
}

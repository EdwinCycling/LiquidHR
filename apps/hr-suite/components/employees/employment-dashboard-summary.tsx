'use client'

import { useState } from 'react'
import { SalaryReveal } from '@/components/employees/salary-reveal'
import type { EmployeeDashboardLabels } from '@/components/employees/employee-dashboard'
import type { EmployeeDetailViewModel } from './types'
import { getEmploymentCardStatus } from '@/lib/employment/employment-card-state'

export function EmploymentDashboardSummary({ employeeId, employments, cards, currentSummary, canReadSalary, labels, locale }: {
  employeeId: string
  employments: EmployeeDetailViewModel['employments']
  cards: EmployeeDetailViewModel['employmentCards']
  currentSummary: EmployeeDetailViewModel['currentEmploymentSummary']
  canReadSalary: boolean
  labels: EmployeeDashboardLabels
  locale: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const activeEmployments = employments.filter((employment) => getEmploymentCardStatus({ startsOn: employment.starts_on, endsOn: employment.ends_on, recordStatus: employment.record_status }, today) === 'ACTIVE')
  const initialId = activeEmployments.some((employment) => employment.id === currentSummary.employmentId)
    ? currentSummary.employmentId
    : activeEmployments[0]?.id ?? currentSummary.employmentId
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const selectedCard = cards.find((card) => card.employmentId === selectedId)
  const selectedSummary = selectedId === currentSummary.employmentId ? currentSummary : null

  if (activeEmployments.length === 0) {
    return <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{labels.employmentEmpty}</p>
  }

  return <div className="space-y-4">
    {activeEmployments.length > 1 ? <div aria-label={labels.employment} className="flex flex-wrap gap-2" role="tablist">
      {activeEmployments.map((employment) => <button aria-selected={selectedId === employment.id} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${selectedId === employment.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'}`} key={employment.id} onClick={() => setSelectedId(employment.id)} role="tab" type="button">{employment.employment_number}</button>)}
    </div> : null}
    <dl className="space-y-4">
      <DataPoint label={labels.department} value={selectedCard?.departmentName ?? labels.notRecorded} />
      <DataPoint label={labels.jobTitle} value={selectedCard?.jobTitle ?? labels.notRecorded} />
      <DataPoint label={labels.manager} value={selectedSummary?.managerName ?? labels.notRecorded} />
      <DataPoint label={labels.hoursPerWeek} value={selectedCard?.hoursPerWeek === null || selectedCard?.hoursPerWeek === undefined ? labels.notRecorded : `${selectedCard.hoursPerWeek}u`} />
      <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{labels.salary}</dt><dd className="mt-1"><SalaryReveal employeeId={employeeId} employmentId={selectedId ?? undefined} locale={locale} canRead={canReadSalary} labels={{ hidden: labels.salaryHidden, loading: labels.salaryLoading, failed: labels.salaryFailed, monthly: labels.salaryMonthly, hourly: labels.salaryHourly, notAvailable: labels.salaryNotAvailable }} /></dd></div>
    </dl>
  </div>
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</dt><dd className="mt-1 truncate text-sm font-semibold">{value}</dd></div>
}

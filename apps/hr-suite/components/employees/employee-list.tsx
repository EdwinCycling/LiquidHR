import { ArrowUpRight, BriefcaseBusiness, Mail } from 'lucide-react'
/* eslint-disable @next/next/no-img-element -- private avatar routes and customer-hosted URLs are intentionally rendered without remote image configuration. */
import Link from 'next/link'
import type { EmployeeOverview } from '@/lib/employment/employment-service'
import type { EmploymentStatus } from '@/lib/employment/employment-status'
import { EmailLink } from '@/components/shared/email-link'

interface EmployeeListProps {
  employees: EmployeeOverview[]
  labels: Record<EmploymentStatus, string>
  emptyLabel: string
  employmentCountLabel: (count: number) => string
  archiveLabel: string
  employeeNumberLabel: string
  departmentLabel: string
  jobTitleLabel: string
  noEmailLabel: string
  notRecordedLabel: string
  view: 'compact' | 'detail'
}

const STATUS_STYLES: Record<EmploymentStatus, string> = {
  ACTIVE_EMPLOYEE: 'bg-success-surface text-success',
  FUTURE_EMPLOYEE: 'bg-accent text-accent-foreground',
  FORMER_EMPLOYEE: 'bg-muted text-muted-foreground',
  NEVER_EMPLOYED: 'bg-warning-surface text-warning',
}

export function EmployeeList({
  employees,
  labels,
  emptyLabel,
  employmentCountLabel,
  archiveLabel,
  employeeNumberLabel,
  departmentLabel,
  jobTitleLabel,
  noEmailLabel,
  notRecordedLabel,
  view,
}: EmployeeListProps) {
  if (employees.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed bg-surface/70 px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">{emptyLabel}</p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <ul className="divide-y">
        {employees.map((employee, index) => (
          <li key={employee.id} className={index % 2 === 1 ? 'bg-muted/20' : ''}>
            <div className={`group relative grid cursor-pointer px-4 transition-colors hover:bg-accent/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 ${view === 'compact' ? 'gap-3 py-2.5' : 'gap-4 py-4 sm:py-5'}`}>
              <Link
                aria-label={[employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')}
                className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                href={`/employees/${employee.id}`}
              />
              <div className="relative z-10 min-w-0 pointer-events-none">
                <div className={`flex min-w-0 items-center ${view === 'compact' ? 'gap-2.5' : 'gap-3.5'}`}>
                  {view === 'detail' ? (
                    employee.avatarUrl ? <img src={employee.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-wide text-primary-foreground shadow-sm">{employee.firstName.slice(0, 1)}{employee.birthName.slice(0, 1)}</span>
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {employeeNumberLabel}: {employee.employeeNumber}
                    </p>
                    <p className={`truncate font-semibold text-foreground ${view === 'compact' ? 'text-sm' : ''}`}>
                      {[employee.firstName, employee.birthNamePrefix, employee.birthName].filter(Boolean).join(' ')}
                    </p>
                    {view === 'detail' ? <p className="mt-1 truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">{departmentLabel}:</span>{' '}
                      {employee.departmentName ?? notRecordedLabel}
                      <span className="px-1.5 text-muted-foreground/70">·</span>
                      <span className="font-medium text-foreground/80">{jobTitleLabel}:</span>{' '}
                      {employee.jobTitle ?? notRecordedLabel}
                    </p> : null}
                  </div>
                </div>
                {view === 'detail' ? <span className="mt-1 flex min-w-0 items-center gap-1.5 pl-[3.875rem] text-sm text-muted-foreground">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {employee.workEmail ? <EmailLink className="pointer-events-auto relative z-20 truncate hover:underline" email={employee.workEmail} /> : <span className="truncate">{noEmailLabel}</span>}
                </span> : null}
              </div>
              <div className={`relative z-10 flex items-center justify-between gap-3 pointer-events-none sm:justify-end ${view === 'detail' ? 'pl-[3.4rem] sm:pl-0' : 'pl-0'}`}>
                {employee.isArchived && <span className="rounded-md bg-warning-surface px-2.5 py-1 text-xs font-semibold text-warning">{archiveLabel}</span>}
                <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[employee.status]}`}>
                  {labels[employee.status]}
                </span>
                <span className="hidden text-xs font-medium text-muted-foreground md:inline">
                  {employmentCountLabel(employee.employmentCount)}
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

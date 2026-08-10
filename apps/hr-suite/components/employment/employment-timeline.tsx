'use client'

import type { Database } from '@scope/db'
import Link from 'next/link'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import { seniorityDuration } from '@/lib/employment/seniority'
import { getEmploymentCardStatus } from '@/lib/employment/employment-card-state'

type Employment = Database['public']['Tables']['employments']['Row']

interface EmploymentTimelineProps {
  employments: Employment[]
  summaries: Array<{ employmentId: string; administrationName: string | null; departmentName: string | null; jobTitle: string | null; hoursPerWeek: number | null; laborConditionName: string | null; employmentType: Database['public']['Enums']['employment_type'] | null; workerType: Database['public']['Enums']['employment_worker_type'] | null; contractType: Database['public']['Enums']['contract_duration_type'] | null }>
  locale: string
  dateFormat: DateFormat
  labels: {
    empty: string
    active: string
    ended: string
    future: string
    primary: string
    employmentNumber: string
    editDetail: string
    status: string
    contractDetails: string
    contractType: string
    indefinite: string
    definite: string
    temporaryWithoutEnd: string
    seniority: string
    seniorityDuration: string
    administration: string
    department: string
    jobTitle: string
    hoursPerWeek: string
    laborConditions: string
    workerType: string
    workerEmployee: string
    workerStudentIntern: string
    workerTemporaryAgency: string
    workerExternal: string
    workerFreelancer: string
    workerVolunteer: string
    workerNoPayroll: string
    hoursPerWeekSuffix: string
    noActiveContract: string
    notRecorded: string
  }
}

export function EmploymentTimeline({ employments, summaries, locale, dateFormat, labels }: EmploymentTimelineProps) {
  if (employments.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{labels.empty}</p>
  }
  const today = new Date().toISOString().slice(0, 10)
  const format = (value: string) => formatDate(value, { locale, dateFormat })

  return (
    <ol className={`grid w-full gap-5 ${employments.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
      {employments.map((employment) => {
        const status = getEmploymentCardStatus({ startsOn: employment.starts_on, endsOn: employment.ends_on, recordStatus: employment.record_status }, today)
        const statusLabel = status === 'ACTIVE' ? labels.active : status === 'FUTURE' ? labels.future : labels.ended
        const summary = summaries.find((item) => item.employmentId === employment.id)
        const duration = seniorityDuration(employment.seniority_date, today)
        const workerType = summary?.workerType === 'EMPLOYEE' ? labels.workerEmployee : summary?.workerType === 'STUDENT_INTERN' ? labels.workerStudentIntern : summary?.workerType === 'TEMPORARY_AGENCY' ? labels.workerTemporaryAgency : summary?.workerType === 'EXTERNAL_NO_PAYROLL' ? labels.workerExternal : labels.notRecorded
        const contractType = summary?.contractType === 'INDEFINITE' ? labels.indefinite : summary?.contractType === 'DEFINITE' ? labels.definite : summary?.contractType === 'TEMPORARY_NO_END' ? labels.temporaryWithoutEnd : null
        return (
          <li key={employment.id}>
            <Link prefetch={false} href={`/employees/${employment.employee_id}/employments/${employment.id}?fromTab=employments`} className="group block h-full cursor-pointer rounded-2xl border bg-surface p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {labels.employmentNumber} {employment.employment_number}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {employment.is_primary && <span className="status-chip">{labels.primary}</span>}
                  <span className="status-chip">{statusLabel}</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {format(employment.starts_on)} — {employment.ends_on ? format(employment.ends_on) : labels.active}
              </p>
              <dl className="mt-5 grid gap-x-5 gap-y-3 border-t pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.seniority}</dt><dd className="mt-1 font-medium">{employment.seniority_date ? format(employment.seniority_date) : labels.notRecorded}{duration ? <span className="mt-1 block text-sm font-normal text-muted-foreground">{labels.seniorityDuration.replace('{years}', String(duration.years)).replace('{months}', String(duration.months))}</span> : null}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.administration}</dt><dd className="mt-1 font-medium">{summary?.administrationName ?? labels.notRecorded}</dd></div>
              </dl>
              <div className="mt-5 border-t pt-4">
                {summary?.contractType ? <>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.contractDetails}</p>
                  <dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.contractType}</dt><dd className="mt-1 font-medium">{contractType ?? labels.notRecorded}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.department}</dt><dd className="mt-1 font-medium">{summary?.departmentName ?? labels.notRecorded}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.jobTitle}</dt><dd className="mt-1 font-medium">{summary?.jobTitle ?? labels.notRecorded}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.hoursPerWeek}</dt><dd className="mt-1 font-medium">{summary?.hoursPerWeek === null || summary?.hoursPerWeek === undefined ? labels.notRecorded : `${summary.hoursPerWeek} ${labels.hoursPerWeekSuffix}`}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.laborConditions}</dt><dd className="mt-1 font-medium">{summary?.laborConditionName ?? labels.notRecorded}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.workerType}</dt><dd className="mt-1 font-medium">{workerType}</dd></div>
                  </dl>
                </> : <p className="text-sm text-muted-foreground">{labels.noActiveContract}</p>}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
                <span className="text-sm font-medium text-muted-foreground">{labels.status}</span>
                <span className="button-secondary cursor-pointer transition-colors group-hover:border-primary/40 group-hover:text-primary">{labels.editDetail} <span aria-hidden="true">→</span></span>
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

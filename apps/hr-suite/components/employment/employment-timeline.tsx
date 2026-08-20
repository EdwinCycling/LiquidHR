'use client'

import type { Database } from '@scope/db'
import Link from 'next/link'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import { seniorityDuration } from '@/lib/employment/seniority'
import { getEmploymentCardStatus } from '@/lib/employment/employment-card-state'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoList } from '@/components/patterns/info-list'
import { Surface } from '@/components/ui/surface'

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
    return <EmptyState title={labels.empty} />
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
            <Link prefetch={false} href={`/employees/${employment.employee_id}/employments/${employment.id}?fromTab=employments`} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Surface className="h-full p-5 transition-colors group-hover:border-primary/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {labels.employmentNumber} {employment.employment_number}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {employment.is_primary && <Badge tone="info">{labels.primary}</Badge>}
                  <Badge tone={status === 'ACTIVE' ? 'success' : status === 'FUTURE' ? 'info' : 'neutral'}>{statusLabel}</Badge>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {format(employment.starts_on)} — {employment.ends_on ? format(employment.ends_on) : labels.active}
              </p>
              <InfoList className="mt-5 border-t border-subtle pt-4" columns={2} items={[
                { label: labels.seniority, value: <>{employment.seniority_date ? format(employment.seniority_date) : labels.notRecorded}{duration ? <span className="mt-1 block text-sm text-muted-foreground">{labels.seniorityDuration.replace('{years}', String(duration.years)).replace('{months}', String(duration.months))}</span> : null}</> },
                { label: labels.administration, value: summary?.administrationName ?? labels.notRecorded },
              ]} />
              <div className="mt-5 border-t border-subtle pt-4">
                {summary?.contractType ? <>
                  <p className="text-sm font-semibold">{labels.contractDetails}</p>
                  <InfoList className="mt-3" columns={2} items={[
                    { label: labels.contractType, value: contractType ?? labels.notRecorded },
                    { label: labels.department, value: summary?.departmentName ?? labels.notRecorded },
                    { label: labels.jobTitle, value: summary?.jobTitle ?? labels.notRecorded },
                    { label: labels.hoursPerWeek, value: summary?.hoursPerWeek === null || summary?.hoursPerWeek === undefined ? labels.notRecorded : `${summary.hoursPerWeek} ${labels.hoursPerWeekSuffix}` },
                    { label: labels.laborConditions, value: summary?.laborConditionName ?? labels.notRecorded },
                    { label: labels.workerType, value: workerType },
                  ]} />
                </> : <p className="text-sm text-muted-foreground">{labels.noActiveContract}</p>}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-subtle pt-4">
                <span className="text-sm font-medium text-muted-foreground">{labels.status}</span>
                <span className="text-sm font-semibold text-primary">{labels.editDetail} <span aria-hidden="true">→</span></span>
              </div>
              </Surface>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

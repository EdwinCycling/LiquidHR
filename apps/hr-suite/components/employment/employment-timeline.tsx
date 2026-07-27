'use client'

import type { Database } from '@scope/db'
import Link from 'next/link'
import { TerminationForm } from './termination-form'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'

type Employment = Database['public']['Tables']['employments']['Row']

interface EmploymentTimelineProps {
  employments: Employment[]
  locale: string
  dateFormat: DateFormat
  options: {
    internalReasons: Array<{ id: string; name: string }>
    statutoryReasons: Array<{ id: string; code: string; label: string }>
  }
  canManage?: boolean
  labels: {
    empty: string
    active: string
    ended: string
    future: string
    primary: string
    employmentNumber: string
    terminate: TerminationFormProps['labels']
    editDetail: string
    indefinite: string
    definite: string
  }
}

type TerminationFormProps = Parameters<typeof TerminationForm>[0]

export function EmploymentTimeline({ employments, locale, dateFormat, options, canManage = false, labels }: EmploymentTimelineProps) {
  if (employments.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{labels.empty}</p>
  }
  const today = new Date().toISOString().slice(0, 10)
  const format = (value: string) => formatDate(value, { locale, dateFormat })

  return (
    <ol className={`grid gap-5 ${employments.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
      {employments.map((employment) => {
        const status = employment.starts_on > today ? 'future' : employment.ends_on && employment.ends_on < today ? 'ended' : 'active'
        return (
          <li key={employment.id}>
            <article className="h-full rounded-2xl border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {labels.employmentNumber} {employment.employment_number}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{employment.contract_type === 'INDEFINITE' ? labels.indefinite : labels.definite}</h3>
                </div>
                <div className="flex gap-2">
                  {employment.is_primary && <span className="status-chip">{labels.primary}</span>}
                  <span className="status-chip">{labels[status]}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {format(employment.starts_on)} — {employment.ends_on ? format(employment.ends_on) : labels.active}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link prefetch={false} href={`/employees/${employment.employee_id}/employments/${employment.id}?fromTab=employments`} className="button-primary">{labels.editDetail}</Link>
              </div>
              {canManage && status === 'active' && (
                <div className="mt-5">
                  <TerminationForm
                    employmentId={employment.id}
                    internalReasons={options.internalReasons}
                    statutoryReasons={options.statutoryReasons}
                    labels={labels.terminate}
                  />
                </div>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}

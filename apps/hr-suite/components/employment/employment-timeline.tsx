'use client'

import type { Database } from '@scope/db'
import Link from 'next/link'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'

type Employment = Database['public']['Tables']['employments']['Row']

interface EmploymentTimelineProps {
  employments: Employment[]
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
    indefinite: string
    definite: string
  }
}

export function EmploymentTimeline({ employments, locale, dateFormat, labels }: EmploymentTimelineProps) {
  if (employments.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{labels.empty}</p>
  }
  const today = new Date().toISOString().slice(0, 10)
  const format = (value: string) => formatDate(value, { locale, dateFormat })

  return (
    <ol className={`grid w-full gap-5 ${employments.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
      {employments.map((employment) => {
        const status = employment.starts_on > today ? 'future' : employment.ends_on && employment.ends_on < today ? 'ended' : 'active'
        return (
          <li key={employment.id}>
            <Link prefetch={false} href={`/employees/${employment.employee_id}/employments/${employment.id}?fromTab=employments`} className="group block h-full cursor-pointer rounded-2xl border bg-surface p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {labels.employmentNumber} {employment.employment_number}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">{employment.contract_type === 'INDEFINITE' ? labels.indefinite : labels.definite}</h3>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {employment.is_primary && <span className="status-chip">{labels.primary}</span>}
                  <span className="status-chip">{labels[status]}</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {format(employment.starts_on)} — {employment.ends_on ? format(employment.ends_on) : labels.active}
              </p>
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

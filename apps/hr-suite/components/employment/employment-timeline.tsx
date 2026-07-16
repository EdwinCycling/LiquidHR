import type { Database } from '@scope/db'
import Link from 'next/link'
import { TerminationForm } from './termination-form'

type Employment = Database['public']['Tables']['employments']['Row']

interface EmploymentTimelineProps {
  employments: Employment[]
  locale: string
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
    openDetail: string
  }
}

type TerminationFormProps = Parameters<typeof TerminationForm>[0]

export function EmploymentTimeline({ employments, locale, options, canManage = false, labels }: EmploymentTimelineProps) {
  if (employments.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{labels.empty}</p>
  }
  const today = new Date().toISOString().slice(0, 10)
  const format = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-6 before:left-[0.42rem] before:top-6 before:w-px before:bg-border">
      {employments.map((employment) => {
        const status = employment.starts_on > today ? 'future' : employment.ends_on && employment.ends_on < today ? 'ended' : 'active'
        return (
          <li key={employment.id} className="relative grid grid-cols-[1rem_1fr] gap-4">
            <span className="mt-6 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary ring-4 ring-background" />
            <article className="rounded-xl border bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {labels.employmentNumber} {employment.employment_number}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{employment.contract_type}</h3>
                </div>
                <div className="flex gap-2">
                  {employment.is_primary && <span className="status-chip">{labels.primary}</span>}
                  <span className="status-chip">{labels[status]}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {format(employment.starts_on)} — {employment.ends_on ? format(employment.ends_on) : labels.active}
              </p>
              <Link href={`/employees/${employment.employee_id}/employments/${employment.id}`} className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">{labels.openDetail}</Link>
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

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { SectionHeader } from '@/components/patterns/section-header'
import type { PayrollSourceReadinessStatus } from '@/lib/payroll/source/source-readiness'

export type PayrollSourceReadinessItem = {
  readonly key: string
  readonly label: string
  readonly status: PayrollSourceReadinessStatus
  readonly details: string
  readonly sourceVersion: string | null
  readonly href: string
  readonly actionLabel: string
}

type Props = {
  readonly title: string
  readonly description: string
  readonly scopeLabel: string
  readonly periodLabel: string
  readonly rows: readonly PayrollSourceReadinessItem[]
  readonly statusLabels: Readonly<Record<PayrollSourceReadinessStatus, string>>
}

function statusTone(status: PayrollSourceReadinessStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'READY') return 'success'
  if (status === 'MISSING') return 'warning'
  if (status === 'CONFLICT') return 'danger'
  return 'neutral'
}

export function PayrollSourceReadinessPanel({ title, description, scopeLabel, periodLabel, rows, statusLabels }: Props) {
  return (
    <Surface className="p-5 sm:p-6">
      <SectionHeader title={title} description={description} actions={<Badge tone="neutral">{periodLabel}</Badge>} />
      <p className="mt-3 break-all text-xs text-muted-foreground">{scopeLabel}</p>
      <ul className="mt-4 divide-y divide-border/70 border-t border-subtle">
        {rows.map((row) => (
          <li className="flex flex-col gap-3 py-4 first:pt-4 sm:flex-row sm:items-start sm:justify-between" key={row.key}>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{row.label}</h3>
                <Badge tone={statusTone(row.status)}>{statusLabels[row.status]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{row.details}</p>
              {row.sourceVersion ? <p className="break-all text-xs text-muted-foreground">{row.sourceVersion}</p> : null}
            </div>
            <Link className={buttonClasses({ variant: 'secondary', size: 'sm' })} href={row.href} prefetch={false}>
              {row.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  )
}

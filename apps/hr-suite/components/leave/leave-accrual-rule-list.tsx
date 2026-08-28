'use client'

import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'

type Labels = {
  title: string
  description: string
  empty: string
  add: string
  edit: string
  version: string
  current: string
  ended: string
  profile: string
  contractHours: string
  workedHours: string
  ageSeniority: string
  payrollPeriod: string
  fourWeekly: string
  monthly: string
  yearly: string
  upfront: string
  arrears: string
  amount: string
  rate: string
  validFrom: string
  validUntil: string
  noValue: string
}

function quantity(rule: LeaveCatalog['accrualRules'][number], labels: Labels): string {
  if (rule.accrual_basis === 'AGE_SENIORITY') return labels.ageSeniority
  if (rule.accrual_basis === 'CONTRACT_HOURS') return `${labels.amount}: ${rule.accrual_amount ?? 0}u`
  return `${labels.rate}: ${rule.accrual_rate ?? 0}u/u`
}

function frequencyLabel(frequency: LeaveCatalog['accrualRules'][number]['accrual_frequency'], labels: Labels): string {
  if (frequency === 'PAYROLL_PERIOD') return labels.payrollPeriod
  if (frequency === 'FOUR_WEEKLY') return labels.fourWeekly
  if (frequency === 'MONTHLY') return labels.monthly
  return labels.yearly
}

export function LeaveAccrualRuleList({ catalog, leaveTypeId, labels, onAdd, onSelect }: { catalog: LeaveCatalog; leaveTypeId: string; labels: Labels; onAdd: () => void; onSelect: (ruleId: string) => void }) {
  const rules = catalog.accrualRules.filter((rule) => rule.leave_type_id === leaveTypeId).sort((left, right) => left.valid_from.localeCompare(right.valid_from))
  const profileNames = new Map(catalog.profiles.map((profile) => [profile.id, profile.name]))
  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p></div>
        <Button onClick={onAdd} size="sm" type="button" variant="secondary">{labels.add}</Button>
      </div>
      <div className="mt-5 space-y-3">
        {rules.map((rule, index) => <article aria-label={`${labels.edit}: ${labels.version.replace('{number}', String(index + 1))}`} className="group block w-full cursor-pointer rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-muted/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" key={rule.id} onClick={() => onSelect(rule.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(rule.id) } }} role="button" tabIndex={0}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-semibold">{labels.version.replace('{number}', String(index + 1))}</p><p className="mt-1 text-sm text-muted-foreground">{labels.profile}: {profileNames.get(rule.leave_profile_id) ?? rule.leave_profile_id}</p></div>
            <Badge tone={rule.valid_until ? 'neutral' : 'success'}>{rule.valid_until ? labels.ended : labels.current}</Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.validFrom}</dt><dd className="mt-1 font-medium">{rule.valid_from}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.validUntil}</dt><dd className="mt-1 font-medium">{rule.valid_until ?? labels.noValue}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.title}</dt><dd className="mt-1 font-medium">{rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : rule.accrual_basis === 'WORKED_HOURS' ? labels.workedHours : labels.ageSeniority}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.amount}</dt><dd className="mt-1 font-medium">{quantity(rule, labels)} · {frequencyLabel(rule.accrual_frequency, labels)} · {rule.accrual_timing === 'UPFRONT' ? labels.upfront : labels.arrears}</dd></div>
          </dl>
          <span className="mt-4 inline-flex rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground transition group-hover:border-primary/40 group-hover:text-primary">{labels.edit}</span>
        </article>)}
        {rules.length === 0 ? <EmptyState title={labels.empty} /> : null}
      </div>
    </Surface>
  )
}

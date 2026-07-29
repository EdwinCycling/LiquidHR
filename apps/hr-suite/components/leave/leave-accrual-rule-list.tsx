'use client'

import type { LeaveCatalog } from '@/lib/leave/leave-service'

type Labels = {
  title: string
  description: string
  empty: string
  add: string
  version: string
  current: string
  ended: string
  successor: string
  select: string
  profile: string
  contractHours: string
  workedHours: string
  ageSeniority: string
  payrollPeriod: string
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

export function LeaveAccrualRuleList({ catalog, leaveTypeId, labels, onAdd, onSelect }: { catalog: LeaveCatalog; leaveTypeId: string; labels: Labels; onAdd: () => void; onSelect: (ruleId: string) => void }) {
  const rules = catalog.accrualRules.filter((rule) => rule.leave_type_id === leaveTypeId).sort((left, right) => left.valid_from.localeCompare(right.valid_from))
  const profileNames = new Map(catalog.profiles.map((profile) => [profile.id, profile.name]))
  return (
    <section className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{labels.title}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p></div>
        <button className="button-secondary" onClick={onAdd} type="button">{labels.add}</button>
      </div>
      <div className="mt-5 space-y-3">
        {rules.map((rule, index) => <article className="rounded-xl border p-4" key={rule.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-semibold">{labels.version.replace('{number}', String(index + 1))}</p><p className="mt-1 text-sm text-muted-foreground">{labels.profile}: {profileNames.get(rule.leave_profile_id) ?? rule.leave_profile_id}</p></div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.valid_until ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success'}`}>{rule.valid_until ? labels.ended : labels.current}</span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.validFrom}</dt><dd className="mt-1 font-medium">{rule.valid_from}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.validUntil}</dt><dd className="mt-1 font-medium">{rule.valid_until ?? labels.noValue}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.title}</dt><dd className="mt-1 font-medium">{rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : rule.accrual_basis === 'WORKED_HOURS' ? labels.workedHours : labels.ageSeniority}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{labels.amount}</dt><dd className="mt-1 font-medium">{quantity(rule, labels)} · {rule.accrual_frequency === 'PAYROLL_PERIOD' ? labels.payrollPeriod : labels.yearly} · {rule.accrual_timing === 'UPFRONT' ? labels.upfront : labels.arrears}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => onSelect(rule.id)} type="button">{rule.valid_until ? labels.select : labels.successor}</button>
          </div>
        </article>)}
        {rules.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.empty}</div> : null}
      </div>
    </section>
  )
}

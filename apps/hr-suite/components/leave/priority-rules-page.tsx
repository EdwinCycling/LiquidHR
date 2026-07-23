'use client'

import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type PriorityLabels = {
  add: string
  year: string
  columns: { name: string; types: string; status: string }
  active: string
  inactive: string
  empty: string
  emptyDescription: string
  back: string
  profile: string
  types: string
  edit: string
  showInactive: string
}

function overlapsYear(validFrom: string, validUntil: string | null, year: number) {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  return validFrom <= end && (validUntil === null || validUntil > start)
}

export function PriorityRulesPage({ initial, labels, initialYear }: { initial: LeaveCatalog; labels: PriorityLabels; initialYear: number }) {
  const [showInactive, setShowInactive] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const yearParam = Number(searchParams.get('year'))
  const selectedYear = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : initialYear
  const profiles = useMemo(() => new Map(initial.profiles.map((profile) => [profile.id, profile.name])), [initial.profiles])
  const itemsByRule = useMemo(() => {
    const result = new Map<string, typeof initial.priorityRuleItems>()
    for (const item of initial.priorityRuleItems) result.set(item.priority_rule_id, [...(result.get(item.priority_rule_id) ?? []), item])
    return result
  }, [initial])
  const rows = initial.priorityRules.filter((rule) => overlapsYear(rule.valid_from, rule.valid_until, selectedYear) && (showInactive || rule.is_active))
  const changeYear = (nextYear: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', String(nextYear))
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link aria-label={labels.back} className="rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground" href="/settings/leave-accrual"><ArrowLeft aria-hidden="true" size={19} /></Link>
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground" htmlFor="priority-year">{labels.year}
            <select className="rounded-md border bg-surface px-2 py-1.5" id="priority-year" onChange={(event) => changeYear(Number(event.target.value))} value={selectedYear}>
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <Link className="button-primary gap-2" href={`/settings/leave-accrual/priority-rules/new?year=${selectedYear}`}><Plus aria-hidden="true" size={17} />{labels.add}</Link>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
        {rows.length === 0 ? <div className="p-10 text-center"><p className="font-semibold">{labels.empty}</p><p className="mt-2 text-sm text-muted-foreground">{labels.emptyDescription}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">{labels.columns.name}</th><th className="px-5 py-3 font-semibold">{labels.columns.types}</th><th className="px-5 py-3 font-semibold">{labels.columns.status}</th></tr></thead><tbody className="divide-y">{rows.map((rule) => { const count = itemsByRule.get(rule.id)?.length ?? 0; return <tr className={`${rule.is_active ? '' : 'opacity-60'} transition hover:bg-accent/30`} key={rule.id}><td className="px-5 py-4"><Link className="font-semibold text-primary hover:underline" href={`/settings/leave-accrual/priority-rules/${rule.id}?year=${selectedYear}`}>{rule.name}</Link><span className="mt-1 block text-xs text-muted-foreground">{labels.profile}: {profiles.get(rule.leave_profile_id) ?? rule.leave_profile_id}</span></td><td className="px-5 py-4 text-muted-foreground">{count} {labels.types}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{rule.is_active ? labels.active : labels.inactive}</span></td></tr> })}</tbody></table></div>}
      </section>
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input checked={showInactive} className="size-4 accent-primary" onChange={(event) => setShowInactive(event.target.checked)} type="checkbox" />{labels.showInactive}</label>
    </div>
  )
}

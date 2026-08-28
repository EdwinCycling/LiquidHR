'use client'

import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'

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

function overlapsYear(validFrom: string, validUntil: string | null, year: number): boolean {
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
  }, [initial.priorityRuleItems])
  const rows = initial.priorityRules.filter((rule) => overlapsYear(rule.valid_from, rule.valid_until, selectedYear) && (showInactive || rule.is_active))
  const changeYear = (nextYear: number): void => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', String(nextYear))
    router.replace(`${pathname}?${params.toString()}`)
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Link aria-label={labels.back} className={buttonClasses({ size: 'sm', variant: 'ghost', className: 'shrink-0 px-2' })} href="/settings/leave-accrual"><ArrowLeft aria-hidden="true" /></Link><FormFieldYear label={labels.year} selectedYear={selectedYear} onChange={changeYear} /></div><Link className={buttonClasses({ className: 'gap-2' })} href={`/settings/leave-accrual/priority-rules/new?year=${selectedYear}`}><Plus aria-hidden="true" />{labels.add}</Link></div>
    <Surface className="overflow-hidden p-0"><DataTableShell caption={labels.columns.name} className="rounded-none border-0" state={rows.length === 0 ? 'empty' : 'ready'} stateContent={<EmptyState description={labels.emptyDescription} title={labels.empty} />}><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">{labels.columns.name}</th><th className="px-5 py-3 font-semibold">{labels.columns.types}</th><th className="px-5 py-3 font-semibold">{labels.columns.status}</th></tr></thead><tbody className="divide-y divide-border-subtle">{rows.map((rule) => { const count = itemsByRule.get(rule.id)?.length ?? 0; return <tr className={rule.is_active ? '' : 'opacity-60'} key={rule.id}><td className="px-5 py-4"><Link className="font-semibold text-primary hover:underline" href={`/settings/leave-accrual/priority-rules/${rule.id}?year=${selectedYear}`}>{rule.name}</Link><span className="mt-1 block text-xs text-muted-foreground">{labels.profile}: {profiles.get(rule.leave_profile_id) ?? rule.leave_profile_id}</span></td><td className="px-5 py-4 text-muted-foreground">{count} {labels.types}</td><td className="px-5 py-4"><Badge tone={rule.is_active ? 'success' : 'neutral'}>{rule.is_active ? labels.active : labels.inactive}</Badge></td></tr> })}</tbody></DataTableShell></Surface>
    <Checkbox checked={showInactive} label={labels.showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
  </div>
}

function FormFieldYear({ label, selectedYear, onChange }: { label: string; selectedYear: number; onChange: (year: number) => void }) {
  return <label className="flex items-center gap-2 text-sm font-semibold text-foreground" htmlFor="priority-year">{label}<DropdownSelect aria-label={label} id="priority-year" onChange={(event) => onChange(Number(event.target.value))} value={String(selectedYear)}><option value={String(selectedYear - 1)}>{selectedYear - 1}</option><option value={String(selectedYear)}>{selectedYear}</option><option value={String(selectedYear + 1)}>{selectedYear + 1}</option></DropdownSelect></label>
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MoreVertical, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type Tab = 'leave' | 'overtime' | 'workHours'

export type LeaveCatalogLabels = {
  addType: string
  addWorkHour: string
  priorityRules: string
  showInactive: string
  empty: string
  emptyDescription: string
  active: string
  inactive: string
  tabs: Record<Tab, string>
  columns: { name: string; accrual: string; expiry: string; approval: string; category: string }
  approvalYes: string
  approvalNo: string
  perYear: string
  unlimited: string
  noExpiry: string
  yearEnd: string
  monthsAfterYear: string
  notConfigured: string
  moreActions: string
  contractHours: string
  workedHours: string
  payrollPeriod: string
  yearly: string
}

function resolveTab(value: string | null): Tab {
  return value === 'overtime' || value === 'workHours' ? value : 'leave'
}

export function LeaveCatalogPage({ initial, labels }: { initial: LeaveCatalog; labels: LeaveCatalogLabels }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showInactive, setShowInactive] = useState(false)
  const tab = resolveTab(searchParams.get('tab'))

  const changeTab = (nextTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === 'leave') params.delete('tab')
    else params.set('tab', nextTab)
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const rows = useMemo(() => {
    if (tab === 'leave') return initial.leaveTypes.filter((item) => showInactive || item.is_active).map((item) => ({ id: item.id, name: item.name, colorCode: item.color_code, active: item.is_active, category: null, href: `/settings/leave-accrual/types/${item.id}`, entitlement: item.entitlement_mode, rule: initial.accrualRules.filter((rule) => rule.leave_type_id === item.id).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] }))
    const category = tab === 'overtime' ? 'OVERTIME' : undefined
    return initial.workHourTypes.filter((item) => (category ? item.category === category : item.category !== 'OVERTIME') && (showInactive || item.is_active)).map((item) => ({ id: item.id, name: item.name, colorCode: item.color_code, active: item.is_active, category: item.category, href: `/settings/leave-accrual/work-hours/${item.id}`, entitlement: null, rule: null }))
  }, [initial, showInactive, tab])

  const addHref = tab === 'leave' ? '/settings/leave-accrual/types/new' : '/settings/leave-accrual/work-hours/new'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto border-b sm:gap-5">
          {(Object.keys(labels.tabs) as Tab[]).map((item) => (
            <button className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} key={item} onClick={() => changeTab(item)} type="button">{labels.tabs[item]}{item === 'leave' ? ` (${initial.leaveTypes.length})` : item === 'overtime' ? ` (${initial.workHourTypes.filter((type) => type.category === 'OVERTIME').length})` : ` (${initial.workHourTypes.filter((type) => type.category !== 'OVERTIME').length})`}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link className="button-secondary" href="/settings/leave-accrual/priority-rules">{labels.priorityRules}</Link>
          <Link className="button-primary gap-2" href={addHref}><Plus aria-hidden="true" size={16} />{tab === 'leave' ? labels.addType : labels.addWorkHour}</Link>
          <button aria-label={labels.moreActions} className="button-secondary px-2.5" type="button"><MoreVertical aria-hidden="true" size={17} /></button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
        {rows.length === 0 ? <div className="p-10 text-center"><p className="font-semibold">{labels.empty}</p><p className="mt-2 text-sm text-muted-foreground">{labels.emptyDescription}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">{labels.columns.name}</th><th className="px-5 py-3 font-semibold">{labels.columns.accrual}</th><th className="px-5 py-3 font-semibold">{labels.columns.expiry}</th><th className="px-5 py-3 font-semibold">{tab === 'leave' ? labels.columns.approval : labels.columns.category}</th></tr></thead><tbody className="divide-y">{rows.map((row) => { const rule = row.rule; const accrual = row.entitlement === 'UNLIMITED' ? labels.unlimited : row.entitlement === 'ANNUAL_HOURS_CAP' ? `${labels.perYear}: ${String(initial.leaveTypes.find((type) => type.id === row.id)?.annual_hours_cap ?? '')}u` : row.entitlement === 'WEEKLY_HOURS_FACTOR_CAP' ? labels.perYear : rule ? `${rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : labels.workedHours} · ${rule.accrual_frequency === 'PAYROLL_PERIOD' ? labels.payrollPeriod : labels.yearly}` : labels.notConfigured; const expiry = rule ? (rule.expiration_months === 0 ? labels.yearEnd : labels.monthsAfterYear.replace('{months}', String(rule.expiration_months))) : tab === 'leave' ? labels.notConfigured : labels.noExpiry; return <tr className={`${row.active ? '' : 'opacity-60'} transition hover:bg-accent/30`} key={row.id}><td className="px-5 py-4"><Link className="flex items-center gap-3 font-semibold text-primary hover:underline" href={row.href}><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.colorCode ?? 'var(--color-primary)' }} />{row.name}</Link><span className="mt-1 block text-xs text-muted-foreground">{row.active ? labels.active : labels.inactive}</span></td><td className="px-5 py-4 text-muted-foreground">{accrual}</td><td className="px-5 py-4 text-muted-foreground">{expiry}</td><td className="px-5 py-4">{tab === 'leave' ? <span className="text-muted-foreground">{labels.notConfigured}</span> : <span className="text-muted-foreground">{row.category === 'INFORMATIONAL' ? labels.columns.category : row.category === 'REGULAR_WORK' ? labels.contractHours : labels.workedHours}</span>}</td></tr> })}</tbody></table></div>}
      </section>
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input checked={showInactive} className="size-4 accent-primary" onChange={(event) => setShowInactive(event.target.checked)} type="checkbox" />{labels.showInactive}</label>
    </div>
  )
}

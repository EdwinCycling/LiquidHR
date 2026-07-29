'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, MoreVertical, Plus, Palette } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { LEAVE_COLOR_OPTIONS, colorCodeToCssValue } from '@/lib/leave/colors'

type Tab = 'leave' | 'overtime' | 'workHours'

export type LeaveCatalogLabels = {
  addType: string
  addWorkHour: string
  addOvertime: string
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
  colorOverview: string
  colorOverviewDescription: string
  usedBy: string
  noColorUsage: string
  colorUnused: string
  colorOptions: Record<string, string>
}

function resolveTab(value: string | null): Tab {
  return value === 'overtime' || value === 'workHours' ? value : 'leave'
}

export function LeaveCatalogPage({ initial, labels }: { initial: LeaveCatalog; labels: LeaveCatalogLabels }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showInactive, setShowInactive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [colorOverviewOpen, setColorOverviewOpen] = useState(false)
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
  const addLabel = tab === 'leave' ? labels.addType : tab === 'overtime' ? labels.addOvertime : labels.addWorkHour
  const addUrl = tab === 'overtime' ? `${addHref}?category=OVERTIME` : addHref
  const colorUsage = useMemo(() => {
    const usage = new Map<string, string[]>()
    for (const item of [...initial.leaveTypes.map((type) => ({ name: type.name, color: type.color_code })), ...initial.workHourTypes.map((type) => ({ name: type.name, color: type.color_code }))]) {
      const color = colorCodeToCssValue(item.color)
      const values = usage.get(color) ?? []
      values.push(item.name)
      usage.set(color, values)
    }
    return usage
  }, [initial])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto border-b sm:gap-5">
          {(Object.keys(labels.tabs) as Tab[]).map((item) => (
            <button aria-current={tab === item ? 'page' : undefined} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === item ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_-2px_0_var(--color-primary)]' : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`} key={item} onClick={() => changeTab(item)} type="button">{tab === item ? <Check aria-hidden="true" className="mr-1.5 inline size-4" /> : null}{labels.tabs[item]}{item === 'leave' ? ` (${initial.leaveTypes.length})` : item === 'overtime' ? ` (${initial.workHourTypes.filter((type) => type.category === 'OVERTIME').length})` : ` (${initial.workHourTypes.filter((type) => type.category !== 'OVERTIME').length})`}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab === 'leave' ? <Link className="button-secondary" href="/settings/leave-accrual/priority-rules">{labels.priorityRules}</Link> : null}
          <Link className="button-primary gap-2" href={addUrl}><Plus aria-hidden="true" size={16} />{addLabel}</Link>
          <div className="relative">
            <button aria-expanded={menuOpen} aria-label={labels.moreActions} className="button-secondary px-2.5" onClick={() => setMenuOpen((open) => !open)} type="button"><MoreVertical aria-hidden="true" size={17} /></button>
            {menuOpen ? <div className="absolute right-0 top-12 z-20 w-64 rounded-xl border bg-surface p-2 shadow-lg"><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setColorOverviewOpen(true); setMenuOpen(false) }} type="button"><Palette aria-hidden="true" size={16} />{labels.colorOverview}</button></div> : null}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
        {rows.length === 0 ? <div className="p-10 text-center"><p className="font-semibold">{labels.empty}</p><p className="mt-2 text-sm text-muted-foreground">{labels.emptyDescription}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">{labels.columns.name}</th><th className="px-5 py-3 font-semibold">{labels.columns.accrual}</th><th className="px-5 py-3 font-semibold">{labels.columns.expiry}</th><th className="px-5 py-3 font-semibold">{tab === 'leave' ? labels.columns.approval : labels.columns.category}</th></tr></thead><tbody className="divide-y">{rows.map((row) => { const rule = row.rule; const accrual = row.entitlement === 'UNLIMITED' ? labels.unlimited : row.entitlement === 'ANNUAL_HOURS_CAP' ? `${labels.perYear}: ${String(initial.leaveTypes.find((type) => type.id === row.id)?.annual_hours_cap ?? '')}u` : row.entitlement === 'WEEKLY_HOURS_FACTOR_CAP' ? labels.perYear : rule ? `${rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : labels.workedHours} · ${rule.accrual_frequency === 'PAYROLL_PERIOD' ? labels.payrollPeriod : labels.yearly}` : labels.notConfigured; const expiry = rule ? (rule.expiration_months === 0 ? labels.yearEnd : labels.monthsAfterYear.replace('{months}', String(rule.expiration_months))) : tab === 'leave' ? labels.notConfigured : labels.noExpiry; return <tr className={`${row.active ? '' : 'opacity-60'} transition hover:bg-accent/30`} key={row.id}><td className="px-5 py-4"><Link className="flex items-center gap-3 font-semibold text-primary hover:underline" href={row.href}><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.colorCode ?? 'var(--color-primary)' }} />{row.name}</Link><span className="mt-1 block text-xs text-muted-foreground">{row.active ? labels.active : labels.inactive}</span></td><td className="px-5 py-4 text-muted-foreground">{accrual}</td><td className="px-5 py-4 text-muted-foreground">{expiry}</td><td className="px-5 py-4">{tab === 'leave' ? <span className="text-muted-foreground">{labels.notConfigured}</span> : <span className="text-muted-foreground">{row.category === 'INFORMATIONAL' ? labels.columns.category : row.category === 'REGULAR_WORK' ? labels.contractHours : labels.workedHours}</span>}</td></tr> })}</tbody></table></div>}
      </section>
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input checked={showInactive} className="size-4 accent-primary" onChange={(event) => setShowInactive(event.target.checked)} type="checkbox" />{labels.showInactive}</label>
      {colorOverviewOpen ? <div aria-labelledby="leave-color-overview-title" aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-foreground/30 p-4" role="dialog"><section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold" id="leave-color-overview-title">{labels.colorOverview}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.colorOverviewDescription}</p></div><button aria-label={labels.moreActions} className="button-secondary px-3" onClick={() => setColorOverviewOpen(false)} type="button">×</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{LEAVE_COLOR_OPTIONS.map((option) => { const names = colorUsage.get(option.value) ?? []; return <div className="rounded-xl border p-3" key={option.value}><div className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded-full" style={{ backgroundColor: option.value }} /><span className="text-sm font-semibold">{labels.colorOptions[option.labelKey]}</span></div><p className="mt-2 text-xs text-muted-foreground">{names.length > 0 ? `${labels.usedBy}: ${names.join(', ')}` : labels.colorUnused}</p></div> })}</div></section></div> : null}
    </div>
  )
}

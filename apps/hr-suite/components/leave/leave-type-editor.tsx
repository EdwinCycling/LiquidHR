'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { LEAVE_COLOR_OPTIONS, colorCodeToCssValue, defaultColorForWorkHourCategory } from '@/lib/leave/colors'

type Tab = 'base' | 'limits' | 'advanced'
type LeaveType = LeaveCatalog['leaveTypes'][number]
type WorkHourType = LeaveCatalog['workHourTypes'][number]
type Labels = { save: string; archive: string; saving: string; saved: string; failed: string; tabs: Record<Tab, string>; name: string; color: string; colorOptions: Record<string, string>; scope: string; scopeStatutory: string; scopeNonStatutory: string; scopeAdv: string; scopeOther: string; category: string; regularWork: string; overtime: string; informational: string; activeLabel: string; selfService: string; entitlement: string; accrual: string; unlimited: string; annualCap: string; weeklyFactorCap: string; annualCapValue: string; weeklyFactor: string; ruleTitle: string; ruleEmpty: string; addRule: string; notApplicable: string }

export function LeaveTypeEditor({ mode, existing, catalog, labels }: { mode: 'leave' | 'work'; existing?: LeaveType | WorkHourType; catalog?: LeaveCatalog; labels: Labels }) {
  const router = useRouter()
  const isLeave = mode === 'leave'
  const leave = isLeave ? existing as LeaveType | undefined : undefined
  const work = !isLeave ? existing as WorkHourType | undefined : undefined
  const [tab, setTab] = useState<Tab>('base')
  const [name, setName] = useState(existing?.name ?? '')
  const [colorCode, setColorCode] = useState(existing?.color_code ?? (work ? defaultColorForWorkHourCategory(work.category) : 'var(--chart-1)'))
  const [scope, setScope] = useState<LeaveType['scope']>(leave?.scope ?? 'OTHER')
  const [category, setCategory] = useState<WorkHourType['category']>(work?.category ?? 'REGULAR_WORK')
  const [entitlementMode, setEntitlementMode] = useState<LeaveType['entitlement_mode']>(leave?.entitlement_mode ?? 'ACCRUAL')
  const [annualHoursCap, setAnnualHoursCap] = useState(String(leave?.annual_hours_cap ?? ''))
  const [weeklyFactor, setWeeklyFactor] = useState(String(leave?.weekly_hours_cap_factor ?? ''))
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [isSelfService, setIsSelfService] = useState(leave?.is_self_service ?? true)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  const save = async (archive = false) => {
    setState('saving')
    const body = isLeave
      ? existing
        ? { action: archive ? 'ARCHIVE_LEAVE_TYPE' : 'UPDATE_LEAVE_TYPE', id: existing.id, name, colorCode, scope, entitlementMode, annualHoursCap: entitlementMode === 'ANNUAL_HOURS_CAP' ? Number(annualHoursCap) : null, weeklyHoursCapFactor: entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? Number(weeklyFactor) : null, isActive, isSelfService }
        : { action: 'LEAVE_TYPE', name, colorCode, scope, entitlementMode, annualHoursCap: entitlementMode === 'ANNUAL_HOURS_CAP' ? Number(annualHoursCap) : undefined, weeklyHoursCapFactor: entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? Number(weeklyFactor) : undefined, isSelfService, isActive }
        : existing
        ? { action: archive ? 'ARCHIVE_WORK_HOUR_TYPE' : 'UPDATE_WORK_HOUR_TYPE', id: existing.id, name, colorCode, category, isActive }
        : { action: 'WORK_HOUR_TYPE', name, colorCode, category, isActive }
    try {
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('LEAVE_SAVE_FAILED')
      setState('saved')
      router.push('/settings/leave-accrual')
      router.refresh()
    } catch { setState('failed') }
  }

  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 overflow-x-auto border-b">{(Object.keys(labels.tabs) as Tab[]).map((item) => <button className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === item ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`} key={item} onClick={() => setTab(item)} type="button">{labels.tabs[item]}</button>)}</div><div className="flex gap-2"><button className="button-primary" disabled={state === 'saving'} onClick={() => void save()} type="button">{state === 'saving' ? labels.saving : labels.save}</button>{existing ? <button className="button-danger" disabled={state === 'saving'} onClick={() => void save(true)} type="button">{labels.archive}</button> : null}</div></div>
    {tab === 'base' ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">{labels.name}<input className="form-field" maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} /></label><div className="grid gap-2 text-sm font-medium"><span>{labels.color}</span><div className="flex flex-wrap gap-2" role="radiogroup" aria-label={labels.color}>{LEAVE_COLOR_OPTIONS.map((option) => <button aria-label={labels.colorOptions[option.labelKey] ?? option.labelKey} aria-pressed={colorCode === option.value} className={`size-8 rounded-full border-2 transition ${colorCode === option.value ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent'}`} key={option.value} onClick={() => setColorCode(option.value)} style={{ backgroundColor: option.value }} type="button" />)}</div><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: colorCodeToCssValue(colorCode) }} />{labels.colorOptions[LEAVE_COLOR_OPTIONS.find((option) => option.value === colorCode)?.labelKey ?? colorCode] ?? colorCode}</span></div>{isLeave ? <label className="grid gap-1.5 text-sm font-medium">{labels.scope}<select className="form-field" onChange={(event) => setScope(event.target.value as LeaveType['scope'])} value={scope}><option value="STATUTORY">{labels.scopeStatutory}</option><option value="NON_STATUTORY">{labels.scopeNonStatutory}</option><option value="ADV">{labels.scopeAdv}</option><option value="OTHER">{labels.scopeOther}</option></select></label> : <label className="grid gap-1.5 text-sm font-medium">{labels.category}<select className="form-field" onChange={(event) => setCategory(event.target.value as WorkHourType['category'])} value={category}><option value="REGULAR_WORK">{labels.regularWork}</option><option value="OVERTIME">{labels.overtime}</option><option value="INFORMATIONAL">{labels.informational}</option></select></label>}</div></section> : null}
    {tab === 'limits' && isLeave ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:max-w-2xl"><label className="grid gap-1.5 text-sm font-medium">{labels.entitlement}<select className="form-field" onChange={(event) => setEntitlementMode(event.target.value as LeaveType['entitlement_mode'])} value={entitlementMode}><option value="ACCRUAL">{labels.accrual}</option><option value="UNLIMITED">{labels.unlimited}</option><option value="ANNUAL_HOURS_CAP">{labels.annualCap}</option><option value="WEEKLY_HOURS_FACTOR_CAP">{labels.weeklyFactorCap}</option></select></label>{entitlementMode === 'ANNUAL_HOURS_CAP' ? <label className="grid gap-1.5 text-sm font-medium">{labels.annualCapValue}<input className="form-field" min="0" onChange={(event) => setAnnualHoursCap(event.target.value)} step="0.01" type="number" value={annualHoursCap} /></label> : null}{entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? <label className="grid gap-1.5 text-sm font-medium">{labels.weeklyFactor}<input className="form-field" min="0" onChange={(event) => setWeeklyFactor(event.target.value)} step="0.01" type="number" value={weeklyFactor} /></label> : null}</div></section> : null}
    {tab === 'advanced' ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="inline-flex items-center gap-3 text-sm font-medium"><input checked={isActive} className="size-4 accent-primary" onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />{labels.activeLabel}</label>{isLeave ? <label className="inline-flex items-center gap-3 text-sm font-medium"><input checked={isSelfService} className="size-4 accent-primary" onChange={(event) => setIsSelfService(event.target.checked)} type="checkbox" />{labels.selfService}</label> : null}</div></section> : null}
    {isLeave && catalog && existing ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{labels.ruleTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{catalog.accrualRules.filter((rule) => rule.leave_type_id === existing.id).length ? labels.addRule : labels.ruleEmpty}</p></div><a className="button-secondary" href={`/settings/leave-accrual/rules/new?leaveTypeId=${existing.id}`}>{labels.addRule}</a></div></section> : null}
    {state === 'saved' ? <p className="text-sm text-success">{labels.saved}</p> : state === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}
  </div>
}

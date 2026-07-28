'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { LEAVE_COLOR_OPTIONS, colorCodeToCssValue, defaultColorForWorkHourCategory } from '@/lib/leave/colors'
import { OvertimeSettingsPanel, type OvertimePanelLabels, type OvertimePanelMode } from './overtime-settings-panel'
import { LeaveAccrualExceptionsPanel } from './leave-accrual-exceptions-panel'
import { LeaveBonusRulesPanel } from './leave-bonus-rules-panel'
import { LeaveAccrualRuleList } from './leave-accrual-rule-list'

type Tab = 'base' | 'limits' | 'advanced'
type LeaveType = LeaveCatalog['leaveTypes'][number]
type WorkHourType = LeaveCatalog['workHourTypes'][number]
type Labels = {
  save: string
  archive: string
  saving: string
  saved: string
  failed: string
  tabs: Record<Tab, string>
  name: string
  color: string
  colorOptions: Record<string, string>
  scope: string
  scopeStatutory: string
  scopeNonStatutory: string
  scopeAdv: string
  scopeOther: string
  category: string
  regularWork: string
  overtime: string
  informational: string
  activeLabel: string
  selfService: string
  entitlement: string
  accrual: string
  unlimited: string
  annualCap: string
  weeklyFactorCap: string
  annualCapValue: string
  weeklyFactor: string
  ruleList?: { title: string; description: string; empty: string; add: string; version: string; current: string; ended: string; successor: string; select: string; profile: string; contractHours: string; workedHours: string; ageSeniority: string; payrollPeriod: string; yearly: string; upfront: string; arrears: string; amount: string; rate: string; validFrom: string; validUntil: string; noValue: string }
  exceptionPanel?: { title: string; description: string; empty: string; add: string; name: string; summary: string; validFrom: string; validUntil: string; noValue: string; noAccrual: string; customAmount: string; amount: string; expiry: string; months: string; reason: string; selectionMode: string; onePerson: string; multiplePeople: string; selectPerson: string; selectPeople: string; search: string; selectVisible: string; selected: string; save: string; cancel: string; saving: string; saved: string; failed: string; previous: string; next: string; page: string }
  bonusPanel?: { title: string; description: string; empty: string; add: string; tileAge: string; tileSeniority: string; name: string; profile: string; trigger: string; age: string; seniority: string; timing: string; startOfYear: string; onTriggerDate: string; proRate: string; proRateHelp: string; tiers: string; thresholdYears: string; bonusAmount: string; addTier: string; removeTier: string; summary: string; save: string; cancel: string; saving: string; saved: string; failed: string; noTiers: string; current: string; inactive: string; fullTime: string; selectTrigger: string }
  leaveSettings?: { title: string; allowLimitOverrun: string; pinInCalendar: string; requiresManagerApproval: string; notifyManagerOnRequest: string; requiresManagerApprovalOnCancellation: string }
  workSettings?: { title: string; selfService: string; pinInCalendar: string }
  advancedPlaceholder?: string
  notApplicable: string
}

export function LeaveTypeEditor({ mode, existing, catalog, labels, workHourSettings }: { mode: 'leave' | 'work'; existing?: LeaveType | WorkHourType; catalog?: LeaveCatalog; labels: Labels; workHourSettings?: { initial: import('@/lib/leave/leave-service').OvertimeSettingsPageData; labels: OvertimePanelLabels; mode: OvertimePanelMode } }) {
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
  const [workSelfService, setWorkSelfService] = useState(work?.is_self_service ?? true)
  const [workPinInCalendar, setWorkPinInCalendar] = useState(work?.pin_in_calendar ?? false)
  const [allowLimitOverrun, setAllowLimitOverrun] = useState(leave?.allow_limit_overrun ?? false)
  const [pinInCalendar, setPinInCalendar] = useState(leave?.pin_in_calendar ?? false)
  const [requiresManagerApproval, setRequiresManagerApproval] = useState(leave?.requires_manager_approval ?? false)
  const [notifyManagerOnRequest, setNotifyManagerOnRequest] = useState(leave?.notify_manager_on_request ?? false)
  const [requiresManagerApprovalOnCancellation, setRequiresManagerApprovalOnCancellation] = useState(leave?.requires_manager_approval_on_cancellation ?? false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const readOnly = Boolean(existing)

  const save = async (archive = false) => {
    if (readOnly && isLeave && !archive) return
    setState('saving')
    const body = isLeave
      ? { action: archive ? 'ARCHIVE_LEAVE_TYPE' : 'LEAVE_TYPE', ...(archive ? { id: existing?.id } : { name, colorCode, scope, entitlementMode, annualHoursCap: entitlementMode === 'ANNUAL_HOURS_CAP' ? Number(annualHoursCap) : undefined, weeklyHoursCapFactor: entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? Number(weeklyFactor) : undefined, isSelfService, allowLimitOverrun, pinInCalendar, requiresManagerApproval, notifyManagerOnRequest, requiresManagerApprovalOnCancellation, isActive }) }
      : archive ? { action: 'ARCHIVE_WORK_HOUR_TYPE', id: existing?.id } : existing ? { action: 'WORK_HOUR_SETTINGS', workHourTypeId: existing.id, isSelfService: workSelfService, pinInCalendar: workPinInCalendar, limitMode: workHourSettings?.initial.settings.limitMode ?? 'UNLIMITED', limitHours: workHourSettings?.initial.settings.limitHours ?? null, contractHoursFactor: workHourSettings?.initial.settings.contractHoursFactor ?? null } : { action: 'WORK_HOUR_TYPE', name, colorCode, category, isActive, isSelfService: workSelfService, pinInCalendar: workPinInCalendar }
    try {
      const response = await fetch(!isLeave && existing ? '/api/leave/work-hours' : '/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('LEAVE_SAVE_FAILED')
      setState('saved')
      if (!existing || isLeave) router.push('/settings/leave-accrual')
      router.refresh()
    } catch { setState('failed') }
  }

  const setting = (label: string, checked: boolean, onChange: (value: boolean) => void, disabled = readOnly) => <label className="inline-flex items-center gap-3 text-sm font-medium"><input checked={checked} className="size-4 accent-primary disabled:opacity-60" disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 overflow-x-auto border-b">{(Object.keys(labels.tabs) as Tab[]).map((item) => <button aria-current={tab === item ? 'page' : undefined} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === item ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_-2px_0_var(--color-primary)]' : 'border-transparent text-muted-foreground hover:bg-muted/60'}`} key={item} onClick={() => setTab(item)} type="button">{tab === item ? '✓ ' : ''}{labels.tabs[item]}</button>)}</div><div className="flex gap-2">{!existing ? <button className="button-primary" disabled={state === 'saving'} onClick={() => void save()} type="button">{state === 'saving' ? labels.saving : labels.save}</button> : <span className="rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">{labels.notApplicable}</span>}{existing ? <button className="button-danger" disabled={state === 'saving'} onClick={() => void save(true)} type="button">{labels.archive}</button> : null}</div></div>

    {tab === 'base' ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">{labels.name}<input className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} /></label><div className="grid gap-2 text-sm font-medium"><span>{labels.color}</span><div className="flex flex-wrap gap-2" role="radiogroup" aria-label={labels.color}>{LEAVE_COLOR_OPTIONS.map((option) => <button aria-label={labels.colorOptions[option.labelKey] ?? option.labelKey} aria-pressed={colorCode === option.value} className={`size-8 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${colorCode === option.value ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent'}`} disabled={readOnly} key={option.value} onClick={() => setColorCode(option.value)} style={{ backgroundColor: option.value }} type="button" />)}</div><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: colorCodeToCssValue(colorCode) }} />{labels.colorOptions[LEAVE_COLOR_OPTIONS.find((option) => option.value === colorCode)?.labelKey ?? colorCode] ?? colorCode}</span></div>{isLeave ? <label className="grid gap-1.5 text-sm font-medium">{labels.scope}<select className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} onChange={(event) => setScope(event.target.value as LeaveType['scope'])} value={scope}><option value="STATUTORY">{labels.scopeStatutory}</option><option value="NON_STATUTORY">{labels.scopeNonStatutory}</option><option value="ADV">{labels.scopeAdv}</option><option value="OTHER">{labels.scopeOther}</option></select></label> : <label className="grid gap-1.5 text-sm font-medium">{labels.category}<select className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} onChange={(event) => setCategory(event.target.value as WorkHourType['category'])} value={category}><option value="REGULAR_WORK">{labels.regularWork}</option><option value="OVERTIME">{labels.overtime}</option><option value="INFORMATIONAL">{labels.informational}</option></select></label>}</div>
      {isLeave && labels.leaveSettings ? <div className="mt-7 border-t pt-6"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.leaveSettings.title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{setting(labels.selfService, isSelfService, setIsSelfService)}{setting(labels.leaveSettings.allowLimitOverrun, allowLimitOverrun, setAllowLimitOverrun)}{setting(labels.leaveSettings.pinInCalendar, pinInCalendar, setPinInCalendar)}{setting(labels.leaveSettings.requiresManagerApproval, requiresManagerApproval, setRequiresManagerApproval)}{setting(labels.leaveSettings.notifyManagerOnRequest, notifyManagerOnRequest, setNotifyManagerOnRequest)}{setting(labels.leaveSettings.requiresManagerApprovalOnCancellation, requiresManagerApprovalOnCancellation, setRequiresManagerApprovalOnCancellation)}{setting(labels.activeLabel, isActive, setIsActive)}</div></div> : null}{!isLeave && labels.workSettings ? <div className="mt-7 border-t pt-6"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.workSettings.title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{setting(labels.workSettings.selfService, workSelfService, setWorkSelfService, false)}{setting(labels.workSettings.pinInCalendar, workPinInCalendar, setWorkPinInCalendar, false)}</div><button className="button-primary mt-5" disabled={state === 'saving'} onClick={() => void save()} type="button">{state === 'saving' ? labels.saving : labels.save}</button></div> : null}
    </section> : null}

    {tab === 'limits' && isLeave ? <div className="space-y-5"><section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:max-w-2xl"><label className="grid gap-1.5 text-sm font-medium">{labels.entitlement}<select className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} onChange={(event) => setEntitlementMode(event.target.value as LeaveType['entitlement_mode'])} value={entitlementMode}><option value="ACCRUAL">{labels.accrual}</option><option value="UNLIMITED">{labels.unlimited}</option><option value="ANNUAL_HOURS_CAP">{labels.annualCap}</option><option value="WEEKLY_HOURS_FACTOR_CAP">{labels.weeklyFactorCap}</option></select></label>{entitlementMode === 'ANNUAL_HOURS_CAP' ? <label className="grid gap-1.5 text-sm font-medium">{labels.annualCapValue}<input className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} min="0" onChange={(event) => setAnnualHoursCap(event.target.value)} step="0.01" type="number" value={annualHoursCap} /></label> : null}{entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? <label className="grid gap-1.5 text-sm font-medium">{labels.weeklyFactor}<input className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} min="0" onChange={(event) => setWeeklyFactor(event.target.value)} step="0.01" type="number" value={weeklyFactor} /></label> : null}</div></section>{catalog && existing && labels.ruleList ? <LeaveAccrualRuleList catalog={catalog} leaveTypeId={existing.id} labels={labels.ruleList} /> : null}{catalog && existing && labels.bonusPanel ? <LeaveBonusRulesPanel catalog={catalog} leaveTypeId={existing.id} labels={labels.bonusPanel} /> : null}{catalog && existing && labels.exceptionPanel ? <LeaveAccrualExceptionsPanel catalog={catalog} leaveTypeId={existing.id} labels={labels.exceptionPanel} /> : null}</div> : null}

    {tab === 'limits' && !isLeave && existing && workHourSettings ? <div className="space-y-5"><OvertimeSettingsPanel workHourTypeId={existing.id} initial={workHourSettings.initial} labels={workHourSettings.labels} mode={workHourSettings.mode} /></div> : null}
    {tab === 'advanced' ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><p className="text-sm text-muted-foreground">{labels.advancedPlaceholder ?? labels.notApplicable}</p></section> : null}
    {state === 'saved' ? <p className="text-sm text-success">{labels.saved}</p> : state === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}
  </div>
}

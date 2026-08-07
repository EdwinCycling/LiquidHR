'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'
import { LEAVE_COLOR_OPTIONS, colorCodeToCssValue, defaultColorForWorkHourCategory } from '@/lib/leave/colors'
import { OvertimeSettingsPanel, type OvertimePanelLabels, type OvertimePanelMode } from './overtime-settings-panel'
import { LeaveAccrualExceptionsPanel } from './leave-accrual-exceptions-panel'
import { LeaveBonusRulesPanel } from './leave-bonus-rules-panel'
import { LeaveAccrualRuleList } from './leave-accrual-rule-list'
import { AccrualRuleEditor, type AccrualRuleEditorLabels } from './accrual-rule-editor'

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
  nameRequired?: string
  nameExists?: string
  archiveTitle: string
  archiveDescription: string
  archiveCancel: string
  archiveConfirm: string
  color: string
  colorOptions: Record<string, string>
  category: string
  regularWork: string
  overtime: string
  informational: string
  activeLabel: string
  selfService: string
  requiresManagerApproval: string
  entitlement: string
  accrual: string
  unlimited: string
  annualCap: string
  annualCapValue: string
  annualFteCap: string
  annualFteCapValue: string
  overtimeCap: string
  overtimeTypes: string
  overtimeTypesHelp: string
  search: string
  selectedCount: string
  noOvertimeTypes: string
  cancel: string
  configureAfterSave: string
  exceptionsForAll: string
  notifyManagerOnEntry: string
  ruleList?: { title: string; description: string; empty: string; add: string; edit: string; version: string; current: string; ended: string; profile: string; contractHours: string; workedHours: string; ageSeniority: string; payrollPeriod: string; fourWeekly: string; monthly: string; yearly: string; upfront: string; arrears: string; amount: string; rate: string; validFrom: string; validUntil: string; noValue: string }
  exceptionPanel?: { title: string; description: string; empty: string; add: string; name: string; summary: string; validFrom: string; validUntil: string; noValue: string; noAccrual: string; customAmount: string; amount: string; expiry: string; months: string; summaryPeople: string; summaryStart: string; summaryAmount: string; summaryExpiry: string; summaryReason: string; hoursUnit: string; reason: string; selectionMode: string; onePerson: string; multiplePeople: string; selectPerson: string; selectPeople: string; search: string; selectVisible: string; selected: string; save: string; cancel: string; saving: string; saved: string; failed: string; previous: string; next: string; page: string }
  bonusPanel?: { title: string; description: string; empty: string; add: string; tileAge: string; tileSeniority: string; name: string; profile: string; trigger: string; age: string; seniority: string; timing: string; startOfYear: string; onTriggerDate: string; proRate: string; proRateHelp: string; tiers: string; thresholdYears: string; bonusAmount: string; addTier: string; removeTier: string; summary: string; save: string; cancel: string; saving: string; saved: string; failed: string; noTiers: string; current: string; inactive: string; fullTime: string; selectTrigger: string }
  leaveSettings?: { title: string; allowLimitOverrun: string; pinInCalendar: string; requiresManagerApproval: string; notifyManagerOnRequest: string; requiresManagerApprovalOnCancellation: string }
  workSettings?: { title: string; selfService: string; pinInCalendar: string }
  ruleEditor?: AccrualRuleEditorLabels
  advancedPlaceholder?: string
  notApplicable: string
}

export function LeaveTypeEditor({ mode, existing, catalog, labels, workHourSettings, initialTab = 'base', initialCategory = 'REGULAR_WORK', backHref = '/settings/leave-accrual' }: { mode: 'leave' | 'work'; existing?: LeaveType | WorkHourType; catalog?: LeaveCatalog; labels: Labels; workHourSettings?: { initial: import('@/lib/leave/leave-service').OvertimeSettingsPageData; labels: OvertimePanelLabels; mode: OvertimePanelMode }; initialTab?: Tab; initialCategory?: WorkHourType['category']; backHref?: string }) {
  const router = useRouter()
  const isLeave = mode === 'leave'
  const leave = isLeave ? existing as LeaveType | undefined : undefined
  const work = !isLeave ? existing as WorkHourType | undefined : undefined
  const [tab, setTab] = useState<Tab>(initialTab)
  const [name, setName] = useState(existing?.name ?? '')
  const [colorCode, setColorCode] = useState(existing?.color_code ?? (work ? defaultColorForWorkHourCategory(work.category) : 'var(--chart-1)'))
  const category = work?.category ?? initialCategory
  const [entitlementMode, setEntitlementMode] = useState<LeaveType['entitlement_mode']>(leave?.entitlement_mode ?? 'ACCRUAL')
  const [annualHoursCap, setAnnualHoursCap] = useState(String(leave?.annual_hours_cap ?? ''))
  const [annualHoursFteCap, setAnnualHoursFteCap] = useState(String(leave?.annual_hours_fte_cap ?? ''))
  const [overtimeWorkHourTypeIds, setOvertimeWorkHourTypeIds] = useState<string[]>(() => catalog?.leaveTypeOvertimeWorkHours.filter((item) => item.leave_type_id === leave?.id).map((item) => item.work_hour_type_id) ?? [])
  const [overtimeSearch, setOvertimeSearch] = useState('')
  const [isActive, setIsActive] = useState(existing?.is_active ?? true)
  const [isSelfService, setIsSelfService] = useState(leave?.is_self_service ?? true)
  const [workSelfService, setWorkSelfService] = useState(work?.is_self_service ?? true)
  const workPinInCalendar = work?.pin_in_calendar ?? false
  const [notifyManagerOnEntry, setNotifyManagerOnEntry] = useState(workHourSettings?.initial.settings.notifyManagerOnEntry ?? false)
  const [workRequiresManagerApproval, setWorkRequiresManagerApproval] = useState(workHourSettings?.initial.settings.requiresManagerApproval ?? false)
  const [allowLimitOverrun, setAllowLimitOverrun] = useState(leave?.allow_limit_overrun ?? false)
  const [pinInCalendar, setPinInCalendar] = useState(leave?.pin_in_calendar ?? false)
  const [requiresManagerApproval, setRequiresManagerApproval] = useState(leave?.requires_manager_approval ?? false)
  const [notifyManagerOnRequest, setNotifyManagerOnRequest] = useState(leave?.notify_manager_on_request ?? false)
  const [requiresManagerApprovalOnCancellation, setRequiresManagerApprovalOnCancellation] = useState(leave?.requires_manager_approval_on_cancellation ?? false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [nameError, setNameError] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>()
  const [copyFromRuleId, setCopyFromRuleId] = useState<string | undefined>()
  const [ruleEditorOpen, setRuleEditorOpen] = useState(!existing && isLeave)
  const readOnly = false

  const save = async (archive = false, stayOnPage = false): Promise<string | null> => {
    if (createdId && !archive) return createdId
    if (!archive && !name.trim()) {
      setNameError(labels.nameRequired ?? labels.failed)
      setState('failed')
      return null
    }
    setNameError(null)
    setState('saving')
    const body = isLeave
      ? archive ? { action: 'ARCHIVE_LEAVE_TYPE', id: existing?.id } : { action: 'LEAVE_TYPE', id: existing?.id, name, colorCode, entitlementMode, annualHoursCap: entitlementMode === 'ANNUAL_HOURS_CAP' ? Number(annualHoursCap) : undefined, annualHoursFteCap: entitlementMode === 'ANNUAL_HOURS_FTE_CAP' ? Number(annualHoursFteCap) : undefined, overtimeWorkHourTypeIds: entitlementMode === 'OVERTIME_HOURS' ? overtimeWorkHourTypeIds : [], isSelfService, allowLimitOverrun, pinInCalendar, requiresManagerApproval, notifyManagerOnRequest, requiresManagerApprovalOnCancellation, isActive }
      : archive ? { action: 'ARCHIVE_WORK_HOUR_TYPE', id: existing?.id } : existing ? { action: 'WORK_HOUR_SETTINGS', workHourTypeId: existing.id, name, colorCode, isActive, isSelfService: workSelfService, pinInCalendar: workPinInCalendar, notifyManagerOnEntry, requiresManagerApproval: workRequiresManagerApproval, limitMode: workHourSettings?.initial.settings.limitMode ?? 'UNLIMITED', limitHours: workHourSettings?.initial.settings.limitHours ?? null, contractHoursFactor: workHourSettings?.initial.settings.contractHoursFactor ?? null } : { action: 'WORK_HOUR_TYPE', name, colorCode, category, isActive, notifyManagerOnEntry, requiresManagerApproval: workRequiresManagerApproval, isSelfService: workSelfService, pinInCalendar: workPinInCalendar }
    try {
      const response = await fetch(!isLeave && existing ? '/api/leave/work-hours' : '/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json() as { data?: { id?: string }; error?: string }
      if (!response.ok) {
        if (payload.error === 'LEAVE_TYPE_NAME_EXISTS' || payload.error === 'WORK_HOUR_TYPE_NAME_EXISTS') setNameError(labels.nameExists ?? labels.failed)
        throw new Error('LEAVE_SAVE_FAILED')
      }
      const savedId = payload.data?.id ?? existing?.id ?? null
      if (savedId) setCreatedId(savedId)
      setState('saved')
      if (archive) { setArchiveOpen(false); router.push(backHref) }
      else if (!stayOnPage && savedId) router.push(isLeave ? `/settings/leave-accrual/types/${savedId}?tab=limits` : `/settings/leave-accrual/work-hours/${savedId}?tab=limits`)
      router.refresh()
      return savedId
    } catch { setState('failed'); return null }
  }

  const setting = (label: string, checked: boolean, onChange: (value: boolean) => void, disabled = readOnly) => <label className="inline-flex items-center gap-3 text-sm font-medium"><input checked={checked} className="size-4 accent-primary disabled:opacity-60" disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>
  const overtimeTypes = catalog?.workHourTypes.filter((item) => item.category === 'OVERTIME' && item.is_active) ?? []
  const visibleOvertimeTypes = overtimeTypes.filter((item) => item.name.toLocaleLowerCase().includes(overtimeSearch.toLocaleLowerCase()))
  const accrualRules = catalog?.accrualRules.filter((item) => item.leave_type_id === existing?.id).sort((left, right) => left.valid_from.localeCompare(right.valid_from)) ?? []
  const latestAccrualRuleId = accrualRules.length > 0 ? accrualRules[accrualRules.length - 1].id : undefined
  const toggleOvertimeType = (id: string) => setOvertimeWorkHourTypeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const saveBlocked = state === 'saving' || !name.trim() || (isLeave && entitlementMode === 'OVERTIME_HOURS' && overtimeWorkHourTypeIds.length === 0)

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 overflow-x-auto border-b">{(Object.keys(labels.tabs) as Tab[]).map((item) => <button aria-current={tab === item ? 'page' : undefined} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === item ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_-2px_0_var(--color-primary)]' : 'border-transparent text-muted-foreground hover:bg-muted/60'}`} key={item} onClick={() => setTab(item)} type="button">{tab === item ? '✓ ' : ''}{labels.tabs[item]}</button>)}</div><div className="flex gap-2">{!existing ? <button className="button-secondary" onClick={() => router.push(backHref)} type="button">{labels.cancel}</button> : null}<button className="button-primary" disabled={saveBlocked} onClick={() => void save()} type="button">{state === 'saving' ? labels.saving : labels.save}</button>{existing ? <button className="button-danger" disabled={state === 'saving'} onClick={() => setArchiveOpen(true)} type="button">{labels.archive}</button> : null}</div></div>

    {tab === 'base' ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">{labels.name}<input className="form-field h-11 min-h-0 w-full whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60" disabled={readOnly} maxLength={160} onChange={(event) => setName(event.target.value)} required type="text" value={name} /></label><div className="grid gap-2 text-sm font-medium"><span>{labels.color}</span><div className="flex flex-wrap gap-2" role="radiogroup" aria-label={labels.color}>{LEAVE_COLOR_OPTIONS.map((option) => <button aria-label={labels.colorOptions[option.labelKey] ?? option.labelKey} aria-pressed={colorCode === option.value} className={`size-8 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${colorCode === option.value ? 'border-foreground ring-2 ring-primary/30' : 'border-transparent'}`} disabled={readOnly} key={option.value} onClick={() => setColorCode(option.value)} style={{ backgroundColor: option.value }} type="button" />)}</div><span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: colorCodeToCssValue(colorCode) }} />{labels.colorOptions[LEAVE_COLOR_OPTIONS.find((option) => option.value === colorCode)?.labelKey ?? colorCode] ?? colorCode}</span></div></div>
      {isLeave && labels.leaveSettings ? <div className="mt-7 border-t pt-6"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.leaveSettings.title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{setting(labels.selfService, isSelfService, setIsSelfService)}{setting(labels.leaveSettings.allowLimitOverrun, allowLimitOverrun, setAllowLimitOverrun)}{setting(labels.leaveSettings.pinInCalendar, pinInCalendar, setPinInCalendar)}{setting(labels.leaveSettings.requiresManagerApproval, requiresManagerApproval, setRequiresManagerApproval)}{setting(labels.leaveSettings.notifyManagerOnRequest, notifyManagerOnRequest, setNotifyManagerOnRequest)}{setting(labels.leaveSettings.requiresManagerApprovalOnCancellation, requiresManagerApprovalOnCancellation, setRequiresManagerApprovalOnCancellation)}{setting(labels.activeLabel, isActive, setIsActive)}</div></div> : null}{!isLeave && labels.workSettings ? <div className="mt-7 border-t pt-6"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.workSettings.title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{setting(labels.requiresManagerApproval, workRequiresManagerApproval, setWorkRequiresManagerApproval)}{setting(labels.notifyManagerOnEntry, notifyManagerOnEntry, setNotifyManagerOnEntry)}{setting(labels.activeLabel, isActive, setIsActive)}{setting(labels.selfService, workSelfService, setWorkSelfService)}</div></div> : null}
    </section> : null}

    {tab === 'limits' && isLeave ? <div className="space-y-5">
      <section className="rounded-2xl border bg-surface p-6 shadow-sm">
        <div className="grid gap-5 md:max-w-2xl">
          <label className="grid gap-1.5 text-sm font-medium">{labels.entitlement}<select className="form-field" onChange={(event) => { setEntitlementMode(event.target.value as LeaveType['entitlement_mode']); setRuleEditorOpen(event.target.value === 'ACCRUAL') }} value={entitlementMode}><option value="ACCRUAL">{labels.accrual}</option><option value="UNLIMITED">{labels.unlimited}</option><option value="ANNUAL_HOURS_CAP">{labels.annualCap}</option><option value="ANNUAL_HOURS_FTE_CAP">{labels.annualFteCap}</option><option value="OVERTIME_HOURS">{labels.overtimeCap}</option></select></label>
          {entitlementMode === 'ANNUAL_HOURS_CAP' ? <label className="grid gap-1.5 text-sm font-medium">{labels.annualCapValue}<input className="form-field w-32" min="0" onChange={(event) => setAnnualHoursCap(event.target.value)} step="0.01" type="number" value={annualHoursCap} /></label> : null}
          {entitlementMode === 'ANNUAL_HOURS_FTE_CAP' ? <label className="grid gap-1.5 text-sm font-medium">{labels.annualFteCapValue}<input className="form-field w-32" min="0" onChange={(event) => setAnnualHoursFteCap(event.target.value)} step="0.01" type="number" value={annualHoursFteCap} /></label> : null}
          {entitlementMode === 'OVERTIME_HOURS' ? <fieldset className="rounded-xl border bg-muted/20 p-4"><legend className="px-1 text-sm font-semibold">{labels.overtimeTypes}</legend><p className="mt-1 text-xs text-muted-foreground">{labels.overtimeTypesHelp}</p><label className="relative mt-3 block"><input className="form-field" onChange={(event) => setOvertimeSearch(event.target.value)} placeholder={labels.search} type="search" value={overtimeSearch} /></label><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{visibleOvertimeTypes.map((item) => <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted" key={item.id}><input checked={overtimeWorkHourTypeIds.includes(item.id)} className="size-4 accent-primary" onChange={() => toggleOvertimeType(item.id)} type="checkbox" />{item.name}</label>)}{visibleOvertimeTypes.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noOvertimeTypes}</p> : null}</div><p className="mt-2 text-xs text-muted-foreground">{labels.selectedCount.replace('{count}', String(overtimeWorkHourTypeIds.length))}</p></fieldset> : null}
        </div>
      </section>
      {entitlementMode === 'ACCRUAL' && catalog && labels.ruleEditor && ruleEditorOpen ? <AccrualRuleEditor catalog={catalog} copyFromRuleId={copyFromRuleId} ensureLeaveTypeId={() => save(false, true)} labels={labels.ruleEditor} leaveTypeId={existing?.id ?? createdId ?? undefined} onCancel={() => { setEditingRuleId(undefined); setCopyFromRuleId(undefined); setRuleEditorOpen(false) }} onSaved={() => { setEditingRuleId(undefined); setCopyFromRuleId(undefined); setRuleEditorOpen(false) }} ruleId={editingRuleId} /> : null}
      {entitlementMode === 'ACCRUAL' && catalog && existing && labels.ruleList && !ruleEditorOpen ? <LeaveAccrualRuleList catalog={catalog} leaveTypeId={existing.id} labels={labels.ruleList} onAdd={() => { setEditingRuleId(undefined); setCopyFromRuleId(latestAccrualRuleId); setRuleEditorOpen(true) }} onSelect={(ruleId) => { setEditingRuleId(ruleId); setCopyFromRuleId(undefined); setRuleEditorOpen(true) }} /> : null}
      {entitlementMode === 'ACCRUAL' && catalog && existing && labels.bonusPanel && !ruleEditorOpen ? <LeaveBonusRulesPanel catalog={catalog} leaveTypeId={existing.id} labels={labels.bonusPanel} /> : null}
      {!existing && entitlementMode !== 'ACCRUAL' ? <section className="rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">{labels.configureAfterSave}</section> : null}
      {existing && catalog && labels.exceptionPanel ? <><p className="text-sm text-muted-foreground">{labels.exceptionsForAll}</p><LeaveAccrualExceptionsPanel catalog={catalog} leaveTypeId={existing.id} labels={labels.exceptionPanel} /></> : null}
    </div> : null}

    {tab === 'limits' && !isLeave && existing && workHourSettings ? <div className="space-y-5"><OvertimeSettingsPanel workHourTypeId={existing.id} initial={workHourSettings.initial} labels={workHourSettings.labels} mode={workHourSettings.mode} /></div> : null}
    {tab === 'limits' && !isLeave && !existing ? <section className="rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">{labels.configureAfterSave}</section> : null}
    {tab === 'advanced' ? <section className="rounded-2xl border bg-surface p-6 shadow-sm"><p className="text-sm text-muted-foreground">{labels.advancedPlaceholder ?? labels.notApplicable}</p></section> : null}
    {nameError ? <p className="text-sm text-destructive" role="alert">{nameError}</p> : null}
    {state === 'saved' ? <p className="text-sm text-success">{labels.saved}</p> : state === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}
    {archiveOpen ? <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" role="dialog"><section aria-labelledby="archive-dialog-title" className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-xl"><h2 className="text-xl font-semibold" id="archive-dialog-title">{labels.archiveTitle}</h2><p className="mt-2 text-sm text-muted-foreground">{labels.archiveDescription}</p><div className="mt-6 flex justify-end gap-2"><button className="button-secondary" onClick={() => setArchiveOpen(false)} type="button">{labels.archiveCancel}</button><button className="button-danger" disabled={state === 'saving'} onClick={() => void save(true)} type="button">{state === 'saving' ? labels.saving : labels.archiveConfirm}</button></div></section></div> : null}
  </div>
}

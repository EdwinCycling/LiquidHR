'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type Basis = 'CONTRACT_HOURS' | 'WORKED_HOURS'
type Frequency = 'PAYROLL_PERIOD' | 'FOUR_WEEKLY' | 'MONTHLY' | 'YEARLY'
type PeriodMode = 'PAYROLL_PERIOD' | 'SPECIFIC'
type SpecificPeriod = 'FOUR_WEEKLY' | 'MONTHLY' | 'YEARLY'
type Parts = { hours: string; minutes: string; seconds: string }

export type AccrualRuleEditorLabels = {
  newTitle: string
  editTitle: string
  editing: string
  copyValuesFrom: string
  startDate: string
  basis: string
  contractHours: string
  contractHoursHelp: string
  workedHours: string
  workedHoursHelp: string
  periodMode: string
  payrollPeriod: string
  specificPeriod: string
  fourWeekly: string
  monthly: string
  yearly: string
  timing: string
  upfront: string
  arrears: string
  amountPerYear: string
  amountPerPeriod: string
  amountPerHour: string
  hours: string
  minutes: string
  seconds: string
  expiry: string
  months: string
  noExpiry: string
  pause: string
  pauseHelp: string
  workHours: string
  workHoursHelp: string
  search: string
  selectedCount: string
  noWorkHours: string
  noPauseTypes: string
  profileRequired: string
  summary: string
  summaryBasis: string
  summaryAmount: string
  summaryFrequency: string
  summaryTiming: string
  summaryExpiry: string
  summaryPause: string
  summaryPauseTypes: string
  save: string
  cancel: string
  saving: string
  failed: string
  saved: string
}

function partsFromDecimal(value: number | null | undefined): Parts {
  const totalSeconds = Math.max(0, Math.round((value ?? 0) * 3600))
  return {
    hours: String(Math.floor(totalSeconds / 3600)),
    minutes: String(Math.floor((totalSeconds % 3600) / 60)),
    seconds: String(totalSeconds % 60),
  }
}

function decimalFromParts(parts: Parts): number {
  return Number(parts.hours || 0) + Number(parts.minutes || 0) / 60 + Number(parts.seconds || 0) / 3600
}

function nextCalendarDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function frequencyLabel(frequency: Frequency, labels: AccrualRuleEditorLabels): string {
  if (frequency === 'PAYROLL_PERIOD') return labels.payrollPeriod
  if (frequency === 'FOUR_WEEKLY') return labels.fourWeekly
  if (frequency === 'MONTHLY') return labels.monthly
  return labels.yearly
}

export function AccrualRuleEditor({
  catalog,
  leaveTypeId,
  ruleId,
  copyFromRuleId,
  labels,
  ensureLeaveTypeId,
  onCancel,
  cancelHref,
  onSaved,
}: {
  catalog: LeaveCatalog
  leaveTypeId?: string
  ruleId?: string
  copyFromRuleId?: string
  labels: AccrualRuleEditorLabels
  ensureLeaveTypeId?: () => Promise<string | null>
  onCancel?: () => void
  cancelHref?: string
  onSaved?: (leaveTypeId: string) => void
}) {
  const router = useRouter()
  const leaveType = catalog.leaveTypes.find((item) => item.id === leaveTypeId)
  const rules = useMemo(
    () => leaveTypeId
      ? catalog.accrualRules
        .filter((rule) => rule.leave_type_id === leaveTypeId)
        .sort((left, right) => left.valid_from.localeCompare(right.valid_from))
      : [],
    [catalog.accrualRules, leaveTypeId],
  )
  const editingRule = rules.find((rule) => rule.id === ruleId)
  const copiedRule = rules.find((rule) => rule.id === copyFromRuleId)
  const sourceRule = editingRule ?? copiedRule
  const defaultProfile = useMemo(
    () => catalog.profiles.find((profile) => profile.is_group_default && profile.is_active),
    [catalog.profiles],
  )
  const profileId = sourceRule?.leave_profile_id ?? defaultProfile?.id ?? ''
  const initialBasis: Basis = sourceRule?.accrual_basis === 'WORKED_HOURS' ? 'WORKED_HOURS' : 'CONTRACT_HOURS'
  const initialFrequency: Frequency = sourceRule?.accrual_frequency === 'FOUR_WEEKLY'
    || sourceRule?.accrual_frequency === 'MONTHLY'
    || sourceRule?.accrual_frequency === 'YEARLY'
    ? sourceRule.accrual_frequency
    : 'PAYROLL_PERIOD'

  const [validFrom, setValidFrom] = useState(
    editingRule?.valid_from
      ?? copiedRule?.valid_until
      ?? (copiedRule ? nextCalendarDay(copiedRule.valid_from) : new Date().toISOString().slice(0, 10)),
  )
  const [basis, setBasis] = useState<Basis>(initialBasis)
  const [periodMode, setPeriodMode] = useState<PeriodMode>(initialFrequency === 'PAYROLL_PERIOD' ? 'PAYROLL_PERIOD' : 'SPECIFIC')
  const [specificPeriod, setSpecificPeriod] = useState<SpecificPeriod>(initialFrequency === 'PAYROLL_PERIOD' ? 'YEARLY' : initialFrequency)
  const [timing, setTiming] = useState<'UPFRONT' | 'ARREARS'>(sourceRule?.accrual_timing ?? 'ARREARS')
  const [amount, setAmount] = useState<Parts>(() => partsFromDecimal(sourceRule?.accrual_amount))
  const [rate, setRate] = useState<Parts>(() => partsFromDecimal(sourceRule?.accrual_rate))
  const [expiryMonths, setExpiryMonths] = useState(String(sourceRule?.expiration_months ?? 6))
  const [workHourTypeIds, setWorkHourTypeIds] = useState<string[]>(() => catalog.accrualRuleWorkHourTypes
    .filter((item) => item.accrual_rule_id === sourceRule?.id)
    .map((item) => item.work_hour_type_id))
  const [workHourSearch, setWorkHourSearch] = useState('')
  const [pauseLeaveTypeIds, setPauseLeaveTypeIds] = useState<string[]>(() => catalog.accrualRulePauseTypes
    .filter((item) => item.accrual_rule_id === sourceRule?.id)
    .map((item) => item.pause_leave_type_id))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const frequency: Frequency = periodMode === 'PAYROLL_PERIOD' ? 'PAYROLL_PERIOD' : specificPeriod
  const availableWorkHours = useMemo(
    () => catalog.workHourTypes.filter((item) => item.category !== 'INFORMATIONAL' && item.is_active),
    [catalog.workHourTypes],
  )
  const visibleWorkHours = availableWorkHours.filter((item) => item.name.toLocaleLowerCase().includes(workHourSearch.toLocaleLowerCase()))

  const toggle = (values: string[], value: string, setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  const save = async () => {
    if (!profileId || (basis === 'WORKED_HOURS' && workHourTypeIds.length === 0)) {
      setStatus('failed')
      return
    }
    setStatus('saving')
    try {
      const resolvedLeaveTypeId = leaveTypeId ?? await ensureLeaveTypeId?.()
      if (!resolvedLeaveTypeId) throw new Error('LEAVE_TYPE_REQUIRED')
      const response = await fetch('/api/leave/catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'ACCRUAL_RULE',
          id: editingRule?.id,
          leaveProfileId: profileId,
          leaveTypeId: resolvedLeaveTypeId,
          predecessorRuleId: editingRule ? null : copyFromRuleId ?? null,
          validFrom,
          validUntil: editingRule?.valid_until ?? null,
          accrualBasis: basis,
          accrualFrequency: frequency,
          accrualTiming: timing,
          accrualAmount: basis === 'CONTRACT_HOURS' ? decimalFromParts(amount) : null,
          accrualRate: basis === 'WORKED_HOURS' ? decimalFromParts(rate) : null,
          expirationMonths: Number(expiryMonths),
          workHourTypeIds: basis === 'WORKED_HOURS' ? workHourTypeIds : [],
          pauseLeaveTypeIds,
        }),
      })
      if (!response.ok) throw new Error('LEAVE_RULE_SAVE_FAILED')
      setStatus('saved')
      onSaved?.(resolvedLeaveTypeId)
      if (!onSaved) router.push(`/settings/leave-accrual/types/${resolvedLeaveTypeId}?tab=limits`)
      router.refresh()
    } catch {
      setStatus('failed')
    }
  }

  const cancel = () => {
    if (onCancel) onCancel()
    else if (cancelHref) router.push(cancelHref)
  }
  const basisLabel = basis === 'CONTRACT_HOURS' ? labels.contractHours : labels.workedHours
  const periodLabel = frequencyLabel(frequency, labels)
  const amountSummary = basis === 'CONTRACT_HOURS'
    ? `${decimalFromParts(amount).toFixed(2)}u ${frequency === 'YEARLY' ? labels.amountPerYear : `${labels.amountPerPeriod} ${periodLabel.toLocaleLowerCase()}`}`
    : `${decimalFromParts(rate).toFixed(4)}u/u ${labels.amountPerHour}`
  const readableSummary = [
    `${labels.summaryBasis} ${basisLabel.toLocaleLowerCase()}.`,
    `${labels.summaryAmount} ${amountSummary}.`,
    `${labels.summaryFrequency} ${periodLabel.toLocaleLowerCase()}. ${labels.summaryTiming} ${timing === 'UPFRONT' ? labels.upfront.toLocaleLowerCase() : labels.arrears.toLocaleLowerCase()}.`,
    expiryMonths === '0' ? labels.noExpiry + '.' : `${labels.summaryExpiry} ${expiryMonths} ${labels.months.toLocaleLowerCase()}.`,
    `${labels.summaryPause} ${pauseLeaveTypeIds.length} ${labels.summaryPauseTypes}.`,
    ...(basis === 'WORKED_HOURS' ? [`${labels.workHours}: ${workHourTypeIds.length}.`] : []),
  ].join(' ')

  const summary = readableSummary

  const partsField = (parts: Parts, setter: (next: Parts) => void, includeSeconds: boolean) => (
    <div className={`grid gap-3 ${includeSeconds ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      <label className="grid max-w-40 gap-1 text-sm font-medium">
        <span>{labels.hours}</span>
        <input className="form-field" min="0" onChange={(event) => setter({ ...parts, hours: event.target.value })} type="number" value={parts.hours} />
      </label>
      <label className="grid max-w-40 gap-1 text-sm font-medium">
        <span>{labels.minutes}</span>
        <input className="form-field" max="59" min="0" onChange={(event) => setter({ ...parts, minutes: event.target.value })} type="number" value={parts.minutes} />
      </label>
      {includeSeconds ? <label className="grid max-w-40 gap-1 text-sm font-medium">
        <span>{labels.seconds}</span>
        <input className="form-field" max="59" min="0" onChange={(event) => setter({ ...parts, seconds: event.target.value })} type="number" value={parts.seconds} />
      </label> : null}
    </div>
  )

  return <div className="space-y-6">
    <section className="rounded-2xl border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{editingRule ? labels.editTitle : labels.newTitle}{leaveType ? ` · ${leaveType.name}` : ''}</h2>
          {copiedRule && !editingRule ? <p className="mt-1 text-sm text-muted-foreground">{labels.copyValuesFrom}: {copiedRule.valid_from}</p> : null}
        </div>
        {editingRule ? <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{labels.editing}</span> : null}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.startDate}
          <input className="form-field disabled:cursor-not-allowed disabled:opacity-60" disabled={Boolean(editingRule)} onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.basis}
          <select className="form-field" onChange={(event) => setBasis(event.target.value as Basis)} value={basis}>
            <option value="CONTRACT_HOURS">{labels.contractHours}</option>
            <option value="WORKED_HOURS">{labels.workedHours}</option>
          </select>
          <span className="text-xs font-normal text-muted-foreground">{basis === 'CONTRACT_HOURS' ? labels.contractHoursHelp : labels.workedHoursHelp}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.periodMode}
          <select className="form-field" onChange={(event) => setPeriodMode(event.target.value as PeriodMode)} value={periodMode}>
            <option value="PAYROLL_PERIOD">{labels.payrollPeriod}</option>
            <option value="SPECIFIC">{labels.specificPeriod}</option>
          </select>
        </label>
        {periodMode === 'SPECIFIC' ? <label className="grid gap-1.5 text-sm font-medium">
          {labels.specificPeriod}
          <select className="form-field" onChange={(event) => setSpecificPeriod(event.target.value as SpecificPeriod)} value={specificPeriod}>
            <option value="FOUR_WEEKLY">{labels.fourWeekly}</option>
            <option value="MONTHLY">{labels.monthly}</option>
            <option value="YEARLY">{labels.yearly}</option>
          </select>
        </label> : null}
        <label className="grid gap-1.5 text-sm font-medium">
          {labels.timing}
          <select className="form-field" onChange={(event) => setTiming(event.target.value as typeof timing)} value={timing}>
            <option value="UPFRONT">{labels.upfront}</option>
            <option value="ARREARS">{labels.arrears}</option>
          </select>
        </label>
      </div>

      {basis === 'WORKED_HOURS' ? <fieldset className="mt-6 rounded-xl border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">{labels.workHours}</legend>
        <p className="mt-1 text-xs text-muted-foreground">{labels.workHoursHelp}</p>
        <label className="mt-3 block">
          <input className="form-field" onChange={(event) => setWorkHourSearch(event.target.value)} placeholder={labels.search} type="search" value={workHourSearch} />
        </label>
        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
          {visibleWorkHours.map((item) => <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted" key={item.id}>
            <input checked={workHourTypeIds.includes(item.id)} className="size-4 accent-primary" onChange={() => toggle(workHourTypeIds, item.id, setWorkHourTypeIds)} type="checkbox" />
            {item.name}
          </label>)}
          {visibleWorkHours.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noWorkHours}</p> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{labels.selectedCount.replace('{count}', String(workHourTypeIds.length))}</p>
      </fieldset> : null}

      <div className="mt-6 rounded-xl border bg-muted/20 p-4">
        <h3 className="font-semibold">{basis === 'CONTRACT_HOURS' && frequency === 'YEARLY' ? labels.amountPerYear : basis === 'CONTRACT_HOURS' ? `${labels.amountPerPeriod} ${periodLabel.toLocaleLowerCase()}` : labels.amountPerHour}</h3>
        <div className="mt-3">{partsField(basis === 'CONTRACT_HOURS' ? amount : rate, basis === 'CONTRACT_HOURS' ? setAmount : setRate, basis === 'WORKED_HOURS')}</div>
      </div>
      <div className="mt-5 flex items-end gap-2">
        <label className="grid max-w-32 gap-1.5 text-sm font-medium">
          {labels.expiry}
          <input className="form-field w-28" max="120" min="0" onChange={(event) => setExpiryMonths(event.target.value)} type="number" value={expiryMonths} />
        </label>
        <span className="pb-3 text-sm text-muted-foreground">{labels.months}</span>
      </div>
      {!profileId ? <p className="mt-5 text-sm text-destructive">{labels.profileRequired}</p> : null}
    </section>

    <section className="rounded-2xl border bg-surface p-6 shadow-sm">
      <fieldset>
        <legend className="text-sm font-semibold">{labels.pause}</legend>
        <p className="mt-1 text-xs text-muted-foreground">{labels.pauseHelp}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {catalog.leaveTypes.filter((item) => item.id !== leaveTypeId && item.is_active).map((item) => <label className="flex cursor-pointer items-center gap-3 text-sm" key={item.id}>
            <input checked={pauseLeaveTypeIds.includes(item.id)} className="size-4 accent-primary" onChange={() => toggle(pauseLeaveTypeIds, item.id, setPauseLeaveTypeIds)} type="checkbox" />
            {item.name}
          </label>)}
        </div>
        {catalog.leaveTypes.filter((item) => item.id !== leaveTypeId && item.is_active).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.noPauseTypes}</p> : null}
      </fieldset>
    </section>

    <section className="rounded-2xl border bg-muted/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.summary}</p>
      <p className="mt-2 text-sm font-medium">{summary}</p>
    </section>

    <div className="flex items-center gap-3">
      {onCancel || cancelHref ? <button className="button-secondary" onClick={cancel} type="button">{labels.cancel}</button> : null}
      <button className="button-primary" disabled={status === 'saving' || !profileId || (basis === 'WORKED_HOURS' && workHourTypeIds.length === 0)} onClick={() => void save()} type="button">{status === 'saving' ? labels.saving : labels.save}</button>
      {status === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}
      {status === 'saved' ? <p className="text-sm text-success">{labels.saved}</p> : null}
    </div>
  </div>
}

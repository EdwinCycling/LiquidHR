'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type Basis = 'CONTRACT_HOURS' | 'WORKED_HOURS'
type Parts = { hours: string; minutes: string; seconds: string }
export type AccrualRuleEditorLabels = {
  chainTitle: string; chainDescription: string; profile: string; predecessor: string; successorStart: string; basis: string; period: string; timing: string; amountPerYear: string; amountPerHour: string; hours: string; minutes: string; seconds: string; expiry: string; pause: string; pauseHelp: string; workHours: string; contractHours: string; workedHours: string; ageSeniority: string; payrollPeriod: string; yearly: string; upfront: string; arrears: string; noPredecessor: string; version: string; current: string; selected: string; successor: string; validFrom: string; validUntil: string; noValue: string; specialRulesLater: string; summary: string; save: string; cancel: string; saving: string; failed: string; saved: string; selectAtLeastOne: string; noWorkHours: string; noPauseTypes: string
}

function partsFromDecimal(value: number | null | undefined): Parts {
  const totalSeconds = Math.max(0, Math.round((value ?? 0) * 3600))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { hours: String(hours), minutes: String(minutes), seconds: String(seconds) }
}

function decimalFromParts(parts: Parts): number {
  return Number(parts.hours || 0) + Number(parts.minutes || 0) / 60 + Number(parts.seconds || 0) / 3600
}

export function AccrualRuleEditor({ catalog, leaveTypeId, predecessorRuleId, labels, ensureLeaveTypeId, onCancel, onSaved }: { catalog: LeaveCatalog; leaveTypeId?: string; predecessorRuleId?: string; labels: AccrualRuleEditorLabels; ensureLeaveTypeId?: () => Promise<string | null>; onCancel?: () => void; onSaved?: (leaveTypeId: string) => void }) {
  const router = useRouter()
  const leaveType = catalog.leaveTypes.find((item) => item.id === leaveTypeId)
  const rules = useMemo(() => leaveTypeId ? catalog.accrualRules.filter((rule) => rule.leave_type_id === leaveTypeId).sort((left, right) => left.valid_from.localeCompare(right.valid_from)) : [], [catalog.accrualRules, leaveTypeId])
  const predecessor = rules.find((rule) => rule.id === predecessorRuleId)
  const initialBasis: Basis = predecessor?.accrual_basis === 'WORKED_HOURS' ? 'WORKED_HOURS' : 'CONTRACT_HOURS'
  const [profileId, setProfileId] = useState(predecessor?.leave_profile_id ?? catalog.profiles[0]?.id ?? '')
  const [validFrom, setValidFrom] = useState(predecessor?.valid_until ?? new Date().toISOString().slice(0, 10))
  const [basis, setBasis] = useState<Basis>(initialBasis)
  const [frequency, setFrequency] = useState<'PAYROLL_PERIOD' | 'YEARLY'>(predecessor?.accrual_frequency ?? 'YEARLY')
  const [timing, setTiming] = useState<'UPFRONT' | 'ARREARS'>(predecessor?.accrual_timing ?? 'ARREARS')
  const [amount, setAmount] = useState<Parts>(() => partsFromDecimal(predecessor?.accrual_amount))
  const [rate, setRate] = useState<Parts>(() => partsFromDecimal(predecessor?.accrual_rate))
  const [expiryMonths, setExpiryMonths] = useState(String(predecessor?.expiration_months ?? 6))
  const [workHourTypeIds, setWorkHourTypeIds] = useState<string[]>(() => catalog.accrualRuleWorkHourTypes.filter((item) => item.accrual_rule_id === predecessorRuleId).map((item) => item.work_hour_type_id))
  const [pauseLeaveTypeIds, setPauseLeaveTypeIds] = useState<string[]>(() => catalog.accrualRulePauseTypes.filter((item) => item.accrual_rule_id === predecessorRuleId).map((item) => item.pause_leave_type_id))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const toggle = (values: string[], value: string, setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  const save = async () => {
    if (!profileId || (basis === 'WORKED_HOURS' && workHourTypeIds.length === 0)) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const resolvedLeaveTypeId = leaveTypeId ?? await ensureLeaveTypeId?.()
      if (!resolvedLeaveTypeId) throw new Error('LEAVE_TYPE_REQUIRED')
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACCRUAL_RULE', leaveProfileId: profileId, leaveTypeId: resolvedLeaveTypeId, predecessorRuleId: predecessorRuleId ?? null, validFrom, validUntil: null, accrualBasis: basis, accrualFrequency: frequency, accrualTiming: timing, accrualAmount: basis === 'CONTRACT_HOURS' ? decimalFromParts(amount) : null, accrualRate: basis === 'WORKED_HOURS' ? decimalFromParts(rate) : null, expirationMonths: Number(expiryMonths), workHourTypeIds: basis === 'WORKED_HOURS' ? workHourTypeIds : [], pauseLeaveTypeIds }) })
      if (!response.ok) throw new Error('LEAVE_RULE_SAVE_FAILED')
      setStatus('saved')
      onSaved?.(resolvedLeaveTypeId)
      router.push(`/settings/leave-accrual/types/${resolvedLeaveTypeId}?tab=limits`)
      router.refresh()
    } catch { setStatus('failed') }
  }
  const basisLabel = basis === 'CONTRACT_HOURS' ? labels.contractHours : labels.workedHours
  const summary = basis === 'CONTRACT_HOURS' ? `${basisLabel} · ${decimalFromParts(amount).toFixed(2)}u ${frequency === 'YEARLY' ? labels.amountPerYear : labels.period}` : `${basisLabel} · ${decimalFromParts(rate).toFixed(4)}u/u ${labels.amountPerHour}`
  const partsField = (parts: Parts, setter: (next: Parts) => void, includeSeconds: boolean) => <div className={`grid gap-3 ${includeSeconds ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}><label className="grid gap-1 text-sm font-medium"><span>{labels.hours}</span><input className="form-field" min="0" onChange={(event) => setter({ ...parts, hours: event.target.value })} type="number" value={parts.hours} /></label><label className="grid gap-1 text-sm font-medium"><span>{labels.minutes}</span><input className="form-field" min="0" max="59" onChange={(event) => setter({ ...parts, minutes: event.target.value })} type="number" value={parts.minutes} /></label>{includeSeconds ? <label className="grid gap-1 text-sm font-medium"><span>{labels.seconds}</span><input className="form-field" min="0" max="59" onChange={(event) => setter({ ...parts, seconds: event.target.value })} type="number" value={parts.seconds} /></label> : null}</div>

  return <div className="space-y-6">
    <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.chainTitle}{leaveType ? ` · ${leaveType.name}` : ''}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.chainDescription}</p></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{predecessor ? labels.selected : labels.noPredecessor}</span></div><div className="mt-5 space-y-3">{rules.map((rule, index) => <article className={`rounded-xl border p-4 ${rule.id === predecessorRuleId ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''}`} key={rule.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{labels.version.replace('{number}', String(index + 1))}</p><p className="mt-1 text-sm text-muted-foreground">{labels.validFrom}: {rule.valid_from} · {labels.validUntil}: {rule.valid_until ?? labels.noValue}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.valid_until ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success'}`}>{rule.valid_until ? labels.noValue : labels.current}</span></div><p className="mt-3 text-sm text-muted-foreground">{rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : rule.accrual_basis === 'WORKED_HOURS' ? labels.workedHours : labels.ageSeniority} · {rule.accrual_frequency === 'PAYROLL_PERIOD' ? labels.payrollPeriod : labels.yearly} · {rule.accrual_timing === 'UPFRONT' ? labels.upfront : labels.arrears}</p><Link className="mt-3 inline-block text-sm font-semibold text-primary hover:underline" href={`/settings/leave-accrual/rules/new?leaveTypeId=${leaveTypeId}&predecessorRuleId=${rule.id}`}>{labels.successor}</Link></article>)}{rules.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.noPredecessor}</p> : null}</div></section>
    <section className="rounded-2xl border bg-surface p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">{labels.profile}<select className="form-field" onChange={(event) => setProfileId(event.target.value)} value={profileId}>{catalog.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">{labels.predecessor}<select className="form-field" disabled value={predecessorRuleId ?? ''}><option value="">{labels.noPredecessor}</option>{predecessor ? <option value={predecessor.id}>{predecessor.valid_from} · {predecessor.valid_until ?? labels.noValue}</option> : null}</select></label><label className="grid gap-1.5 text-sm font-medium">{labels.successorStart}<input className="form-field" min={predecessor?.valid_from} onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.basis}<select className="form-field" onChange={(event) => setBasis(event.target.value as Basis)} value={basis}><option value="CONTRACT_HOURS">{labels.contractHours}</option><option value="WORKED_HOURS">{labels.workedHours}</option></select></label><label className="grid gap-1.5 text-sm font-medium">{labels.period}<select className="form-field" onChange={(event) => setFrequency(event.target.value as typeof frequency)} value={frequency}><option value="PAYROLL_PERIOD">{labels.payrollPeriod}</option><option value="YEARLY">{labels.yearly}</option></select></label><label className="grid gap-1.5 text-sm font-medium">{labels.timing}<select className="form-field" onChange={(event) => setTiming(event.target.value as typeof timing)} value={timing}><option value="UPFRONT">{labels.upfront}</option><option value="ARREARS">{labels.arrears}</option></select></label></div>
      <div className="mt-6 rounded-xl border bg-muted/20 p-4"><h3 className="font-semibold">{basis === 'CONTRACT_HOURS' && frequency === 'YEARLY' ? labels.amountPerYear : basis === 'CONTRACT_HOURS' ? labels.period : labels.amountPerHour}</h3><div className="mt-3">{partsField(basis === 'CONTRACT_HOURS' ? amount : rate, basis === 'CONTRACT_HOURS' ? setAmount : setRate, basis === 'WORKED_HOURS')}</div></div>
      <div className="mt-5 grid gap-1.5 text-sm font-medium"><label>{labels.expiry}<input className="form-field mt-1 max-w-xs" min="0" max="120" onChange={(event) => setExpiryMonths(event.target.value)} type="number" value={expiryMonths} /></label></div>
    </section>
    <section className="grid gap-5 md:grid-cols-2"><fieldset className="rounded-2xl border bg-surface p-6 shadow-sm"><legend className="px-1 text-sm font-semibold">{labels.workHours}</legend><p className="mt-1 text-xs text-muted-foreground">{labels.selectAtLeastOne}</p><div className="mt-3 space-y-2">{catalog.workHourTypes.filter((item) => item.category !== 'INFORMATIONAL').map((item) => <label className="flex items-center gap-3 text-sm" key={item.id}><input checked={workHourTypeIds.includes(item.id)} className="size-4 accent-primary" disabled={basis !== 'WORKED_HOURS'} onChange={() => toggle(workHourTypeIds, item.id, setWorkHourTypeIds)} type="checkbox" />{item.name}</label>)}{catalog.workHourTypes.filter((item) => item.category !== 'INFORMATIONAL').length === 0 ? <p className="text-sm text-muted-foreground">{labels.noWorkHours}</p> : null}</div></fieldset><fieldset className="rounded-2xl border bg-surface p-6 shadow-sm"><legend className="px-1 text-sm font-semibold">{labels.pause}</legend><p className="mt-1 text-xs text-muted-foreground">{labels.pauseHelp}</p><div className="mt-3 space-y-2">{catalog.leaveTypes.filter((item) => item.id !== leaveTypeId).map((item) => <label className="flex items-center gap-3 text-sm" key={item.id}><input checked={pauseLeaveTypeIds.includes(item.id)} className="size-4 accent-primary" onChange={() => toggle(pauseLeaveTypeIds, item.id, setPauseLeaveTypeIds)} type="checkbox" />{item.name}</label>)}{catalog.leaveTypes.filter((item) => item.id !== leaveTypeId).length === 0 ? <p className="text-sm text-muted-foreground">{labels.noPauseTypes}</p> : null}</div></fieldset></section>
    <section className="rounded-2xl border bg-muted/50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.summary}</p><p className="mt-2 text-sm font-medium">{summary} · {labels.expiry}: {expiryMonths} · {labels.pause}: {pauseLeaveTypeIds.length} · {labels.workHours}: {workHourTypeIds.length}</p></section>
    <div className="flex items-center gap-3">{onCancel ? <button className="button-secondary" onClick={onCancel} type="button">{labels.cancel}</button> : null}<button className="button-primary" disabled={status === 'saving'} onClick={() => void save()} type="button">{status === 'saving' ? labels.saving : labels.save}</button>{status === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}{status === 'saved' ? <p className="text-sm text-success">{labels.saved}</p> : null}</div>
  </div>
}

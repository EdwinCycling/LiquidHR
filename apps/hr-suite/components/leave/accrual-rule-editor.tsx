'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { LeaveCatalog } from '@/lib/leave/leave-service'

type Labels = {
  save: string; saving: string; chainTitle: string; chainDescription: string; predecessor: string; profile: string; successor: string; successorStart: string; validUntil: string; basis: string; frequency: string; timing: string; amount: string; rate: string; expiry: string; pause: string; workHours: string; contractHours: string; workedHours: string; payrollPeriod: string; yearly: string; upfront: string; arrears: string; noPredecessor: string; version: string; lockedHint: string; selectAtLeastOne: string; failed: string; saved: string
}

export function AccrualRuleEditor({ catalog, leaveTypeId, predecessorRuleId, labels }: { catalog: LeaveCatalog; leaveTypeId: string; predecessorRuleId?: string; labels: Labels }) {
  const router = useRouter()
  const leaveType = catalog.leaveTypes.find((item) => item.id === leaveTypeId)
  const rules = useMemo(() => catalog.accrualRules.filter((rule) => rule.leave_type_id === leaveTypeId).sort((a, b) => a.valid_from.localeCompare(b.valid_from)), [catalog.accrualRules, leaveTypeId])
  const predecessor = rules.find((rule) => rule.id === predecessorRuleId)
  const [profileId, setProfileId] = useState(catalog.profiles[0]?.id ?? '')
  const [validFrom, setValidFrom] = useState(predecessor?.valid_until ?? new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [basis, setBasis] = useState<'CONTRACT_HOURS' | 'WORKED_HOURS'>('CONTRACT_HOURS')
  const [frequency, setFrequency] = useState<'PAYROLL_PERIOD' | 'YEARLY'>('PAYROLL_PERIOD')
  const [timing, setTiming] = useState<'UPFRONT' | 'ARREARS'>('ARREARS')
  const [amount, setAmount] = useState('0')
  const [rate, setRate] = useState('0.083333')
  const [expiryMonths, setExpiryMonths] = useState('6')
  const [workHourTypeIds, setWorkHourTypeIds] = useState<string[]>([])
  const [pauseLeaveTypeIds, setPauseLeaveTypeIds] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const toggle = (values: string[], value: string, setter: (next: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  const save = async () => {
    if (!profileId || (basis === 'WORKED_HOURS' && workHourTypeIds.length === 0)) { setStatus('failed'); return }
    setStatus('saving')
    try {
      const response = await fetch('/api/leave/catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACCRUAL_RULE', leaveProfileId: profileId, leaveTypeId, predecessorRuleId: predecessorRuleId ?? null, validFrom, validUntil: validUntil || null, accrualBasis: basis, accrualFrequency: frequency, accrualTiming: timing, accrualAmount: basis === 'CONTRACT_HOURS' ? Number(amount) : null, accrualRate: basis === 'WORKED_HOURS' ? Number(rate) : null, expirationMonths: Number(expiryMonths), workHourTypeIds, pauseLeaveTypeIds }) })
      if (!response.ok) throw new Error('LEAVE_RULE_SAVE_FAILED')
      router.push(`/settings/leave-accrual/types/${leaveTypeId}`)
      router.refresh()
    } catch { setStatus('failed') }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{labels.chainTitle}{leaveType ? ` · ${leaveType.name}` : ''}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.chainDescription}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {rules.map((rule, index) => <div className={`rounded-xl border p-4 ${rule.id === predecessorRuleId ? 'border-primary bg-accent/40' : ''}`} key={rule.id}><div className="flex items-center justify-between gap-3"><span className="font-semibold">{labels.version.replace('{number}', String(index + 1))}</span><time className="text-xs text-muted-foreground" dateTime={rule.valid_from}>{rule.valid_from}</time></div><p className="mt-2 text-sm text-muted-foreground">{rule.accrual_basis === 'CONTRACT_HOURS' ? labels.contractHours : labels.workedHours} · {rule.accrual_frequency === 'PAYROLL_PERIOD' ? labels.payrollPeriod : labels.yearly} · {rule.accrual_timing === 'UPFRONT' ? labels.upfront : labels.arrears}</p>{rule.valid_until ? <p className="mt-1 text-xs text-muted-foreground">{labels.validUntil}: {rule.valid_until}</p> : <p className="mt-1 text-xs text-success">{labels.lockedHint}</p>}{rule.valid_until ? <a className="mt-3 inline-block text-sm font-semibold text-primary hover:underline" href={`/settings/leave-accrual/rules/new?leaveTypeId=${leaveTypeId}&predecessorRuleId=${rule.id}`}>{labels.successor}</a> : null}</div>)}
          {rules.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.noPredecessor}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border bg-surface p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">{labels.profile}<select className="form-field" onChange={(event) => setProfileId(event.target.value)} value={profileId}>{catalog.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.predecessor}<select className="form-field" disabled value={predecessorRuleId ?? ''}><option value="">{labels.noPredecessor}</option>{predecessor ? <option value={predecessor.id}>{predecessor.valid_from} — {predecessor.valid_until ?? '…'}</option> : null}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.successorStart}<input className="form-field" onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.validUntil}<input className="form-field" onChange={(event) => setValidUntil(event.target.value)} type="date" value={validUntil} /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.basis}<select className="form-field" onChange={(event) => setBasis(event.target.value as typeof basis)} value={basis}><option value="CONTRACT_HOURS">{labels.contractHours}</option><option value="WORKED_HOURS">{labels.workedHours}</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.frequency}<select className="form-field" onChange={(event) => setFrequency(event.target.value as typeof frequency)} value={frequency}><option value="PAYROLL_PERIOD">{labels.payrollPeriod}</option><option value="YEARLY">{labels.yearly}</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.timing}<select className="form-field" onChange={(event) => setTiming(event.target.value as typeof timing)} value={timing}><option value="UPFRONT">{labels.upfront}</option><option value="ARREARS">{labels.arrears}</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">{basis === 'CONTRACT_HOURS' ? labels.amount : labels.rate}<input className="form-field" min="0" onChange={(event) => basis === 'CONTRACT_HOURS' ? setAmount(event.target.value) : setRate(event.target.value)} step="0.000001" type="number" value={basis === 'CONTRACT_HOURS' ? amount : rate} /></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.expiry}<input className="form-field" min="0" max="120" onChange={(event) => setExpiryMonths(event.target.value)} type="number" value={expiryMonths} /></label>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <fieldset className="rounded-2xl border bg-surface p-6 shadow-sm"><legend className="px-1 text-sm font-semibold">{labels.workHours}</legend><div className="mt-3 space-y-2">{catalog.workHourTypes.filter((item) => item.category !== 'INFORMATIONAL').map((item) => <label className="flex items-center gap-3 text-sm" key={item.id}><input checked={workHourTypeIds.includes(item.id)} className="size-4 accent-primary" disabled={basis !== 'WORKED_HOURS'} onChange={() => toggle(workHourTypeIds, item.id, setWorkHourTypeIds)} type="checkbox" />{item.name}</label>)}</div></fieldset>
        <fieldset className="rounded-2xl border bg-surface p-6 shadow-sm"><legend className="px-1 text-sm font-semibold">{labels.pause}</legend><div className="mt-3 space-y-2">{catalog.leaveTypes.filter((item) => item.id !== leaveTypeId).map((item) => <label className="flex items-center gap-3 text-sm" key={item.id}><input checked={pauseLeaveTypeIds.includes(item.id)} className="size-4 accent-primary" onChange={() => toggle(pauseLeaveTypeIds, item.id, setPauseLeaveTypeIds)} type="checkbox" />{item.name}</label>)}</div></fieldset>
      </section>
      <div className="flex items-center gap-3"><button className="button-primary" disabled={status === 'saving'} onClick={() => void save()} type="button">{status === 'saving' ? labels.saving : labels.save}</button>{status === 'failed' ? <p className="text-sm text-destructive">{labels.failed}</p> : null}</div>
    </div>
  )
}

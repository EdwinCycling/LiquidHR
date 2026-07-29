'use client'

import { createPortal } from 'react-dom'
import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { AbsenceCaseSummary } from '@/lib/absence/service'

type IndicatorValue = 'UNKNOWN' | 'YES' | 'NO'

interface AbsenceQuickFormProps {
  employeeId: string
  employmentId?: string
  currentCase?: AbsenceCaseSummary | null
  labels: {
    report: string
    startDate: string
    percentage: string
    expectedRecovery: string
    hasSafetyNet: string
    workAccident: string
    thirdPartyAccident: string
    unknown: string
    yes: string
    no: string
    submit: string
    recover: string
    recoveredOn: string
    failed: string
    close: string
  }
}

export function AbsenceQuickForm({ employeeId, employmentId, currentCase, labels }: AbsenceQuickFormProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [percentage, setPercentage] = useState('100')
  const [expectedRecovery, setExpectedRecovery] = useState('')
  const [hasSafetyNet, setHasSafetyNet] = useState<IndicatorValue>('UNKNOWN')
  const [workAccident, setWorkAccident] = useState<IndicatorValue>('UNKNOWN')
  const [thirdPartyAccident, setThirdPartyAccident] = useState<IndicatorValue>('UNKNOWN')
  const [recoveredOn, setRecoveredOn] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(false)
    const response = await fetch('/api/absence/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeId, employmentId, startDate, absencePercentage: Number(percentage), expectedRecoveryOn: expectedRecovery || null, hasSicknessBenefitSafetyNet: toIndicator(hasSafetyNet), isWorkAccident: toIndicator(workAccident), isThirdPartyTrafficAccident: toIndicator(thirdPartyAccident), idempotencyKey: crypto.randomUUID() }) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    setOpen(false)
    window.location.reload()
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!currentCase) return
    setSaving(true); setError(false)
    const response = await fetch('/api/absence/recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: currentCase.id, recoveredOn, idempotencyKey: crypto.randomUUID() }) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    window.location.reload()
  }

  const modal = open && mounted ? createPortal(
    <div aria-labelledby="absence-report-title" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4" role="dialog">
      <section className="max-h-[min(90vh,48rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border bg-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b pb-4"><div><p className="eyebrow text-primary">{labels.report}</p><h2 className="mt-1 text-xl font-semibold" id="absence-report-title">{labels.report}</h2></div><button aria-label={labels.close} className="button-secondary shrink-0" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={17} /></button></div>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitReport}>
          <label className="text-sm font-medium">{labels.startDate}<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input mt-1 w-full" /></label>
          <label className="text-sm font-medium">{labels.percentage}<input required min="0.01" max="100" step="0.01" type="number" value={percentage} onChange={(event) => setPercentage(event.target.value)} className="input mt-1 w-full" /></label>
          <label className="text-sm font-medium sm:col-span-2">{labels.expectedRecovery}<input type="date" value={expectedRecovery} onChange={(event) => setExpectedRecovery(event.target.value)} className="input mt-1 w-full" /></label>
          <IndicatorField label={labels.hasSafetyNet} value={hasSafetyNet} onChange={setHasSafetyNet} labels={labels} />
          <IndicatorField label={labels.workAccident} value={workAccident} onChange={setWorkAccident} labels={labels} />
          <IndicatorField label={labels.thirdPartyAccident} value={thirdPartyAccident} onChange={setThirdPartyAccident} labels={labels} />
          <div className="flex items-end sm:justify-end"><button type="submit" disabled={saving} className="button-primary w-full sm:w-auto">{saving ? '…' : labels.submit}</button></div>
          {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{labels.failed}</p>}
        </form>
      </section>
    </div>,
    document.body,
  ) : null

  return <>
    <div className="flex flex-wrap items-center gap-3"><button type="button" className="button-primary" onClick={() => { setError(false); setMounted(true); setOpen(true) }}>{labels.report}</button>{currentCase && currentCase.status === 'ACTIVE' ? <form onSubmit={submitRecovery} className="flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor="recovered-on">{labels.recoveredOn}</label><input id="recovered-on" required type="date" value={recoveredOn} onChange={(event) => setRecoveredOn(event.target.value)} className="input h-10" /><button type="submit" disabled={saving} className="button-secondary">{labels.recover}</button></form> : null}</div>
    {error && !open && <p role="alert" className="text-sm font-medium text-destructive">{labels.failed}</p>}
    {modal}
  </>
}

function IndicatorField({ label, value, onChange, labels }: { label: string; value: IndicatorValue; onChange: (value: IndicatorValue) => void; labels: AbsenceQuickFormProps['labels'] }) {
  return <label className="text-sm font-medium">{label}<select className="input mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value as IndicatorValue)}><option value="UNKNOWN">{labels.unknown}</option><option value="YES">{labels.yes}</option><option value="NO">{labels.no}</option></select></label>
}

function toIndicator(value: IndicatorValue): boolean | null {
  return value === 'UNKNOWN' ? null : value === 'YES'
}

'use client'

import { createPortal } from 'react-dom'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { AbsenceCaseSummary } from '@/lib/absence/service'
import type { LeaveEmploymentOption } from '@/lib/leave/employment-resolver'

type IndicatorValue = 'UNKNOWN' | 'YES' | 'NO'

interface AbsenceQuickFormProps {
  employeeId: string
  employmentId?: string
  employmentOptions?: LeaveEmploymentOption[]
  currentCase?: AbsenceCaseSummary | null
  recoveryMode?: 'link' | 'form' | 'hidden'
  showReportAction?: boolean
  selfService?: boolean
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
    partialRecover?: string
    recoveredOn: string
    capacityEffectiveOn?: string
    failed: string
    close: string
    employment?: string
    employmentPlaceholder?: string
    employmentSearch?: string
    saving?: string
    selfServiceIntro?: string
  }
}

export function AbsenceQuickForm({ employeeId, employmentId, employmentOptions = [], currentCase, recoveryMode = 'form', showReportAction = true, selfService = false, labels }: AbsenceQuickFormProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [percentage, setPercentage] = useState('100')
  const [expectedRecovery, setExpectedRecovery] = useState('')
  const [hasSafetyNet, setHasSafetyNet] = useState<IndicatorValue>('UNKNOWN')
  const [workAccident, setWorkAccident] = useState<IndicatorValue>('UNKNOWN')
  const [thirdPartyAccident, setThirdPartyAccident] = useState<IndicatorValue>('UNKNOWN')
  const [recoveredOn, setRecoveredOn] = useState(new Date().toISOString().slice(0, 10))
  const [capacityEffectiveOn, setCapacityEffectiveOn] = useState(new Date().toISOString().slice(0, 10))
  const [capacityPercentage, setCapacityPercentage] = useState('50')
  const [selectedEmploymentId, setSelectedEmploymentId] = useState(employmentOptions.length > 1 ? '' : employmentId ?? (employmentOptions.length === 1 ? employmentOptions[0]?.id ?? '' : ''))
  const [availableEmploymentOptions, setAvailableEmploymentOptions] = useState(employmentOptions)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(false)
    const body = selfService
      ? { employeeId, employmentId: selectedEmploymentId || undefined, startDate, idempotencyKey: crypto.randomUUID() }
      : { employeeId, employmentId: selectedEmploymentId || undefined, startDate, absencePercentage: Number(percentage), expectedRecoveryOn: expectedRecovery || null, hasSicknessBenefitSafetyNet: toIndicator(hasSafetyNet), isWorkAccident: toIndicator(workAccident), isThirdPartyTrafficAccident: toIndicator(thirdPartyAccident), idempotencyKey: crypto.randomUUID() }
    const response = await fetch('/api/absence/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    setOpen(false)
    window.location.reload()
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentCase) return
    setSaving(true)
    setError(false)
    const response = await fetch('/api/absence/recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: currentCase.id, recoveredOn, idempotencyKey: crypto.randomUUID() }) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    window.location.reload()
  }

  async function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentCase) return
    setSaving(true)
    setError(false)
    const response = await fetch('/api/absence/capacity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ caseId: currentCase.id, effectiveOn: capacityEffectiveOn, absencePercentage: Number(capacityPercentage), expectedNextReviewOn: null, idempotencyKey: crypto.randomUUID() }) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    window.location.reload()
  }

  async function openReport() {
    setError(false)
    if (availableEmploymentOptions.length === 0) {
      setSaving(true)
      const response = await fetch(`/api/absence/employments/${employeeId}`)
      const body = await response.json().catch(() => null) as { options?: LeaveEmploymentOption[]; selectedEmploymentId?: string | null } | null
      setSaving(false)
      if (!response.ok) { setError(true); return }
      const nextOptions = body?.options ?? []
      setAvailableEmploymentOptions(nextOptions)
      setSelectedEmploymentId(body?.selectedEmploymentId ?? (nextOptions.length === 1 ? nextOptions[0]?.id ?? '' : ''))
    }
    setMounted(true)
    setOpen(true)
  }

  const showEmploymentSelector = availableEmploymentOptions.length > 1 || (!employmentId && availableEmploymentOptions.length === 1)
  const isOpen = currentCase?.status === 'ACTIVE' || currentCase?.status === 'RECOVERY_WINDOW'
  const isActive = currentCase?.status === 'ACTIVE'
  const modal = open && mounted ? createPortal(
    <div aria-labelledby="absence-report-title" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/70 p-4" role="dialog">
      <section className="max-h-[min(90vh,48rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border bg-surface p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b pb-4"><div><p className="eyebrow text-primary">{labels.report}</p><h2 className="mt-1 text-xl font-semibold" id="absence-report-title">{labels.report}</h2></div><button aria-label={labels.close} className="button-secondary shrink-0" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={17} /></button></div>
        {selfService && labels.selfServiceIntro ? <p className="mt-5 text-sm leading-6 text-muted-foreground">{labels.selfServiceIntro}</p> : null}
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitReport}>
          {showEmploymentSelector ? <label className="text-sm font-medium sm:col-span-2">{labels.employment ?? labels.report}<DropdownSelect aria-label={labels.employment ?? labels.report} className="mt-1" emptyLabel={labels.employmentPlaceholder ?? labels.report} id="absence-employment" name="employmentId" onChange={(event) => setSelectedEmploymentId(event.target.value)} placeholder={labels.employmentPlaceholder ?? labels.report} required searchPlaceholder={labels.employmentSearch ?? labels.report} searchable value={selectedEmploymentId}>
            <option disabled value="">{labels.employmentPlaceholder ?? labels.report}</option>
            {availableEmploymentOptions.map((option) => <option key={option.id} value={option.id}>{[option.employmentNumber, option.administrationName, option.departmentName, option.functionName].filter(Boolean).join(' · ')}</option>)}
          </DropdownSelect></label> : null}
          <label className="text-sm font-medium">{labels.startDate}<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input mt-1 w-full" /></label>
          {!selfService && <label className="text-sm font-medium">{labels.percentage}<input required min="0.01" max="100" step="0.01" type="number" value={percentage} onChange={(event) => setPercentage(event.target.value)} className="input mt-1 w-full" /></label>}
          {!selfService && <label className="text-sm font-medium sm:col-span-2">{labels.expectedRecovery}<input type="date" value={expectedRecovery} onChange={(event) => setExpectedRecovery(event.target.value)} className="input mt-1 w-full" /></label>}
          {!selfService && <IndicatorField label={labels.hasSafetyNet} value={hasSafetyNet} onChange={setHasSafetyNet} labels={labels} />}
          {!selfService && <IndicatorField label={labels.workAccident} value={workAccident} onChange={setWorkAccident} labels={labels} />}
          {!selfService && <IndicatorField label={labels.thirdPartyAccident} value={thirdPartyAccident} onChange={setThirdPartyAccident} labels={labels} />}
          <div className="flex items-end sm:justify-end"><button type="submit" disabled={saving} className="button-primary w-full sm:w-auto">{saving ? labels.saving ?? labels.submit : labels.submit}</button></div>
          {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{labels.failed}</p>}
        </form>
      </section>
    </div>,
    document.body,
  ) : null

  return <>
    <div className="flex flex-wrap items-end gap-3">
      {showReportAction && !isOpen ? <button type="button" className="button-primary" disabled={saving} onClick={() => void openReport()}>{labels.report}</button> : null}
      {isOpen && recoveryMode === 'link' ? <Link prefetch={false} href={`/employees/${employeeId}?tab=absence&view=expanded&caseId=${currentCase?.id}`} className="button-secondary">{labels.recover}</Link> : null}
      {isActive && recoveryMode === 'form' ? <>
        <form onSubmit={submitRecovery} className="flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-muted-foreground" htmlFor="recovered-on">{labels.recoveredOn}<input id="recovered-on" required type="date" value={recoveredOn} onChange={(event) => setRecoveredOn(event.target.value)} className="input mt-1 h-10" /></label><button type="submit" disabled={saving} className="button-secondary">{labels.recover}</button></form>
        <form onSubmit={submitCapacity} className="flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-muted-foreground" htmlFor="absence-capacity-effective-on">{labels.capacityEffectiveOn ?? labels.recoveredOn}<input id="absence-capacity-effective-on" required type="date" value={capacityEffectiveOn} onChange={(event) => setCapacityEffectiveOn(event.target.value)} className="input mt-1 h-10" /></label><label className="text-xs font-semibold text-muted-foreground" htmlFor="absence-capacity-percentage">{labels.percentage}<input id="absence-capacity-percentage" required min="0.01" max="100" step="0.01" type="number" value={capacityPercentage} onChange={(event) => setCapacityPercentage(event.target.value)} className="input mt-1 h-10 w-28" /></label><button type="submit" disabled={saving} className="button-secondary">{labels.partialRecover ?? labels.recover}</button></form>
      </> : null}
    </div>
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

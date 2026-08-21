'use client'

import { createPortal } from 'react-dom'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { IconButton } from '@/components/ui/icon-button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { FormField } from '@/components/patterns/form-field'
import type { AbsenceCaseSummary } from '@/lib/absence/service'
import type { LeaveEmploymentOption } from '@/lib/leave/employment-resolver'
import {
  buildAbsenceCapacityPayload,
  buildAbsenceRecoveryPayload,
  buildAbsenceReportPayload,
  type IndicatorValue,
} from './absence-presentational'

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
    const body = buildAbsenceReportPayload({ employeeId, employmentId: selectedEmploymentId, startDate, percentage, expectedRecovery, hasSafetyNet, workAccident, thirdPartyAccident, idempotencyKey: crypto.randomUUID(), selfService })
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
    const response = await fetch('/api/absence/recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildAbsenceRecoveryPayload(currentCase.id, recoveredOn, crypto.randomUUID())) })
    setSaving(false)
    if (!response.ok) { setError(true); return }
    window.location.reload()
  }

  async function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentCase) return
    setSaving(true)
    setError(false)
    const response = await fetch('/api/absence/capacity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildAbsenceCapacityPayload(currentCase.id, capacityEffectiveOn, capacityPercentage, crypto.randomUUID())) })
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
      <Surface variant="overlay" className="max-h-[min(90vh,48rem)] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-subtle pb-4"><div><p className="eyebrow text-primary">{labels.report}</p><h2 className="mt-1 text-xl font-semibold" id="absence-report-title">{labels.report}</h2></div><IconButton label={labels.close} size="sm" variant="secondary" onClick={() => setOpen(false)}><X aria-hidden="true" /></IconButton></div>
        {selfService && labels.selfServiceIntro ? <p className="mt-5 text-sm leading-6 text-muted-foreground">{labels.selfServiceIntro}</p> : null}
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submitReport}>
          {showEmploymentSelector ? <FormField className="sm:col-span-2" label={labels.employment ?? labels.report} required control={<DropdownSelect aria-label={labels.employment ?? labels.report} emptyLabel={labels.employmentPlaceholder ?? labels.report} id="absence-employment" name="employmentId" onChange={(event) => setSelectedEmploymentId(event.target.value)} placeholder={labels.employmentPlaceholder ?? labels.report} required searchPlaceholder={labels.employmentSearch ?? labels.report} searchable value={selectedEmploymentId}>
            <option disabled value="">{labels.employmentPlaceholder ?? labels.report}</option>
            {availableEmploymentOptions.map((option) => <option key={option.id} value={option.id}>{[option.employmentNumber, option.administrationName, option.departmentName, option.functionName].filter(Boolean).join(' · ')}</option>)}
          </DropdownSelect>} /> : null}
          <FormField label={labels.startDate} required control={<TextInput required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />} />
          {!selfService && <FormField label={labels.percentage} required control={<TextInput required min="0.01" max="100" step="0.01" type="number" value={percentage} onChange={(event) => setPercentage(event.target.value)} />} />}
          {!selfService && <FormField className="sm:col-span-2" label={labels.expectedRecovery} control={<TextInput type="date" value={expectedRecovery} onChange={(event) => setExpectedRecovery(event.target.value)} />} />}
          {!selfService && <IndicatorField label={labels.hasSafetyNet} value={hasSafetyNet} onChange={setHasSafetyNet} labels={labels} />}
          {!selfService && <IndicatorField label={labels.workAccident} value={workAccident} onChange={setWorkAccident} labels={labels} />}
          {!selfService && <IndicatorField label={labels.thirdPartyAccident} value={thirdPartyAccident} onChange={setThirdPartyAccident} labels={labels} />}
          <div className="flex items-end sm:justify-end"><Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? labels.saving ?? labels.submit : labels.submit}</Button></div>
          {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{labels.failed}</p>}
        </form>
      </Surface>
    </div>,
    document.body,
  ) : null

  return <>
    <div className="flex flex-wrap items-end gap-3">
      {showReportAction && !isOpen ? <Button type="button" disabled={saving} onClick={() => void openReport()}>{labels.report}</Button> : null}
      {isOpen && recoveryMode === 'link' ? <Link prefetch={false} href={`/employees/${employeeId}?tab=absence&view=expanded&caseId=${currentCase?.id}`} className={buttonClasses({ variant: 'secondary' })}>{labels.recover}</Link> : null}
      {isActive && recoveryMode === 'form' ? <>
        <form onSubmit={submitRecovery} className="flex min-w-0 flex-1 flex-wrap items-end gap-2"><FormField className="min-w-[10rem] flex-1" label={labels.recoveredOn} required control={<TextInput id="recovered-on" required type="date" value={recoveredOn} onChange={(event) => setRecoveredOn(event.target.value)} />} /><Button type="submit" disabled={saving} variant="secondary">{labels.recover}</Button></form>
        <form onSubmit={submitCapacity} className="flex min-w-0 flex-1 flex-wrap items-end gap-2"><FormField className="min-w-[10rem] flex-1" label={labels.capacityEffectiveOn ?? labels.recoveredOn} required control={<TextInput id="absence-capacity-effective-on" required type="date" value={capacityEffectiveOn} onChange={(event) => setCapacityEffectiveOn(event.target.value)} />} /><FormField className="min-w-[8rem] flex-1" label={labels.percentage} required control={<TextInput id="absence-capacity-percentage" required min="0.01" max="100" step="0.01" type="number" value={capacityPercentage} onChange={(event) => setCapacityPercentage(event.target.value)} />} /><Button type="submit" disabled={saving} variant="secondary">{labels.partialRecover ?? labels.recover}</Button></form>
      </> : null}
    </div>
    {error && !open && <p role="alert" className="text-sm font-medium text-destructive">{labels.failed}</p>}
    {modal}
  </>
}

function IndicatorField({ label, value, onChange, labels }: { label: string; value: IndicatorValue; onChange: (value: IndicatorValue) => void; labels: AbsenceQuickFormProps['labels'] }) {
  return <FormField label={label} control={<DropdownSelect value={value} onChange={(event) => onChange(event.target.value as IndicatorValue)}><option value="UNKNOWN">{labels.unknown}</option><option value="YES">{labels.yes}</option><option value="NO">{labels.no}</option></DropdownSelect>} />
}

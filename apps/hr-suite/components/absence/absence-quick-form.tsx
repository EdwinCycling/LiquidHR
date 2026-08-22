'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button, buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import type { AbsenceCaseSummary } from '@/lib/absence/service'
import type { LeaveEmploymentOption } from '@/lib/leave/employment-resolver'
import { buildAbsenceCapacityPayload, buildAbsenceRecoveryPayload, buildAbsenceReportPayload, getDefaultAbsenceCapacityEffectiveOn, type IndicatorValue } from './absence-presentational'

interface AbsenceQuickFormProps {
  employeeId: string
  employmentId?: string
  employmentOptions?: LeaveEmploymentOption[]
  currentCase?: AbsenceCaseSummary | null
  recoveryMode?: 'link' | 'form' | 'hidden'
  showReportAction?: boolean
  canReport?: boolean
  canRecover?: boolean
  canChangeCapacity?: boolean
  selfService?: boolean
  labels: {
    report: string; startDate: string; percentage: string; expectedRecovery: string; hasSafetyNet: string; workAccident: string; thirdPartyAccident: string
    unknown: string; yes: string; no: string; submit: string; recover: string; partialRecover?: string; recoveredOn: string; capacityEffectiveOn?: string
    failed: string; close: string; employment?: string; employmentPlaceholder?: string; employmentSearch?: string; saving?: string; selfServiceIntro?: string
    discardTitle?: string; discardDescription?: string; discardConfirm?: string; discardCancel?: string
  }
}

export function AbsenceQuickForm({ canChangeCapacity = true, canRecover = true, canReport = true, employeeId, employmentId, employmentOptions = [], currentCase, recoveryMode = 'form', showReportAction = true, selfService = false, labels }: AbsenceQuickFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [percentage, setPercentage] = useState('100')
  const [expectedRecovery, setExpectedRecovery] = useState('')
  const [hasSafetyNet, setHasSafetyNet] = useState<IndicatorValue>('UNKNOWN')
  const [workAccident, setWorkAccident] = useState<IndicatorValue>('UNKNOWN')
  const [thirdPartyAccident, setThirdPartyAccident] = useState<IndicatorValue>('UNKNOWN')
  const [recoveredOn, setRecoveredOn] = useState(new Date().toISOString().slice(0, 10))
  const [capacityEffectiveOn, setCapacityEffectiveOn] = useState(() => getDefaultAbsenceCapacityEffectiveOn(currentCase))
  const [capacityPercentage, setCapacityPercentage] = useState('50')
  const [selectedEmploymentId, setSelectedEmploymentId] = useState(employmentOptions.length > 1 ? '' : employmentId ?? (employmentOptions.length === 1 ? employmentOptions[0]?.id ?? '' : ''))
  const [availableEmploymentOptions, setAvailableEmploymentOptions] = useState(employmentOptions)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [initialReportValues, setInitialReportValues] = useState({ startDate, percentage, expectedRecovery, hasSafetyNet, workAccident, thirdPartyAccident, selectedEmploymentId })
  const reportDirty = open && JSON.stringify({ startDate, percentage, expectedRecovery, hasSafetyNet, workAccident, thirdPartyAccident, selectedEmploymentId }) !== JSON.stringify(initialReportValues)

  function discardReportChanges(): void {
    const initial = initialReportValues
    setStartDate(initial.startDate); setPercentage(initial.percentage); setExpectedRecovery(initial.expectedRecovery)
    setHasSafetyNet(initial.hasSafetyNet); setWorkAccident(initial.workAccident); setThirdPartyAccident(initial.thirdPartyAccident); setSelectedEmploymentId(initial.selectedEmploymentId); setError(false)
  }

  async function submitReport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true); setError(false)
    const body = buildAbsenceReportPayload({ employeeId, employmentId: selectedEmploymentId, startDate, percentage, expectedRecovery, hasSafetyNet, workAccident, thirdPartyAccident, idempotencyKey: crypto.randomUUID(), selfService })
    try {
      const response = await fetch('/api/absence/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) { setError(true); return }
      setOpen(false); router.refresh()
    } catch { setError(true) } finally { setSaving(false) }
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (!currentCase) return; setSaving(true); setError(false)
    try {
      const response = await fetch('/api/absence/recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildAbsenceRecoveryPayload(currentCase.id, recoveredOn, crypto.randomUUID())) })
      if (!response.ok) { setError(true); return }
      router.refresh()
    } catch { setError(true) } finally { setSaving(false) }
  }

  async function submitCapacity(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (!currentCase) return; setSaving(true); setError(false)
    try {
      const response = await fetch('/api/absence/capacity', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(buildAbsenceCapacityPayload(currentCase.id, capacityEffectiveOn, capacityPercentage, crypto.randomUUID())) })
      if (!response.ok) { setError(true); return }
      router.refresh()
    } catch { setError(true) } finally { setSaving(false) }
  }

  async function openReport(): Promise<void> {
    setError(false)
    if (availableEmploymentOptions.length === 0) {
      setSaving(true)
      try {
        const response = await fetch(`/api/absence/employments/${employeeId}`)
        const body = await response.json().catch(() => null) as { options?: LeaveEmploymentOption[]; selectedEmploymentId?: string | null } | null
        if (!response.ok) { setError(true); return }
        const nextOptions = body?.options ?? []
        const nextSelectedEmploymentId = body?.selectedEmploymentId ?? (nextOptions.length === 1 ? nextOptions[0]?.id ?? '' : '')
        setAvailableEmploymentOptions(nextOptions); setSelectedEmploymentId(nextSelectedEmploymentId)
        setInitialReportValues((current) => ({ ...current, selectedEmploymentId: nextSelectedEmploymentId }))
      } catch { setError(true); return } finally { setSaving(false) }
    }
    setOpen(true)
  }

  const showEmploymentSelector = availableEmploymentOptions.length > 1 || (!employmentId && availableEmploymentOptions.length === 1)
  const isOpen = currentCase?.status === 'ACTIVE' || currentCase?.status === 'RECOVERY_WINDOW'
  const isActive = currentCase?.status === 'ACTIVE'

  const showRecoveryAction = canRecover && !selfService
  const showCapacityAction = canChangeCapacity && !selfService

  return <>
    <div className="flex flex-wrap items-end gap-3">
      {showReportAction && canReport && !isOpen ? <Button type="button" disabled={saving} onClick={() => void openReport()}>{labels.report}</Button> : null}
      {isOpen && recoveryMode === 'link' && showRecoveryAction ? <Link prefetch={false} href={`/employees/${employeeId}?tab=absence&view=expanded&caseId=${currentCase?.id}`} className={buttonClasses({ variant: 'secondary' })}>{labels.recover}</Link> : null}
      {isActive && recoveryMode === 'form' && (showRecoveryAction || showCapacityAction) ? <>
        {showRecoveryAction ? <form onSubmit={submitRecovery} className="flex min-w-0 flex-1 flex-wrap items-end gap-2"><FormField className="min-w-[10rem] flex-1" label={labels.recoveredOn} required control={<TextInput id="recovered-on" required type="date" value={recoveredOn} onChange={(event) => setRecoveredOn(event.target.value)} />} /><Button loading={saving} type="submit" disabled={saving} variant="secondary">{labels.recover}</Button></form> : null}
        {showCapacityAction ? <form onSubmit={submitCapacity} className="flex min-w-0 flex-1 flex-wrap items-end gap-2"><FormField className="min-w-[10rem] flex-1" label={labels.capacityEffectiveOn ?? labels.recoveredOn} required control={<TextInput id="absence-capacity-effective-on" required type="date" value={capacityEffectiveOn} onChange={(event) => setCapacityEffectiveOn(event.target.value)} />} /><FormField className="min-w-[8rem] flex-1" label={labels.percentage} required control={<TextInput id="absence-capacity-percentage" required min="0.01" max="100" step="0.01" type="number" value={capacityPercentage} onChange={(event) => setCapacityPercentage(event.target.value)} />} /><Button loading={saving} type="submit" disabled={saving} variant="secondary">{labels.partialRecover ?? labels.recover}</Button></form> : null}
      </> : null}
    </div>
    {error && !open ? <p role="alert" className="text-sm font-medium text-destructive">{labels.failed}</p> : null}
    <FormDrawer cancelLabel={labels.close} closeLabel={labels.close} dirty={reportDirty} dirtyProtection={{ description: labels.discardDescription ?? labels.report, discardLabel: labels.discardConfirm ?? labels.close, keepEditingLabel: labels.discardCancel ?? labels.close, title: labels.discardTitle ?? labels.report }} onDiscard={discardReportChanges} onOpenChange={setOpen} onSubmit={submitReport} open={open} saveLabel={labels.submit} saving={saving} title={labels.report}>
      {selfService && labels.selfServiceIntro ? <p className="text-sm leading-6 text-muted-foreground">{labels.selfServiceIntro}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {showEmploymentSelector ? <FormField className="sm:col-span-2" label={labels.employment ?? labels.report} required control={<DropdownSelect aria-label={labels.employment ?? labels.report} emptyLabel={labels.employmentPlaceholder ?? labels.report} id="absence-employment" name="employmentId" onChange={(event) => setSelectedEmploymentId(event.target.value)} placeholder={labels.employmentPlaceholder ?? labels.report} required searchPlaceholder={labels.employmentSearch ?? labels.report} searchable value={selectedEmploymentId}><option disabled value="">{labels.employmentPlaceholder ?? labels.report}</option>{availableEmploymentOptions.map((option) => <option key={option.id} value={option.id}>{[option.employmentNumber, option.administrationName, option.departmentName, option.functionName].filter(Boolean).join(' · ')}</option>)}</DropdownSelect>} /> : null}
        <FormField label={labels.startDate} required control={<TextInput required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />} />
        {!selfService && <FormField label={labels.percentage} required control={<TextInput required min="0.01" max="100" step="0.01" type="number" value={percentage} onChange={(event) => setPercentage(event.target.value)} />} />}
        {!selfService && <FormField className="sm:col-span-2" label={labels.expectedRecovery} control={<TextInput type="date" value={expectedRecovery} onChange={(event) => setExpectedRecovery(event.target.value)} />} />}
        {!selfService && <IndicatorField label={labels.hasSafetyNet} value={hasSafetyNet} onChange={setHasSafetyNet} labels={labels} />}
        {!selfService && <IndicatorField label={labels.workAccident} value={workAccident} onChange={setWorkAccident} labels={labels} />}
        {!selfService && <IndicatorField label={labels.thirdPartyAccident} value={thirdPartyAccident} onChange={setThirdPartyAccident} labels={labels} />}
        {error ? <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{labels.failed}</p> : null}
      </div>
    </FormDrawer>
  </>
}

function IndicatorField({ label, value, onChange, labels }: { label: string; value: IndicatorValue; onChange: (value: IndicatorValue) => void; labels: AbsenceQuickFormProps['labels'] }) {
  return <FormField label={label} control={<DropdownSelect value={value} onChange={(event) => onChange(event.target.value as IndicatorValue)}><option value="UNKNOWN">{labels.unknown}</option><option value="YES">{labels.yes}</option><option value="NO">{labels.no}</option></DropdownSelect>} />
}

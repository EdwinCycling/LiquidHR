'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import type { JourneyActivationPreview } from '@/lib/journeys/runtime-domain'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyStartOptions } from '@/lib/journeys'

interface ApiResponse<T> { data?: T; error?: string }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultEmployment(options: JourneyStartOptions, employeeId: string) {
  const employments = options.employments.filter((employment) => employment.employeeId === employeeId)
  return employments.find((employment) => employment.isPrimary) ?? employments[0]
}

function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `journey-${Date.now()}`
}

export function ActivationWizard({ labels, locale, options }: { labels: JourneyLabels; locale: 'nl' | 'en'; options: JourneyStartOptions }) {
  const router = useRouter()
  const initialEmployeeId = options.employees[0]?.id ?? ''
  const initialTemplateVersionId = options.templates[0]?.versionId ?? ''
  const initialTemplate = options.templates.find((template) => template.versionId === initialTemplateVersionId)
  const initialEmployment = initialTemplate?.anchorRule === 'EMPLOYMENT_START_DATE' ? defaultEmployment(options, initialEmployeeId) : undefined
  const [step, setStep] = useState(0)
  const [templateVersionId, setTemplateVersionId] = useState(initialTemplateVersionId)
  const [employeeId, setEmployeeId] = useState(initialEmployeeId)
  const [employmentId, setEmploymentId] = useState(initialEmployment?.id ?? '')
  const [anchorDate, setAnchorDate] = useState(initialEmployment?.startsOn ?? today())
  const [manualParticipants, setManualParticipants] = useState<Record<string, string[]>>({})
  const [preview, setPreview] = useState<JourneyActivationPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const activationKeyRef = useRef<string | null>(null)
  const selectedTemplate = useMemo(() => options.templates.find((template) => template.versionId === templateVersionId), [options.templates, templateVersionId])
  const employeeEmployments = useMemo(() => options.employments.filter((employment) => employment.employeeId === employeeId), [employeeId, options.employments])
  const selectedEmployment = employeeEmployments.find((employment) => employment.id === employmentId)
  const employmentAnchor = selectedTemplate?.anchorRule === 'EMPLOYMENT_START_DATE'
  const payload = useMemo(() => ({ templateVersionId, targetEmployeeId: employeeId, employmentId: employmentId || null, anchorDate, manualParticipants }), [anchorDate, employeeId, employmentId, manualParticipants, templateVersionId])
  const payloadIdentity = useMemo(() => JSON.stringify(payload), [payload])

  useEffect(() => {
    activationKeyRef.current = null
  }, [payloadIdentity])

  function clearPreview(): void {
    setPreview(null)
    setError('')
  }

  function changeEmployee(nextEmployeeId: string): void {
    setEmployeeId(nextEmployeeId)
    const nextEmployment = employmentAnchor ? defaultEmployment(options, nextEmployeeId) : undefined
    setEmploymentId(nextEmployment?.id ?? '')
    if (nextEmployment) setAnchorDate(nextEmployment.startsOn)
    clearPreview()
  }

  function changeTemplate(nextTemplateVersionId: string): void {
    setTemplateVersionId(nextTemplateVersionId)
    const nextTemplate = options.templates.find((template) => template.versionId === nextTemplateVersionId)
    const nextEmployment = nextTemplate?.anchorRule === 'EMPLOYMENT_START_DATE' ? selectedEmployment ?? defaultEmployment(options, employeeId) : undefined
    setEmploymentId(nextEmployment?.id ?? '')
    setAnchorDate(nextEmployment?.startsOn ?? today())
    clearPreview()
  }

  function errorLabel(code: string | undefined): string {
    if (code === 'JOURNEY_EMPLOYMENT_REQUIRED_FOR_ANCHOR') return labels.employmentRequired
    if (code === 'JOURNEY_ANCHOR_DATE_MISMATCH') return labels.anchorDateMismatch
    if (code === 'JOURNEY_ACTIVATION_BLOCKED') return labels.activationBlocked
    return labels.operationFailed
  }

  async function loadPreview(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/journeys/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json() as ApiResponse<JourneyActivationPreview>
      if (!response.ok || !body.data) {
        setError(errorLabel(body.error))
        return
      }
      setPreview(body.data)
      setStep(3)
    } catch {
      setError(labels.operationFailed)
    } finally {
      setBusy(false)
    }
  }

  async function activate(): Promise<void> {
    if (!preview?.canActivate || busy) return
    setBusy(true)
    setError('')
    try {
      const key = activationKeyRef.current ?? idempotencyKey()
      activationKeyRef.current = key
      const response = await fetch('/api/journeys/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, idempotencyKey: key }) })
      const body = await response.json() as ApiResponse<{ id: string; version: number; idempotentReplay: boolean }>
      if (!response.ok || !body.data) {
        setError(errorLabel(body.error))
        return
      }
      router.replace(`/journeys/${body.data.id}`)
    } catch {
      setError(labels.operationFailed)
    } finally {
      setBusy(false)
    }
  }

  function updateManualParticipant(roleKey: string, value: string): void {
    setManualParticipants((current) => {
      const next = { ...current }
      if (value) next[roleKey] = [value]
      else delete next[roleKey]
      return next
    })
    setPreview(null)
    setStep(2)
  }

  const canContinueFromEmployee = Boolean(employeeId) && (!employmentAnchor || Boolean(employmentId))
  const canContinueFromTemplate = Boolean(templateVersionId && anchorDate && canContinueFromEmployee)
  const noOptions = options.employees.length === 0 || options.templates.length === 0

  return <Surface className="p-5 sm:p-8">
    <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={labels.newTitle}>
      {[labels.targetEmployee, labels.selectTemplate, labels.resolveTeam, labels.preview].map((label, index) => <li aria-current={index === step ? 'step' : undefined} className={`min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-sm ${index === step ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`} key={label}>
        {index < step ? <Check className="mr-2 inline" size={15} /> : null}{label}
      </li>)}
    </ol>
    {noOptions ? <p className="mb-6 rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 p-3 text-sm text-warning" role="alert">{labels.noActivationOptions}</p> : null}
    {step === 0 ? <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-sm font-medium">{labels.selectEmployee}<DropdownSelect aria-label={labels.selectEmployee} className="min-w-0" disabled={options.employees.length === 0} searchable searchPlaceholder={labels.search} value={employeeId} onChange={(event) => changeEmployee(event.target.value)}>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeNumber}</option>)}</DropdownSelect></label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">{labels.selectEmployment}<DropdownSelect aria-label={labels.selectEmployment} className="min-w-0" disabled={employeeEmployments.length === 0} searchable searchPlaceholder={labels.search} value={employmentId} onChange={(event) => { const nextId = event.target.value; setEmploymentId(nextId); const nextEmployment = employeeEmployments.find((employment) => employment.id === nextId); if (employmentAnchor && nextEmployment) setAnchorDate(nextEmployment.startsOn); clearPreview() }}><option disabled={employmentAnchor} value="">{employmentAnchor ? labels.selectEmployment : labels.noEmployment}</option>{employeeEmployments.map((employment) => <option key={employment.id} value={employment.id}>{employment.employmentNumber || labels.selectEmployment} · {employment.startsOn}</option>)}</DropdownSelect></label>
    </div> : null}
    {step === 1 ? <div className="grid min-w-0 gap-5 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-sm font-medium">{labels.selectTemplate}<DropdownSelect aria-label={labels.selectTemplate} className="min-w-0" disabled={options.templates.length === 0} searchable searchPlaceholder={labels.search} value={templateVersionId} onChange={(event) => changeTemplate(event.target.value)}>{options.templates.map((template) => <option key={template.versionId} value={template.versionId}>{template.name[locale]} · v{template.versionNumber}</option>)}</DropdownSelect></label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">{labels.anchorDate}<input aria-label={labels.anchorDate} className="form-field mt-0" readOnly={employmentAnchor} type="date" value={anchorDate} onChange={(event) => { setAnchorDate(event.target.value); clearPreview() }} /><span className="text-xs font-normal text-muted-foreground">{employmentAnchor ? labels.employmentAnchorHelp : labels.manualAnchorHelp}</span></label>
    </div> : null}
    {step === 2 ? <div className="space-y-4">
      <div className="flex items-center gap-3"><Users className="text-primary" /><h2 className="text-xl font-semibold">{labels.resolveTeam}</h2></div>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{labels.teamHelp}</p>
      <Surface className="grid gap-3 bg-surface-subtle p-4 text-sm sm:grid-cols-2">
        <div><p className="text-xs text-muted-foreground">{labels.targetEmployee}</p><p className="mt-1 font-semibold">{options.employees.find((employee) => employee.id === employeeId)?.name ?? labels.selectEmployee}</p></div>
        <div><p className="text-xs text-muted-foreground">{labels.selectTemplate}</p><p className="mt-1 font-semibold">{selectedTemplate?.name[locale] ?? labels.selectTemplate}</p></div>
      </Surface>
    </div> : null}
    {step === 3 && preview ? <div className="space-y-6">
      <div><h2 className="text-xl font-semibold">{labels.preview}</h2><p className="mt-1 text-sm text-muted-foreground">{preview.templateName[locale]} · {preview.targetEmployeeName} · {preview.anchorDate}</p></div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{preview.participants.map((participant) => {
        const candidateIds = participant.status === 'AMBIGUOUS' && participant.candidateEmployeeIds.length > 0 ? new Set(participant.candidateEmployeeIds) : null
        const manualOptions = options.employees.filter((employee) => !candidateIds || candidateIds.has(employee.id))
        return <Surface className="min-w-0 p-4" key={participant.roleKey}>
          <p className="font-semibold">{participant.roleName[locale]}</p>
          <p className={`mt-1 text-sm ${participant.status === 'RESOLVED' ? 'text-success' : participant.status === 'MISSING' && !participant.blocking ? 'text-warning' : 'text-destructive'}`}>{participant.status === 'RESOLVED' ? participant.employees.map((employee) => employee.name).join(', ') : participant.status === 'AMBIGUOUS' ? labels.ambiguous : participant.blocking ? labels.missingRequired : labels.missingOptional}</p>
          {participant.status !== 'RESOLVED' && manualOptions.length > 0 ? <DropdownSelect aria-label={participant.roleName[locale]} className="mt-3 min-w-0" searchable searchPlaceholder={labels.search} value={manualParticipants[participant.roleKey]?.[0] ?? ''} onChange={(event) => updateManualParticipant(participant.roleKey, event.target.value)}><option value="">{labels.manualSelection}</option>{manualOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeNumber}</option>)}</DropdownSelect> : null}
        </Surface>
      })}</div>
      <div className="space-y-2"><h3 className="font-semibold">{labels.timeline}</h3>{preview.moments.map((moment) => <div className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] bg-surface-subtle px-4 py-3 text-sm" key={moment.key}><span className="min-w-0 truncate">{moment.name[locale]}</span><time className="shrink-0">{moment.scheduledOn}</time></div>)}</div>
      {preview.warnings.length > 0 ? <p className="text-sm text-warning">{labels.missingOptional}</p> : null}
      {!preview.canActivate ? <p role="alert" className="text-sm text-destructive">{labels.activationBlocked}</p> : null}
    </div> : null}
    {error ? <p className="mt-5 text-sm text-destructive" role="alert">{error}</p> : null}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
      <Button disabled={busy || step === 0} onClick={() => { setStep((current) => Math.max(0, current - 1)); clearPreview() }} type="button" variant="secondary"><ChevronLeft size={16} />{labels.back}</Button>
      {step < 2 ? <Button disabled={busy || (step === 0 ? !canContinueFromEmployee : !canContinueFromTemplate)} onClick={() => setStep((current) => current + 1)} type="button">{labels.continue}<ChevronRight size={16} /></Button> : step === 2 ? <Button disabled={busy || !canContinueFromTemplate} loading={busy} onClick={() => void loadPreview()} type="button">{labels.resolveTeam}<ChevronRight size={16} /></Button> : <Button disabled={busy || !preview?.canActivate} loading={busy} onClick={() => void activate()} type="button">{labels.activate}</Button>}
    </div>
  </Surface>
}

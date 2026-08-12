'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { JourneyActivationPreview } from '@/lib/journeys/runtime-domain'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyStartOptions } from '@/lib/journeys'

interface ApiResponse<T> { data?: T; error?: string }

export function ActivationWizard({ labels, locale, options }: { labels: JourneyLabels; locale: 'nl' | 'en'; options: JourneyStartOptions }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [templateVersionId, setTemplateVersionId] = useState(options.templates[0]?.versionId ?? '')
  const [employeeId, setEmployeeId] = useState(options.employees[0]?.id ?? '')
  const [employmentId, setEmploymentId] = useState('')
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().slice(0, 10))
  const [manualParticipants, setManualParticipants] = useState<Record<string, string[]>>({})
  const [preview, setPreview] = useState<JourneyActivationPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const employeeEmployments = useMemo(() => options.employments.filter((employment) => employment.employeeId === employeeId), [employeeId, options.employments])

  const payload = { templateVersionId, targetEmployeeId: employeeId, employmentId: employmentId || null, anchorDate, manualParticipants }
  async function loadPreview(): Promise<void> {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/journeys/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json() as ApiResponse<JourneyActivationPreview>
      if (!response.ok || !body.data) throw new Error(body.error)
      setPreview(body.data); setStep(3)
    } catch { setError(labels.operationFailed) }
    finally { setBusy(false) }
  }
  async function activate(): Promise<void> {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/journeys/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, idempotencyKey: crypto.randomUUID() }) })
      const body = await response.json() as ApiResponse<{ id: string }>
      if (!response.ok || !body.data) throw new Error(body.error)
      router.push(`/journeys/${body.data.id}`); router.refresh()
    } catch { setError(labels.operationFailed) }
    finally { setBusy(false) }
  }

  return <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-8">
    <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={labels.newTitle}>{[labels.targetEmployee, labels.selectTemplate, labels.resolveTeam, labels.preview].map((label, index) => <li className={`rounded-xl border px-3 py-2 text-sm ${index === step ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`} key={label}>{index < step ? <Check className="mr-2 inline" size={15} /> : null}{label}</li>)}</ol>
    {step === 0 ? <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">{labels.selectEmployee}<DropdownSelect className="mt-2" searchable searchPlaceholder={labels.search} value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setEmploymentId('') }}>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeNumber}</option>)}</DropdownSelect></label>
      <label className="text-sm font-medium">{labels.selectEmployment}<DropdownSelect className="mt-2" searchable searchPlaceholder={labels.search} value={employmentId} onChange={(event) => setEmploymentId(event.target.value)}><option value="">{labels.noEmployment}</option>{employeeEmployments.map((employment) => <option key={employment.id} value={employment.id}>{employment.employmentNumber} · {employment.startsOn}</option>)}</DropdownSelect></label>
    </div> : null}
    {step === 1 ? <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">{labels.selectTemplate}<DropdownSelect className="mt-2" searchable searchPlaceholder={labels.search} value={templateVersionId} onChange={(event) => setTemplateVersionId(event.target.value)}>{options.templates.map((template) => <option key={template.versionId} value={template.versionId}>{template.name[locale]} · v{template.versionNumber}</option>)}</DropdownSelect></label>
      <label className="text-sm font-medium">{labels.anchorDate}<input className="form-field mt-2" type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} /></label>
    </div> : null}
    {step === 2 ? <div className="space-y-4"><div className="flex items-center gap-3"><Users className="text-primary" /><h2 className="text-xl font-semibold">{labels.resolveTeam}</h2></div><p className="text-sm text-muted-foreground">{labels.newSubtitle}</p></div> : null}
    {step === 3 && preview ? <div className="space-y-6">
      <div><h2 className="text-xl font-semibold">{preview.templateName[locale]}</h2><p className="mt-1 text-sm text-muted-foreground">{preview.targetEmployeeName} · {preview.anchorDate}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">{preview.participants.map((participant) => <div className="rounded-2xl border p-4" key={participant.roleKey}><p className="font-semibold">{participant.roleName[locale]}</p><p className={`mt-1 text-sm ${participant.status === 'RESOLVED' ? 'text-success' : participant.status === 'MISSING' && !participant.blocking ? 'text-warning' : 'text-destructive'}`}>{participant.status === 'RESOLVED' ? participant.employees.map((employee) => employee.name).join(', ') : participant.status === 'AMBIGUOUS' ? labels.ambiguous : participant.blocking ? labels.missingRequired : labels.missingOptional}</p>{participant.status !== 'RESOLVED' ? <DropdownSelect className="mt-3" searchable searchPlaceholder={labels.search} value={manualParticipants[participant.roleKey]?.[0] ?? ''} onChange={(event) => { const value = event.target.value; setManualParticipants((current) => ({ ...current, [participant.roleKey]: value ? [value] : [] })); setPreview(null); setStep(2) }}><option value="">{labels.manualSelection}</option>{options.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</DropdownSelect> : null}</div>)}</div>
      <div className="space-y-2">{preview.moments.map((moment) => <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm" key={moment.key}><span>{moment.name[locale]}</span><time>{moment.scheduledOn}</time></div>)}</div>
      {preview.warnings.length > 0 ? <p className="text-sm text-warning">{labels.missingOptional}</p> : null}{!preview.canActivate ? <p role="alert" className="text-sm text-destructive">{labels.activationBlocked}</p> : null}
    </div> : null}
    {error ? <p className="mt-5 text-sm text-destructive" role="alert">{error}</p> : null}
    <div className="mt-8 flex justify-between gap-3 border-t pt-5"><button className="button-secondary" disabled={busy || step === 0} onClick={() => { setStep((current) => Math.max(0, current - 1)); setPreview(null) }} type="button"><ChevronLeft size={16} />{labels.back}</button>{step < 2 ? <button className="button-primary" disabled={step === 0 ? !employeeId : !templateVersionId || !anchorDate} onClick={() => setStep((current) => current + 1)} type="button">{labels.continue}<ChevronRight size={16} /></button> : step === 2 ? <button className="button-primary" disabled={busy} onClick={loadPreview} type="button">{labels.resolveTeam}<ChevronRight size={16} /></button> : <button className="button-primary" disabled={busy || !preview?.canActivate} onClick={activate} type="button">{busy ? labels.activating : labels.activate}</button>}</div>
  </section>
}

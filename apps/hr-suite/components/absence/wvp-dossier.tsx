'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DetailColumns } from '@/components/layout/detail-columns'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { FormField } from '@/components/patterns/form-field'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import type { WvpCase, WvpDocumentLink } from '@/lib/absence/wvp/service'
import type { EmployeeDocumentLinkOption } from '@/lib/documents/document-service'
import { agreementCodes, wvpUrgency, type WvpCommand } from '@/lib/absence/wvp/domain'

export type WvpLabels = Record<string, string>

export function milestoneLabel(code: string, labels: WvpLabels): string {
  return code.startsWith('WVP_EVALUATION_6W_') ? `${labels.evaluation} ${Number(code.slice(-2))}` : labels[code] ?? labels.milestones
}

export function WvpDossier({ dossier, documentLinks, documentOptions, canManageDocumentLinks, linksUnavailable, documentReadUnavailable, labels, today, locale }: {
  dossier: WvpCase
  documentLinks: WvpDocumentLink[]
  documentOptions: EmployeeDocumentLinkOption[]
  canManageDocumentLinks: boolean
  linksUnavailable: boolean
  documentReadUnavailable: boolean
  labels: WvpLabels
  today: string
  locale: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, string>>({})
  const [removeCandidate, setRemoveCandidate] = useState<{ id: string } | null>(null)
  const [occurredOn, setOccurredOn] = useState(today)
  const [agreement, setAgreement] = useState<(typeof agreementCodes)[number]>('UNCHANGED')
  const [reviewOn, setReviewOn] = useState(today)
  const openTasks = dossier.tasks.filter(t => t.status === 'OPEN')
  const actionableTasks = dossier.tasks.filter(t => t.code === dossier.currentMilestone)
  const canAct = dossier.canManage && Boolean(dossier.processInstanceId) && !dossier.closedAt
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
  async function send(command: WvpCommand) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/absence/wvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) })
      if (!response.ok) {
        const body: unknown = await response.json()
        setError(typeof body === 'object' && body !== null && 'error' in body && body.error === 'WVP_SCHEMA_REQUIRED' ? labels.schemaRequired : labels.failed)
        return
      }
      setSelectedTask('')
      router.refresh()
    } catch { setError(labels.failed) }
    finally { setBusy(false) }
  }
  async function changeDocumentLink(method: 'POST' | 'DELETE', body: { caseId: string; taskId?: string; documentId?: string; linkId?: string }) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/absence/wvp/document-links', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) { setError(labels.failed); return }
      if (method === 'DELETE') setRemoveCandidate(null)
      if (method === 'POST' && body.taskId) setSelectedDocuments(current => ({ ...current, [body.taskId]: '' }))
      router.refresh()
    } catch { setError(labels.failed) }
    finally { setBusy(false) }
  }
  return <div className="min-w-0 space-y-6">
    <p className="text-sm text-muted-foreground">{labels.privacy}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold">{labels[dossier.closedAt ? 'CLOSED' : dossier.status]}</span>
      <Link className="text-sm text-primary underline" href={`/employees/${dossier.employeeId}?tab=absence&caseId=${dossier.id}`}>{labels.source}</Link>
      <Link className="text-sm text-primary underline" href="/work">{labels.work}</Link>
      {!dossier.processInstanceId && dossier.canConfirm && dossier.status === 'ACTIVE' && !dossier.pendingConfirmation && <Button disabled={busy} onClick={() => void send({ action: 'START', caseId: dossier.id })}>{labels.start}</Button>}
      {canAct && dossier.canConfirm && dossier.status === 'CLOSED' && <Button disabled={busy} onClick={() => void send({ action: 'CLOSE', caseId: dossier.id, idempotencyKey: crypto.randomUUID() })}>{labels.close}</Button>}
    </div>
    <DetailColumns main={<div className="min-w-0 space-y-6">
      <section aria-label={labels.milestones}>
        <h2 className="mb-3 text-lg font-semibold">{labels.milestones}</h2>
        {dossier.tasks.length ? <ol className="divide-y divide-border-subtle border-y border-border-subtle">{dossier.tasks.map(task => {
          const taskLinks = documentLinks.filter(link => link.taskId === task.id)
          const availableDocuments = documentOptions.filter(option => !taskLinks.some(link => link.documentId === option.id))
          return <li key={task.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
            <div className="min-w-0 grow"><p className="break-words font-medium">{milestoneLabel(task.code, labels)}</p><p className="text-muted-foreground">{date(task.dueOn)} · {task.code === 'WVP_WEEK_42' || task.code === 'WVP_WIA_APPLICATION' ? labels.signal : task.code.startsWith('WVP_EVALUATION') ? labels.review : labels.statutory}</p>
              {dossier.processInstanceId && <div className="mt-3 space-y-2">
                <h3 className="font-medium">{labels.documents}</h3>
                {taskLinks.length ? <ul className="space-y-1">{taskLinks.map(link => {
                  const document = documentOptions.find(option => option.id === link.documentId)
                  return <li key={link.id} className="flex flex-wrap items-center gap-2">
                    {document ? <Link className="text-primary underline" href={`/employees/${dossier.employeeId}?tab=documents`}>{document.title}</Link> : <span>{labels.documentUnavailable}</span>}
                    {document && <span className="text-muted-foreground">{date(document.createdAt)}</span>}
                    {canManageDocumentLinks && <Button type="button" variant="secondary" disabled={busy} aria-label={`${labels.removeDocumentLink}: ${document?.title ?? labels.documentUnavailable} — ${milestoneLabel(task.code, labels)}`} onClick={() => setRemoveCandidate({ id: link.id })}>{labels.removeDocumentLink}</Button>}
                  </li>
                })}</ul> : !linksUnavailable && !documentReadUnavailable && <p className="text-muted-foreground">{labels.noDocumentLink}</p>}
                {canManageDocumentLinks && <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={event => { event.preventDefault(); const documentId = selectedDocuments[task.id]; if (documentId) void changeDocumentLink('POST', { caseId: dossier.id, taskId: task.id, documentId }) }}>
                  <FormField label={labels.selectDocument} control={<DropdownSelect value={selectedDocuments[task.id] ?? ''} onChange={event => setSelectedDocuments(current => ({ ...current, [task.id]: event.target.value }))} searchable required><option value="">{labels.selectDocument}</option>{availableDocuments.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}</DropdownSelect>} />
                  <Button type="submit" disabled={busy || !availableDocuments.length || !selectedDocuments[task.id]}>{labels.linkDocument}</Button>
                  {!availableDocuments.length && <p className="text-xs text-muted-foreground sm:col-span-2">{labels.noAvailableDocuments}</p>}
                </form>}
              </div>}
            </div>
            <span>{task.status === 'OPEN' && !dossier.closedAt ? labels[wvpUrgency(task.dueOn, today)] : labels[task.status]}</span>
          </li>
        })}</ol> : <p className="text-sm text-muted-foreground">{labels.noTasks}</p>}
        {dossier.processInstanceId && <div className="space-y-2 text-sm text-muted-foreground">
          <p>{labels.documentLinkHelp}</p>
          {linksUnavailable && <p role="status">{labels.documentLinksUnavailable}</p>}
          {documentReadUnavailable && <p role="status">{labels.documentsUnavailable}</p>}
        </div>}
        {canAct && dossier.canConfirm && actionableTasks.length > 0 && <form className="mt-4 grid gap-3" onSubmit={event => { event.preventDefault(); void send({ action: 'MILESTONE', caseId: dossier.id, taskId: selectedTask, occurredOn, confirmed: true, idempotencyKey: crypto.randomUUID() }) }}>
          <FormField label={labels.complete} control={<DropdownSelect value={selectedTask} onChange={event => setSelectedTask(event.target.value)} searchable required><option value="">{labels.milestones}</option>{actionableTasks.map(task => <option key={task.id} value={task.id}>{milestoneLabel(task.code, labels)}</option>)}</DropdownSelect>} />
          <FormField label={labels.occurredOn} control={<input className="ui-input w-full min-w-0" type="date" value={occurredOn} min={dossier.firstAbsenceOn} max={today} required onChange={event => setOccurredOn(event.target.value)} />} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />{labels.confirm}</label>
          <Button disabled={busy || !selectedTask} type="submit">{labels.complete}</Button>
        </form>}
      </section>
      <section aria-label={labels.timeline}><h2 className="mb-3 text-lg font-semibold">{labels.timeline}</h2>
        <ol className="space-y-4">{dossier.events.map(event => <li key={event.id} className="border-l-2 border-border-subtle pl-4 text-sm">
          <p className="font-medium">{labels[event.type] ?? labels.timeline}{event.taskId ? ` · ${milestoneLabel(dossier.tasks.find(t => t.id === event.taskId)?.code ?? '', labels)}` : ''}</p>
          <p className="text-muted-foreground">{date(event.occurredOn)}</p>
          {event.agreement && <p>{labels[event.agreement]}{event.reviewOn ? ` · ${labels.reviewOn}: ${date(event.reviewOn)}` : ''}</p>}
          {event.type === 'AGREEMENT' && dossier.isSelf && !dossier.closedAt && !dossier.events.some(e => e.agreementId === event.id && e.type === 'ACKNOWLEDGED') && <Button variant="secondary" className="mt-2" disabled={busy} onClick={() => void send({ action: 'ACKNOWLEDGE', caseId: dossier.id, agreementId: event.id, idempotencyKey: crypto.randomUUID() })}>{labels.acknowledge}</Button>}
        </li>)}</ol>{!dossier.events.length && <p className="text-sm text-muted-foreground">{labels.noHistory}</p>}
      </section>
    </div>} aside={<div className="min-w-0 space-y-6">
      <Surface className="p-4"><h2 className="font-semibold">{labels.nextAction}</h2><p className="mt-2 text-sm">{openTasks[0] ? `${milestoneLabel(openTasks[0].code, labels)} · ${date(openTasks[0].dueOn)}` : labels.noTasks}</p><h3 className="mt-4 text-sm font-semibold">{labels.responsibility}</h3><p className="mt-1 text-sm">{labels.hrOwner}</p><p className="mt-2 text-sm text-muted-foreground">{labels.physicianOwner}</p><p className="mt-2 text-sm text-muted-foreground">{labels.jointOwner}</p></Surface>
      <section><h2 className="font-semibold">{labels.capacity}</h2><ol className="mt-2 space-y-2 text-sm">{dossier.capacity.map((change, index) => <li key={`${change.effectiveOn}-${index}`}>{date(change.effectiveOn)} · {100 - change.absencePercentage}%</li>)}{dossier.spells.filter(s => s.recoveredOn).map(s => <li key={s.startedOn}>{date(s.recoveredOn!)} · 100%</li>)}</ol><p className="mt-2 text-sm text-muted-foreground">{labels.recoveryHelp}</p></section>
      {canAct && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void send({ action: 'AGREEMENT', caseId: dossier.id, agreement, occurredOn, reviewOn, idempotencyKey: crypto.randomUUID() }) }}>
        <h2 className="font-semibold">{labels.recordAgreement}</h2>
        <FormField label={labels.agreement} control={<DropdownSelect value={agreement} onChange={event => setAgreement(event.target.value as typeof agreement)} searchable required>{agreementCodes.map(code => <option key={code} value={code}>{labels[code]}</option>)}</DropdownSelect>} />
        <FormField label={labels.occurredOn} control={<input className="ui-input w-full min-w-0" type="date" required min={dossier.firstAbsenceOn} max={today} value={occurredOn} onChange={event => setOccurredOn(event.target.value)} />} />
        <FormField label={labels.reviewOn} control={<input className="ui-input w-full min-w-0" type="date" required min={occurredOn} value={reviewOn} onChange={event => setReviewOn(event.target.value)} />} />
        <Button type="submit" disabled={busy}>{labels.save}</Button>
      </form>}
    </div>} />
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.removeDocumentLink} description={labels.removeDocumentLinkDescription} destructive onConfirm={async () => { if (removeCandidate) await changeDocumentLink('DELETE', { caseId: dossier.id, linkId: removeCandidate.id }) }} onOpenChange={(open) => { if (!open && !busy) setRemoveCandidate(null) }} open={removeCandidate !== null} pending={busy} title={labels.removeDocumentLinkTitle} />
  </div>
}

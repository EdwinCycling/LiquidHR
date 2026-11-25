'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, LockKeyhole, UserPlus } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'

type Participant = { id: string; employee_id?: string; employeeName?: string; phase?: string }
type Round = { id: string; title: string; introduction: string; status: string; version: number; period_start: string; period_end: string; due_date?: string | null; participants?: Participant[]; dossiers?: Participant[] }
type Labels = { rounds: string; closeRound: string; closeReason: string; close: string; closed: string; error: string; saved: string; status: string; period: string; dueDate: string; participants: string; employee: string; selected: string; add: string; confirmClose: string; confirmCloseTitle: string; cancel: string; roundDraft: string; roundScheduled: string; roundActive: string; roundClosed: string; roundCancelled: string; waitingEmployee: string; waitingManager: string; waitingAcknowledgement: string; completedAgreed: string; completedDisagreed: string; phaseCancelled: string }

function roundStatusLabel(status: string, labels: Labels) {
  return ({ DRAFT: labels.roundDraft, SCHEDULED: labels.roundScheduled, ACTIVE: labels.roundActive, CLOSED: labels.roundClosed, CANCELLED: labels.roundCancelled } as Record<string, string>)[status] ?? status
}

function phaseLabel(phase: string, labels: Labels) {
  return ({ WAITING_EMPLOYEE: labels.waitingEmployee, WAITING_MANAGER: labels.waitingManager, WAITING_ACKNOWLEDGEMENT: labels.waitingAcknowledgement, COMPLETED_AGREED: labels.completedAgreed, COMPLETED_DISAGREED: labels.completedDisagreed, CANCELLED: labels.phaseCancelled } as Record<string, string>)[phase] ?? phase
}

export function PerformanceReviewRoundDetail({ roundId, labels }: { roundId: string; labels: Labels }) {
  const [round, setRound] = useState<Round | null>(null)
  const [reason, setReason] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>>([])
  const [busy, setBusy] = useState(false)
  const [addIdempotencyKey, setAddIdempotencyKey] = useState('')
  const [closeIdempotencyKey, setCloseIdempotencyKey] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => { let active = true; void fetch(`/api/performance-reviews/rounds/${roundId}`).then((response) => response.ok ? response.json() as Promise<Round | null> : null).then((value) => { if (active) setRound(value) }).catch(() => undefined); return () => { active = false } }, [roundId])
  useEffect(() => { let active = true; if (!employeeSearch.trim()) { window.setTimeout(() => { if (active) setEmployees([]) }, 0); return () => { active = false } }; const timer = window.setTimeout(() => { void fetch(`/api/performance-reviews/employees?search=${encodeURIComponent(employeeSearch)}`).then((response) => response.ok ? response.json() as Promise<{ items?: Array<{ id: string; first_name: string; birth_name: string; employee_number: string }> }> : { items: [] }).then((result) => { if (active) setEmployees(result.items ?? []) }).catch(() => undefined) }, 250); return () => { active = false; window.clearTimeout(timer) } }, [employeeSearch])

  async function addParticipant(employeeId: string) {
    setBusy(true); setMessage(null)
    try { const requestKey = addIdempotencyKey || crypto.randomUUID(); setAddIdempotencyKey(requestKey); const response = await fetch(`/api/performance-reviews/rounds/${roundId}/dossiers`, { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': requestKey }, body: JSON.stringify({ employeeId }) }); if (!response.ok) throw new Error('add'); setAddIdempotencyKey(''); setEmployeeSearch(''); setEmployees([]); setMessage(labels.saved); const refreshed = await fetch(`/api/performance-reviews/rounds/${roundId}`); if (refreshed.ok) setRound(await refreshed.json() as Round) } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  async function closeRound() {
    if (!round || !reason.trim()) return
    setBusy(true); setMessage(null)
    try { const requestKey = closeIdempotencyKey || crypto.randomUUID(); setCloseIdempotencyKey(requestKey); const response = await fetch(`/api/performance-reviews/rounds/${round.id}/close`, { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': requestKey }, body: JSON.stringify({ version: round.version, reason: reason.trim() }) }); if (!response.ok) throw new Error('close'); setCloseIdempotencyKey(''); const refreshed = await fetch(`/api/performance-reviews/rounds/${round.id}`); setRound(refreshed.ok ? await refreshed.json() as Round : { ...round, status: 'CLOSED', version: round.version + 1 }); setMessage(labels.saved); setConfirmClose(false) } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  const participants = round?.participants ?? round?.dossiers ?? []
  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide"><PageHeader title={round?.title ?? labels.rounds} description={round?.introduction} actions={<Link href="/workforce/conversations" className="text-sm underline underline-offset-4"><ArrowLeft aria-hidden="true" className="mr-2 inline size-4" />{labels.rounds}</Link>} />{round ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-5"><Surface className="space-y-5 p-5 sm:p-6"><dl className="grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">{labels.status}</dt><dd className="mt-1 font-medium">{roundStatusLabel(round.status, labels)}</dd></div><div><dt className="text-xs text-muted-foreground">{labels.period}</dt><dd className="mt-1 font-medium">{round.period_start} – {round.period_end}</dd></div><div><dt className="text-xs text-muted-foreground">{labels.dueDate}</dt><dd className="mt-1 font-medium">{round.due_date ?? '—'}</dd></div></dl><p className="text-sm text-muted-foreground">{round.introduction}</p></Surface><Surface className="space-y-4 p-5"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><UserPlus aria-hidden="true" className="size-4" />{labels.participants}</h2><span className="text-sm text-muted-foreground">{participants.length}</span></div><div className="relative"><input aria-label={labels.employee} className="min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" placeholder={labels.employee} value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} />{employees.length ? <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius-control)] border border-border bg-surface">{employees.map((employee) => <button className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-raised" key={employee.id} onClick={() => void addParticipant(employee.id)} type="button">{[employee.first_name, employee.birth_name].filter(Boolean).join(' ')} <span className="text-xs text-muted-foreground">({employee.employee_number})</span></button>)}</div> : null}</div><ul className="divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle">{participants.length ? participants.map((participant) => <li className="flex items-center justify-between gap-3 px-3 py-3 text-sm" key={participant.id}>{participant.employeeName ?? participant.employee_id ?? labels.employee}<span className="text-xs text-muted-foreground">{participant.phase ? phaseLabel(participant.phase, labels) : labels.status}</span></li>) : <li className="px-3 py-3 text-sm text-muted-foreground">{labels.selected}: 0</li>}</ul></Surface></div><Surface className="space-y-3 p-5"><p className="flex items-center gap-2 font-medium"><LockKeyhole aria-hidden="true" className="size-4" />{labels.closeRound}</p><textarea aria-label={labels.closeReason} className="min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={labels.closeReason} disabled={round.status === 'CLOSED'} /><Button disabled={busy || round.status === 'CLOSED' || !reason.trim()} onClick={() => setConfirmClose(true)}>{round.status === 'CLOSED' ? labels.closed : labels.close}</Button>{message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}</Surface></div> : <Surface className="p-6 text-sm text-muted-foreground">{labels.error}</Surface>}<ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.close} description={labels.confirmClose} onConfirm={closeRound} onOpenChange={setConfirmClose} open={confirmClose} pending={busy} title={labels.confirmCloseTitle} /></PageShell>
}

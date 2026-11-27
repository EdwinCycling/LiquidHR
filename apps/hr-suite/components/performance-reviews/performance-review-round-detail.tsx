'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, UserPlus } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Locale } from '@/lib/i18n/config'
import nlQuestionSetMessages from '@/messages/nl/performanceReviewQuestionSets.json'
import enQuestionSetMessages from '@/messages/en/performanceReviewQuestionSets.json'

type Participant = {
  id: string
  employee_id?: string
  reviewer_employee_id?: string
  additional_reviewer_employee_id?: string | null
  employeeName?: string
  reviewerName?: string
  additionalReviewerName?: string
  phase?: string
  version?: number
}
type QuestionSetRole = 'EMPLOYEE' | 'GV' | 'AB'
type QuestionSetOption = { id: string; name: string; status: 'DRAFT' | 'AVAILABLE' | 'ARCHIVED' }
type QuestionSetOverride = { mode: 'NONE' } | { mode: 'SET'; questionSetId: string }
type Round = {
  id: string
  title: string
  introduction: string
  status: string
  version: number
  period_start: string
  period_end: string
  due_date?: string | null
  additional_reviewer_enabled?: boolean
  questionSetConfig?: { enabled?: boolean; defaults?: Record<QuestionSetRole, string | null>; published_defaults_snapshot?: Record<QuestionSetRole, { sourceSetName?: string; questions?: unknown[] } | null> | null }
  participants?: Participant[]
  dossiers?: Participant[]
}
type FlipItem = { dossierId: string; employeeId: string; reviewerEmployeeId: string; additionalReviewerEmployeeId: string | null; version: number; blockReason: string | null; hasDrafts: boolean }
type FlipPreview = { previewHash: string; total: number; eligible: number; blocked: number; draftCount: number; items: FlipItem[] }
type Labels = {
  rounds: string; closeRound: string; closeReason: string; close: string; closed: string; error: string; saved: string; status: string; period: string; dueDate: string; participants: string; employee: string; selected: string; add: string; confirmClose: string; confirmCloseTitle: string; cancel: string; roundDraft: string; roundScheduled: string; roundActive: string; roundClosed: string; roundCancelled: string; waitingEmployee: string; waitingAdditionalReviewer: string; waitingManager: string; waitingAcknowledgement: string; waitingReviewerClose: string; completedAgreed: string; completedDisagreed: string; phaseCancelled: string; additionalReviewerEnabled: string; additionalReviewer: string; bulkFlip: string; flipAll: string; flipFiltered: string; flipSelected: string; previewFlip: string; applyFlip: string; flipPreview: string; flipReason: string; flipChanged: string; flipBlocked: string; flipDrafts: string; preserveDrafts: string; draftArchiveWarning: string; closeConversation: string; search: string; open: string; swapRoles: string
}

function roundStatusLabel(status: string, labels: Labels) {
  return ({ DRAFT: labels.roundDraft, SCHEDULED: labels.roundScheduled, ACTIVE: labels.roundActive, CLOSED: labels.roundClosed, CANCELLED: labels.roundCancelled } as Record<string, string>)[status] ?? status
}
function phaseLabel(phase: string, labels: Labels) {
  return ({ WAITING_EMPLOYEE: labels.waitingEmployee, WAITING_ADDITIONAL_REVIEWER: labels.waitingAdditionalReviewer, WAITING_MANAGER: labels.waitingManager, WAITING_ACKNOWLEDGEMENT: labels.waitingAcknowledgement, WAITING_REVIEWER_CLOSE: labels.waitingReviewerClose, COMPLETED_AGREED: labels.completedAgreed, COMPLETED_DISAGREED: labels.completedDisagreed, CANCELLED: labels.phaseCancelled } as Record<string, string>)[phase] ?? phase
}

export function PerformanceReviewRoundDetail({ roundId, labels, locale = 'nl', questionSetsEnabled = false }: { roundId: string; labels: Labels; locale?: Locale; questionSetsEnabled?: boolean }) {
  const questionSetMessages = locale === 'nl' ? nlQuestionSetMessages : enQuestionSetMessages
  const [round, setRound] = useState<Round | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; birth_name: string; employee_number: string; reviewerEmployeeId?: string | null; administrationId?: string | null }>>([])
  const [busy, setBusy] = useState(false)
  const [addIdempotencyKey, setAddIdempotencyKey] = useState('')
  const [closeIdempotencyKey, setCloseIdempotencyKey] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [flipScope, setFlipScope] = useState<'ALL' | 'FILTERED' | 'SELECTED'>('ALL')
  const [preview, setPreview] = useState<FlipPreview | null>(null)
  const [flipRequestKey, setFlipRequestKey] = useState('')
  const [flipReason, setFlipReason] = useState('')
  const [preserveDrafts, setPreserveDrafts] = useState(false)
  const [confirmFlip, setConfirmFlip] = useState(false)
  const [flipResult, setFlipResult] = useState<{ changed?: number; blocked?: number } | null>(null)
  const [participantQuery, setParticipantQuery] = useState('')
  const [questionSets, setQuestionSets] = useState<QuestionSetOption[]>([])
  const [pendingEmployee, setPendingEmployee] = useState<(typeof employees)[number] | null>(null)
  const [pendingQuestionSetChoices, setPendingQuestionSetChoices] = useState<Partial<Record<QuestionSetRole, 'DEFAULT' | 'NONE' | string>>>({})

  async function refresh() {
    const response = await fetch('/api/performance-reviews/rounds/' + encodeURIComponent(roundId))
    if (response.ok) setRound(await response.json() as Round)
  }
  useEffect(() => { let active = true; void fetch('/api/performance-reviews/rounds/' + encodeURIComponent(roundId)).then((response) => response.ok ? response.json() as Promise<Round | null> : null).then((value) => { if (active) setRound(value) }).catch(() => undefined); return () => { active = false } }, [roundId])
  useEffect(() => {
    if (!questionSetsEnabled) return
    let active = true
    void fetch('/api/performance-reviews/question-sets').then((response) => response.ok ? response.json() as Promise<{ items?: QuestionSetOption[] }> : { items: [] })
      .then((result) => { if (active) setQuestionSets((result.items ?? []).filter((item) => item.status === 'AVAILABLE')) })
      .catch(() => { if (active) setQuestionSets([]) })
    return () => { active = false }
  }, [questionSetsEnabled])
  useEffect(() => {
    let active = true
    if (!employeeSearch.trim()) { window.setTimeout(() => { if (active) setEmployees([]) }, 0); return () => { active = false } }
    const timer = window.setTimeout(() => { void fetch('/api/performance-reviews/employees?search=' + encodeURIComponent(employeeSearch)).then((response) => response.ok ? response.json() as Promise<{ items?: typeof employees }> : { items: [] }).then((result) => { if (active) setEmployees(result.items ?? []) }).catch(() => undefined) }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [employeeSearch])

  async function addParticipant(employee: (typeof employees)[number], overrides?: Partial<Record<QuestionSetRole, QuestionSetOverride>>) {
    setBusy(true); setMessage(null)
    try {
      const requestKey = addIdempotencyKey || crypto.randomUUID()
      setAddIdempotencyKey(requestKey)
      const response = await fetch('/api/performance-reviews/rounds/' + encodeURIComponent(roundId) + '/dossiers', {
        method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify({ employeeId: employee.id, reviewerEmployeeId: employee.reviewerEmployeeId, administrationId: employee.administrationId, questionSetOverrides: overrides }),
      })
      if (!response.ok) throw new Error('add')
      setAddIdempotencyKey(''); setEmployeeSearch(''); setEmployees([]); setPendingEmployee(null); setPendingQuestionSetChoices({}); setMessage(labels.saved); await refresh()
    } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  function selectEmployee(employee: (typeof employees)[number]) {
    if (questionSetsEnabled && round?.questionSetConfig?.enabled) {
      setPendingEmployee(employee)
      setPendingQuestionSetChoices({})
    } else void addParticipant(employee)
  }
  async function addPendingEmployee() {
    if (!pendingEmployee) return
    const overrides: Partial<Record<QuestionSetRole, QuestionSetOverride>> = {}
    for (const role of ['EMPLOYEE', 'GV', 'AB'] as const) {
      if (role === 'AB' && !round?.additional_reviewer_enabled) continue
      const choice = pendingQuestionSetChoices[role] ?? 'DEFAULT'
      if (choice === 'NONE') overrides[role] = { mode: 'NONE' }
      else if (choice !== 'DEFAULT') overrides[role] = { mode: 'SET', questionSetId: choice }
    }
    await addParticipant(pendingEmployee, Object.keys(overrides).length ? overrides : undefined)
  }
  async function closeRound() {
    if (!round || !closeReason.trim()) return
    setBusy(true); setMessage(null)
    try {
      const requestKey = closeIdempotencyKey || crypto.randomUUID()
      setCloseIdempotencyKey(requestKey)
      const response = await fetch('/api/performance-reviews/rounds/' + encodeURIComponent(round.id) + '/close', {
        method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify({ version: round.version, reason: closeReason.trim() }),
      })
      if (!response.ok) throw new Error('close')
      setCloseIdempotencyKey(''); await refresh(); setMessage(labels.saved); setConfirmClose(false)
    } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  const participants = useMemo(() => round?.participants ?? round?.dossiers ?? [], [round?.participants, round?.dossiers])
  const visibleParticipants = useMemo(() => participants.filter((participant) => !participantQuery.trim() || (participant.employeeName ?? participant.employee_id ?? '').toLocaleLowerCase().includes(participantQuery.trim().toLocaleLowerCase())), [participants, participantQuery])
  const filteredIds = visibleParticipants.map((participant) => participant.id)
  const selectedList = [...selectedIds].filter((id) => participants.some((participant) => participant.id === id))
  function setParticipantSelected(id: string, checked: boolean) {
    setSelectedIds((current) => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next })
    setPreview(null)
    setFlipRequestKey('')
  }
  async function createPreview() {
    if (!round || flipScope === 'SELECTED' && selectedList.length === 0 || flipScope === 'FILTERED' && filteredIds.length === 0) return
    setBusy(true); setMessage(null); setFlipResult(null)
    try {
      const participantIds = flipScope === 'SELECTED' ? selectedList : flipScope === 'FILTERED' ? filteredIds : undefined
      const response = await fetch('/api/performance-reviews/rounds/' + encodeURIComponent(round.id) + '/role-flips/preview', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope: flipScope, participantIds }),
      })
      if (!response.ok) throw new Error('preview')
      setPreview(await response.json() as FlipPreview)
      setFlipRequestKey('')
    } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  async function applyPreview() {
    if (!round || !preview || !flipReason.trim() || preview.draftCount > 0 && !preserveDrafts) return
    setBusy(true); setMessage(null)
    try {
      const requestKey = flipRequestKey || crypto.randomUUID()
      setFlipRequestKey(requestKey)
      const response = await fetch('/api/performance-reviews/rounds/' + encodeURIComponent(round.id) + '/role-flips', {
        method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify({ participantIds: preview.items.map((item) => item.dossierId), previewHash: preview.previewHash, reason: flipReason.trim(), preserveDrafts }),
      })
      if (!response.ok) throw new Error('apply')
      const result = await response.json() as { changed?: number; blocked?: number }
      setFlipRequestKey(''); setFlipResult(result); setPreview(null); setFlipReason(''); setSelectedIds(new Set()); setConfirmFlip(false); setMessage(labels.saved); await refresh()
    } catch { setMessage(labels.error) } finally { setBusy(false) }
  }

  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader title={round?.title ?? labels.rounds} description={round?.introduction} actions={<Link href="/workforce/conversations" className="text-sm underline underline-offset-4"><ArrowLeft aria-hidden="true" className="mr-2 inline size-4" />{labels.rounds}</Link>} />
    {round ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Surface className="space-y-5 p-5 sm:p-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">{labels.status}</dt><dd className="mt-1 font-medium">{roundStatusLabel(round.status, labels)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{labels.period}</dt><dd className="mt-1 font-medium">{round.period_start} – {round.period_end}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{labels.dueDate}</dt><dd className="mt-1 font-medium">{round.due_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{labels.additionalReviewerEnabled}</dt><dd className="mt-1 font-medium">{round.additional_reviewer_enabled ? labels.additionalReviewer : '—'}</dd></div>
          </dl>
          <p className="text-sm text-muted-foreground">{round.introduction}</p>
        </Surface>
        <Surface className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><UserPlus aria-hidden="true" className="size-4" />{labels.participants}</h2><span className="text-sm text-muted-foreground">{participants.length}</span></div>
          <div className="relative"><input aria-label={labels.employee} className="min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" placeholder={labels.employee} value={employeeSearch} onChange={(event) => { setEmployeeSearch(event.target.value); setPendingEmployee(null) }} />{employees.length ? <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius-control)] border border-border bg-surface">{employees.map((employee) => <button className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-raised" key={employee.id} onClick={() => selectEmployee(employee)} type="button">{[employee.first_name, employee.birth_name].filter(Boolean).join(' ')} <span className="text-xs text-muted-foreground">({employee.employee_number})</span></button>)}</div> : null}</div>
          {pendingEmployee && round.questionSetConfig?.enabled ? <Surface className="space-y-3 p-4" variant="subtle">
            <div><h3 className="font-semibold">{questionSetMessages.individualOverrides}</h3><p className="mt-1 text-sm text-muted-foreground">{[pendingEmployee.first_name, pendingEmployee.birth_name].filter(Boolean).join(' ')}</p></div>
            {(['EMPLOYEE', 'GV', ...(round.additional_reviewer_enabled ? ['AB'] : [])] as QuestionSetRole[]).map((role) => {
              const roleLabel = role === 'EMPLOYEE' ? questionSetMessages.employeeRole : role === 'GV' ? questionSetMessages.gvRole : questionSetMessages.abRole
              return <label className="block text-sm font-medium" key={role}>{roleLabel}<select className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={pendingQuestionSetChoices[role] ?? 'DEFAULT'} onChange={(event) => setPendingQuestionSetChoices((current) => ({ ...current, [role]: event.target.value }))}><option value="DEFAULT">{questionSetMessages.overrideInherit}</option><option value="NONE">{questionSetMessages.overrideNone}</option>{questionSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
            })}
            <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void addPendingEmployee()}>{labels.add}</Button><Button disabled={busy} onClick={() => setPendingEmployee(null)} variant="secondary">{questionSetMessages.back}</Button></div>
          </Surface> : null}
          {round.additional_reviewer_enabled ? <Surface className="space-y-2 p-4" variant="subtle">
            <div className="flex items-center gap-2"><RotateCcw aria-hidden="true" className="size-4" /><h3 className="font-semibold">{labels.bulkFlip}</h3></div>
            <label className="block text-sm font-medium">{labels.bulkFlip}<select className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={flipScope} onChange={(event) => { setFlipScope(event.target.value as typeof flipScope); setPreview(null); setFlipRequestKey('') }}><option value="ALL">{labels.flipAll}</option><option value="FILTERED">{labels.flipFiltered}</option><option value="SELECTED">{labels.flipSelected}</option></select></label>
            <Button disabled={busy || flipScope === 'SELECTED' && selectedList.length === 0 || flipScope === 'FILTERED' && filteredIds.length === 0} onClick={() => void createPreview()} variant="secondary">{labels.previewFlip}</Button>
            {preview ? <div className="space-y-3 border-t border-border-subtle pt-3">
              <h4 className="font-medium">{labels.flipPreview}</h4>
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><div><dt>{labels.participants}</dt><dd className="font-semibold">{preview.total}</dd></div><div><dt>{labels.flipChanged}</dt><dd className="font-semibold">{preview.eligible}</dd></div><div><dt>{labels.flipBlocked}</dt><dd className="font-semibold">{preview.blocked}</dd></div><div><dt>{labels.flipDrafts}</dt><dd className="font-semibold">{preview.draftCount}</dd></div></dl>
              <ul className="max-h-52 divide-y divide-border-subtle overflow-auto rounded-[var(--radius-control)] border border-border-subtle text-xs">{preview.items.map((item) => <li className="flex flex-wrap justify-between gap-2 px-3 py-2" key={item.dossierId}><span>{participants.find((participant) => participant.id === item.dossierId)?.employeeName ?? item.dossierId}</span><span className={item.blockReason ? 'text-destructive' : 'text-muted-foreground'}>{item.blockReason ?? (item.hasDrafts ? labels.draftArchiveWarning : labels.flipChanged)}</span></li>)}</ul>
              {preview.draftCount ? <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={preserveDrafts} onChange={(event) => setPreserveDrafts(event.target.checked)} /><span>{labels.preserveDrafts}<span className="mt-1 block text-muted-foreground">{labels.draftArchiveWarning}</span></span></label> : null}
              <label className="block text-sm font-medium">{labels.flipReason}<textarea className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={flipReason} onChange={(event) => setFlipReason(event.target.value)} /></label>
              <Button disabled={busy || !flipReason.trim() || preview.draftCount > 0 && !preserveDrafts} onClick={() => setConfirmFlip(true)}>{labels.applyFlip}</Button>
            </div> : null}
            {flipResult ? <p className="text-sm" role="status">{labels.flipChanged}: {flipResult.changed ?? 0} · {labels.flipBlocked}: {flipResult.blocked ?? 0}</p> : null}
          </Surface> : null}
          <label className="block text-sm font-medium">{labels.search}<input className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3" value={participantQuery} onChange={(event) => { setParticipantQuery(event.target.value); setPreview(null); setFlipRequestKey('') }} /></label>
          <ul className="divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle">
            {visibleParticipants.length ? visibleParticipants.map((participant) => <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm" key={participant.id}>
              <div className="flex min-w-0 items-start gap-3">{round.additional_reviewer_enabled ? <Checkbox aria-label={labels.flipSelected + ': ' + (participant.employeeName ?? labels.employee)} checked={selectedIds.has(participant.id)} onChange={(event) => setParticipantSelected(participant.id, event.target.checked)} /> : null}<div className="min-w-0"><Link className="font-medium underline-offset-4 hover:underline" href={'/conversations/' + encodeURIComponent(participant.id)}>{participant.employeeName ?? participant.employee_id ?? labels.employee}</Link><p className="mt-1 text-xs text-muted-foreground">{participant.reviewerName ?? '—'}{participant.additionalReviewerName ? ' · ' + participant.additionalReviewerName : ''}</p></div></div>
              <span className="text-xs text-muted-foreground">{participant.phase ? phaseLabel(participant.phase, labels) : labels.status}</span>
            </li>) : <li className="px-3 py-3 text-sm text-muted-foreground">{labels.selected}: 0</li>}
          </ul>
          {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
        </Surface>
      </div>
      <Surface className="space-y-3 p-5"><p className="font-medium">{labels.closeRound}</p><textarea aria-label={labels.closeReason} className="min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" value={closeReason} onChange={(event) => setCloseReason(event.target.value)} disabled={round.status === 'CLOSED'} /><Button disabled={busy || ['CLOSED', 'CANCELLED'].includes(round.status) || !closeReason.trim()} onClick={() => setConfirmClose(true)}>{round.status === 'CLOSED' ? labels.closed : labels.close}</Button></Surface>
    </div> : <Surface className="p-6 text-sm text-muted-foreground">{labels.error}</Surface>}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.close} description={labels.confirmClose} onConfirm={closeRound} onOpenChange={setConfirmClose} open={confirmClose} pending={busy} title={labels.confirmCloseTitle} />
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.applyFlip} description={labels.flipPreview} onConfirm={applyPreview} onOpenChange={setConfirmFlip} open={confirmFlip} pending={busy} title={labels.bulkFlip} />
  </PageShell>
}

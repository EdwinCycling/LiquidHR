'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, Download, FileText, LockKeyhole, MessageSquareText, Send, UserRound } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { Surface } from '@/components/ui/surface'
import { Button, buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PerformanceReviewDashboard } from './performance-review-dashboard'
import { isSoftDeadlineOverdue } from '@/lib/performance-reviews/performance-domain'

export type PerformanceReviewRole = 'hr' | 'manager' | 'employee' | 'additional-reviewer'
type Submission = { kind: 'SELF' | 'MANAGER' | 'ADDITIONAL_REVIEWER'; body: string; meeting_date?: string | null; score?: number | null; rating_explanation?: string | null; submitted_at?: string | null }
type Acknowledgement = { decision: 'AGREE' | 'DISAGREE'; reason?: string | null; created_at?: string }
type RoundDetails = { title?: string; due_date?: string | null; status?: string; additional_reviewer_enabled?: boolean; rating_snapshot?: { options?: Array<{ score: number; label: string; description: string }> } | null }
type ReviewAttachment = { id: string; original_filename: string; content_type: string; file_size: number; released_at?: string | null }
export type PerformanceReviewSummary = { id: string; title: string; employeeName?: string; reviewerName?: string; employeeId?: string; reviewer_employee_id?: string; additional_reviewer_employee_id?: string | null; additional_reviewer_workflow?: boolean; phase: string; dueDate?: string | null; roundStatus?: string; submitted?: boolean; version?: number; attachments?: ReviewAttachment[]; performance_review_attachments?: ReviewAttachment[]; appraisalLinks?: Array<{ appraisal_item_id: string }>; performance_review_rounds?: RoundDetails | RoundDetails[] | null; performance_review_submissions?: Submission[]; performance_review_acknowledgements?: Acknowledgement[] }
type AppraisalItem = { id: string; title: string; occurred_on?: string; item_status?: string }
type RoundSummary = { id: string; title: string; status: string; period_start: string; period_end: string; due_date?: string | null }
type Labels = { title: string; subtitle: string; newRound: string; rounds: string; roundsEmpty: string; myTeam: string; myConversations: string; myAdditionalReviews: string; open: string; empty: string; employee: string; status: string; dueDate: string; overdue: string; action: string; selfReflection: string; managerResponse: string; additionalReviewerResponse: string; acknowledgement: string; saveDraft: string; submit: string; submitContribution: string; agree: string; disagree: string; disagreementReason: string; privateInfo: string; privateInfoHint: string; closed: string; error: string; saved: string; search: string; filter: string; allStatuses: string; attachments: string; upload: string; appraisalLink: string; link: string; dashboard: string; waitingEmployee: string; waitingAdditionalReviewer: string; waitingManager: string; waitingAcknowledgement: string; waitingReviewerClose: string; completedAgreed: string; completedDisagreed: string; closedOpen: string; nextActions: string; noActions: string; meetingDate: string; rating: string; ratingScore: string; ratingExplanation: string; remove: string; reassignReviewer: string; newReviewer: string; reviewerSearch: string; conversationLead: string; additionalReviewer: string; additionalReviewerOptional: string; assignReviewers: string; reviewerRoleReason: string; preserveDrafts: string; draftArchiveWarning: string; saveAssignments: string; swapRoles: string; releaseAdditionalReviewer: string; releaseReason: string; closeConversation: string; additionalReviewerHidden: string; confirmSubmit: string; confirmSubmitTitle: string; cancel: string; phaseCancelled: string; roundDraft: string; roundScheduled: string; roundActive: string; roundClosed: string; roundCancelled: string }

type Props = { role: PerformanceReviewRole; summaries: PerformanceReviewSummary[]; labels: Labels }

export function PerformanceReviewWorkspace({ labels, role, summaries: initialSummaries }: Props) {
  const [summaries, setSummaries] = useState(initialSummaries)
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(initialSummaries[0]?.id ?? null)
  const [body, setBody] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [score, setScore] = useState('')
  const [ratingExplanation, setRatingExplanation] = useState('')
  const [reason, setReason] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentRequestKey, setAttachmentRequestKey] = useState('')
  const [appraisalId, setAppraisalId] = useState('')
  const [appraisalItems, setAppraisalItems] = useState<AppraisalItem[]>([])
  const [reviewerSearch, setReviewerSearch] = useState('')
  const [reviewerCandidates, setReviewerCandidates] = useState<Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>>([])
  const [assignedReviewerId, setAssignedReviewerId] = useState('')
  const [assignedAdditionalReviewerId, setAssignedAdditionalReviewerId] = useState('')
  const [roleChangeReason, setRoleChangeReason] = useState('')
  const [preserveDrafts, setPreserveDrafts] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ action: string; payload: Record<string, string | number | null> } | null>(null)
  const [search, setSearch] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [today, setToday] = useState<string | null>(null)
  const draftEditRevisions = useRef({ body: 0, meetingDate: 0, score: 0, ratingExplanation: 0 })
  const selected = summaries.find((item) => item.id === selectedId) ?? null
  const dossierAttachments = selected?.performance_review_attachments ?? selected?.attachments ?? []
  const visibleAttachments = role === 'employee' ? dossierAttachments.filter((item) => item.released_at != null) : role === 'additional-reviewer' ? [] : dossierAttachments

  useEffect(() => {
    const updateToday = () => {
      const now = new Date()
      setToday(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
    }
    updateToday()
    const timer = window.setInterval(updateToday, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => { let active = true; void fetch(`/api/performance-reviews?role=${role}`).then((response) => response.ok ? response.json() as Promise<{ items?: PerformanceReviewSummary[] }> : { items: [] }).then((result) => { if (!active || !Array.isArray(result.items)) return; setSummaries(result.items); const requested = new URLSearchParams(window.location.search).get('dossierId'); setSelectedId((current) => current && result.items?.some((item) => item.id === current) ? current : requested && result.items?.some((item) => item.id === requested) ? requested : result.items?.[0]?.id ?? null) }).catch(() => undefined); return () => { active = false } }, [role])
  useEffect(() => { if (role !== 'hr') return; let active = true; void fetch('/api/performance-reviews/rounds').then((response) => response.ok ? response.json() as Promise<RoundSummary[]> : []).then((result) => { if (active) setRounds(Array.isArray(result) ? result : []) }).catch(() => undefined); return () => { active = false } }, [role])
  useEffect(() => {
    if (!selectedId) return
    let active = true
    const editRevisionsAtRequest = { ...draftEditRevisions.current }
    void fetch(`/api/performance-reviews/dossiers/${selectedId}`)
      .then((response) => response.ok ? response.json() as Promise<PerformanceReviewSummary> : null)
      .then((result) => {
        if (!active || !result) return
        setSummaries((current) => current.map((item) => item.id === selectedId ? { ...item, ...result } : item))
        const self = result.performance_review_submissions?.find((item) => item.kind === 'SELF')
        const manager = result.performance_review_submissions?.find((item) => item.kind === 'MANAGER')
        const additional = result.performance_review_submissions?.find((item) => item.kind === 'ADDITIONAL_REVIEWER')
        const editable = role === 'employee' ? self : role === 'additional-reviewer' ? additional : manager
        setAssignedReviewerId(result.reviewer_employee_id ?? '')
        setAssignedAdditionalReviewerId(result.additional_reviewer_employee_id ?? '')
        if (draftEditRevisions.current.body === editRevisionsAtRequest.body) setBody(editable?.body ?? '')
        if (draftEditRevisions.current.meetingDate === editRevisionsAtRequest.meetingDate) setMeetingDate(manager?.meeting_date ?? '')
        if (draftEditRevisions.current.score === editRevisionsAtRequest.score) setScore(manager?.score == null ? '' : String(manager.score))
        if (draftEditRevisions.current.ratingExplanation === editRevisionsAtRequest.ratingExplanation) setRatingExplanation(manager?.rating_explanation ?? '')
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [selectedId, role])
  useEffect(() => { if (!selectedId || role === 'employee' || role === 'additional-reviewer') return; let active = true; void fetch(`/api/performance-reviews/dossiers/${selectedId}/private-note`).then((response) => response.ok ? response.json() as Promise<Array<{ body: string }>> : []).then((notes) => { if (active) setPrivateNote(notes.at(-1)?.body ?? '') }).catch(() => undefined); return () => { active = false } }, [selectedId, role])
  useEffect(() => { if (!selected?.employeeId || role === 'employee' || role === 'additional-reviewer') { window.setTimeout(() => setAppraisalItems([]), 0); return }; let active = true; void fetch(`/api/continuous-appraisal?employeeId=${encodeURIComponent(selected.employeeId)}`).then((response) => response.ok ? response.json() as Promise<{ items?: AppraisalItem[] }> : { items: [] }).then((result) => { if (active) setAppraisalItems(result.items ?? []) }).catch(() => undefined); return () => { active = false } }, [role, selected?.employeeId])
  useEffect(() => { const canChange = role === 'hr' && ['WAITING_EMPLOYEE', 'WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER'].includes(selected?.phase ?? '') && selected?.roundStatus === 'ACTIVE'; if (!canChange || reviewerSearch.trim().length < 2) { window.setTimeout(() => setReviewerCandidates([]), 0); return }; let active = true; const timer = window.setTimeout(() => { void fetch(`/api/performance-reviews/dossiers/${selected?.id}/role-candidates?search=${encodeURIComponent(reviewerSearch)}`).then((response) => response.ok ? response.json() as Promise<Array<{ employee_id?: string; id?: string; first_name: string; birth_name: string; employee_number: string }>> : []).then((result) => { if (active) setReviewerCandidates((result ?? []).map((candidate) => ({ id: candidate.employee_id ?? candidate.id ?? '', first_name: candidate.first_name, birth_name: candidate.birth_name, employee_number: candidate.employee_number })).filter((candidate) => candidate.id && candidate.id !== selected?.employeeId)) }).catch(() => undefined) }, 250); return () => { active = false; window.clearTimeout(timer) } }, [role, selected?.id, selected?.employeeId, selected?.phase, selected?.roundStatus, reviewerSearch])

  async function submit(action: string, payload: Record<string, string | number | null> = {}) {
    if (!selected) return
    if (action === 'submit-self' || action === 'submit-manager' || action === 'submit-additional-reviewer' || action === 'acknowledge') {
      setConfirmation({ action, payload })
      return
    }
    await performSubmit(action, payload)
  }
  async function performSubmit(action: string, payload: Record<string, string | number | null>) {
    if (!selected) return
    setBusy(true); setMessage(null)
    try {
      const response = await fetch('/api/performance-reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, dossierId: selected.id, version: selected.version ?? 1, body, reason, privateNote, ...payload }) })
      if (!response.ok) throw new Error('request')
      const mutation = await response.json() as { version?: number; phase?: string }
      setSummaries((current) => current.map((item) => item.id === selected.id ? { ...item, ...(typeof mutation.version === 'number' ? { version: mutation.version } : {}), ...(typeof mutation.phase === 'string' ? { phase: mutation.phase } : {}) } : item))
      if (action === 'submit-self' || action === 'submit-manager' || action === 'submit-additional-reviewer' || action === 'acknowledge') {
        draftEditRevisions.current.body += 1
        setBody('')
        await refreshSelected()
      }
      setMessage(labels.saved)
    } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  async function savePrivateNote() {
    if (!selected) return
    setBusy(true); setMessage(null)
    try { const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/private-note`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: selected.version ?? 1, body: privateNote }) }); if (!response.ok) throw new Error('note'); setMessage(labels.saved) } catch { setMessage(labels.error) } finally { setBusy(false) }
  }
  async function refreshSelected() { if (!selected) return; const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}`); if (!response.ok) return; const result = await response.json() as PerformanceReviewSummary; setSummaries((current) => current.map((item) => item.id === selected.id ? { ...item, ...result } : item)) }
  async function uploadAttachment() { if (!selected || !attachment) return; const requestKey = attachmentRequestKey || crypto.randomUUID(); setAttachmentRequestKey(requestKey); setBusy(true); try { const form = new FormData(); form.set('file', attachment); const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/attachments`, { method: 'POST', headers: { 'Idempotency-Key': requestKey }, body: form }); if (!response.ok) throw new Error('upload'); setAttachment(null); setAttachmentRequestKey(''); setMessage(labels.saved); await refreshSelected() } catch { setMessage(labels.error) } finally { setBusy(false) } }
  async function removeAttachment(attachmentId: string) { if (!selected) return; setBusy(true); try { const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/attachments/${attachmentId}`, { method: 'DELETE' }); if (!response.ok) throw new Error('delete'); setMessage(labels.saved); await refreshSelected() } catch { setMessage(labels.error) } finally { setBusy(false) } }
  async function saveReviewerAssignments() { if (!selected || !assignedReviewerId || !roleChangeReason.trim()) return; setBusy(true); setMessage(null); try { const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/reviewer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewerEmployeeId: assignedReviewerId, additionalReviewerEmployeeId: assignedAdditionalReviewerId || null, version: selected.version ?? 1, reason: roleChangeReason, preserveDrafts }) }); if (!response.ok) throw new Error('reassign'); setReviewerSearch(''); setReviewerCandidates([]); setRoleChangeReason(''); setMessage(labels.saved); await refreshSelected() } catch { setMessage(labels.error) } finally { setBusy(false) } }
  async function releaseReviewer() { if (!selected || !roleChangeReason.trim()) return; setBusy(true); setMessage(null); try { const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/release-additional-reviewer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: selected.version ?? 1, reason: roleChangeReason }) }); if (!response.ok) throw new Error('release'); setRoleChangeReason(''); setMessage(labels.saved); await refreshSelected() } catch { setMessage(labels.error) } finally { setBusy(false) } }
  async function closeConversation() { if (!selected) return; setBusy(true); setMessage(null); try { const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/close`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: selected.version ?? 1 }) }); if (!response.ok) throw new Error('close'); setMessage(labels.saved); await refreshSelected() } catch { setMessage(labels.error) } finally { setBusy(false) } }
  async function linkAppraisal() { if (!selected || !appraisalId) return; setBusy(true); try { const response = await fetch(`/api/performance-reviews/dossiers/${selected.id}/appraisal-links`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appraisalItemId: appraisalId }) }); if (!response.ok) throw new Error('link'); setAppraisalId(''); setMessage(labels.saved) } catch { setMessage(labels.error) } finally { setBusy(false) } }
  function downloadAttachment(attachmentId: string) { if (!selected) return; window.open(`/api/performance-reviews/dossiers/${encodeURIComponent(selected.id)}/attachments/${encodeURIComponent(attachmentId)}`, '_blank', 'noopener,noreferrer') }
  const visible = summaries.filter((item) => { const haystack = `${item.title} ${item.employeeName ?? ''} ${item.reviewerName ?? ''}`.toLocaleLowerCase(); return (!search.trim() || haystack.includes(search.trim().toLocaleLowerCase())) && (!phaseFilter || item.phase === phaseFilter) })
  const roleTitle = role === 'hr' ? labels.rounds : role === 'manager' ? labels.myTeam : role === 'additional-reviewer' ? labels.myAdditionalReviews : labels.myConversations
  const selfSubmission = selected?.performance_review_submissions?.find((item) => item.kind === 'SELF')
  const managerSubmission = selected?.performance_review_submissions?.find((item) => item.kind === 'MANAGER')
  const additionalReviewerSubmission = selected?.performance_review_submissions?.find((item) => item.kind === 'ADDITIONAL_REVIEWER')
  const acknowledgement = selected?.performance_review_acknowledgements?.[0]
  const phaseLabel = (phase: string) => ({ WAITING_EMPLOYEE: labels.waitingEmployee, WAITING_MANAGER: labels.waitingManager, WAITING_ACKNOWLEDGEMENT: labels.waitingAcknowledgement, COMPLETED_AGREED: labels.completedAgreed, COMPLETED_DISAGREED: labels.completedDisagreed, CANCELLED: labels.phaseCancelled } as Record<string, string>)[phase] ?? phase
  const roundStatusLabel = (status: string) => ({ DRAFT: labels.roundDraft, SCHEDULED: labels.roundScheduled, ACTIVE: labels.roundActive, CLOSED: labels.roundClosed, CANCELLED: labels.roundCancelled } as Record<string, string>)[status] ?? status

  const roundValue = Array.isArray(selected?.performance_review_rounds) ? selected.performance_review_rounds[0] : selected?.performance_review_rounds
  const ratingOptions = roundValue?.rating_snapshot?.options ?? []

  return (
    <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
      <PageHeader title={roleTitle} description={labels.subtitle} actions={role === 'hr' ? <Link className={buttonClasses({ size: 'sm' })} href="/workforce/conversations/new"><MessageSquareText aria-hidden="true" />{labels.newRound}</Link> : role === 'employee' ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/my-additional-reviews">{labels.myAdditionalReviews}</Link> : role === 'additional-reviewer' ? <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/my-conversations">{labels.myConversations}</Link> : undefined} />
      <PerformanceReviewDashboard role={role} labels={{ dashboard: labels.dashboard, waitingEmployee: labels.waitingEmployee, waitingAdditionalReviewer: labels.waitingAdditionalReviewer, waitingManager: labels.waitingManager, waitingAcknowledgement: labels.waitingAcknowledgement, waitingReviewerClose: labels.waitingReviewerClose, completedAgreed: labels.completedAgreed, completedDisagreed: labels.completedDisagreed, closedOpen: labels.closedOpen, nextActions: labels.nextActions, noActions: labels.noActions, open: labels.open, cancelled: labels.phaseCancelled }} />
      {role === 'hr' ? <Surface className="overflow-hidden"><div className="border-b border-border-subtle px-4 py-3"><SectionHeader title={labels.rounds} description={String(rounds.length)} /></div>{rounds.length ? <ul className="divide-y divide-border-subtle">{rounds.map((round) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={round.id}><div className="min-w-0"><p className="break-words font-medium">{round.title}</p><p className="mt-1 text-xs text-muted-foreground">{round.period_start} – {round.period_end} · {roundStatusLabel(round.status)}</p></div><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/workforce/conversations/rounds/${round.id}`}>{labels.open}</Link></li>)}</ul> : <p className="p-4 text-sm text-muted-foreground">{labels.roundsEmpty}</p>}</Surface> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.35fr)_minmax(0,1fr)]">
        <Surface className="overflow-hidden">
          <div className="border-b border-border-subtle px-4 py-3">
            <SectionHeader title={labels.open} description={`${visible.length} / ${summaries.length}`} />
            <div className="mt-3 grid gap-2">
              <input aria-label={labels.search} className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} />
              <select aria-label={labels.filter} className="min-h-10 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
                <option value="">{labels.allStatuses}</option>
                {Array.from(new Set(summaries.map((item) => item.phase))).map((phase) => <option key={phase} value={phase}>{phaseLabel(phase)}</option>)}
              </select>
            </div>
          </div>
          <div className="divide-y divide-border-subtle">
            {visible.length ? visible.map((item) => (
              <button className={`w-full px-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-focus ${selectedId === item.id ? 'bg-accent' : 'hover:bg-surface-raised'}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.employeeName ?? item.reviewerName ?? labels.employee}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" />{item.dueDate ?? labels.dueDate} · {phaseLabel(item.phase)}</span>
                {isSoftDeadlineOverdue({ dueDate: item.dueDate, today, phase: item.phase, roundStatus: item.roundStatus }) ? <Badge className="mt-2" tone="warning">{labels.overdue}</Badge> : null}
              </button>
            )) : <p className="p-6 text-sm text-muted-foreground">{labels.empty}</p>}
          </div>
        </Surface>
        <Surface className="p-5 sm:p-6">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selected.roundStatus ?? labels.status}</p><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.employeeName ?? selected.reviewerName}</p></div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"><UserRound aria-hidden="true" className="size-3.5" />{phaseLabel(selected.phase)}</span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3"><Info icon={<CalendarDays />} label={labels.dueDate} value={selected.dueDate ?? '—'} /><Info icon={<FileText />} label={labels.status} value={phaseLabel(selected.phase)} /><Info icon={<LockKeyhole />} label={labels.action} value={selected.roundStatus === 'CLOSED' ? labels.closed : labels.open} /></div>
              {isSoftDeadlineOverdue({ dueDate: selected.dueDate, today, phase: selected.phase, roundStatus: selected.roundStatus }) ? <p className="mt-3"><Badge tone="warning">{labels.overdue}</Badge></p> : null}
              {role === 'hr' && selected.roundStatus === 'ACTIVE' && ['WAITING_EMPLOYEE', 'WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER'].includes(selected.phase) ? <section className="mt-6 space-y-3 border-t border-border-subtle pt-5">
                <h3 className="text-sm font-semibold">{labels.assignReviewers}</h3>
                <label className="block text-sm font-medium">{labels.reviewerSearch}<input className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={reviewerSearch} onChange={(event) => setReviewerSearch(event.target.value)} /></label>
                {reviewerCandidates.length ? <ul className="divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle">{reviewerCandidates.map((candidate) => <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" key={candidate.id}><span className="min-w-0 text-sm">{[candidate.first_name, candidate.birth_name].filter(Boolean).join(' ')} <span className="text-xs text-muted-foreground">({candidate.employee_number})</span></span><div className="flex flex-wrap gap-2"><Button disabled={busy || assignedAdditionalReviewerId === candidate.id} onClick={() => setAssignedReviewerId(candidate.id)} type="button" variant={assignedReviewerId === candidate.id ? 'primary' : 'secondary'}>{labels.conversationLead}</Button>{roundValue?.additional_reviewer_enabled ? <Button disabled={busy || assignedReviewerId === candidate.id} onClick={() => setAssignedAdditionalReviewerId(candidate.id)} type="button" variant={assignedAdditionalReviewerId === candidate.id ? 'primary' : 'secondary'}>{labels.additionalReviewer}</Button> : null}</div></li>)}</ul> : null}
                <p className="text-xs text-muted-foreground">{labels.conversationLead}: {reviewerCandidates.find((candidate) => candidate.id === assignedReviewerId)?.first_name ?? selected.reviewerName ?? '—'}{roundValue?.additional_reviewer_enabled ? ` · ${labels.additionalReviewer}: ${reviewerCandidates.find((candidate) => candidate.id === assignedAdditionalReviewerId)?.first_name ?? '—'}` : ''}</p>
                <label className="block text-sm font-medium">{labels.reviewerRoleReason}<textarea className="mt-1 min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={roleChangeReason} onChange={(event) => setRoleChangeReason(event.target.value)} /></label>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={preserveDrafts} onChange={(event) => setPreserveDrafts(event.target.checked)} /><span>{labels.preserveDrafts}<span className="mt-1 block text-xs text-muted-foreground">{labels.draftArchiveWarning}</span></span></label>
                <div className="flex flex-wrap gap-2">{roundValue?.additional_reviewer_enabled && assignedReviewerId && assignedAdditionalReviewerId ? <Button disabled={busy} onClick={() => { setAssignedReviewerId(assignedAdditionalReviewerId); setAssignedAdditionalReviewerId(assignedReviewerId) }} type="button" variant="secondary">{labels.swapRoles}</Button> : null}<Button disabled={busy || !assignedReviewerId || !roleChangeReason.trim() || assignedReviewerId === assignedAdditionalReviewerId} onClick={() => void saveReviewerAssignments()}>{labels.saveAssignments}</Button>{selected.phase === 'WAITING_ADDITIONAL_REVIEWER' ? <Button disabled={busy || !roleChangeReason.trim()} onClick={() => void releaseReviewer()} variant="secondary">{labels.releaseAdditionalReviewer}</Button> : null}</div>
              </section> : null}
              {role === 'manager' && selfSubmission?.submitted_at ? <ReadOnlyText label={labels.selfReflection} value={selfSubmission.body} /> : null}
              {role === 'additional-reviewer' && selfSubmission?.submitted_at ? <ReadOnlyText label={labels.selfReflection} value={selfSubmission.body} /> : null}
              {role === 'hr' && selfSubmission?.submitted_at ? <ReadOnlyText label={labels.selfReflection} value={selfSubmission.body} /> : null}
              {role === 'employee' && selfSubmission?.submitted_at && selected.phase !== 'WAITING_EMPLOYEE' ? <ReadOnlyText label={labels.selfReflection} value={selfSubmission.body} /> : null}
              {role === 'employee' && managerSubmission?.submitted_at ? <ReadOnlyText label={labels.managerResponse} value={managerSubmission.body} /> : null}
              {(role === 'manager' || role === 'hr' || (role === 'employee' && Boolean(managerSubmission?.submitted_at)) || role === 'additional-reviewer') && additionalReviewerSubmission?.submitted_at ? <ReadOnlyText label={labels.additionalReviewerResponse} value={additionalReviewerSubmission.body} /> : null}
              {role === 'employee' && selected.additional_reviewer_workflow && !managerSubmission?.submitted_at ? <p className="mt-4 text-xs text-muted-foreground">{labels.additionalReviewerHidden}</p> : null}
              {role === 'employee' && managerSubmission?.submitted_at && managerSubmission.score != null ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><Info icon={<FileText />} label={labels.ratingScore} value={String(managerSubmission.score)} />{managerSubmission.rating_explanation ? <ReadOnlyText label={labels.ratingExplanation} value={managerSubmission.rating_explanation} /> : null}</div> : null}
              {(role === 'employee' || role === 'manager' || role === 'hr') && acknowledgement ? <ReadOnlyText label={labels.acknowledgement} value={acknowledgement.decision === 'AGREE' ? labels.agree : `${labels.disagree}${acknowledgement.reason ? `: ${acknowledgement.reason}` : ''}`} /> : null}
              {visibleAttachments.length ? <div className="mt-6 space-y-2"><p className="text-sm font-medium">{labels.attachments}</p><ul className="divide-y divide-border-subtle rounded-[var(--radius-control)] border border-border-subtle">{visibleAttachments.map((item) => <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm" key={item.id}><span className="min-w-0 truncate">{item.original_filename}</span><span className="flex shrink-0 items-center gap-3"><button className="inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline" onClick={() => void downloadAttachment(item.id)} type="button"><Download aria-hidden="true" className="size-3.5" />{labels.action}</button>{role === 'manager' && selected.phase === 'WAITING_MANAGER' && selected.roundStatus !== 'CLOSED' ? <button className="text-xs text-destructive underline-offset-4 hover:underline" onClick={() => void removeAttachment(item.id)} type="button">{labels.remove}</button> : null}</span></li>)}</ul></div> : null}
              {role === 'employee' && selected.phase === 'WAITING_EMPLOYEE' && selected.roundStatus !== 'CLOSED' ? <Form label={labels.selfReflection} value={body} onChange={(value) => { draftEditRevisions.current.body += 1; setBody(value) }} onSubmit={() => submit('submit-self')} busy={busy} submitLabel={labels.submit} draftLabel={labels.saveDraft} onDraft={() => submit('save-self')} /> : null}
              {role === 'additional-reviewer' && selected.phase === 'WAITING_ADDITIONAL_REVIEWER' && selected.roundStatus === 'ACTIVE' ? <Form label={labels.additionalReviewerResponse} hint={labels.additionalReviewerOptional} value={body} onChange={(value) => { draftEditRevisions.current.body += 1; setBody(value) }} onSubmit={() => submit('submit-additional-reviewer')} busy={busy} submitLabel={labels.submitContribution} draftLabel={labels.saveDraft} onDraft={() => submit('save-additional-reviewer')} /> : null}
              {role === 'manager' && selected.phase === 'WAITING_REVIEWER_CLOSE' && selected.roundStatus === 'ACTIVE' ? <div className="mt-6 border-t border-border-subtle pt-5"><Button disabled={busy} onClick={() => void closeConversation()}>{labels.closeConversation}</Button></div> : null}
              {role === 'manager' && selected.phase === 'WAITING_MANAGER' && selected.roundStatus !== 'CLOSED' ? (
                <>
                  <Form label={labels.managerResponse} value={body} onChange={(value) => { draftEditRevisions.current.body += 1; setBody(value) }} onSubmit={() => submit('submit-manager', { meetingDate: meetingDate || null, ...(ratingOptions.length ? { score: score ? Number(score) : null, ratingExplanation } : {}) })} busy={busy} submitLabel={labels.submit} submitDisabled={ratingOptions.length > 0 && (!score || !ratingExplanation.trim())} draftLabel={labels.saveDraft} onDraft={() => submit('save-manager', { meetingDate: meetingDate || null, ...(ratingOptions.length ? { score: score ? Number(score) : null, ratingExplanation } : {}) })} />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium">{labels.meetingDate}<input type="date" className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={meetingDate} onChange={(event) => { draftEditRevisions.current.meetingDate += 1; setMeetingDate(event.target.value) }} /></label>
                    {ratingOptions.length ? <label className="block text-sm font-medium">{labels.ratingScore}<select required className="mt-1 block w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2" value={score} onChange={(event) => { draftEditRevisions.current.score += 1; setScore(event.target.value) }}><option value="">{labels.rating}</option>{ratingOptions.map((option) => <option key={option.score} value={option.score}>{option.score} · {option.label}</option>)}</select></label> : null}
                  </div>
                  {ratingOptions.length ? <label className="mt-4 block text-sm font-medium">{labels.ratingExplanation}<textarea required className="mt-1 min-h-28 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" value={ratingExplanation} onChange={(event) => { draftEditRevisions.current.ratingExplanation += 1; setRatingExplanation(event.target.value) }} /></label> : null}
                  <div className="mt-6 space-y-3 border-t border-border-subtle pt-5"><p className="text-sm font-medium">{labels.attachments}</p><div className="flex flex-wrap items-center gap-2"><input aria-label={labels.attachments} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setAttachment(event.target.files?.[0] ?? null); setAttachmentRequestKey(crypto.randomUUID()) }} /><Button disabled={busy || !attachment} onClick={() => void uploadAttachment()} variant="secondary">{labels.upload}</Button></div><div className="flex flex-wrap items-center gap-2"><select aria-label={labels.appraisalLink} className="min-h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" value={appraisalId} onChange={(event) => setAppraisalId(event.target.value)}><option value="">{labels.appraisalLink}</option>{appraisalItems.map((item) => <option key={item.id} value={item.id}>{item.title}{item.occurred_on ? ` · ${item.occurred_on}` : ''}</option>)}</select><Button disabled={busy || !appraisalId} onClick={() => void linkAppraisal()} variant="secondary">{labels.link}</Button></div></div>
                </>
              ) : null}
              {(role === 'manager' || role === 'hr') && privateNote ? <ReadOnlyText label={labels.privateInfo} value={privateNote} /> : null}
              {(role === 'manager' || role === 'hr') && selected.roundStatus !== 'CLOSED' && selected.phase !== 'CANCELLED' ? <Form label={labels.privateInfo} hint={labels.privateInfoHint} value={privateNote} onChange={setPrivateNote} onSubmit={() => void savePrivateNote()} busy={busy} submitLabel={labels.saveDraft} /> : null}
              {role === 'employee' && selected.phase === 'WAITING_ACKNOWLEDGEMENT' && selected.roundStatus !== 'CLOSED' ? <div className="mt-6 space-y-4"><p className="text-sm font-medium">{labels.acknowledgement}</p><textarea aria-label={labels.disagreementReason} className="min-h-28 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={labels.disagreementReason} /><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => submit('acknowledge', { decision: 'AGREE' })} variant="primary"><CheckCircle2 aria-hidden="true" />{labels.agree}</Button><Button disabled={busy || !reason.trim()} onClick={() => submit('acknowledge', { decision: 'DISAGREE' })} variant="secondary"><Send aria-hidden="true" />{labels.disagree}</Button></div></div> : null}
              {message ? <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p> : null}
            </>
          ) : <div className="grid min-h-72 place-items-center text-center"><div><MessageSquareText aria-hidden="true" className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p></div></div>}
        </Surface>
      </div>
      <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.submit} description={labels.confirmSubmit} onConfirm={async () => { if (!confirmation) return; await performSubmit(confirmation.action, confirmation.payload); setConfirmation(null) }} onOpenChange={(open) => { if (!open) setConfirmation(null) }} open={confirmation !== null} pending={busy} title={labels.confirmSubmitTitle} />
    </PageShell>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><p className="mt-2 text-sm font-medium">{value}</p></div> }
function Form({ label, hint, value, onChange, onSubmit, onDraft, busy, submitLabel, draftLabel, submitDisabled = false }: { label: string; hint?: string; value: string; onChange: (value: string) => void; onSubmit: () => void; onDraft?: () => void; busy: boolean; submitLabel: string; draftLabel?: string; submitDisabled?: boolean }) { return <div className="mt-6 space-y-2">{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}<label className="block text-sm font-medium">{label}<textarea required aria-label={label} className="mt-1 min-h-36 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label><div className="flex flex-wrap gap-2">{onDraft && draftLabel ? <Button disabled={busy} onClick={onDraft} variant="secondary">{draftLabel}</Button> : null}<Button disabled={busy || !value.trim() || submitDisabled} onClick={onSubmit}>{submitLabel}</Button></div></div> }
function ReadOnlyText({ label, value }: { label: string; value: string }) { return <section className="mt-6 space-y-2"><h3 className="text-sm font-semibold">{label}</h3><p className="whitespace-pre-wrap rounded-[var(--radius-control)] border border-border-subtle p-3 text-sm">{value}</p></section> }

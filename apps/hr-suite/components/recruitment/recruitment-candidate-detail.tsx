'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactElement } from 'react'

import { DetailColumns } from '@/components/layout/detail-columns'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { InfoList } from '@/components/patterns/info-list'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import { ScrollableTabs, TabLink } from '@/components/patterns/scrollable-tabs'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { ApplicationDetail } from '@/lib/recruitment/application-service'
import type { GuidedInterview, GuidedSet, RecruitmentParticipantOption } from '@/lib/recruitment/guided-service'
import { GuidedInterviewPlanner } from './guided-interview-planner'

type ApplicantDetailTab = 'overview' | 'interviews' | 'assessments' | 'history'

interface StageOption {
  readonly id: string
  readonly name: string
}

interface Labels {
  readonly back: string
  readonly candidate: string
  readonly contact: string
  readonly motivation: string
  readonly answers: string
  readonly documents: string
  readonly timeline: string
  readonly otherApplications: string
  readonly securityNotice: string
  readonly emptyValue: string
  readonly decisionReason: string
  readonly decisionNote: string
  readonly email: string
  readonly phone: string
  readonly vacancy: string
  readonly stage: string
  readonly source: string
  readonly received: string
  readonly status: string
  readonly active: string
  readonly rejected: string
  readonly hired: string
  readonly manual: string
  readonly public: string
  readonly clean: string
  readonly unknown: string
  readonly tabs: { readonly label: string; readonly overview: string; readonly interviews: string; readonly assessments: string; readonly history: string; readonly previous: string; readonly next: string }
  readonly actions: { readonly changeStage: string; readonly addInterview: string; readonly reject: string; readonly reopen: string; readonly close: string; readonly stageTitle: string; readonly stageDescription: string; readonly stageSearch: string; readonly stageSave: string; readonly cancel: string; readonly rejectTitle: string; readonly rejectDescription: string; readonly rejectReason: string; readonly rejectReasonPlaceholder: string; readonly rejectConfirm: string; readonly dirtyTitle: string; readonly dirtyDescription: string; readonly discard: string; readonly keepEditing: string; readonly hire: string; readonly hireDescription: string; readonly administrationId: string; readonly employeeId: string; readonly employmentId: string; readonly hireConfirm: string }
  readonly states: { readonly noAnswers: string; readonly noDocuments: string; readonly noAssessments: string; readonly noEvents: string; readonly noOtherApplications: string; readonly event: string; readonly changedStage: string; readonly applicationCreated: string; readonly rejectedEvent: string; readonly reopenedEvent: string; readonly interviewCreated: string; readonly hiredEvent: string; readonly unknownEvent: string }
  readonly feedback: { readonly saved: string; readonly failed: string }
  readonly interview: { readonly title: string; readonly description: string; readonly newInterview: string; readonly interviewTitle: string; readonly scheduledAt: string; readonly set: string; readonly noSet: string; readonly participants: string; readonly searchParticipants: string; readonly createInterview: string; readonly cancel: string; readonly saved: string; readonly noInterviews: string; readonly close: string; readonly dirtyTitle: string; readonly dirtyDescription: string; readonly discard: string; readonly keepEditing: string }
}

interface Props {
  readonly activeTab: ApplicantDetailTab
  readonly application: ApplicationDetail
  readonly basePath: string
  readonly canWrite: boolean
  readonly interviews: readonly GuidedInterview[]
  readonly labels: Labels
  readonly participants: readonly RecruitmentParticipantOption[]
  readonly sets: readonly GuidedSet[]
  readonly stages: readonly StageOption[]
}

type Feedback = { readonly ok: boolean; readonly status: number }

function formatAnswer(value: ApplicationDetail['answers'][number]['value'], emptyValue: string): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value) ?? emptyValue
}

function eventLabel(type: string, states: Labels['states']): string {
  const labels: Readonly<Record<string, string>> = {
    APPLICATION_CREATED: states.applicationCreated,
    STAGE_CHANGED: states.changedStage,
    APPLICATION_REJECTED: states.rejectedEvent,
    APPLICATION_REOPENED: states.reopenedEvent,
    INTERVIEW_CREATED: states.interviewCreated,
    APPLICATION_HIRED: states.hiredEvent,
  }
  return labels[type] ?? states.unknownEvent
}

function statusTone(application: ApplicationDetail): BadgeTone {
  if (application.terminalOutcome === 'AANGENOMEN') return 'success'
  if (application.terminalOutcome === 'AFGEWEZEN') return 'danger'
  return 'info'
}

function statusLabel(application: ApplicationDetail, labels: Labels): string {
  if (application.terminalOutcome === 'AANGENOMEN') return labels.hired
  if (application.terminalOutcome === 'AFGEWEZEN') return labels.rejected
  return application.stageName ?? labels.active
}

function sourceLabel(source: ApplicationDetail['source'], labels: Labels): string {
  return source === 'PUBLIC' ? labels.public : labels.manual
}

function outcomeLabel(outcome: string | null, labels: Labels): string {
  if (outcome === 'AFGEWEZEN') return labels.rejected
  if (outcome === 'AANGENOMEN') return labels.hired
  return outcome ?? labels.emptyValue
}

function readStatus(response: Response | null): Feedback {
  return { ok: Boolean(response?.ok), status: response?.status ?? 0 }
}

export function RecruitmentCandidateDetail({ activeTab, application, basePath, canWrite, interviews, labels, participants, sets, stages }: Props): ReactElement {
  const router = useRouter()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [stageOpen, setStageOpen] = useState(false)
  const [stageDraft, setStageDraft] = useState(application.stageId ?? stages[0]?.id ?? '')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [discardRejectOpen, setDiscardRejectOpen] = useState(false)
  const [hireOpen, setHireOpen] = useState(false)
  const [hireForm, setHireForm] = useState({ administrationId: '', employeeId: '', employmentId: '' })
  const [saving, setSaving] = useState(false)

  const stageDirty = stageDraft !== (application.stageId ?? stages[0]?.id ?? '')
  const rejectDirty = rejectReason.trim().length > 0
  const hireDirty = Object.values(hireForm).some((value) => value.trim().length > 0)

  async function postApplicationAction(endpoint: string, body: Record<string, unknown>): Promise<Feedback> {
    if (saving) return { ok: false, status: 0 }
    setSaving(true)
    const response = await fetch(`/api/recruitment/applications/${application.id}/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const result = readStatus(response)
    setFeedback(result)
    if (result.ok) router.refresh()
    setSaving(false)
    return result
  }

  async function submitStage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!stageDraft) return
    const result = await postApplicationAction(application.terminalOutcome ? 'reopen' : 'stage', { stageId: stageDraft, expectedVersion: application.version, idempotencyKey: crypto.randomUUID() })
    if (result.ok) setStageOpen(false)
  }

  async function submitReject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!rejectReason.trim()) return
    const result = await postApplicationAction('reject', { reason: rejectReason.trim(), expectedVersion: application.version, idempotencyKey: crypto.randomUUID() })
    if (result.ok) {
      setRejectReason('')
      setRejectOpen(false)
    }
  }

  async function submitHire(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const { administrationId, employeeId, employmentId } = hireForm
    if (!administrationId.trim() || !employeeId.trim()) return
    const result = await postApplicationAction('hire', { choice: 'EXISTING_EMPLOYEE', administrationId: administrationId.trim(), employeeId: employeeId.trim(), employmentId: employmentId.trim() || null, expectedVersion: application.version })
    if (result.ok) setHireOpen(false)
  }

  function requestRejectClose(nextOpen: boolean): void {
    if (nextOpen) { setRejectOpen(true); return }
    if (saving) return
    if (rejectDirty) { setDiscardRejectOpen(true); return }
    setRejectOpen(false)
  }

  function discardReject(): void {
    setRejectReason('')
    setDiscardRejectOpen(false)
    setRejectOpen(false)
  }

  const detailDescription = <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><Link className="break-words text-primary underline-offset-4 hover:underline" href={`/recruitment/vacancies/${application.vacancyId}`}>{application.vacancyTitle}</Link><span aria-hidden="true">·</span><span>{statusLabel(application, labels)}</span></span>
  const headerActions = canWrite ? <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
    <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`${basePath}?tab=interviews`}>{labels.actions.addInterview}</Link>
    {application.terminalOutcome ? <Button disabled={saving || stages.length === 0} onClick={() => setStageOpen(true)} size="sm" variant="secondary">{labels.actions.reopen}</Button> : <Button disabled={saving || stages.length === 0} onClick={() => setStageOpen(true)} size="sm" variant="secondary">{labels.actions.changeStage}</Button>}
    {application.terminalOutcome === null ? <Button disabled={saving} onClick={() => setRejectOpen(true)} size="sm" variant="danger">{labels.actions.reject}</Button> : null}
  </div> : null

  return <div className="min-w-0 py-6 sm:py-8">
    <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/recruitment/vacancies/${application.vacancyId}`}>← {labels.back}</Link>
    <PageHeader className="mt-5" actions={headerActions} description={detailDescription} title={<span className="break-words">{application.candidateName}</span>} />
    <p className="mt-4 rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-4 text-sm text-muted-foreground">{labels.securityNotice}</p>
    <div className="mt-6"><ScrollableTabs ariaLabel={labels.tabs.label} leftLabel={labels.tabs.previous} rightLabel={labels.tabs.next}><TabLink active={activeTab === 'overview'} href={`${basePath}?tab=overview`}>{labels.tabs.overview}</TabLink><TabLink active={activeTab === 'interviews'} href={`${basePath}?tab=interviews`}>{labels.tabs.interviews}</TabLink><TabLink active={activeTab === 'assessments'} href={`${basePath}?tab=assessments`}>{labels.tabs.assessments}</TabLink><TabLink active={activeTab === 'history'} href={`${basePath}?tab=history`}>{labels.tabs.history}</TabLink></ScrollableTabs></div>
    {feedback ? <p aria-live="polite" className={`mt-4 text-sm ${feedback.ok ? 'text-success' : 'text-destructive'}`}>{feedback.ok ? labels.feedback.saved : labels.feedback.failed}</p> : null}
    <DetailColumns className="mt-6" main={activeTab === 'overview' ? <Overview application={application} labels={labels} /> : activeTab === 'interviews' ? <Interviews applicationId={application.id} canWrite={canWrite} interviews={interviews} labels={labels} participants={participants} sets={sets} /> : activeTab === 'assessments' ? <Assessments labels={labels} /> : <History application={application} labels={labels} />} aside={<Aside application={application} canWrite={canWrite} labels={labels} onHire={() => setHireOpen(true)} /> } />

    <FormDrawer cancelLabel={labels.actions.cancel} closeLabel={labels.actions.close} dirty={stageDirty} dirtyProtection={{ title: labels.actions.dirtyTitle, description: labels.actions.dirtyDescription, discardLabel: labels.actions.discard, keepEditingLabel: labels.actions.keepEditing }} onDiscard={() => setStageDraft(application.stageId ?? stages[0]?.id ?? '')} onOpenChange={setStageOpen} open={stageOpen} saveLabel={application.terminalOutcome ? labels.actions.reopen : labels.actions.stageSave} saving={saving} title={application.terminalOutcome ? labels.actions.reopen : labels.actions.stageTitle} description={labels.actions.stageDescription} onSubmit={(event) => void submitStage(event)}>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.stage}</span><DropdownSelect aria-label={labels.stage} name="stageId" onChange={(event) => setStageDraft(event.target.value)} placeholder={labels.actions.stageSearch} searchable searchPlaceholder={labels.actions.stageSearch} value={stageDraft}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</DropdownSelect></label>
    </FormDrawer>

    <Dialog closeLabel={labels.actions.close} description={labels.actions.rejectDescription} onOpenChange={requestRejectClose} open={rejectOpen} title={labels.actions.rejectTitle} footer={<div className="flex flex-wrap justify-end gap-2"><Button disabled={saving} onClick={() => requestRejectClose(false)} size="sm" type="button" variant="secondary">{labels.actions.cancel}</Button><Button disabled={saving || !rejectReason.trim()} loading={saving} onClick={() => { const form = document.getElementById('recruitment-reject-form'); if (form instanceof HTMLFormElement) form.requestSubmit() }} size="sm" type="button" variant="danger">{labels.actions.rejectConfirm}</Button></div>}><form className="grid gap-4" id="recruitment-reject-form" onSubmit={(event) => void submitReject(event)}><label className="grid gap-1.5 text-sm font-medium"><span>{labels.actions.rejectReason}</span><Textarea maxLength={2000} onChange={(event) => setRejectReason(event.target.value)} placeholder={labels.actions.rejectReasonPlaceholder} required value={rejectReason} /></label></form></Dialog>
    <ConfirmDialog cancelLabel={labels.actions.keepEditing} confirmLabel={labels.actions.discard} destructive description={labels.actions.dirtyDescription} onConfirm={discardReject} onOpenChange={setDiscardRejectOpen} open={discardRejectOpen} title={labels.actions.dirtyTitle} />

    <FormDrawer cancelLabel={labels.actions.cancel} closeLabel={labels.actions.close} dirty={hireDirty} dirtyProtection={{ title: labels.actions.dirtyTitle, description: labels.actions.dirtyDescription, discardLabel: labels.actions.discard, keepEditingLabel: labels.actions.keepEditing }} onDiscard={() => setHireForm({ administrationId: '', employeeId: '', employmentId: '' })} onOpenChange={setHireOpen} open={hireOpen} saveLabel={labels.actions.hireConfirm} saving={saving} title={labels.actions.hire} description={labels.actions.hireDescription} onSubmit={(event) => void submitHire(event)}>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.actions.administrationId}</span><TextInput name="administrationId" onChange={(event) => setHireForm((current) => ({ ...current, administrationId: event.target.value }))} required value={hireForm.administrationId} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.actions.employeeId}</span><TextInput name="employeeId" onChange={(event) => setHireForm((current) => ({ ...current, employeeId: event.target.value }))} required value={hireForm.employeeId} /></label>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.actions.employmentId}</span><TextInput name="employmentId" onChange={(event) => setHireForm((current) => ({ ...current, employmentId: event.target.value }))} value={hireForm.employmentId} /></label>
    </FormDrawer>
  </div>
}

function Overview({ application, labels }: { readonly application: ApplicationDetail; readonly labels: Labels }): ReactElement {
  return <div className="space-y-6"><Surface className="p-5"><SectionHeader title={labels.contact} /><InfoList className="mt-5" columns={2} items={[{ label: labels.email, value: <span className="break-all">{application.privateEmail ?? labels.emptyValue}</span> }, { label: labels.phone, value: application.phone ?? labels.emptyValue }, { label: labels.source, value: sourceLabel(application.source, labels) }, { label: labels.received, value: application.createdAt.slice(0, 10) }]} /></Surface><Surface className="p-5"><SectionHeader title={labels.motivation} /><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{application.motivation ?? labels.emptyValue}</p></Surface>{application.terminalReason || application.terminalNote ? <Surface className="p-5"><SectionHeader title={labels.status} /><InfoList className="mt-4" items={[{ label: labels.decisionReason, value: application.terminalReason ?? labels.emptyValue }, { label: labels.decisionNote, value: application.terminalNote ?? labels.emptyValue }]} /></Surface> : null}<Surface className="p-5"><SectionHeader title={labels.documents} />{application.documents.length ? <ul className="mt-4 divide-y divide-border-subtle">{application.documents.map((document) => <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0" key={document.id}><span className="break-all">{document.fileName}</span><Badge tone={document.scanStatus === 'CLEAN' ? 'success' : 'neutral'}>{document.scanStatus === 'CLEAN' ? labels.clean : document.scanStatus}</Badge></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{labels.states.noDocuments}</p>}</Surface><Surface className="p-5"><SectionHeader title={labels.answers} description={labels.states.noAnswers} />{application.answers.length ? <ul className="mt-4 space-y-4">{application.answers.map((answer) => <li className="border-b border-border-subtle pb-4 last:border-0 last:pb-0" key={answer.id}><p className="text-sm font-medium">{answer.label}</p><p className="mt-1 break-words text-sm text-muted-foreground">{formatAnswer(answer.value, labels.emptyValue)}</p></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{labels.states.noAnswers}</p>}</Surface></div>
}

function Interviews({ applicationId, canWrite, interviews, labels, participants, sets }: { readonly applicationId: string; readonly canWrite: boolean; readonly interviews: readonly GuidedInterview[]; readonly labels: Labels; readonly participants: readonly RecruitmentParticipantOption[]; readonly sets: readonly GuidedSet[] }): ReactElement {
  if (canWrite) return <GuidedInterviewPlanner applicationId={applicationId} interviews={interviews} labels={labels.interview} participants={participants} sets={sets} />
  return <Surface className="p-5"><SectionHeader title={labels.tabs.interviews} />{interviews.length ? <ul className="mt-4 divide-y divide-border-subtle">{interviews.map((interview) => <li className="py-3 first:pt-0 last:pb-0" key={interview.id}><p className="break-words text-sm font-medium">{interview.title}</p><p className="mt-1 text-xs text-muted-foreground">{interview.scheduledAt ?? labels.emptyValue}</p></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">{labels.interview.noInterviews}</p>}</Surface>
}

function Assessments({ labels }: { readonly labels: Labels }): ReactElement {
  return <Surface className="p-5"><SectionHeader title={labels.tabs.assessments} /><p className="mt-4 text-sm leading-6 text-muted-foreground">{labels.states.noAssessments}</p></Surface>
}

function History({ application, labels }: { readonly application: ApplicationDetail; readonly labels: Labels }): ReactElement {
  return <Surface className="p-5"><SectionHeader title={labels.timeline} />{application.events.length ? <ol className="mt-4 divide-y divide-border-subtle">{application.events.map((event) => <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0" key={event.id}><span className="break-words text-sm">{eventLabel(event.type, labels.states)}</span><time className="shrink-0 text-xs text-muted-foreground" dateTime={event.createdAt}>{event.createdAt.slice(0, 10)}</time></li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">{labels.states.noEvents}</p>}</Surface>
}

function Aside({ application, canWrite, labels, onHire }: { readonly application: ApplicationDetail; readonly canWrite: boolean; readonly labels: Labels; readonly onHire: () => void }): ReactElement {
  return <div className="space-y-6"><Surface className="p-5"><SectionHeader title={labels.status} /><div className="mt-4"><Badge tone={statusTone(application)}>{statusLabel(application, labels)}</Badge></div><InfoList className="mt-5" items={[{ label: labels.vacancy, value: <Link className="break-words text-primary underline-offset-4 hover:underline" href={`/recruitment/vacancies/${application.vacancyId}`}>{application.vacancyTitle}</Link> }, { label: labels.stage, value: application.stageName ?? labels.emptyValue }, { label: labels.source, value: sourceLabel(application.source, labels) }]} /></Surface>{canWrite && application.terminalOutcome === null ? <Surface className="p-5"><SectionHeader title={labels.actions.hire} description={labels.actions.hireDescription} /><Button className="mt-4 w-full" onClick={onHire} type="button" variant="primary">{labels.actions.hire}</Button></Surface> : null}{application.otherApplications.length ? <Surface className="p-5"><SectionHeader title={labels.otherApplications} /><ul className="mt-4 space-y-3">{application.otherApplications.map((other) => <li key={other.id}><Link className="break-words text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/recruitment/applications/${other.id}`}>{other.vacancyTitle}</Link><p className="mt-1 text-xs text-muted-foreground">{other.stageName ?? outcomeLabel(other.outcome, labels)}</p></li>)}</ul></Surface> : null}</div>
}

'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Archive, Check, Pencil, Plus, RotateCcw, Send } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import type { TalentAssessmentItem, TalentAssessmentResponse, TalentAssessmentWorkspace } from '@/lib/talent/assessment-service'

type Mode = 'admin' | 'manager' | 'self'

type Labels = {
  title: string
  subtitle: string
  cycles: string
  noCycles: string
  selectCycle: string
  createCycle: string
  code: string
  name: string
  description: string
  opensOn: string
  closesOn: string
  itemTitle: string
  sortOrder: string
  prompt: string
  maxScore: string
  create: string
  save: string
  submit: string
  status: string
  open: string
  close: string
  archive: string
  draft: string
  opened: string
  closed: string
  archived: string
  response: string
  self: string
  manager: string
  participant: string
  chooseParticipant: string
  answer: string
  privateNote: string
  privateNoteHint: string
  noItems: string
  noResponses: string
  responseStatus: string
  lock: string
  finalize: string
  reopen: string
  saved: string
  failed: string
  readOnly: string
  itemFormTitle: string
  itemCreate: string
  itemEdit: string
  itemSaved: string
  question: string
  required: string
  optional: string
  noParticipants: string
  responseHint: string
  finalizedReadOnly: string
  confirmTitle: string
  confirmOpen: string
  confirmClose: string
  confirmArchive: string
  confirmLock: string
  confirmFinalize: string
  confirmReopen: string
  discardTitle: string
  discardDescription: string
  discard: string
  keepEditing: string
  cancel: string
}

type CycleDraft = {
  code: string
  name: string
  description: string
  opensOn: string
  closesOn: string
  itemTitle: string
  prompt: string
  maxScore: string
}

type ItemDraft = {
  title: string
  prompt: string
  sortOrder: string
  maxScore: string
  isRequired: boolean
}

type AnswerDraft = { score: string; answerText: string }
type ConfirmRequest = {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function inThirtyDays(): string {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString().slice(0, 10)
}

function emptyCycleDraft(): CycleDraft {
  return { code: '', name: '', description: '', opensOn: today(), closesOn: inThirtyDays(), itemTitle: '', prompt: '', maxScore: '5' }
}

function emptyItemDraft(sortOrder: number): ItemDraft {
  return { title: '', prompt: '', sortOrder: String(sortOrder), maxScore: '5', isRequired: true }
}

function responseKey(cycleId: string, responseType: string, subjectId: string | null): string {
  return `${cycleId}:${responseType}:${subjectId ?? 'self'}`
}

function cycleStatusLabel(status: string, labels: Labels): string {
  if (status === 'OPEN') return labels.opened
  if (status === 'CLOSED') return labels.closed
  if (status === 'ARCHIVED') return labels.archived
  return labels.draft
}

function responseStatusLabel(status: string, labels: Labels): string {
  if (status === 'SUBMITTED') return labels.submit
  if (status === 'LOCKED') return labels.lock
  if (status === 'FINALIZED') return labels.finalize
  return labels.draft
}

function statusTone(status: string): BadgeTone {
  if (status === 'OPEN' || status === 'SUBMITTED') return 'info'
  if (status === 'CLOSED' || status === 'LOCKED') return 'warning'
  if (status === 'FINALIZED') return 'success'
  return 'neutral'
}

function defaultAnswerDrafts(items: TalentAssessmentItem[], response: TalentAssessmentResponse | null): Record<string, AnswerDraft> {
  return Object.fromEntries(items.map((item) => {
    const answer = response?.answers.find((candidate) => candidate.item_id === item.id)
    return [item.id, { score: answer?.score === null || answer?.score === undefined ? '' : String(answer.score), answerText: answer?.answer_text ?? '' }]
  }))
}

export function TalentAssessmentWorkspace({ mode, initial, labels }: { mode: Mode; initial: TalentAssessmentWorkspace; labels: Labels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(initial.cycles[0]?.id ?? null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initial.participants[0]?.id ?? null)
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, Record<string, AnswerDraft>>>({})
  const [privateNotes, setPrivateNotes] = useState<Record<string, string>>({})
  const [dirtyResponses, setDirtyResponses] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [cycleDrawerOpen, setCycleDrawerOpen] = useState(false)
  const [cycleDraft, setCycleDraft] = useState<CycleDraft>(emptyCycleDraft)
  const [cycleDrawerDirty, setCycleDrawerDirty] = useState(false)
  const [itemDrawer, setItemDrawer] = useState<{ mode: 'create' | 'edit'; itemId?: string } | null>(null)
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItemDraft(1))
  const [itemDrawerDirty, setItemDrawerDirty] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)

  const selectedCycle = workspace.cycles.find((cycle) => cycle.id === selectedCycleId) ?? null
  const items = useMemo(() => workspace.items.filter((item) => item.cycle_id === selectedCycleId).sort((a, b) => a.sort_order - b.sort_order), [selectedCycleId, workspace.items])
  const responseType = mode === 'self' ? 'SELF' : 'MANAGER'
  const selectedResponse = workspace.responses.find((response) => response.cycle_id === selectedCycleId && response.response_type === responseType && (mode === 'self' || response.subject_employee_id === selectedSubjectId)) ?? null
  const selectionKey = responseKey(selectedCycleId ?? '', responseType, mode === 'self' ? null : selectedSubjectId)
  const defaultAnswers = useMemo(() => defaultAnswerDrafts(items, selectedResponse), [items, selectedResponse])
  const answers = answerDrafts[selectionKey] ?? defaultAnswers
  const privateNote = privateNotes[selectionKey] ?? selectedResponse?.privateNote ?? ''
  const responseEditable = mode !== 'admin' && selectedCycle?.status === 'OPEN' && (!selectedResponse || selectedResponse.status === 'DRAFT')
  const responseDirty = Boolean(dirtyResponses[selectionKey])

  useEffect(() => {
    if (!responseDirty) return undefined
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [responseDirty])

  function setFeedback(text: string, error = false): void {
    setMessage({ text, error })
  }

  async function refresh(): Promise<void> {
    const query = new URLSearchParams({ mode })
    if (mode === 'self') query.set('responseType', 'SELF')
    const response = await fetch(`/api/talent/assessments?${query.toString()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('read')
    const payload = await response.json() as { data: TalentAssessmentWorkspace }
    setWorkspace(payload.data)
    setSelectedCycleId((current) => current && payload.data.cycles.some((cycle) => cycle.id === current) ? current : payload.data.cycles[0]?.id ?? null)
    if (mode === 'manager') setSelectedSubjectId((current) => current && payload.data.participants.some((participant) => participant.id === current) ? current : payload.data.participants[0]?.id ?? null)
  }

  function closeCycleDrawer(): void {
    setCycleDrawerOpen(false)
    setCycleDrawerDirty(false)
    setCycleDraft(emptyCycleDraft())
  }

  async function createCycle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (pending) return
    setPending('cycle:create')
    setMessage(null)
    try {
      const response = await fetch('/api/talent/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        code: cycleDraft.code,
        name: cycleDraft.name,
        description: cycleDraft.description || null,
        opensOn: cycleDraft.opensOn,
        closesOn: cycleDraft.closesOn,
        items: [{ title: cycleDraft.itemTitle, prompt: cycleDraft.prompt, sortOrder: 1, maxScore: Number(cycleDraft.maxScore), isRequired: true }],
      }) })
      if (!response.ok) throw new Error('create')
      closeCycleDrawer()
      await refresh()
      setFeedback(labels.saved)
    } catch {
      setFeedback(labels.failed, true)
    } finally {
      setPending(null)
    }
  }

  function openItemDrawer(item?: TalentAssessmentItem): void {
    if (item) {
      setItemDrawer({ mode: 'edit', itemId: item.id })
      setItemDraft({ title: item.title, prompt: item.prompt, sortOrder: String(item.sort_order), maxScore: String(item.max_score), isRequired: item.is_required })
    } else {
      setItemDrawer({ mode: 'create' })
      setItemDraft(emptyItemDraft(items.length + 1))
    }
    setItemDrawerDirty(false)
  }

  function closeItemDrawer(): void {
    setItemDrawer(null)
    setItemDrawerDirty(false)
    setItemDraft(emptyItemDraft(items.length + 1))
  }

  async function saveItem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selectedCycle || !itemDrawer || pending) return
    setPending(`item:${itemDrawer.mode}`)
    setMessage(null)
    try {
      const url = itemDrawer.mode === 'create' ? `/api/talent/assessments/${selectedCycle.id}/items` : `/api/talent/assessments/items/${itemDrawer.itemId}`
      const body = { title: itemDraft.title, prompt: itemDraft.prompt, sortOrder: Number(itemDraft.sortOrder), maxScore: Number(itemDraft.maxScore), isRequired: itemDraft.isRequired }
      const response = await fetch(url, { method: itemDrawer.mode === 'create' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('item')
      closeItemDrawer()
      await refresh()
      setFeedback(labels.itemSaved)
    } catch {
      setFeedback(labels.failed, true)
    } finally {
      setPending(null)
    }
  }

  async function transitionCycle(status: 'OPEN' | 'CLOSED' | 'ARCHIVED'): Promise<void> {
    if (!selectedCycle || pending) return
    setPending(`cycle:${status}`)
    try {
      const response = await fetch(`/api/talent/assessments/${selectedCycle.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: selectedCycle.version, status }) })
      if (!response.ok) throw new Error('cycle')
      setConfirmRequest(null)
      await refresh()
      setFeedback(labels.saved)
    } catch {
      setFeedback(labels.failed, true)
    } finally {
      setPending(null)
    }
  }

  function requestCycleTransition(status: 'OPEN' | 'CLOSED' | 'ARCHIVED'): void {
    if (!selectedCycle) return
    const description = status === 'OPEN' ? labels.confirmOpen : status === 'CLOSED' ? labels.confirmClose : labels.confirmArchive
    setConfirmRequest({ title: labels.confirmTitle, description, confirmLabel: status === 'OPEN' ? labels.open : status === 'CLOSED' ? labels.close : labels.archive, destructive: status !== 'OPEN', onConfirm: () => transitionCycle(status) })
  }

  function clearResponseDraft(key: string): void {
    setAnswerDrafts((current) => { const next = { ...current }; delete next[key]; return next })
    setPrivateNotes((current) => { const next = { ...current }; delete next[key]; return next })
    setDirtyResponses((current) => ({ ...current, [key]: false }))
  }

  function selectCycle(nextCycleId: string): void {
    if (nextCycleId === selectedCycleId) return
    const apply = () => { clearResponseDraft(selectionKey); setSelectedCycleId(nextCycleId); setMessage(null); setConfirmRequest(null) }
    if (responseDirty) {
      setConfirmRequest({ title: labels.discardTitle, description: labels.discardDescription, confirmLabel: labels.discard, destructive: true, onConfirm: apply })
      return
    }
    apply()
  }

  function selectParticipant(nextSubjectId: string | null): void {
    if (nextSubjectId === selectedSubjectId) return
    const apply = () => { clearResponseDraft(selectionKey); setSelectedSubjectId(nextSubjectId); setMessage(null); setConfirmRequest(null) }
    if (responseDirty) {
      setConfirmRequest({ title: labels.discardTitle, description: labels.discardDescription, confirmLabel: labels.discard, destructive: true, onConfirm: apply })
      return
    }
    apply()
  }

  function updateAnswer(itemId: string, value: Partial<AnswerDraft>): void {
    setAnswerDrafts((current) => ({ ...current, [selectionKey]: { ...answers, [itemId]: { ...answers[itemId], ...value } } }))
    setDirtyResponses((current) => ({ ...current, [selectionKey]: true }))
  }

  function updatePrivateNote(value: string): void {
    setPrivateNotes((current) => ({ ...current, [selectionKey]: value }))
    setDirtyResponses((current) => ({ ...current, [selectionKey]: true }))
  }

  async function saveResponse(status: 'DRAFT' | 'SUBMITTED'): Promise<void> {
    if (!selectedCycle || (mode === 'manager' && !selectedSubjectId) || !responseEditable || pending) return
    setPending(`response:${status}`)
    setMessage(null)
    try {
      const response = await fetch('/api/talent/assessments/responses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        cycleId: selectedCycle.id,
        responseId: selectedResponse?.id,
        responseType,
        subjectEmployeeId: mode === 'manager' ? selectedSubjectId : undefined,
        status,
        version: selectedResponse?.version,
        answers: items.map((item) => ({ itemId: item.id, score: answers[item.id]?.score.trim() === '' ? null : Number(answers[item.id]?.score), answerText: answers[item.id]?.answerText.trim() || null })),
        privateNote: mode === 'manager' ? privateNote.trim() || null : undefined,
      }) })
      if (!response.ok) throw new Error('response')
      clearResponseDraft(selectionKey)
      await refresh()
      setFeedback(labels.saved)
    } catch {
      setFeedback(labels.failed, true)
    } finally {
      setPending(null)
    }
  }

  async function transitionResponse(response: TalentAssessmentResponse, status: 'DRAFT' | 'LOCKED' | 'FINALIZED'): Promise<void> {
    if (pending) return
    const description = status === 'LOCKED' ? labels.confirmLock : status === 'FINALIZED' ? labels.confirmFinalize : labels.confirmReopen
    const confirmLabel = status === 'LOCKED' ? labels.lock : status === 'FINALIZED' ? labels.finalize : labels.reopen
    setConfirmRequest({ title: labels.confirmTitle, description, confirmLabel, destructive: status === 'DRAFT', onConfirm: async () => {
      setPending(`response:${status}`)
      try {
        const result = await fetch(`/api/talent/assessments/responses/${response.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, version: response.version }) })
        if (!result.ok) throw new Error('response')
        setConfirmRequest(null)
        await refresh()
        setFeedback(labels.saved)
      } catch {
        setFeedback(labels.failed, true)
      } finally {
        setPending(null)
      }
    } })
  }

  const selectedCycleResponses = workspace.responses.filter((response) => response.cycle_id === selectedCycleId)

  return <section className="mt-6 space-y-5">
    <Surface className="p-5">
      <SectionHeader title={labels.title} description={labels.subtitle} actions={mode === 'admin' ? <Button onClick={() => setCycleDrawerOpen(true)} size="sm" type="button"><Plus aria-hidden="true" />{labels.createCycle}</Button> : undefined} />
      {message ? <p aria-live="polite" className={`mt-4 text-sm ${message.error ? 'text-destructive' : 'text-success'}`} role="status">{message.text}</p> : null}
    </Surface>

    {mode === 'admin' ? <FormDrawer
      cancelLabel={labels.cancel}
      closeLabel={labels.cancel}
      description={labels.subtitle}
      dirty={cycleDrawerDirty}
      dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discard, keepEditingLabel: labels.keepEditing }}
      onDiscard={closeCycleDrawer}
      onOpenChange={(open) => { if (!open) closeCycleDrawer() }}
      onSubmit={(event) => void createCycle(event)}
      open={cycleDrawerOpen}
      saveLabel={labels.create}
      saving={pending === 'cycle:create'}
      title={labels.createCycle}
    >
      <FormField control={<TextInput onChange={(event) => { setCycleDraft({ ...cycleDraft, code: event.target.value }); setCycleDrawerDirty(true) }} required value={cycleDraft.code} />} label={labels.code} required />
      <FormField control={<TextInput onChange={(event) => { setCycleDraft({ ...cycleDraft, name: event.target.value }); setCycleDrawerDirty(true) }} required value={cycleDraft.name} />} label={labels.name} required />
      <FormField control={<Textarea onChange={(event) => { setCycleDraft({ ...cycleDraft, description: event.target.value }); setCycleDrawerDirty(true) }} value={cycleDraft.description} />} label={labels.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={<TextInput onChange={(event) => { setCycleDraft({ ...cycleDraft, opensOn: event.target.value }); setCycleDrawerDirty(true) }} required type="date" value={cycleDraft.opensOn} />} label={labels.opensOn} required />
        <FormField control={<TextInput onChange={(event) => { setCycleDraft({ ...cycleDraft, closesOn: event.target.value }); setCycleDrawerDirty(true) }} required type="date" value={cycleDraft.closesOn} />} label={labels.closesOn} required />
      </div>
      <Surface className="grid gap-4 p-4" variant="subtle">
        <p className="text-sm font-semibold">{labels.itemTitle}</p>
        <FormField control={<TextInput onChange={(event) => { setCycleDraft({ ...cycleDraft, itemTitle: event.target.value }); setCycleDrawerDirty(true) }} required value={cycleDraft.itemTitle} />} label={labels.question} required />
        <FormField control={<Textarea onChange={(event) => { setCycleDraft({ ...cycleDraft, prompt: event.target.value }); setCycleDrawerDirty(true) }} required value={cycleDraft.prompt} />} label={labels.prompt} required />
        <FormField control={<TextInput max="10" min="1" onChange={(event) => { setCycleDraft({ ...cycleDraft, maxScore: event.target.value }); setCycleDrawerDirty(true) }} required type="number" value={cycleDraft.maxScore} />} label={labels.maxScore} required />
      </Surface>
    </FormDrawer> : null}

    {itemDrawer && selectedCycle ? <FormDrawer
      cancelLabel={labels.cancel}
      closeLabel={labels.cancel}
      description={selectedCycle.name}
      dirty={itemDrawerDirty}
      dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discard, keepEditingLabel: labels.keepEditing }}
      onDiscard={closeItemDrawer}
      onOpenChange={(open) => { if (!open) closeItemDrawer() }}
      onSubmit={(event) => void saveItem(event)}
      open
      saveLabel={itemDrawer.mode === 'create' ? labels.itemCreate : labels.itemEdit}
      saving={pending === `item:${itemDrawer.mode}`}
      title={labels.itemFormTitle}
    >
      <FormField control={<TextInput onChange={(event) => { setItemDraft({ ...itemDraft, title: event.target.value }); setItemDrawerDirty(true) }} required value={itemDraft.title} />} label={labels.question} required />
      <FormField control={<Textarea onChange={(event) => { setItemDraft({ ...itemDraft, prompt: event.target.value }); setItemDrawerDirty(true) }} required value={itemDraft.prompt} />} label={labels.prompt} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={<TextInput min="1" onChange={(event) => { setItemDraft({ ...itemDraft, sortOrder: event.target.value }); setItemDrawerDirty(true) }} required type="number" value={itemDraft.sortOrder} />} label={labels.sortOrder} required />
        <FormField control={<TextInput max="10" min="1" onChange={(event) => { setItemDraft({ ...itemDraft, maxScore: event.target.value }); setItemDrawerDirty(true) }} required type="number" value={itemDraft.maxScore} />} label={labels.maxScore} required />
      </div>
      <Checkbox checked={itemDraft.isRequired} label={labels.required} onChange={(event) => { setItemDraft({ ...itemDraft, isRequired: event.target.checked }); setItemDrawerDirty(true) }} />
    </FormDrawer> : null}

    <div className="grid gap-5 lg:grid-cols-[minmax(14rem,0.65fr)_minmax(0,1.35fr)]">
      <Surface className="p-3">
        <SectionHeader title={labels.cycles} />
        <div className="mt-3 space-y-2">
          {workspace.cycles.length === 0 ? <EmptyState description={labels.selectCycle} title={labels.noCycles} /> : workspace.cycles.map((cycle) => <Button aria-pressed={cycle.id === selectedCycleId} className={`h-auto w-full justify-start border p-3 text-left ${cycle.id === selectedCycleId ? 'border-primary/50 bg-primary/5' : 'border-border bg-surface'}`} key={cycle.id} onClick={() => selectCycle(cycle.id)} type="button" variant="ghost"><span className="min-w-0"><span className="block truncate font-semibold">{cycle.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{cycle.code}</span></span><Badge className="ml-auto shrink-0" tone={statusTone(cycle.status)}>{cycleStatusLabel(cycle.status, labels)}</Badge></Button>)}
        </div>
      </Surface>

      {!selectedCycle ? <EmptyState description={labels.selectCycle} title={labels.noCycles} /> : <Surface className="min-w-0 p-5">
        <SectionHeader title={selectedCycle.name} description={`${selectedCycle.code} · ${selectedCycle.opens_on} – ${selectedCycle.closes_on}`} actions={<Badge tone={statusTone(selectedCycle.status)}>{cycleStatusLabel(selectedCycle.status, labels)}</Badge>} />
        {mode === 'admin' ? <div className="mt-4 flex flex-wrap gap-2">
          {selectedCycle.status === 'DRAFT' ? <Button disabled={Boolean(pending)} loading={pending === 'cycle:OPEN'} onClick={() => requestCycleTransition('OPEN')} size="sm" type="button"><Check aria-hidden="true" />{labels.open}</Button> : null}
          {selectedCycle.status === 'OPEN' ? <Button disabled={Boolean(pending)} loading={pending === 'cycle:CLOSED'} onClick={() => requestCycleTransition('CLOSED')} size="sm" type="button" variant="secondary">{labels.close}</Button> : null}
          {selectedCycle.status !== 'ARCHIVED' ? <Button disabled={Boolean(pending)} loading={pending === 'cycle:ARCHIVED'} onClick={() => requestCycleTransition('ARCHIVED')} size="sm" type="button" variant="secondary"><Archive aria-hidden="true" />{labels.archive}</Button> : null}
        </div> : null}

        <div className="mt-6 space-y-4">
          <SectionHeader title={labels.itemTitle} actions={mode === 'admin' && selectedCycle.status === 'DRAFT' ? <Button onClick={() => openItemDrawer()} size="sm" type="button" variant="secondary"><Plus aria-hidden="true" />{labels.itemCreate}</Button> : undefined} />
          {items.length === 0 ? <EmptyState className="mt-3" description={mode === 'admin' ? labels.itemCreate : labels.noItems} title={labels.noItems} /> : <div className="mt-3 space-y-3">{items.map((item) => <Surface className="p-4" key={item.id} variant="subtle">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{item.sort_order}. {item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.prompt}</p></div>{mode === 'admin' && selectedCycle.status === 'DRAFT' ? <Button aria-label={`${labels.itemEdit}: ${item.title}`} onClick={() => openItemDrawer(item)} size="sm" type="button" variant="ghost"><Pencil aria-hidden="true" />{labels.itemEdit}</Button> : null}</div>
            {mode !== 'admin' ? <div className="mt-4 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]"><FormField control={<TextInput aria-label={`${labels.answer}: ${item.title}`} disabled={!responseEditable} max={item.max_score} min="0" onChange={(event) => updateAnswer(item.id, { score: event.target.value })} type="number" value={answers[item.id]?.score ?? ''} />} description={`${labels.maxScore}: ${item.max_score}`} label={labels.answer} required={item.is_required} /><FormField control={<Textarea aria-label={item.title} disabled={!responseEditable} onChange={(event) => updateAnswer(item.id, { answerText: event.target.value })} placeholder={labels.answer} value={answers[item.id]?.answerText ?? ''} />} label={labels.response} /></div> : null}
          </Surface>)}</div>}
        </div>

        {mode === 'manager' ? <div className="mt-6"><FormField control={<DropdownSelect aria-label={labels.participant} onChange={(event) => selectParticipant(event.target.value || null)} searchable searchPlaceholder={labels.chooseParticipant} value={selectedSubjectId ?? ''}><option value="">{labels.chooseParticipant}</option>{workspace.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.label}</option>)}</DropdownSelect>} label={labels.participant} required />{workspace.participants.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.noParticipants}</p> : null}</div> : null}

        {mode !== 'admin' ? <div className="mt-5">
          {selectedResponse?.status === 'FINALIZED' ? <p className="mb-4 rounded-[var(--radius-surface)] border border-success bg-success-surface p-3 text-sm text-success" role="status">{labels.finalizedReadOnly}</p> : null}
          {mode === 'manager' && !selectedSubjectId ? <EmptyState description={labels.noParticipants} title={labels.chooseParticipant} /> : <>
            {mode === 'manager' && selectedResponse ? <p className="mb-3 text-sm text-muted-foreground">{selectedResponse.subjectLabel ?? labels.participant}</p> : null}
            {mode === 'manager' ? <FormField control={<Textarea disabled={!responseEditable} onChange={(event) => updatePrivateNote(event.target.value)} placeholder={labels.privateNoteHint} value={privateNote} />} description={labels.privateNoteHint} label={labels.privateNote} /> : null}
            <p className="mt-4 text-xs text-muted-foreground">{labels.responseHint}</p>
            <div className="mt-4 flex flex-wrap gap-2"><Button disabled={!responseEditable || Boolean(pending)} loading={pending === 'response:DRAFT'} onClick={() => void saveResponse('DRAFT')} size="sm" type="button" variant="secondary">{labels.save}</Button><Button disabled={!responseEditable || Boolean(pending)} loading={pending === 'response:SUBMITTED'} onClick={() => void saveResponse('SUBMITTED')} size="sm" type="button"><Send aria-hidden="true" />{labels.submit}</Button></div>
            <p className="mt-3 text-xs text-muted-foreground">{labels.responseStatus}: {responseStatusLabel(selectedResponse?.status ?? 'DRAFT', labels)}</p>
          </>}
        </div> : <div className="mt-6 space-y-3">
          <SectionHeader title={labels.response} />
          {selectedCycleResponses.length === 0 ? <EmptyState className="mt-3" description={labels.readOnly} title={labels.noResponses} /> : selectedCycleResponses.map((response) => <Surface className="p-4" key={response.id} variant="subtle"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{response.subjectLabel ?? labels.participant}</p><p className="mt-1 text-xs text-muted-foreground">{response.response_type === 'SELF' ? labels.self : labels.manager} · v{response.version}</p></div><Badge tone={statusTone(response.status)}>{responseStatusLabel(response.status, labels)}</Badge></div><div className="mt-4 flex flex-wrap gap-2">{response.status === 'SUBMITTED' ? <Button disabled={Boolean(pending)} loading={pending === 'response:LOCKED'} onClick={() => void transitionResponse(response, 'LOCKED')} size="sm" type="button" variant="secondary">{labels.lock}</Button> : null}{response.status === 'LOCKED' ? <Button disabled={Boolean(pending)} loading={pending === 'response:FINALIZED'} onClick={() => void transitionResponse(response, 'FINALIZED')} size="sm" type="button"><Check aria-hidden="true" />{labels.finalize}</Button> : null}{response.status === 'SUBMITTED' ? <Button disabled={Boolean(pending)} loading={pending === 'response:DRAFT'} onClick={() => void transitionResponse(response, 'DRAFT')} size="sm" type="button" variant="secondary"><RotateCcw aria-hidden="true" />{labels.reopen}</Button> : null}</div></Surface>)}
        </div>}
      </Surface>}
    </div>
    <p className="text-xs text-muted-foreground">{labels.readOnly}</p>
    <ConfirmDialog cancelLabel={labels.keepEditing} confirmLabel={confirmRequest?.confirmLabel ?? labels.discard} description={confirmRequest?.description} destructive={confirmRequest?.destructive} onConfirm={async () => { await confirmRequest?.onConfirm() }} onOpenChange={(open) => { if (!open && !pending) setConfirmRequest(null) }} open={Boolean(confirmRequest)} pending={Boolean(pending)} title={confirmRequest?.title ?? labels.confirmTitle} />
  </section>
}

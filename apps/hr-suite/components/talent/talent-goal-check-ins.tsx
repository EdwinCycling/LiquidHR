'use client'

import { CheckCircle2, PencilLine, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import type { TalentGoalCheckIn } from '@/lib/talent/check-in-service'

type GoalMode = 'admin' | 'manager' | 'self'
type GoalStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
type EntryType = 'EMPLOYEE_REFLECTION' | 'MANAGER_OBSERVATION' | 'FOLLOW_UP'

export type CheckInLabels = {
  title: string
  add: string
  edit: string
  close: string
  open: string
  reflection: string
  observation: string
  followUp: string
  type: string
  body: string
  followUpTitle: string
  dueOn: string
  save: string
  complete: string
  empty: string
  saved: string
  failed: string
  conflict: string
  openStatus: string
  completedStatus: string
  cancelledStatus: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardKeep: string
  confirmComplete: string
}

function entryLabel(entryType: EntryType, labels: CheckInLabels): string {
  if (entryType === 'EMPLOYEE_REFLECTION') return labels.reflection
  if (entryType === 'MANAGER_OBSERVATION') return labels.observation
  return labels.followUp
}

function isEditable(mode: GoalMode, checkIn: TalentGoalCheckIn): boolean {
  if (checkIn.status !== 'OPEN') return false
  if (mode === 'admin') return true
  return mode === 'self' ? checkIn.entry_type === 'EMPLOYEE_REFLECTION' : checkIn.entry_type !== 'EMPLOYEE_REFLECTION'
}

export function TalentGoalCheckIns({ goalId, goalStatus, mode, labels }: { goalId: string; goalStatus: GoalStatus; mode: GoalMode; labels: CheckInLabels }) {
  const [open, setOpen] = useState(false)
  const [checkIns, setCheckIns] = useState<TalentGoalCheckIn[]>([])
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<TalentGoalCheckIn | null>(null)
  const [entryType, setEntryType] = useState<EntryType>(mode === 'self' ? 'EMPLOYEE_REFLECTION' : 'MANAGER_OBSERVATION')
  const [body, setBody] = useState('')
  const [followUpTitle, setFollowUpTitle] = useState('')
  const [followUpDueOn, setFollowUpDueOn] = useState('')
  const [initialForm, setInitialForm] = useState({ entryType, body: '', followUpTitle: '', followUpDueOn: '' })
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [completeCandidate, setCompleteCandidate] = useState<TalentGoalCheckIn | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const dirty = editorOpen && JSON.stringify({ entryType, body, followUpTitle, followUpDueOn }) !== JSON.stringify(initialForm)
  const canCreate = goalStatus === 'ACTIVE'

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const response = await fetch(`/api/talent/goals/${goalId}/check-ins`, { cache: 'no-store' })
      if (!response.ok) throw new Error('read')
      const payload = await response.json() as { data: TalentGoalCheckIn[] }
      setCheckIns(payload.data)
    } catch {
      setCheckIns([])
    } finally {
      setLoading(false)
    }
  }

  async function toggle(): Promise<void> {
    const next = !open
    setOpen(next)
    if (next) await load()
  }

  function resetEditor(): void {
    setEditorOpen(false)
    setEditing(null)
    setBody('')
    setFollowUpTitle('')
    setFollowUpDueOn('')
    setEntryType(mode === 'self' ? 'EMPLOYEE_REFLECTION' : 'MANAGER_OBSERVATION')
  }

  function openCreate(): void {
    const nextEntryType: EntryType = mode === 'self' ? 'EMPLOYEE_REFLECTION' : 'MANAGER_OBSERVATION'
    setEditing(null)
    setEntryType(nextEntryType)
    setBody('')
    setFollowUpTitle('')
    setFollowUpDueOn('')
    setInitialForm({ entryType: nextEntryType, body: '', followUpTitle: '', followUpDueOn: '' })
    setFeedback(null)
    setEditorOpen(true)
  }

  function openEdit(checkIn: TalentGoalCheckIn): void {
    if (!isEditable(mode, checkIn)) return
    const next: { entryType: EntryType; body: string; followUpTitle: string; followUpDueOn: string } = { entryType: checkIn.entry_type as EntryType, body: checkIn.body, followUpTitle: checkIn.follow_up_title ?? '', followUpDueOn: checkIn.follow_up_due_on ?? '' }
    setEditing(checkIn)
    setEntryType(next.entryType)
    setBody(next.body)
    setFollowUpTitle(next.followUpTitle)
    setFollowUpDueOn(next.followUpDueOn)
    setInitialForm(next)
    setFeedback(null)
    setEditorOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving || !body.trim() || (entryType === 'FOLLOW_UP' && !followUpTitle.trim())) return
    setSaving(true)
    try {
      const payload = { body, followUpTitle: entryType === 'FOLLOW_UP' ? followUpTitle : null, followUpDueOn: entryType === 'FOLLOW_UP' ? followUpDueOn || null : null }
      const response = editing
        ? await fetch(`/api/talent/goals/check-ins/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, version: editing.version }) })
        : await fetch(`/api/talent/goals/${goalId}/check-ins`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, entryType }) })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(result?.error === 'TALENT_CHECKIN_VERSION_CONFLICT' ? 'conflict' : 'save')
      }
      resetEditor()
      await load()
      setFeedback(labels.saved)
    } catch (caught) {
      setFeedback(caught instanceof Error && caught.message === 'conflict' ? labels.conflict : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function complete(): Promise<void> {
    if (!completeCandidate || pendingId) return
    setPendingId(completeCandidate.id)
    try {
      const response = await fetch(`/api/talent/goals/check-ins/${completeCandidate.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: completeCandidate.version, status: 'COMPLETED' }) })
      if (!response.ok) throw new Error('complete')
      setCompleteCandidate(null)
      await load()
    } catch {
      setFeedback(labels.failed)
    } finally {
      setPendingId(null)
    }
  }

  return <div className="mt-5 border-t border-border-subtle pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-foreground">{labels.title}</h4><Button aria-expanded={open} onClick={() => void toggle()} size="sm" type="button" variant="secondary">{labels.open}</Button></div>
    {open ? <div className="mt-4 space-y-4">
      {feedback ? <p className="border border-border-subtle bg-surface-subtle px-3 py-2 text-sm" role="status">{feedback}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground" role="status">{labels.openStatus}</p> : null}
      {!loading && checkIns.length === 0 ? <EmptyState className="px-4 py-6" title={labels.empty} /> : null}
      {checkIns.length ? <ol className="space-y-3" aria-label={labels.title}>{checkIns.map((checkIn) => <li className="border-l-2 border-border-subtle pl-3" key={checkIn.id}><div className="flex flex-wrap items-center gap-2"><Badge tone={checkIn.status === 'COMPLETED' ? 'success' : checkIn.status === 'CANCELLED' ? 'danger' : 'info'}>{checkIn.status === 'COMPLETED' ? labels.completedStatus : checkIn.status === 'CANCELLED' ? labels.cancelledStatus : labels.openStatus}</Badge><span className="text-xs font-semibold text-primary">{entryLabel(checkIn.entry_type as EntryType, labels)}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{checkIn.body}</p>{checkIn.follow_up_title ? <p className="mt-2 text-xs text-muted-foreground">{checkIn.follow_up_title}{checkIn.follow_up_due_on ? <> · <time dateTime={checkIn.follow_up_due_on}>{checkIn.follow_up_due_on}</time></> : null}</p> : null}<div className="mt-2 flex flex-wrap gap-2">{isEditable(mode, checkIn) ? <Button onClick={() => openEdit(checkIn)} size="sm" type="button" variant="ghost"><PencilLine aria-hidden="true" />{labels.edit}</Button> : null}{checkIn.status === 'OPEN' && isEditable(mode, checkIn) ? <Button onClick={() => setCompleteCandidate(checkIn)} size="sm" type="button" variant="ghost"><CheckCircle2 aria-hidden="true" />{labels.complete}</Button> : null}</div></li>)}</ol> : null}
      {canCreate ? <Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button> : null}
      <FormDrawer cancelLabel={labels.close} closeLabel={labels.close} description={labels.title} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardKeep, title: labels.discardTitle }} onDiscard={resetEditor} onOpenChange={(nextOpen) => { if (!nextOpen) resetEditor() }} onSubmit={(event) => void save(event)} open={editorOpen} saveLabel={editing ? labels.edit : labels.save} saving={saving} disabled={!body.trim() || (entryType === 'FOLLOW_UP' && !followUpTitle.trim())} title={editing ? labels.edit : labels.add}>
        <div className="grid gap-4">
          <FormField control={<DropdownSelect aria-label={labels.type} disabled={mode === 'self' || editing !== null} onChange={(event) => setEntryType(event.target.value as EntryType)} value={entryType}><option value="EMPLOYEE_REFLECTION">{labels.reflection}</option><option value="MANAGER_OBSERVATION">{labels.observation}</option><option value="FOLLOW_UP">{labels.followUp}</option></DropdownSelect>} label={labels.type} />
          <FormField control={<Textarea aria-label={labels.body} maxLength={4000} onChange={(event) => setBody(event.target.value)} required value={body} />} label={labels.body} required />
          {entryType === 'FOLLOW_UP' ? <><FormField control={<TextInput aria-label={labels.followUpTitle} maxLength={160} onChange={(event) => setFollowUpTitle(event.target.value)} required value={followUpTitle} />} label={labels.followUpTitle} required /><FormField control={<TextInput aria-label={labels.dueOn} onChange={(event) => setFollowUpDueOn(event.target.value)} type="date" value={followUpDueOn} />} label={labels.dueOn} /></> : null}
        </div>
      </FormDrawer>
      <ConfirmDialog cancelLabel={labels.close} confirmLabel={labels.confirmComplete} description={labels.confirmComplete} onConfirm={() => complete()} onOpenChange={(nextOpen) => { if (!nextOpen && !pendingId) setCompleteCandidate(null) }} open={completeCandidate !== null} pending={pendingId !== null} title={labels.confirmComplete} />
    </div> : null}
  </div>
}

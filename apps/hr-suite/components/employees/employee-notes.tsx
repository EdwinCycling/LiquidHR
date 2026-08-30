'use client'

import { FilePenLine, Pencil, Plus, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionMenu } from '@/components/ui/action-menu'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'
import type { EmployeeNote } from '@/lib/employees/employee-notes-service'

interface Labels {
  title: string
  accessNotice: string
  empty: string
  add: string
  edit: string
  remove: string
  noteTitle: string
  description: string
  author: string
  createdAt: string
  save: string
  cancel: string
  close: string
  moreActions: string
  saving: string
  failed: string
  saved: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  deleteTitle: string
  deleteDescription: string
  deleteConfirm: string
  deleteCancel: string
  improveWithAi: string
  improveWriting: string
  makeShorter: string
  makeProfessional: string
  aiWorking: string
  aiReviewTitle: string
  applyAi: string
  cancelAi: string
  aiFailed: string
}

type FormValues = { title: string; description: string }
type AiProposal = { sourceText: string; proposedText: string }

const emptyForm: FormValues = { title: '', description: '' }

export function EmployeeNotes({ employeeId, notes, canWrite, canDelete, canImproveWithAi, locale, dateFormat, timeFormat, labels }: { employeeId: string; notes: EmployeeNote[]; canWrite: boolean; canDelete: boolean; canImproveWithAi: boolean; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; labels: Labels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeNote | null>(null)
  const [formValues, setFormValues] = useState<FormValues>(emptyForm)
  const [savedValues, setSavedValues] = useState<FormValues>(emptyForm)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<EmployeeNote | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [aiPending, setAiPending] = useState(false)
  const [aiProposal, setAiProposal] = useState<AiProposal | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiGeneration = useRef(0)
  const aiRequest = useRef<{ generation: number; controller: AbortController } | null>(null)
  const formValuesRef = useRef(formValues)
  const dirty = open && JSON.stringify(formValues) !== JSON.stringify(savedValues)

  const invalidateAi = useCallback((): void => {
    aiGeneration.current += 1
    aiRequest.current?.controller.abort()
    aiRequest.current = null
    setAiPending(false)
    setAiProposal(null)
    setAiError(null)
  }, [])

  function startAdd(): void {
    invalidateAi()
    formValuesRef.current = emptyForm
    setEditing(null)
    setFormValues(emptyForm)
    setSavedValues(emptyForm)
    setFeedback(null)
    setFormError(null)
    setOpen(true)
  }

  const startEdit = useCallback((note: EmployeeNote): void => {
    invalidateAi()
    const values = { title: note.title, description: note.description }
    formValuesRef.current = values
    setEditing(note)
    setFormValues(values)
    setSavedValues(values)
    setFeedback(null)
    setFormError(null)
    setOpen(true)
  }, [invalidateAi])

  function closeForm(): void {
    if (saving) return
    invalidateAi()
    setOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function updateFormValue<Key extends keyof FormValues>(key: Key, value: FormValues[Key]): void {
    invalidateAi()
    formValuesRef.current = { ...formValuesRef.current, [key]: value }
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  function requestKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `employee-note-ai-${Date.now()}`
  }

  async function improveDescription(transformation: 'improve_writing' | 'shorten' | 'professionalize'): Promise<void> {
    if (aiPending) return
    const sourceText = formValues.description
    if (!sourceText.trim()) return
    const generation = aiGeneration.current + 1
    const controller = new AbortController()
    aiGeneration.current = generation
    aiRequest.current = { generation, controller }
    setAiPending(true)
    setAiProposal(null)
    setAiError(null)

    try {
      const response = await fetch(`/api/employees/${employeeId}/notes/improve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': requestKey() },
        body: JSON.stringify({ sourceText, transformation, locale: locale === 'en' ? 'en' : 'nl' }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('AI_IMPROVE_FAILED')
      const payload: unknown = await response.json()
      if (aiGeneration.current !== generation || formValuesRef.current.description !== sourceText) return
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('AI_IMPROVE_FAILED')
      const data = (payload as { data?: unknown }).data
      if (typeof data !== 'object' || data === null || Array.isArray(data) || typeof (data as { proposedText?: unknown }).proposedText !== 'string') throw new Error('AI_IMPROVE_FAILED')
      setAiProposal({ sourceText, proposedText: (data as { proposedText: string }).proposedText })
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return
      if (aiGeneration.current === generation && formValuesRef.current.description === sourceText) setAiError(labels.aiFailed)
    } finally {
      if (aiGeneration.current === generation) {
        aiRequest.current = null
        setAiPending(false)
      }
    }
  }

  function applyAiProposal(): void {
    if (!aiProposal || formValuesRef.current.description !== aiProposal.sourceText) {
      invalidateAi()
      return
    }
    updateFormValue('description', aiProposal.proposedText)
  }

  useEffect(() => () => {
    aiGeneration.current += 1
    aiRequest.current?.controller.abort()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFeedback(null)
    setFormError(null)

    try {
      const response = await fetch(editing ? `/api/employees/${employeeId}/notes/${editing.id}` : `/api/employees/${employeeId}/notes`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: formValues.title, description: formValues.description }),
      })
      if (!response.ok) {
        setFormError(labels.failed)
        return
      }
      setFeedback(labels.saved)
      closeForm()
      router.refresh()
    } catch {
      setFormError(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function remove(note: EmployeeNote): Promise<void> {
    if (deleting) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}/notes/${note.id}`, { method: 'DELETE' })
      if (!response.ok) {
        setFeedback(labels.failed)
        return
      }
      setFeedback(labels.saved)
      router.refresh()
    } catch {
      setFeedback(labels.failed)
    } finally {
      setDeleting(false)
      setDeleteCandidate(null)
    }
  }

  const items = useMemo(() => notes.map((note) => ({
    actions: canWrite ? <RowActions menuLabel={labels.moreActions} menuItems={canDelete ? [{ destructive: true, id: 'delete', label: labels.remove, onSelect: () => setDeleteCandidate(note) }] : []} primaryAction={<Button onClick={() => startEdit(note)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>} /> : undefined,
    id: note.id,
    primary: note.title,
    secondary: <div className="grid gap-1"><p className="whitespace-pre-wrap break-words">{note.description}</p><div className="flex flex-wrap gap-x-5 gap-y-1 text-xs"><span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={13} />{labels.author}: {note.authorName}</span><time dateTime={note.createdAt}>{labels.createdAt}: {formatDateTime(note.createdAt, { locale, dateFormat, timeFormat })}</time></div></div>,
  })), [canDelete, canWrite, dateFormat, labels, locale, notes, startEdit, timeFormat])

  return (
    <section className="mt-8 space-y-5">
      <SectionHeader actions={canWrite ? <Button className="whitespace-normal text-left" onClick={startAdd} type="button"><Plus aria-hidden="true" />{labels.add}</Button> : undefined} description={labels.accessNotice} title={labels.title} />
      {feedback ? <p className="border border-border-subtle bg-surface-subtle px-4 py-3 text-sm" role="status">{feedback}</p> : null}
      {notes.length === 0 ? <EmptyState icon={<FilePenLine />} title={labels.empty} /> : <EntityList ariaLabel={labels.title} items={items} />}
      <FormDrawer
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        description={editing ? labels.edit : labels.add}
        dirty={dirty}
        dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }}
        onDiscard={closeForm}
        onOpenChange={(nextOpen) => { if (!nextOpen) closeForm(); else setOpen(true) }}
        onSubmit={(event) => void submit(event)}
        open={open}
        saveLabel={labels.save}
        saving={saving}
        title={editing ? labels.edit : labels.add}
      >
        {formError ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{formError}</p> : null}
        <div className="grid gap-4">
          <FormField control={<TextInput name="title" onChange={(event) => updateFormValue('title', event.target.value)} required value={formValues.title} />} label={labels.noteTitle} required />
          <div className="grid gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <label className="font-medium text-foreground" htmlFor="employee-note-description">{labels.description}<span aria-hidden="true" className="ml-1 text-destructive">*</span></label>
              {canImproveWithAi ? <ActionMenu
                items={[
                  { id: 'improve-writing', label: labels.improveWriting, disabled: aiPending || !formValues.description.trim(), onSelect: () => { void improveDescription('improve_writing') } },
                  { id: 'shorten', label: labels.makeShorter, disabled: aiPending || !formValues.description.trim(), onSelect: () => { void improveDescription('shorten') } },
                  { id: 'professionalize', label: labels.makeProfessional, disabled: aiPending || !formValues.description.trim(), onSelect: () => { void improveDescription('professionalize') } },
                ]}
                label={labels.improveWithAi}
              /> : null}
            </div>
            <Textarea aria-required="true" id="employee-note-description" name="description" onChange={(event) => updateFormValue('description', event.target.value)} required value={formValues.description} />
            {aiPending ? <p className="text-xs text-muted-foreground" role="status">{labels.aiWorking}</p> : null}
            {aiError ? <p className="text-xs text-destructive" role="alert">{aiError}</p> : null}
            {aiProposal ? <Surface className="grid gap-3 p-3" variant="subtle">
              <div>
                <p className="font-medium text-foreground">{labels.aiReviewTitle}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{aiProposal.proposedText}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={applyAiProposal} type="button">{labels.applyAi}</Button>
                <Button onClick={invalidateAi} type="button" variant="ghost">{labels.cancelAi}</Button>
              </div>
            </Surface> : null}
          </div>
        </div>
      </FormDrawer>
      <ConfirmDialog
        cancelLabel={labels.deleteCancel}
        confirmLabel={labels.deleteConfirm}
        description={labels.deleteDescription}
        destructive
        onConfirm={() => deleteCandidate ? remove(deleteCandidate) : Promise.resolve()}
        onOpenChange={(nextOpen) => { if (!nextOpen && !deleting) setDeleteCandidate(null) }}
        open={deleteCandidate !== null}
        pending={deleting}
        title={labels.deleteTitle}
      />
    </section>
  )
}

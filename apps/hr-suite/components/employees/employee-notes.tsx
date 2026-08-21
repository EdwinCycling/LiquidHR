'use client'

import { FilePenLine, Pencil, Plus, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
}

type FormValues = { title: string; description: string }

const emptyForm: FormValues = { title: '', description: '' }

export function EmployeeNotes({ employeeId, notes, canWrite, canDelete, locale, dateFormat, timeFormat, labels }: { employeeId: string; notes: EmployeeNote[]; canWrite: boolean; canDelete: boolean; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; labels: Labels }) {
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
  const dirty = open && JSON.stringify(formValues) !== JSON.stringify(savedValues)

  function startAdd(): void {
    setEditing(null)
    setFormValues(emptyForm)
    setSavedValues(emptyForm)
    setFeedback(null)
    setFormError(null)
    setOpen(true)
  }

  function startEdit(note: EmployeeNote): void {
    const values = { title: note.title, description: note.description }
    setEditing(note)
    setFormValues(values)
    setSavedValues(values)
    setFeedback(null)
    setFormError(null)
    setOpen(true)
  }

  function closeForm(): void {
    if (saving) return
    setOpen(false)
    setEditing(null)
    setFormError(null)
  }

  function updateFormValue<Key extends keyof FormValues>(key: Key, value: FormValues[Key]): void {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

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
  })), [canDelete, canWrite, dateFormat, labels, locale, notes, timeFormat])

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
          <FormField control={<Textarea name="description" onChange={(event) => updateFormValue('description', event.target.value)} required value={formValues.description} />} label={labels.description} required />
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

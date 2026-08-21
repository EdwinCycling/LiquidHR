'use client'

import { FilePenLine, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
  saving: string
  failed: string
  saved: string
  confirmDelete: string
}

export function EmployeeNotes({ employeeId, notes, canWrite, canDelete, locale, dateFormat, timeFormat, labels }: { employeeId: string; notes: EmployeeNote[]; canWrite: boolean; canDelete: boolean; locale: string; dateFormat: DateFormat; timeFormat: TimeFormat; labels: Labels }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const noteId = form.dataset.noteId
    const response = await fetch(noteId ? `/api/employees/${employeeId}/notes/${noteId}` : `/api/employees/${employeeId}/notes`, {
      method: noteId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: data.get('title'), description: data.get('description') }),
    })
    if (!response.ok) { setFeedback(labels.failed); return }
    setFeedback(labels.saved); setAdding(false); setEditingId(null); router.refresh()
  }

  async function remove(noteId: string): Promise<void> {
    if (!window.confirm(labels.confirmDelete)) return
    const response = await fetch(`/api/employees/${employeeId}/notes/${noteId}`, { method: 'DELETE' })
    if (!response.ok) { setFeedback(labels.failed); return }
    setFeedback(labels.saved); router.refresh()
  }

  return (
    <section className="mt-8 space-y-5">
      <SectionHeader actions={canWrite ? <Button className="whitespace-normal text-left" onClick={() => { setAdding((value) => !value); setEditingId(null) }} type="button"><Plus aria-hidden="true" />{labels.add}</Button> : undefined} description={labels.accessNotice} title={labels.title} />
      {feedback && <p className="text-sm text-muted-foreground" role="status">{feedback}</p>}
      {notes.length === 0 ? <EmptyState icon={<FilePenLine />} title={labels.empty} /> : <ol className="space-y-3">{notes.map((note) => <li key={note.id}><Surface className="p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-semibold text-foreground">{note.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{note.description}</p></div>{canWrite && <div className="flex shrink-0 flex-wrap gap-2"><Button onClick={() => { setEditingId(editingId === note.id ? null : note.id); setAdding(false) }} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>{canDelete && <Button className="text-destructive" onClick={() => void remove(note.id)} size="sm" type="button" variant="secondary"><Trash2 aria-hidden="true" />{labels.remove}</Button>}</div>}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border-subtle pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={13} />{labels.author}: {note.authorName}</span><time dateTime={note.createdAt}>{labels.createdAt}: {formatDateTime(note.createdAt, { locale, dateFormat, timeFormat })}</time></div>{editingId === note.id && <NoteForm labels={labels} note={note} noteId={note.id} onCancel={() => setEditingId(null)} onSubmit={submit} />}</Surface></li>)}</ol>}
      {adding && <NoteForm labels={labels} onCancel={() => setAdding(false)} onSubmit={submit} />}
    </section>
  )
}

function NoteForm({ note, noteId, labels, onCancel, onSubmit }: { note?: EmployeeNote; noteId?: string; labels: Labels; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Surface className="mt-5 p-4" variant="subtle"><form className="grid gap-4" data-note-id={noteId} onSubmit={onSubmit}><FormField control={<TextInput autoFocus={!note} defaultValue={note?.title ?? ''} maxLength={160} name="title" required />} label={labels.noteTitle} required /><FormField control={<Textarea defaultValue={note?.description ?? ''} maxLength={4000} name="description" required />} label={labels.description} required /><div className="flex flex-wrap gap-2"><Button type="submit"><FilePenLine aria-hidden="true" />{labels.save}</Button><Button onClick={onCancel} type="button" variant="secondary">{labels.cancel}</Button></div></form></Surface>
}

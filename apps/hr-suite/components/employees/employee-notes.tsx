'use client'

import { FilePenLine, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import type { EmployeeNote } from '@/lib/employees/employee-notes-service'
import { formatDateTime } from '@/lib/preferences/formatters'
import type { DateFormat, TimeFormat } from '@/lib/preferences/user-preferences'

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

  return <section className="mt-8 rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5"><div><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"><FilePenLine aria-hidden="true" size={18} /></span><h2 className="text-xl font-semibold">{labels.title}</h2></div><p className="mt-3 text-sm font-medium text-muted-foreground">{labels.accessNotice}</p></div>{canWrite && <button type="button" className="button-primary inline-flex items-center gap-2" onClick={() => { setAdding((value) => !value); setEditingId(null) }}><Plus aria-hidden="true" size={16} />{labels.add}</button>}</header>
    {feedback && <p className="mt-4 text-sm text-muted-foreground" role="status">{feedback}</p>}
    {notes.length === 0 ? <p className="mt-6 rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">{labels.empty}</p> : <ol className="mt-6 space-y-3">{notes.map((note) => <li key={note.id} className="rounded-xl border bg-background p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{note.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{note.description}</p></div>{canWrite && <div className="flex shrink-0 gap-2"><button type="button" className="button-secondary inline-flex items-center gap-1.5" onClick={() => { setEditingId(editingId === note.id ? null : note.id); setAdding(false) }}><Pencil aria-hidden="true" size={14} />{labels.edit}</button>{canDelete && <button type="button" className="button-secondary inline-flex items-center gap-1.5 text-destructive" onClick={() => void remove(note.id)}><Trash2 aria-hidden="true" size={14} />{labels.remove}</button>}</div>}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" size={13} />{labels.author}: {note.authorName}</span><time dateTime={note.createdAt}>{labels.createdAt}: {formatDateTime(note.createdAt, { locale, dateFormat, timeFormat })}</time></div>{editingId === note.id && <NoteForm note={note} noteId={note.id} labels={labels} onCancel={() => setEditingId(null)} onSubmit={submit} />}</li>)}</ol>}
    {adding && <NoteForm labels={labels} onCancel={() => setAdding(false)} onSubmit={submit} />}
  </section>
}

function NoteForm({ note, noteId, labels, onCancel, onSubmit }: { note?: EmployeeNote; noteId?: string; labels: Labels; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="mt-5 grid gap-3 rounded-xl border bg-muted/35 p-4" data-note-id={noteId} onSubmit={onSubmit}><label className="grid gap-1 text-sm font-medium">{labels.noteTitle}<input className="form-field" name="title" defaultValue={note?.title ?? ''} maxLength={160} required autoFocus={!note} /></label><label className="grid gap-1 text-sm font-medium">{labels.description}<textarea className="form-field min-h-28" name="description" defaultValue={note?.description ?? ''} maxLength={4000} required /></label><div className="flex flex-wrap gap-2"><button className="button-primary inline-flex items-center gap-2" type="submit"><FilePenLine aria-hidden="true" size={15} />{labels.save}</button><button className="button-secondary" type="button" onClick={onCancel}>{labels.cancel}</button></div></form>
}

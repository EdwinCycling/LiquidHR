'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import type { PersonalLogbookEntry } from '@/lib/logbook/service'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'

export type LogbookPageLabels = {
  title: string
  description: string
  newEntry: string
  editEntry: string
  titleLabel: string
  descriptionLabel: string
  save: string
  saving: string
  cancel: string
  close: string
  delete: string
  deleteTitle: string
  deleteDescription: string
  confirmDelete: string
  empty: string
  sourceManual: string
  sourceAi: string
  createdAt: string
  context: string
  saved: string
  failed: string
  deleted: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  backToStart: string
}

type Draft = { id: string | null; title: string; description: string }

function entryFromResponse(value: unknown): PersonalLogbookEntry | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string' || typeof candidate.description !== 'string') return null
  if (candidate.source !== 'MANUAL' && candidate.source !== 'AI_TEAM_SUMMARY') return null
  if (typeof candidate.createdAt !== 'string' || typeof candidate.updatedAt !== 'string') return null
  return {
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    source: candidate.source,
    sourceSessionId: typeof candidate.sourceSessionId === 'string' ? candidate.sourceSessionId : null,
    contextName: typeof candidate.contextName === 'string' ? candidate.contextName : null,
    contextDepartmentId: typeof candidate.contextDepartmentId === 'string' ? candidate.contextDepartmentId : null,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  }
}

export function LogbookPage({ canDelete, canWrite, initial, initialOpen = false, labels, locale }: { canDelete: boolean; canWrite: boolean; initial: PersonalLogbookEntry[]; initialOpen?: boolean; labels: LogbookPageLabels; locale: Locale }) {
  const [entries, setEntries] = useState(initial)
  const [draft, setDraft] = useState<Draft | null>(() => initialOpen ? { id: null, title: '', description: '' } : null)
  const [deleteTarget, setDeleteTarget] = useState<PersonalLogbookEntry | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [originalDraft, setOriginalDraft] = useState<Draft | null>(() => initialOpen ? { id: null, title: '', description: '' } : null)

  function openCreate(): void {
    const next = { id: null, title: '', description: '' }
    setOriginalDraft(next)
    setDraft(next)
    setMessage('')
  }

  function openEdit(entry: PersonalLogbookEntry): void {
    const next = { id: entry.id, title: entry.title, description: entry.description }
    setOriginalDraft(next)
    setDraft(next)
    setMessage('')
  }

  function closeEditor(): void {
    setDraft(null)
    setOriginalDraft(null)
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!draft) return
    setPending(true)
    setMessage('')
    let response: Response
    try {
      response = await fetch(draft.id ? `/api/logbook/${draft.id}` : '/api/logbook', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.title, description: draft.description }),
      })
    } catch {
      setMessage(labels.failed)
      setPending(false)
      return
    }
    if (!response.ok) {
      setMessage(labels.failed)
      setPending(false)
      return
    }
    const payload: unknown = await response.json().catch(() => null)
    const entry = entryFromResponse(payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : null)
    if (entry) setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)])
    setMessage(labels.saved)
    setPending(false)
    closeEditor()
  }

  async function remove(): Promise<void> {
    if (!deleteTarget) return
    setPending(true)
    let response: Response
    try {
      response = await fetch(`/api/logbook/${deleteTarget.id}`, { method: 'DELETE' })
    } catch {
      setMessage(labels.failed)
      setPending(false)
      setDeleteTarget(null)
      return
    }
    if (!response.ok) {
      setMessage(labels.failed)
    } else {
      setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id))
      setMessage(labels.deleted)
    }
    setPending(false)
    setDeleteTarget(null)
  }

  const dirty = draft !== null && originalDraft !== null && JSON.stringify(draft) !== JSON.stringify(originalDraft)
  const formatter = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

  return <PageShell className="space-y-6 py-8" width="reading">
    <PageHeader actions={canWrite ? <Button onClick={openCreate} type="button"><Plus aria-hidden="true" />{labels.newEntry}</Button> : undefined} description={labels.description} title={labels.title} />
    <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/dashboard/start"><BookOpen aria-hidden="true" />{labels.backToStart}</Link>
    {message ? <p aria-live="polite" className="border border-border-subtle bg-surface-subtle px-4 py-3 text-sm">{message}</p> : null}
    <section aria-label={labels.title} className="space-y-3">
      {entries.map((entry) => <Surface className="p-5" key={entry.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-semibold">{entry.title}</h2><p className="mt-1 text-xs text-muted-foreground">{labels.createdAt}: {formatter.format(new Date(entry.createdAt))}{entry.contextName ? ` · ${labels.context}: ${entry.contextName}` : ''}</p></div>
          <Badge tone={entry.source === 'AI_TEAM_SUMMARY' ? 'info' : 'neutral'}>{entry.source === 'AI_TEAM_SUMMARY' ? labels.sourceAi : labels.sourceManual}</Badge>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.description}</p>
        {canWrite || canDelete ? <div className="mt-4 flex flex-wrap gap-2">
          {canWrite ? <Button onClick={() => openEdit(entry)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.editEntry}</Button> : null}
          {canDelete ? <Button onClick={() => setDeleteTarget(entry)} size="sm" type="button" variant="ghost"><Trash2 aria-hidden="true" />{labels.delete}</Button> : null}
        </div> : null}
      </Surface>)}
      {entries.length === 0 ? <Surface className="border-dashed p-10 text-center text-sm text-muted-foreground" variant="subtle">{labels.empty}</Surface> : null}
    </section>
    {draft ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} dirty={dirty} dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel }} onDiscard={closeEditor} onOpenChange={(open) => { if (!open && !dirty) closeEditor() }} onSubmit={(event) => void save(event)} open saveLabel={pending ? labels.saving : labels.save} saving={pending} title={draft.id ? labels.editEntry : labels.newEntry}>
      <FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)} required value={draft.title} />} label={labels.titleLabel} required />
      <FormField control={<Textarea className="min-h-40" maxLength={4000} onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)} required value={draft.description} />} label={labels.descriptionLabel} required />
    </FormDrawer> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.confirmDelete} description={labels.deleteDescription} destructive onConfirm={() => void remove()} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} open={deleteTarget !== null} pending={pending} title={labels.deleteTitle} />
  </PageShell>
}

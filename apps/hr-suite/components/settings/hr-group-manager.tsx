'use client'

import { Pencil, Plus, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import type { AdministrationContextOption, HrGroupContextOption } from '@/lib/context/administration-context'

interface HrGroupManagerLabels {
  title: string
  subtitle: string
  groupCode: string
  groupName: string
  groupDescription: string
  saveGroup: string
  saved: string
  addAdministration: string
  editAdministration: string
  administrations: string
  administrationCode: string
  administrationName: string
  administrationNumber: string
  saveAdministration: string
  cancel: string
  close: string
  search: string
  searchPlaceholder: string
  empty: string
  failed: string
  invalid: string
  duplicate: string
}

export function HrGroupManager({
  activeGroup,
  canWrite,
  labels,
}: {
  activeGroup: HrGroupContextOption
  canWrite: boolean
  labels: HrGroupManagerLabels
}) {
  const router = useRouter()
  const [groupName, setGroupName] = useState(activeGroup.name)
  const [groupDescription, setGroupDescription] = useState(activeGroup.description ?? '')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAdministrationId, setEditingAdministrationId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', name: '', administrationNumber: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const administrations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return activeGroup.administrations
      .filter((administration) => `${administration.code} ${administration.name}`.toLocaleLowerCase().includes(normalized))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [activeGroup.administrations, query])

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSaved(false)
    try {
      const response = await fetch('/api/hr-groups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: groupName, description: groupDescription }),
      })
      if (!response.ok) throw new Error(labels.failed)
      setSaved(true)
      router.refresh()
    } catch {
      setError(labels.failed)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveAdministration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch(editingAdministrationId ? `/api/hr-groups/administrations/${editingAdministrationId}` : '/api/hr-groups', {
        method: editingAdministrationId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editingAdministrationId
          ? { name: form.name, administrationNumber: form.administrationNumber }
          : form),
      })
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null)
        const code = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string' ? result.error : ''
        throw new Error(code === 'ADMINISTRATION_ALREADY_EXISTS' ? labels.duplicate : labels.failed)
      }
      setModalOpen(false)
      setEditingAdministrationId(null)
      setForm({ code: '', name: '', administrationNumber: '' })
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : labels.failed)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{labels.title}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{activeGroup.name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.subtitle}</p>
      </header>

      <form className="mt-7 rounded-2xl border bg-surface p-5 shadow-sm" onSubmit={(event) => void saveGroup(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">{labels.groupCode}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-sm" disabled value={activeGroup.code} /></label>
          <label className="text-sm font-medium">{labels.groupName}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-sm" disabled={!canWrite} onChange={(event) => setGroupName(event.target.value)} value={groupName} /></label>
          <label className="text-sm font-medium sm:col-span-2">{labels.groupDescription}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm" disabled={!canWrite} onChange={(event) => setGroupDescription(event.target.value)} value={groupDescription} /></label>
        </div>
        {canWrite ? <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSaving} type="submit"><Pencil size={16} />{labels.saveGroup}</button> : null}
        {saved ? <p className="mt-3 text-sm text-success" role="status">{labels.saved}</p> : null}
        {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
      </form>

      <section className="mt-7 rounded-2xl border bg-surface p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><h2 className="text-xl font-semibold">{labels.administrations}</h2><p className="mt-1 text-sm text-muted-foreground">{activeGroup.administrations.length}</p></div>
          {canWrite ? <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" onClick={() => { setError(null); setEditingAdministrationId(null); setForm({ code: '', name: '', administrationNumber: '' }); setModalOpen(true) }} type="button"><Plus size={16} />{labels.addAdministration}</button> : null}
        </div>
        <label className="relative mt-5 block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">{labels.search}</span><input className="h-11 w-full rounded-xl border border-border bg-surface-raised pl-9 pr-3 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} value={query} /></label>
        <div className="mt-4 divide-y divide-border">{administrations.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{labels.empty}</p> : administrations.map((administration) => <AdministrationRow administration={administration} canWrite={canWrite} editLabel={labels.editAdministration} onEdit={() => { setError(null); setEditingAdministrationId(administration.id); setForm({ code: administration.code, name: administration.name, administrationNumber: administration.administrationNumber ?? administration.code }); setModalOpen(true) }} key={administration.id} />)}</div>
      </section>

      {modalOpen ? <div aria-hidden="true" className="fixed inset-0 z-[70] bg-foreground/40" onClick={() => setModalOpen(false)} /> : null}
      {modalOpen ? <div aria-labelledby="new-administration-title" aria-modal="true" className="fixed inset-x-4 top-1/2 z-[80] mx-auto max-w-lg -translate-y-1/2 rounded-2xl border bg-surface p-6 shadow-2xl" role="dialog">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold" id="new-administration-title">{editingAdministrationId ? labels.editAdministration : labels.addAdministration}</h2><p className="mt-1 text-sm text-muted-foreground">{activeGroup.name}</p></div><button aria-label={labels.close} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" onClick={() => { setModalOpen(false); setEditingAdministrationId(null) }} type="button"><X size={18} /></button></div>
        <form className="mt-5 space-y-4" onSubmit={(event) => void saveAdministration(event)}><label className="block text-sm font-medium">{labels.administrationCode}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-sm" disabled={editingAdministrationId !== null} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} required value={form.code} /></label><label className="block text-sm font-medium">{labels.administrationName}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></label><label className="block text-sm font-medium">{labels.administrationNumber}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-surface-raised px-3 text-sm" onChange={(event) => setForm((current) => ({ ...current, administrationNumber: event.target.value }))} required value={form.administrationNumber} /></label>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}<div className="flex justify-end gap-3 pt-2"><button className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold" onClick={() => { setModalOpen(false); setEditingAdministrationId(null) }} type="button">{labels.cancel}</button><button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSaving} type="submit">{labels.saveAdministration}</button></div></form>
      </div> : null}
    </section>
  )
}

function AdministrationRow({ administration, canWrite, editLabel, onEdit }: { administration: AdministrationContextOption; canWrite: boolean; editLabel: string; onEdit: () => void }) {
  return <article className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{administration.name}</p><p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{administration.code}</p><p className="mt-1 text-sm text-muted-foreground">{administration.administrationNumber ?? administration.code}</p></div><div className="flex items-center gap-3"><p className="text-xs text-muted-foreground">{administration.id}</p>{canWrite ? <button aria-label={`${editLabel}: ${administration.name}`} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted" onClick={onEdit} type="button"><Pencil size={16} /></button> : null}</div></article>
}

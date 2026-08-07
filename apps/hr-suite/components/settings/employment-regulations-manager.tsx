'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { GitBranch, Pencil, Plus } from 'lucide-react'
import type { EmploymentRegulationTimeline, EmploymentRegulationVersion } from '@/lib/employment/employment-regulation-model'

type Labels = {
  search: string
  addRegulation: string
  addSuccessor: string
  edit: string
  save: string
  cancel: string
  name: string
  validFrom: string
  standardHours: string
  successor: string
  successors: string
  current: string
  historical: string
  validUntil: string
  empty: string
  failed: string
  description: string
  newTitle: string
  editTitle: string
  successorTitle: string
  continuityHint: string
}

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; version: EmploymentRegulationVersion; nextVersion?: EmploymentRegulationVersion }
  | { mode: 'successor'; predecessor: EmploymentRegulationVersion }

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function RegulationDialog({ state, labels, onCancel, onSave }: { state: DialogState; labels: Labels; onCancel: () => void; onSave: (input: { name: string; validFrom: string; standardHoursPerWeek: number }) => Promise<void> }) {
  const initial = state.mode === 'create' ? { name: '', validFrom: '', standardHoursPerWeek: '40' } : state.mode === 'edit' ? { name: state.version.name, validFrom: state.version.validFrom, standardHoursPerWeek: String(state.version.standardHoursPerWeek) } : { name: state.predecessor.name, validFrom: '', standardHoursPerWeek: String(state.predecessor.standardHoursPerWeek) }
  const [name, setName] = useState(initial.name)
  const [validFrom, setValidFrom] = useState(initial.validFrom)
  const [standardHours, setStandardHours] = useState(initial.standardHoursPerWeek)
  const [saving, setSaving] = useState(false)
  const minDate = state.mode === 'successor' ? addDays(state.predecessor.validFrom, 1) : undefined
  const maxDate = state.mode === 'edit' && state.nextVersion ? addDays(state.nextVersion.validFrom, -1) : undefined
  const title = state.mode === 'create' ? labels.newTitle : state.mode === 'edit' ? labels.editTitle : labels.successorTitle
  const validDate = Boolean(validFrom) && (!minDate || validFrom >= minDate) && (!maxDate || validFrom <= maxDate)
  const canSave = name.trim().length > 0 && validDate && Number(standardHours) > 0 && Number(standardHours) <= 60
  async function save(): Promise<void> {
    if (!canSave) return
    setSaving(true)
    await onSave({ name: name.trim(), validFrom, standardHoursPerWeek: Number(standardHours) })
    setSaving(false)
  }
  return <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" role="dialog">
    <div className="w-full max-w-lg rounded-2xl border bg-background p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><span className="text-xs text-muted-foreground">{state.mode === 'successor' ? labels.successor : labels.validFrom}</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">{labels.name}<input autoFocus className="form-field" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-medium">{labels.validFrom}<input className="form-field" type="date" min={minDate} max={maxDate} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label>
        <label className="grid gap-1 text-sm font-medium">{labels.standardHours}<input className="form-field" type="number" min="0.01" max="60" step="0.01" value={standardHours} onChange={(event) => setStandardHours(event.target.value)} /></label>
      </div>
      <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{labels.continuityHint}</p>
      <div className="mt-6 flex justify-end gap-3 border-t pt-4"><button type="button" className="button-secondary" disabled={saving} onClick={onCancel}>{labels.cancel}</button><button type="button" className="button-primary" disabled={saving || !canSave} onClick={() => void save()}>{labels.save}</button></div>
    </div>
  </div>
}

export function EmploymentRegulationsManager({ timelines, labels }: { timelines: EmploymentRegulationTimeline[]; labels: Labels }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [failed, setFailed] = useState(false)
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? timelines.filter((timeline) => `${timeline.code} ${timeline.name} ${timeline.versions.map((version) => version.name).join(' ')}`.toLowerCase().includes(query)) : timelines
  }, [search, timelines])
  async function request(body: Record<string, unknown>): Promise<boolean> {
    const response = await fetch('/api/settings/employment-contracts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setFailed(!response.ok)
    if (response.ok) { setDialog(null); router.refresh() }
    return response.ok
  }
  async function save(input: { name: string; validFrom: string; standardHoursPerWeek: number }): Promise<void> {
    if (!dialog) return
    if (dialog.mode === 'create') await request({ action: 'REGULATION_CREATE', ...input })
    else if (dialog.mode === 'edit') await request({ action: 'REGULATION_UPDATE', id: dialog.version.id, ...input })
    else await request({ action: 'REGULATION_SUCCESSOR', predecessorId: dialog.predecessor.id, ...input })
  }
  return <div>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{labels.description}</p></div><button type="button" className="button-primary inline-flex items-center justify-center gap-2" onClick={() => { setFailed(false); setDialog({ mode: 'create' }) }}><Plus size={17} />{labels.addRegulation}</button></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><input aria-label={labels.search} className="form-field max-w-sm" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} />{failed && <p role="alert" className="text-sm text-destructive">{labels.failed}</p>}</div>
    <div className="mt-4 grid gap-4">{filtered.length === 0 ? <p className="rounded-2xl border p-6 text-sm text-muted-foreground">{labels.empty}</p> : filtered.map((timeline) => <section className="rounded-2xl border bg-surface p-5" key={timeline.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{timeline.code}</p><h3 className="mt-1 text-lg font-semibold">{timeline.name}</h3></div><span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"><GitBranch size={14} />{timeline.versions.length - 1} {labels.successors}</span></div>
      <div className="mt-5 space-y-3 border-l-2 border-primary/20 pl-4">{timeline.versions.map((version, index) => {
        const nextVersion = timeline.versions[index + 1]
        return <div className="relative rounded-xl border bg-background p-4" key={version.id}>
          <span className="absolute -left-[1.45rem] top-5 size-3 rounded-full border-2 border-background bg-primary" />
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{index === 0 ? labels.validFrom : labels.successor}: {version.validFrom}</p><p className="mt-1 font-semibold">{version.name}</p></div><button type="button" className="button-secondary inline-flex items-center gap-2" onClick={() => { setFailed(false); setDialog({ mode: 'edit', version, nextVersion }) }}><Pencil size={15} />{labels.edit}</button></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{labels.standardHours}: {version.standardHoursPerWeek}</span>{nextVersion ? <span>{labels.validUntil}: {addDays(nextVersion.validFrom, -1)}</span> : <span className="font-medium text-success">{labels.current}</span>}{!version.isActive && <span>{labels.historical}</span>}</div>
          {!nextVersion && <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" onClick={() => { setFailed(false); setDialog({ mode: 'successor', predecessor: version }) }}><Plus size={15} />{labels.addSuccessor}</button>}
        </div>
      })}</div>
    </section>)}</div>
    {dialog && <RegulationDialog state={dialog} labels={labels} onCancel={() => setDialog(null)} onSave={save} />}
  </div>
}

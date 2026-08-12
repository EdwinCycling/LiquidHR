'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Plus, Route, Search, X } from 'lucide-react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { JourneyTemplateDraft } from '@/lib/journeys'
import type { JourneyLabels } from '@/lib/journeys/labels'

export interface TemplateCatalogRow {
  readonly id: string
  readonly key: string
  readonly name: string
  readonly description: string
  readonly journeyType: JourneyTemplateDraft['journeyType']
  readonly lifecycle: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  readonly draftRevision: number
  readonly publishedVersionNumber: number | null
  readonly updatedAt: string
}

function newDraft(nameNl: string, nameEn: string, journeyType: JourneyTemplateDraft['journeyType']): JourneyTemplateDraft {
  return {
    name: { nl: nameNl, en: nameEn }, description: { nl: nameNl, en: nameEn }, journeyType,
    anchorRule: 'EMPLOYMENT_START_DATE',
    phases: [{ key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10 }],
    roles: [
      { key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 },
      { key: 'manager', name: { nl: 'Manager', en: 'Manager' }, required: true, cardinality: 'ONE', resolverType: 'DIRECT_MANAGER', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 20 },
    ],
    moments: [{ key: 'welcome', phaseKey: 'start', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: 0, availabilityOffsetDays: 0, sortOrder: 10 }],
    topics: [{ key: 'welcome', momentKey: 'welcome', ownerRoleKey: 'manager', topicType: 'INFORMATION', title: { nl: 'Welkom', en: 'Welcome' }, body: { nl: 'Welkom bij de organisatie.', en: 'Welcome to the organisation.' }, actionUrl: null, required: true, sortOrder: 10, audienceRoleKeys: ['employee', 'manager'] }],
  }
}

export function TemplateCatalog({ items, labels, canWrite, locale }: { items: readonly TemplateCatalogRow[]; labels: JourneyLabels; canWrite: boolean; locale: 'nl' | 'en' }) {
  const router = useRouter()
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB'), [locale])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [form, setForm] = useState({ key: '', nameNl: '', nameEn: '', journeyType: 'ONBOARDING' as JourneyTemplateDraft['journeyType'] })
  const visible = useMemo(() => items.filter((item) => `${item.name} ${item.description} ${item.key}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [items, query])
  async function create() {
    setState('saving')
    const response = await fetch('/api/journeys/templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: form.key, draft: newDraft(form.nameNl, form.nameEn, form.journeyType) }) })
    const payload = await response.json() as { data?: { id: string } }
    if (!response.ok || !payload.data) { setState('failed'); return }
    router.push(`/settings/journeys/templates/${payload.data.id}`)
    router.refresh()
  }
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <label className="relative min-w-64 flex-1 max-w-xl"><span className="sr-only">{labels.search}</span><Search className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={17} /><input className="form-field w-full pl-10" onChange={(event) => setQuery(event.target.value)} placeholder={labels.search} value={query} /></label>
      {canWrite ? <button className="button-primary inline-flex items-center gap-2" onClick={() => setOpen(true)} type="button"><Plus size={16} />{labels.newTemplate}</button> : null}
    </div>
    <div className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
      {visible.length === 0 ? <p className="p-8 text-sm text-muted-foreground">{labels.noTemplates}</p> : <div className="divide-y">{visible.map((item) => <Link className="grid gap-3 p-5 transition hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_10rem_8rem] sm:items-center" href={`/settings/journeys/templates/${item.id}`} key={item.id}><span className="min-w-0"><span className="flex items-center gap-2 font-semibold"><Route className="text-primary" size={17} />{item.name}</span><span className="mt-1 block truncate text-sm text-muted-foreground">{item.description}</span><span className="mt-2 block font-mono text-xs text-muted-foreground">{item.key}</span></span><span className="text-sm"><span className="block font-medium">{labels.types[item.journeyType]}</span><span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(item.updatedAt))}</span></span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${item.lifecycle === 'PUBLISHED' ? 'bg-success/10 text-success' : item.lifecycle === 'RETIRED' ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'}`}>{item.lifecycle === 'PUBLISHED' ? `${labels.published} v${item.publishedVersionNumber}` : item.lifecycle === 'RETIRED' ? labels.retired : labels.draft}</span></Link>)}</div>}
    </div>
    {open ? <div className="fixed inset-0 z-[80] grid place-items-center bg-sidebar/60 p-4" role="presentation"><section aria-labelledby="journey-create-title" aria-modal="true" className="w-full max-w-2xl rounded-2xl border bg-surface p-6 shadow-2xl" role="dialog"><header className="flex items-start justify-between"><div><p className="eyebrow">{labels.eyebrow}</p><h2 className="mt-1 text-xl font-semibold" id="journey-create-title">{labels.newTemplate}</h2></div><button aria-label={labels.cancel} className="button-secondary px-3" onClick={() => setOpen(false)} type="button"><X size={17} /></button></header><form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void create() }}><label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{labels.key}<input autoFocus className="form-field font-mono" pattern="[a-z][a-z0-9_-]*" required onChange={(event) => setForm({ ...form, key: event.target.value })} value={form.key} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.name} · {labels.nl}<input className="form-field" required onChange={(event) => setForm({ ...form, nameNl: event.target.value })} value={form.nameNl} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.name} · {labels.en}<input className="form-field" required onChange={(event) => setForm({ ...form, nameEn: event.target.value })} value={form.nameEn} /></label><label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{labels.type}<DropdownSelect searchable className="form-field" onChange={(event) => setForm({ ...form, journeyType: event.target.value as JourneyTemplateDraft['journeyType'] })} value={form.journeyType}>{Object.entries(labels.types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DropdownSelect></label><div className="flex justify-end gap-2 border-t pt-5 sm:col-span-2"><button className="button-secondary" onClick={() => setOpen(false)} type="button">{labels.cancel}</button><button className="button-primary inline-flex items-center gap-2" disabled={state === 'saving'} type="submit">{state === 'saving' ? <LoaderCircle className="animate-spin" size={16} /> : null}{labels.create}</button></div>{state === 'failed' ? <p className="text-sm text-destructive sm:col-span-2" role="alert">{labels.failed}</p> : null}</form></section></div> : null}
  </div>
}

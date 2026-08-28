'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { GitBranch, Pencil, Plus } from 'lucide-react'
import type { EmploymentRegulationTimeline, EmploymentRegulationVersion } from '@/lib/employment/employment-regulation-model'
import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { CaoSalaryStructuresSection } from './cao-salary-structures-section'

type Labels = {
  search: string; addRegulation: string; addSuccessor: string; edit: string; save: string; cancel: string; name: string; validFrom: string; standardHours: string; successor: string; successors: string; current: string; historical: string; validUntil: string; empty: string; failed: string; description: string; newTitle: string; editTitle: string; successorTitle: string; continuityHint: string; probationMaximum: string; probationOneMonth: string; probationTwoMonths: string
  salaryStructures: { sectionTitle: string; description: string; scalesAndSteps: string; salaryBands: string; linked: string; noActiveRevision: string; save: string; cancel: string; unsaved: string; saving: string; saved: string; failed: string; readOnly: string }
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

function RegulationDrawer({ state, labels, onCancel, onSave }: { state: DialogState; labels: Labels; onCancel: () => void; onSave: (input: { name: string; validFrom: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }) => Promise<void> }) {
  const initial = state.mode === 'create' ? { name: '', validFrom: '', standardHoursPerWeek: '40', probationMaximumMonths: '1' } : state.mode === 'edit' ? { name: state.version.name, validFrom: state.version.validFrom, standardHoursPerWeek: String(state.version.standardHoursPerWeek), probationMaximumMonths: String(state.version.probationMaximumMonths) } : { name: state.predecessor.name, validFrom: '', standardHoursPerWeek: String(state.predecessor.standardHoursPerWeek), probationMaximumMonths: String(state.predecessor.probationMaximumMonths) }
  const [name, setName] = useState(initial.name)
  const [validFrom, setValidFrom] = useState(initial.validFrom)
  const [standardHours, setStandardHours] = useState(initial.standardHoursPerWeek)
  const [probationMaximumMonths, setProbationMaximumMonths] = useState(initial.probationMaximumMonths)
  const [saving, setSaving] = useState(false)
  const minDate = state.mode === 'successor' ? addDays(state.predecessor.validFrom, 1) : undefined
  const maxDate = state.mode === 'edit' && state.nextVersion ? addDays(state.nextVersion.validFrom, -1) : undefined
  const title = state.mode === 'create' ? labels.newTitle : state.mode === 'edit' ? labels.editTitle : labels.successorTitle
  const validDate = Boolean(validFrom) && (!minDate || validFrom >= minDate) && (!maxDate || validFrom <= maxDate)
  const canSave = name.trim().length > 0 && validDate && Number(standardHours) > 0 && Number(standardHours) <= 60 && (probationMaximumMonths === '1' || probationMaximumMonths === '2')
  const dirty = JSON.stringify({ name, validFrom, standardHours, probationMaximumMonths }) !== JSON.stringify(initial)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    await onSave({ name: name.trim(), validFrom, standardHoursPerWeek: Number(standardHours), probationMaximumMonths: probationMaximumMonths === '2' ? 2 : 1 })
    setSaving(false)
  }

  return <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.continuityHint} dirty={dirty} dirtyProtection={{ description: labels.continuityHint, discardLabel: labels.cancel, keepEditingLabel: labels.edit, title: labels.cancel }} onDiscard={onCancel} onOpenChange={(open) => { if (!open && !dirty) onCancel() }} onSubmit={(event) => void submit(event)} open saveLabel={labels.save} saving={saving} title={title}><FormField control={<TextInput autoFocus maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} />} label={labels.name} required /><FormField control={<TextInput max={maxDate} min={minDate} onChange={(event) => setValidFrom(event.target.value)} required type="date" value={validFrom} />} label={labels.validFrom} required /><FormField control={<TextInput max="60" min="0.01" onChange={(event) => setStandardHours(event.target.value)} required step="0.01" type="number" value={standardHours} />} label={labels.standardHours} required /><FormField control={<DropdownSelect aria-label={labels.probationMaximum} onChange={(event) => setProbationMaximumMonths(event.target.value)} value={probationMaximumMonths}><option value="1">{labels.probationOneMonth}</option><option value="2">{labels.probationTwoMonths}</option></DropdownSelect>} label={labels.probationMaximum} required /><p className="rounded-[var(--radius-control)] bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">{labels.continuityHint}</p>{!canSave && (name || validFrom || standardHours !== initial.standardHoursPerWeek) ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}</FormDrawer>
}

export function EmploymentRegulationsManager({ timelines, labels, salaryStructureCatalog, locale }: { timelines: EmploymentRegulationTimeline[]; labels: Labels; salaryStructureCatalog: SalaryStructureCatalog | null; locale: 'nl' | 'en' }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [failed, setFailed] = useState(false)
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? timelines.filter((timeline) => `${timeline.code} ${timeline.name} ${timeline.versions.map((version) => version.name).join(' ')}`.toLowerCase().includes(query)) : timelines }, [search, timelines])

  async function request(body: Record<string, unknown>): Promise<boolean> {
    const response = await fetch('/api/settings/employment-contracts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setFailed(!response.ok)
    if (response.ok) { setDialog(null); router.refresh() }
    return response.ok
  }

  async function save(input: { name: string; validFrom: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }): Promise<void> {
    if (!dialog) return
    if (dialog.mode === 'create') await request({ action: 'REGULATION_CREATE', ...input })
    else if (dialog.mode === 'edit') await request({ action: 'REGULATION_UPDATE', id: dialog.version.id, ...input })
    else await request({ action: 'REGULATION_SUCCESSOR', predecessorId: dialog.predecessor.id, ...input })
  }

  return <div className="space-y-5"><Surface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold">{labels.description}</p><Button onClick={() => { setFailed(false); setDialog({ mode: 'create' }) }} size="sm" type="button"><Plus aria-hidden="true" />{labels.addRegulation}</Button></Surface><CollectionToolbar search={<TextInput aria-label={labels.search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} type="search" value={search} />} />{failed ? <p role="alert" className="text-sm text-destructive">{labels.failed}</p> : null}{filtered.length === 0 ? <EmptyState title={labels.empty} /> : <div className="grid gap-4">{filtered.map((timeline) => <Surface className="p-5" key={timeline.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{timeline.code}</p><h3 className="mt-1 text-lg font-semibold">{timeline.name}</h3></div><Badge tone="info"><GitBranch aria-hidden="true" className="mr-1 inline size-3.5" />{timeline.versions.length - 1} {labels.successors}</Badge></div><div className="mt-5 space-y-3 border-l-2 border-primary/20 pl-4">{timeline.versions.map((version, index) => { const nextVersion = timeline.versions[index + 1]; return <div className="relative rounded-[var(--radius-control)] border border-subtle bg-background p-4" key={version.id}><span aria-hidden="true" className="absolute -left-[1.45rem] top-5 size-3 rounded-full border-2 border-background bg-primary" /><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{index === 0 ? labels.validFrom : labels.successor}: {version.validFrom}</p><p className="mt-1 font-semibold">{version.name}</p></div><Button onClick={() => { setFailed(false); setDialog({ mode: 'edit', version, nextVersion }) }} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{labels.standardHours}: {version.standardHoursPerWeek}</span><span>{labels.probationMaximum}: {version.probationMaximumMonths === 2 ? labels.probationTwoMonths : labels.probationOneMonth}</span>{nextVersion ? <span>{labels.validUntil}: {addDays(nextVersion.validFrom, -1)}</span> : <Badge tone="success">{labels.current}</Badge>}{!version.isActive ? <Badge tone="neutral">{labels.historical}</Badge> : null}</div>{!nextVersion ? <Button className="mt-4" onClick={() => { setFailed(false); setDialog({ mode: 'successor', predecessor: version }) }} size="sm" type="button" variant="ghost"><Plus aria-hidden="true" />{labels.addSuccessor}</Button> : null}{salaryStructureCatalog ? <CaoSalaryStructuresSection laborConditionSetId={version.id} catalog={salaryStructureCatalog} locale={locale} selectedStructureIds={salaryStructureCatalog.laborConditionRelations.filter((relation) => relation.labor_condition_set_id === version.id).map((relation) => relation.salary_structure_id)} labels={labels.salaryStructures} /> : null}</div> })}</div></Surface>)}</div>}{dialog ? <RegulationDrawer labels={labels} onCancel={() => setDialog(null)} onSave={save} state={dialog} /> : null}</div>
}

'use client'

import { Building2, Pencil, Plus, UsersRound } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { HrGroupContextOption } from '@/lib/context/administration-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

type Labels = { title: string; subtitle: string; groups: string; administrations: string; add: string; edit: string; save: string; cancel: string; name: string; description: string; code: string; number: string; coc: string; vat: string; parent: string; active: string; group: string; failed: string; saved: string; empty: string }
type Selection = { type: 'group' | 'administration'; id: string }
type FormValues = { code: string; name: string; description: string; administrationNumber: string; cocNumber: string; vatNumber: string; parentId: string; isActive: boolean }
const emptyForm: FormValues = { code: '', name: '', description: '', administrationNumber: '', cocNumber: '', vatNumber: '', parentId: '', isActive: true }

export function BusinessStructureManager({ groups, canWrite, labels }: { groups: HrGroupContextOption[]; canWrite: boolean; labels: Labels }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Selection | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [initialForm, setInitialForm] = useState<FormValues>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const currentGroup = selected ? groups.find((group) => selected.type === 'group' ? group.id === selected.id : group.administrations.some((administration) => administration.id === selected.id)) : undefined
  const administration = selected?.type === 'administration' ? currentGroup?.administrations.find((item) => item.id === selected.id) : undefined
  const administrations = useMemo(() => groups.flatMap((group) => group.administrations.map((item) => ({ ...item, groupName: group.name }))), [groups])
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm)

  function startGroup(group: HrGroupContextOption): void { setSelected({ type: 'group', id: group.id }); setEditing(false); setError(null) }
  function startAdministration(id: string): void { setSelected({ type: 'administration', id }); setEditing(false); setError(null) }
  function startCreate(): void { setSelected(null); setForm(emptyForm); setInitialForm(emptyForm); setError(null); setEditing(true) }
  function startEdit(): void {
    if (selected?.type === 'group' && currentGroup) { const next = { ...emptyForm, name: currentGroup.name, description: currentGroup.description ?? '' }; setForm(next); setInitialForm(next) }
    if (selected?.type === 'administration' && administration) { const next = { code: administration.code, name: administration.name, description: '', administrationNumber: administration.administrationNumber ?? '', cocNumber: administration.cocNumber ?? '', vatNumber: administration.vatNumber ?? '', parentId: administration.parentId ?? '', isActive: administration.isActive ?? true }; setForm(next); setInitialForm(next) }
    setError(null); setEditing(true)
  }
  function reset(): void { setEditing(false); setForm(emptyForm); setInitialForm(emptyForm); setError(null) }
  function update<K extends keyof FormValues>(key: K, value: FormValues[K]): void { setForm((current) => ({ ...current, [key]: value })); setError(null) }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (saving) return; setSaving(true); setError(null)
    const isGroup = selected?.type === 'group'
    const isAdministration = selected?.type === 'administration'
    const url = isGroup ? `/api/hr-groups/${selected.id}` : isAdministration ? `/api/hr-groups/administrations/${selected.id}` : '/api/hr-groups'
    const method = isGroup || isAdministration ? 'PATCH' : 'POST'
    const body = isGroup
      ? { name: form.name, description: form.description }
      : { code: form.code, name: form.name, administrationNumber: form.administrationNumber, cocNumber: form.cocNumber || null, vatNumber: form.vatNumber || null, parentId: form.parentId || null, isActive: form.isActive }
    try {
      const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(labels.failed)
      reset(); router.refresh()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : labels.failed) } finally { setSaving(false) }
  }

  return <section className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
      <Surface className="min-w-0 p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-foreground">{labels.groups}</h2>{canWrite ? <Button onClick={startCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button> : null}</div>
        <div className="mt-4 space-y-1">{groups.map((group) => <div key={group.id}><button aria-pressed={selected?.type === 'group' && selected.id === group.id} className={`flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-semibold outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus ${selected?.type === 'group' && selected.id === group.id ? 'bg-accent text-accent-foreground' : 'text-foreground'}`} onClick={() => startGroup(group)} type="button"><UsersRound aria-hidden="true" className="size-4 shrink-0" />{group.name}</button><div className="ml-5 border-l border-border-subtle pl-2">{group.administrations.map((item) => <button aria-pressed={selected?.type === 'administration' && selected.id === item.id} className={`block min-h-9 w-full rounded-[var(--radius-control)] px-3 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-focus ${selected?.type === 'administration' && selected.id === item.id ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground'}`} key={item.id} onClick={() => startAdministration(item.id)} type="button">{item.name}</button>)}</div></div>)}</div>
      </Surface>

      <Surface className="min-w-0 p-5 sm:p-6">
        {!selected && !editing ? <EmptyState icon={<Building2 />} title={labels.empty} /> : editing ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.subtitle} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={reset} onOpenChange={(open) => { if (!open) reset() }} onSubmit={(event) => void save(event)} open title={selected?.type === 'group' ? labels.groups : labels.add} saveLabel={labels.save} saving={saving}>
          {error ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
          {!selected ? <FormField control={<TextInput maxLength={80} onChange={(event) => update('code', event.target.value)} required value={form.code} />} label={labels.code} required /> : null}
          <FormField control={<TextInput maxLength={160} onChange={(event) => update('name', event.target.value)} required value={form.name} />} label={labels.name} required />
          {selected?.type === 'group' ? <FormField control={<Textarea maxLength={1000} onChange={(event) => update('description', event.target.value)} value={form.description} />} label={labels.description} /> : <><FormField control={<TextInput maxLength={80} onChange={(event) => update('administrationNumber', event.target.value)} required value={form.administrationNumber} />} label={labels.number} required /><FormField control={<TextInput maxLength={40} onChange={(event) => update('cocNumber', event.target.value)} value={form.cocNumber} />} label={labels.coc} /><FormField control={<TextInput maxLength={40} onChange={(event) => update('vatNumber', event.target.value)} value={form.vatNumber} />} label={labels.vat} /><FormField control={<DropdownSelect aria-label={labels.parent} onChange={(event) => update('parentId', event.target.value)} searchable searchPlaceholder={labels.parent} value={form.parentId}><option value="">{labels.parent}</option>{administrations.filter((item) => item.id !== selected?.id).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.groupName}</option>)}</DropdownSelect>} label={labels.parent} /><Checkbox checked={form.isActive} label={labels.active} onChange={(event) => update('isActive', event.target.checked)} /></>}
        </FormDrawer> : <div><div className="flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-foreground">{selected?.type === 'group' ? currentGroup?.name : administration?.name}</h2>{selected?.type === 'administration' && administration ? <Badge>{administration.code}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{selected?.type === 'group' ? labels.group : currentGroup?.name}</p></div>{canWrite ? <RowActions menuLabel={labels.edit} primaryAction={<Button onClick={startEdit} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>} /> : null}</div><dl className="mt-6 grid gap-5 sm:grid-cols-2">{selected?.type === 'group' ? <><Detail label={labels.name} value={currentGroup?.name} /><Detail label={labels.description} value={currentGroup?.description} /></> : <><Detail label={labels.code} value={administration?.code} /><Detail label={labels.number} value={administration?.administrationNumber} /><Detail label={labels.coc} value={administration?.cocNumber} /><Detail label={labels.vat} value={administration?.vatNumber} /><Detail label={labels.group} value={currentGroup?.name} /></>}</dl></div>}
      </Surface>
    </div>
  </section>
}

function Detail({ label, value }: { label: string; value?: string | null }) { return <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium text-foreground">{value || '—'}</dd></div> }

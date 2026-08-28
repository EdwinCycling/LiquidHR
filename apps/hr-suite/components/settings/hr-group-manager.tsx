'use client'

import { Building2, Pencil, Plus, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AdministrationContextOption, HrGroupContextOption } from '@/lib/context/administration-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

interface Labels {
  title: string; subtitle: string; groupCode: string; groupName: string; groupDescription: string; saveGroup: string; saved: string
  addAdministration: string; editAdministration: string; administrations: string; administrationCode: string; administrationName: string
  administrationNumber: string; administrationCocNumber: string; administrationVatNumber: string; administrationParent: string; administrationActive: string
  saveAdministration: string; cancel: string; close: string; search: string; searchPlaceholder: string; empty: string; failed: string; invalid: string; duplicate: string
}
type AdministrationForm = { code: string; name: string; administrationNumber: string; cocNumber: string; vatNumber: string; parentId: string; isActive: boolean }
const emptyAdministration: AdministrationForm = { code: '', name: '', administrationNumber: '', cocNumber: '', vatNumber: '', parentId: '', isActive: true }

export function HrGroupManager({ activeGroup, canWrite, labels }: { activeGroup: HrGroupContextOption; canWrite: boolean; labels: Labels }) {
  const router = useRouter()
  const [groupName, setGroupName] = useState(activeGroup.name)
  const [groupDescription, setGroupDescription] = useState(activeGroup.description ?? '')
  const [query, setQuery] = useState('')
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false)
  const [administrationDrawerOpen, setAdministrationDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdministrationForm>(emptyAdministration)
  const [initialAdministration, setInitialAdministration] = useState<AdministrationForm>(emptyAdministration)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const administrations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return activeGroup.administrations.filter((administration) => `${administration.code} ${administration.name}`.toLocaleLowerCase().includes(normalized)).sort((left, right) => left.name.localeCompare(right.name))
  }, [activeGroup.administrations, query])
  const groupDirty = groupName !== activeGroup.name || groupDescription !== (activeGroup.description ?? '')
  const administrationDirty = JSON.stringify(form) !== JSON.stringify(initialAdministration)

  function openCreate(): void { setEditingId(null); setForm(emptyAdministration); setInitialAdministration(emptyAdministration); setError(null); setAdministrationDrawerOpen(true) }
  function openEdit(administration: AdministrationContextOption): void { const next = { code: administration.code, name: administration.name, administrationNumber: administration.administrationNumber ?? '', cocNumber: administration.cocNumber ?? '', vatNumber: administration.vatNumber ?? '', parentId: administration.parentId ?? '', isActive: administration.isActive ?? true }; setEditingId(administration.id); setForm(next); setInitialAdministration(next); setError(null); setAdministrationDrawerOpen(true) }
  function resetAdministration(): void { setEditingId(null); setForm(emptyAdministration); setInitialAdministration(emptyAdministration); setError(null) }
  function update<K extends keyof AdministrationForm>(key: K, value: AdministrationForm[K]): void { setForm((current) => ({ ...current, [key]: value })); setError(null) }

  async function saveGroup(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (saving) return; setSaving(true); setError(null); setSaved(false)
    try { const response = await fetch('/api/hr-groups', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: groupName, description: groupDescription }) }); if (!response.ok) throw new Error(labels.failed); setGroupDrawerOpen(false); setSaved(true); router.refresh() } catch (saveError) { setError(saveError instanceof Error ? saveError.message : labels.failed) } finally { setSaving(false) }
  }

  async function saveAdministration(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (saving) return; setSaving(true); setError(null)
    const url = editingId ? `/api/hr-groups/administrations/${editingId}` : '/api/hr-groups'
    const body = editingId ? { name: form.name, administrationNumber: form.administrationNumber, cocNumber: form.cocNumber || null, vatNumber: form.vatNumber || null, parentId: form.parentId || null, isActive: form.isActive } : form
    try {
      const response = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) { const result: unknown = await response.json().catch(() => null); const code = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string' ? result.error : ''; throw new Error(code === 'ADMINISTRATION_ALREADY_EXISTS' ? labels.duplicate : labels.failed) }
      setAdministrationDrawerOpen(false); resetAdministration(); router.refresh()
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : labels.failed) } finally { setSaving(false) }
  }

  return <section className="space-y-6">
    <Surface className="border-primary/20 bg-primary/[0.04] p-4 sm:p-5"><div className="flex items-start gap-3"><Building2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{labels.title}</p><p className="mt-1 font-semibold text-foreground">{activeGroup.name} <Badge className="ml-2" tone="info">{activeGroup.code}</Badge></p><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></div></div></Surface>

    <Surface className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="text-xl font-semibold text-foreground">{labels.groupName}</h2><p className="mt-1 text-sm text-muted-foreground">{activeGroup.description || labels.subtitle}</p></div>{canWrite ? <Button onClick={() => setGroupDrawerOpen(true)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.saveGroup}</Button> : null}</div>{saved ? <p aria-live="polite" className="mt-3 text-sm text-success" role="status">{labels.saved}</p> : null}{error && !administrationDrawerOpen && !groupDrawerOpen ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}</Surface>

    <section className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-semibold text-foreground">{labels.administrations}</h2><p className="mt-1 text-sm text-muted-foreground">{activeGroup.administrations.length}</p></div>{canWrite ? <Button onClick={openCreate} size="sm" type="button"><Plus aria-hidden="true" />{labels.addAdministration}</Button> : null}</div><CollectionToolbar search={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} type="search" value={query} />} />{administrations.length ? <Surface><ul className="divide-y divide-border-subtle">{administrations.map((administration) => <li className="flex min-w-0 items-center justify-between gap-4 px-4 py-4 sm:px-5" key={administration.id}><div className="min-w-0"><p className="break-words font-semibold text-foreground">{administration.name}</p><p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{administration.code} · {administration.administrationNumber ?? administration.code}</p></div>{canWrite ? <RowActions menuLabel={labels.editAdministration} primaryAction={<Button aria-label={`${labels.editAdministration}: ${administration.name}`} onClick={() => openEdit(administration)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.editAdministration}</Button>} /> : null}</li>)}</ul></Surface> : <EmptyState icon={<Building2 />} title={labels.empty} />}</section>

    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.subtitle} dirty={groupDirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={() => { setGroupName(activeGroup.name); setGroupDescription(activeGroup.description ?? '') }} onOpenChange={setGroupDrawerOpen} onSubmit={(event) => void saveGroup(event)} open={groupDrawerOpen} saveLabel={labels.saveGroup} saving={saving} title={labels.groupName}><FormField control={<TextInput disabled value={activeGroup.code} />} label={labels.groupCode} /><FormField control={<TextInput onChange={(event) => setGroupName(event.target.value)} required value={groupName} />} label={labels.groupName} required /><FormField control={<Textarea maxLength={1000} onChange={(event) => setGroupDescription(event.target.value)} value={groupDescription} />} label={labels.groupDescription} />{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</FormDrawer>
    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.subtitle} dirty={administrationDirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={resetAdministration} onOpenChange={(open) => { setAdministrationDrawerOpen(open); if (!open) resetAdministration() }} onSubmit={(event) => void saveAdministration(event)} open={administrationDrawerOpen} saveLabel={labels.saveAdministration} saving={saving} title={editingId ? labels.editAdministration : labels.addAdministration}>
      {error ? <p className="border border-destructive/40 bg-destructive-surface px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}<FormField control={<TextInput disabled={Boolean(editingId)} maxLength={80} onChange={(event) => update('code', event.target.value)} required value={form.code} />} label={labels.administrationCode} required /><FormField control={<TextInput maxLength={160} onChange={(event) => update('name', event.target.value)} required value={form.name} />} label={labels.administrationName} required /><FormField control={<TextInput maxLength={80} onChange={(event) => update('administrationNumber', event.target.value)} required value={form.administrationNumber} />} label={labels.administrationNumber} required /><FormField control={<TextInput maxLength={40} onChange={(event) => update('cocNumber', event.target.value)} value={form.cocNumber} />} label={labels.administrationCocNumber} /><FormField control={<TextInput maxLength={40} onChange={(event) => update('vatNumber', event.target.value)} value={form.vatNumber} />} label={labels.administrationVatNumber} /><FormField control={<DropdownSelect aria-label={labels.administrationParent} onChange={(event) => update('parentId', event.target.value)} searchable searchPlaceholder={labels.administrationParent} value={form.parentId}><option value="">{labels.administrationParent}</option>{activeGroup.administrations.filter((item) => item.id !== editingId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect>} label={labels.administrationParent} /><Checkbox checked={form.isActive} label={labels.administrationActive} onChange={(event) => update('isActive', event.target.checked)} />
    </FormDrawer>
  </section>
}

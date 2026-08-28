'use client'

import { Pencil, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CountryPicker } from '@/components/ui/country-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { CollectionToolbar } from '@/components/patterns/collection-toolbar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'

type Catalog = 'LABOR_CONDITION_SET' | 'FLEX_PHASE' | 'SALARY_FREQUENCY' | 'COST_CARRIER' | 'COST_CENTER'
type CatalogRow = { id: string; code: string; name: string; isActive: boolean; numericValue: number | null }

export function EmploymentGeneralSettings({ defaultCountryCode, frequencies, labels }: { defaultCountryCode: string; frequencies: CatalogRow[]; labels: { country: string; paymentFrequency: string; monthly: string; fourWeekly: string; save: string; saved: string; failed: string; search: string; empty: string } }) {
  const router = useRouter()
  const [countryCode, setCountryCode] = useState(defaultCountryCode)
  const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>(() => frequencies.filter((frequency) => frequency.isActive).map((frequency) => frequency.code))
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle')
  async function save(): Promise<void> {
    if (selectedFrequencies.length === 0) { setState('failed'); return }
    const [countryResponse, frequencyResponse] = await Promise.all([
      fetch('/api/settings/employment-contracts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'COUNTRY', countryCode }) }),
      fetch('/api/settings/employment-contracts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'PAYMENT_FREQUENCIES', codes: selectedFrequencies }) }),
    ])
    const response = countryResponse.ok && frequencyResponse.ok ? countryResponse : frequencyResponse
    setState(response.ok ? 'saved' : 'failed')
    if (response.ok) router.refresh()
  }
  return <div className="max-w-xl space-y-5"><Surface className="p-5"><div className="grid gap-1.5 text-sm"><span className="font-medium">{labels.country}</span><CountryPicker value={countryCode} onChange={(value) => { setCountryCode(value); setState('idle') }} searchLabel={labels.search} emptyLabel={labels.empty} /></div><fieldset className="mt-5 grid gap-3"><legend className="text-sm font-semibold">{labels.paymentFrequency}</legend>{frequencies.filter((frequency) => frequency.code === 'MONTHLY' || frequency.code === 'FOUR_WEEKLY').map((frequency) => <Checkbox checked={selectedFrequencies.includes(frequency.code)} key={frequency.code} label={frequency.code === 'MONTHLY' ? labels.monthly : labels.fourWeekly} onChange={(event) => { setSelectedFrequencies((current) => event.target.checked ? [...new Set([...current, frequency.code])] : current.filter((code) => code !== frequency.code)); setState('idle') }} />)}</fieldset><div className="mt-5 flex flex-wrap items-center gap-3 border-t border-subtle pt-4"><Button onClick={() => void save()} type="button">{labels.save}</Button>{state === 'saved' && <p className="text-sm text-success" role="status">{labels.saved}</p>}{state === 'failed' && <p className="text-sm text-destructive" role="alert">{labels.failed}</p>}</div></Surface></div>
}

export function EmploymentCatalogManager({ catalog, rows, numericLabel, labels }: { catalog: Catalog; rows: CatalogRow[]; numericLabel: string | null; labels: { search: string; code: string; name: string; add: string; edit: string; save: string; cancel: string; active: string; inactive: string; activate: string; deactivate: string; empty: string; failed: string } }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CatalogRow | 'new' | null>(null)
  const [draft, setDraft] = useState({ code: '', name: '', numericValue: '' })
  const [initialDraft, setInitialDraft] = useState(draft)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(query)) : rows }, [rows, search])
  async function request(body: object): Promise<boolean> { const response = await fetch('/api/settings/employment-contracts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); setFailed(!response.ok); if (response.ok) router.refresh(); return response.ok }
  function openEditor(row: CatalogRow | 'new'): void {
    const next = row === 'new' ? { code: '', name: '', numericValue: '' } : { code: row.code, name: row.name, numericValue: String(row.numericValue ?? '') }
    setFailed(false); setSelected(row); setDraft(next); setInitialDraft(next)
  }
  function closeEditor(): void { setSelected(null); setDraft({ code: '', name: '', numericValue: '' }); setInitialDraft({ code: '', name: '', numericValue: '' }) }
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!selected || !draft.code.trim() || !draft.name.trim() || (numericLabel !== null && !draft.numericValue)) return
    setSaving(true)
    const numericValue = numericLabel ? Number(draft.numericValue) : null
    const ok = await request({ action: selected === 'new' ? 'CREATE' : 'UPDATE', catalog, ...(selected === 'new' ? {} : { id: selected.id }), code: draft.code.trim(), name: draft.name.trim(), numericValue })
    setSaving(false)
    if (ok) closeEditor()
  }
  async function toggle(): Promise<void> {
    if (selected === null || selected === 'new') return
    setSaving(true)
    const ok = await request({ action: 'ACTIVE', catalog, id: selected.id, isActive: !selected.isActive })
    setSaving(false)
    if (ok) closeEditor()
  }
  async function toggleRow(row: CatalogRow): Promise<void> {
    await request({ action: 'ACTIVE', catalog, id: row.id, isActive: !row.isActive })
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  return <div className="space-y-4"><CollectionToolbar createAction={<Button onClick={() => openEditor('new')} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button>} search={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} type="search" value={search} />} />{failed && <p role="alert" className="text-sm text-destructive">{labels.failed}</p>}{filtered.length === 0 ? <EmptyState title={labels.empty} /> : <Surface><ul className="divide-y divide-border-subtle">{filtered.map((row) => <li className="flex min-w-0 items-center justify-between gap-4 px-4 py-4" key={row.id}><div className="min-w-0"><p className="break-words font-semibold">{row.code} · {row.name}</p><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? labels.active : labels.inactive}</Badge>{row.numericValue != null && numericLabel ? <span>{numericLabel}: {row.numericValue}</span> : null}</p></div><RowActions menuLabel={labels.edit} primaryAction={<Button aria-label={`${labels.edit}: ${row.name}`} onClick={() => openEditor(row)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.edit}</Button>} menuItems={[{ id: 'toggle', label: row.isActive ? labels.deactivate : labels.activate, onSelect: () => void toggleRow(row) }]} /></li>)}</ul></Surface>}{selected ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.name} dirty={dirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={closeEditor} onOpenChange={(open) => { if (!open && !dirty) closeEditor() }} onSubmit={(event) => void save(event)} open saveLabel={labels.save} saving={saving} title={selected === 'new' ? labels.add : `${labels.edit}: ${selected.code}`}><FormField control={<TextInput maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required value={draft.code} />} label={labels.code} required /><FormField control={<TextInput maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required value={draft.name} />} label={labels.name} required />{numericLabel ? <FormField control={<TextInput inputMode="decimal" min="0" onChange={(event) => setDraft((current) => ({ ...current, numericValue: event.target.value }))} required type="number" value={draft.numericValue} />} label={numericLabel} required /> : null}{selected !== 'new' ? <div className="border-t border-subtle pt-3"><Button disabled={saving} onClick={() => void toggle()} type="button" variant="secondary">{selected.isActive ? labels.deactivate : labels.activate}</Button></div> : null}</FormDrawer> : null}</div>
}

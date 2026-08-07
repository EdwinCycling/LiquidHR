'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CountryPicker } from '@/components/ui/country-picker'

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
  return <div className="max-w-xl"><label className="grid gap-1.5 text-sm font-medium">{labels.country}<CountryPicker value={countryCode} onChange={(value) => { setCountryCode(value); setState('idle') }} searchLabel={labels.search} emptyLabel={labels.empty} /></label><fieldset className="mt-5 rounded-2xl border p-4"><legend className="px-1 text-sm font-semibold">{labels.paymentFrequency}</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{frequencies.filter((frequency) => frequency.code === 'MONTHLY' || frequency.code === 'FOUR_WEEKLY').map((frequency) => <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-medium" key={frequency.code}><input type="checkbox" checked={selectedFrequencies.includes(frequency.code)} onChange={(event) => { setSelectedFrequencies((current) => event.target.checked ? [...new Set([...current, frequency.code])] : current.filter((code) => code !== frequency.code)); setState('idle') }} />{frequency.code === 'MONTHLY' ? labels.monthly : labels.fourWeekly}</label>)}</div></fieldset><div className="mt-4 flex items-center gap-3"><button type="button" className="button-primary" onClick={() => void save()}>{labels.save}</button>{state === 'saved' && <p className="text-sm text-success">{labels.saved}</p>}{state === 'failed' && <p className="text-sm text-destructive">{labels.failed}</p>}</div></div>
}

export function EmploymentCatalogManager({ catalog, rows, numericLabel, labels }: { catalog: Catalog; rows: CatalogRow[]; numericLabel: string | null; labels: { search: string; code: string; name: string; add: string; edit: string; save: string; cancel: string; active: string; inactive: string; activate: string; deactivate: string; empty: string; failed: string } }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CatalogRow | 'new' | null>(null)
  const [failed, setFailed] = useState(false)
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return query ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(query)) : rows }, [rows, search])
  async function request(body: object): Promise<boolean> { const response = await fetch('/api/settings/employment-contracts', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); setFailed(!response.ok); if (response.ok) router.refresh(); return response.ok }
  async function save(input: { code: string; name: string; numericValue: string }): Promise<void> { const numericValue = numericLabel ? Number(input.numericValue) : null; if (await request({ action: selected === 'new' ? 'CREATE' : 'UPDATE', catalog, ...(selected === 'new' ? {} : { id: selected?.id }), code: input.code, name: input.name, numericValue })) setSelected(null) }
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><input aria-label={labels.search} className="form-field max-w-sm" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} /><button type="button" className="button-primary" onClick={() => { setFailed(false); setSelected('new') }}>{labels.add}</button></div>{failed && <p role="alert" className="mt-3 text-sm text-destructive">{labels.failed}</p>}<div className="mt-4 overflow-hidden rounded-2xl border">{filtered.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{labels.empty}</p> : <ul className="divide-y">{filtered.map((row) => <li key={row.id}><button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-muted/60" onClick={() => { setFailed(false); setSelected(row) }}><div><p className="font-semibold">{row.code} · {row.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.isActive ? labels.active : labels.inactive}{row.numericValue != null && numericLabel ? ` · ${numericLabel}: ${row.numericValue}` : ''}</p></div><span className="button-secondary">{labels.edit}</span></button></li>)}</ul>}</div>{selected && <CatalogDialog selected={selected} numericLabel={numericLabel} labels={labels} onCancel={() => setSelected(null)} onSave={save} onToggle={selected === 'new' ? undefined : () => request({ action: 'ACTIVE', catalog, id: selected.id, isActive: !selected.isActive })} />}</div>
}

function CatalogDialog({ selected, numericLabel, labels, onCancel, onSave, onToggle }: { selected: CatalogRow | 'new'; numericLabel: string | null; labels: { code: string; name: string; add: string; save: string; cancel: string; active: string; inactive: string; activate: string; deactivate: string }; onCancel: () => void; onSave: (input: { code: string; name: string; numericValue: string }) => Promise<void>; onToggle?: () => Promise<boolean> }) {
  const [code, setCode] = useState(selected === 'new' ? '' : selected.code)
  const [name, setName] = useState(selected === 'new' ? '' : selected.name)
  const [numericValue, setNumericValue] = useState(selected === 'new' ? '' : String(selected.numericValue ?? ''))
  const [saving, setSaving] = useState(false)
  const isNew = selected === 'new'
  const isActive = selected !== 'new' && selected.isActive
  async function submit(): Promise<void> { setSaving(true); await onSave({ code, name, numericValue }); setSaving(false) }
  async function toggle(): Promise<void> { setSaving(true); await onToggle?.(); setSaving(false) }
  return <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" role="dialog"><div className="w-full max-w-lg rounded-2xl border bg-background p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{isNew ? labels.add : `${labels.code}: ${selected.code}`}</h2>{!isNew && <span className="status-chip bg-muted text-muted-foreground">{isActive ? labels.active : labels.inactive}</span>}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{labels.code}<input autoFocus className="form-field uppercase" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label><label className="grid gap-1 text-sm font-medium">{labels.name}<input className="form-field" value={name} onChange={(event) => setName(event.target.value)} /></label>{numericLabel && <label className="grid gap-1 text-sm font-medium sm:col-span-2">{numericLabel}<input type="number" min="0" step="0.01" className="form-field" value={numericValue} onChange={(event) => setNumericValue(event.target.value)} /></label>}</div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div>{onToggle && <button type="button" className="button-secondary" disabled={saving} onClick={toggle}>{isActive ? labels.deactivate : labels.activate}</button>}</div><div className="flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={saving} onClick={onCancel}>{labels.cancel}</button><button type="button" className="button-primary" disabled={saving || !code.trim() || !name.trim() || (numericLabel !== null && !numericValue)} onClick={submit}>{labels.save}</button></div></div></div></div>
}

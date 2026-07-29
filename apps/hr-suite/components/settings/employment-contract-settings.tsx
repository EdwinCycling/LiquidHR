'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type Catalog = 'LABOR_CONDITION_SET' | 'FLEX_PHASE' | 'SALARY_FREQUENCY' | 'COST_CARRIER'

export function EmploymentGeneralSettings({ defaultCountryCode, labels }: {
  defaultCountryCode: string
  labels: { country: string; save: string; saved: string; failed: string }
}) {
  const router = useRouter()
  const [countryCode, setCountryCode] = useState(defaultCountryCode)
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle')
  async function save(): Promise<void> {
    const response = await fetch('/api/settings/employment-contracts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'COUNTRY', countryCode }),
    })
    setState(response.ok ? 'saved' : 'failed')
    if (response.ok) router.refresh()
  }
  return <div className="max-w-xl">
    <label className="grid gap-1.5 text-sm font-medium">{labels.country}<input className="form-field" maxLength={2} value={countryCode} onChange={(event) => { setCountryCode(event.target.value.toUpperCase()); setState('idle') }} /></label>
    <div className="mt-4 flex items-center gap-3"><button type="button" className="button-primary" onClick={save}>{labels.save}</button>{state === 'saved' && <p className="text-sm text-success">{labels.saved}</p>}{state === 'failed' && <p className="text-sm text-destructive">{labels.failed}</p>}</div>
  </div>
}

export function EmploymentCatalogManager({ catalog, rows, numericLabel, labels }: {
  catalog: Catalog
  rows: Array<{ id: string; code: string; name: string; isActive: boolean; numericValue: number | null }>
  numericLabel: string | null
  labels: {
    search: string; code: string; name: string; add: string; active: string; inactive: string
    activate: string; deactivate: string; empty: string; failed: string
  }
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [numericValue, setNumericValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [failed, setFailed] = useState(false)
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? rows.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(query)) : rows
  }, [rows, search])

  async function request(body: object): Promise<boolean> {
    const response = await fetch('/api/settings/employment-contracts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    setFailed(!response.ok)
    if (response.ok) router.refresh()
    return response.ok
  }

  async function add(): Promise<void> {
    if (await request({
      action: 'CREATE', catalog, code, name,
      numericValue: numericLabel ? Number(numericValue) : null,
    })) {
      setCode(''); setName(''); setNumericValue(''); setAdding(false)
    }
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <input aria-label={labels.search} className="form-field max-w-sm" placeholder={labels.search} value={search} onChange={(event) => setSearch(event.target.value)} />
      <button type="button" className="button-primary" onClick={() => setAdding((value) => !value)}>{labels.add}</button>
    </div>
    {adding && <div className="mt-4 grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-3">
      <label className="grid gap-1 text-sm font-medium">{labels.code}<input className="form-field" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
      <label className="grid gap-1 text-sm font-medium">{labels.name}<input className="form-field" value={name} onChange={(event) => setName(event.target.value)} /></label>
      {numericLabel && <label className="grid gap-1 text-sm font-medium">{numericLabel}<input type="number" min="0" step="0.01" className="form-field" value={numericValue} onChange={(event) => setNumericValue(event.target.value)} /></label>}
      <div className="sm:col-span-3 flex justify-end"><button type="button" className="button-primary" onClick={add}>{labels.add}</button></div>
    </div>}
    {failed && <p role="alert" className="mt-3 text-sm text-destructive">{labels.failed}</p>}
    <div className="mt-4 overflow-hidden rounded-2xl border">
      {filtered.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{labels.empty}</p> : <ul className="divide-y">{filtered.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
        <div><p className="font-semibold">{row.code} · {row.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.isActive ? labels.active : labels.inactive}{row.numericValue != null && numericLabel ? ` · ${numericLabel}: ${row.numericValue}` : ''}</p></div>
        <button type="button" className="button-secondary" onClick={() => request({ action: 'ACTIVE', catalog, id: row.id, isActive: !row.isActive })}>{row.isActive ? labels.deactivate : labels.activate}</button>
      </li>)}</ul>}
    </div>
  </div>
}

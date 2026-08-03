'use client'

import { MapPin, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState } from 'react'

interface CompanyAddress {
  address_line_1: string | null
  address_line_2: string | null
  street: string | null
  house_number: string | null
  house_number_addition: string | null
  postal_code: string | null
  city: string | null
  region: string | null
  country_code: string
}

interface CompanyLocationOption {
  id: string
  name: string
  is_active: boolean
}

interface CompanyLocationAssignment {
  id: string
  location_id: string | null
  effective_from: string
  effective_to: string | null
}

interface Labels {
  title: string
  description: string
  company: string
  companyAddress: string
  locations: string
  current: string
  history: string
  active: string
  notRecorded: string
  readOnly: string
  noLocations: string
  location: string
  locationSearch: string
  locationSearchPlaceholder: string
  noLocationResults: string
  add: string
  edit: string
  save: string
  cancel: string
  effectiveOn: string
  failed: string
  saving: string
  changeSaved: string
  singleLocationMode: string
}

function formatAddress(address: CompanyAddress | null): string {
  if (!address) return ''
  const street = [address.street, address.house_number, address.house_number_addition].filter(Boolean).join(' ')
  const line = address.country_code === 'NL' ? street : address.address_line_1
  return [line, address.address_line_2, [address.postal_code, address.city].filter(Boolean).join(' '), address.region].filter(Boolean).join(', ')
}

function locationAddress(location: CompanyLocationOption): string {
  return location.name
}

function LocationPicker({
  options,
  value,
  onChange,
  labels,
}: {
  options: CompanyLocationOption[]
  value: string
  onChange: (value: string) => void
  labels: Pick<Labels, 'location' | 'locationSearch' | 'locationSearchPlaceholder' | 'noLocationResults'>
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return normalized ? options.filter((option) => option.name.toLocaleLowerCase().includes(normalized)) : options
  }, [options, query])
  const selected = options.find((option) => option.id === value)

  return <div className="grid gap-2 sm:col-span-2">
    <span className="text-sm font-medium">{labels.location}</span>
    <label className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label={labels.locationSearch}
        className="form-field pl-10"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={labels.locationSearchPlaceholder}
        role="combobox"
        aria-autocomplete="list"
        aria-controls="employment-location-options"
        aria-expanded={filtered.length > 0}
        value={query}
      />
    </label>
    <div aria-label={labels.locationSearch} className="max-h-52 overflow-y-auto rounded-xl border" id="employment-location-options" role="listbox">
      {filtered.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{labels.noLocationResults}</p> : filtered.map((option) => <button
        aria-selected={option.id === value}
        className={`flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent ${option.id === value ? 'bg-primary/5 font-semibold' : ''}`}
        key={option.id}
        onClick={() => onChange(option.id)}
        role="option"
        type="button"
      >
        <span>{locationAddress(option)}</span>
        {option.id === value ? <span className="text-xs text-primary">✓</span> : null}
      </button>)}
    </div>
    {selected ? <p className="text-xs text-muted-foreground">{selected.name}</p> : null}
  </div>
}

export function CompanyLocationTimelineManager({
  company,
  locations,
  assignments,
  employmentId,
  canWrite,
  labels,
}: {
  company: { name: string; single_location: boolean; address: CompanyAddress | null }
  locations: CompanyLocationOption[]
  assignments: CompanyLocationAssignment[]
  employmentId: string
  canWrite: boolean
  labels: Labels
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<CompanyLocationAssignment | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view')
  const [effectiveOn, setEffectiveOn] = useState('')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function open(assignment: CompanyLocationAssignment): void {
    setSelected(assignment)
    setMode('view')
    setEffectiveOn(assignment.effective_from)
    setLocationId(assignment.location_id ?? '')
    setError('')
  }

  function add(): void {
    const current = assignments[0]
    setSelected(null)
    setMode('add')
    setEffectiveOn('')
    setLocationId(current?.location_id ?? locations.find((location) => location.is_active)?.id ?? '')
    setError('')
  }

  function close(): void {
    setSelected(null)
    setMode('view')
    setError('')
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setError('')
    const response = await fetch(`/api/employments/${employmentId}/company-location`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        placementId: mode === 'edit' ? selected?.id : null,
        effectiveOn,
        locationId,
      }),
    })
    if (!response.ok) {
      const result = await response.json() as { code?: string }
      setError(result.code ?? labels.failed)
      setSaving(false)
      return
    }
    close()
    setSaving(false)
    router.refresh()
  }

  if (company.single_location) {
    return <section className="rounded-2xl border bg-surface p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{labels.title}</p>
          <h2 className="mt-1 text-xl font-semibold">{labels.company}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.singleLocationMode}</p>
        </div>
        <span className="status-chip bg-muted text-muted-foreground">{labels.readOnly}</span>
      </header>
      <article className="mt-5 flex items-start gap-3 rounded-2xl border bg-background p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><MapPin aria-hidden="true" className="h-5 w-5" /></span>
        <div>
          <h3 className="font-semibold">{company.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{labels.companyAddress}: {formatAddress(company.address) || labels.notRecorded}</p>
        </div>
      </article>
    </section>
  }

  const activeLocations = locations.filter((location) => location.is_active)
  const modalOpen = Boolean(selected || mode === 'add')

  return <section className="rounded-2xl border bg-surface p-5 shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow">{labels.title}</p>
        <h2 className="mt-1 text-xl font-semibold">{labels.locations}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.description}</p>
      </div>
      {canWrite && activeLocations.length > 0 ? <button className="button-primary" onClick={add} type="button">{labels.add}</button> : null}
    </header>
    {activeLocations.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.noLocations}</p> : null}
    <div className="mt-5 grid gap-3">{assignments.map((assignment, index) => {
      const location = locations.find((option) => option.id === assignment.location_id)
      return <button className="cursor-pointer rounded-2xl border p-4 text-left transition hover:border-primary hover:bg-primary/5" key={assignment.id} onClick={() => open(assignment)} type="button">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{index === 0 ? labels.current : labels.history}</p>
            <p className="mt-1 font-semibold">{location?.name ?? labels.notRecorded}</p>
          </div>
          <span className="status-chip bg-accent text-accent-foreground">{assignment.effective_to ?? labels.active}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{labels.effectiveOn}: {assignment.effective_from}</p>
      </button>
    })}</div>
    {modalOpen ? <div className="fixed inset-0 z-[70] grid place-items-center bg-sidebar/70 p-4" role="presentation">
      <form className="w-full max-w-xl rounded-3xl border bg-surface p-6 shadow-2xl" onSubmit={(event) => void save(event)} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-4 border-b pb-4"><div><p className="eyebrow">{labels.title}</p><h3 className="mt-1 text-xl font-semibold">{mode === 'add' ? labels.add : mode === 'edit' ? labels.edit : labels.locations}</h3></div><button className="button-secondary" onClick={close} type="button">{labels.cancel}</button></div>
        {mode === 'view' ? <dl className="mt-5 grid gap-3 sm:grid-cols-2"><Item label={labels.location} value={locations.find((location) => location.id === selected?.location_id)?.name ?? labels.notRecorded} /><Item label={labels.effectiveOn} value={selected?.effective_from ?? ''} /><Item label={labels.active} value={selected?.effective_to ?? labels.active} /></dl> : <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <LocationPicker labels={labels} onChange={setLocationId} options={activeLocations} value={locationId} />
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.effectiveOn}</span><input className="form-field" min={assignments[0]?.effective_from} onChange={(event) => setEffectiveOn(event.target.value)} readOnly={mode === 'edit'} required type="date" value={effectiveOn} /></label>
        </div>}
        {error ? <p className="mt-4 text-sm text-destructive" role="alert">{labels.failed}</p> : null}
        <div className="mt-6 flex justify-end gap-3 border-t pt-4">{mode === 'view' && canWrite && selected ? <button className="button-primary" onClick={() => setMode('edit')} type="button">{labels.edit}</button> : mode !== 'view' ? <button className="button-primary" disabled={saving || !locationId} type="submit">{saving ? labels.saving : labels.save}</button> : null}</div>
      </form>
    </div> : null}
  </section>
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
}

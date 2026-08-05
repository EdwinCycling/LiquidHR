'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Check, Edit3, LoaderCircle, MapPin, Plus, Search, Trash2, X } from 'lucide-react'
import { CountryPicker } from '@/components/ui/country-picker'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import type { AddressSuggestion } from '@/lib/address/address-suggestions'
import type { CompanyAddress, CompanyData, CompanyDataSettings, CompanyLocation } from '@/lib/company-data/service'
import { toCompanyDataUpdatePayload } from '@/lib/company-data/payloads'

interface CompanyDataLabels {
  companySection: string
  companySectionDescription: string
  locationsSection: string
  locationsSectionDescription: string
  singleLocation: string
  singleLocationDescription: string
  singleLocationDisabled: string
  save: string
  saving: string
  saved: string
  failed: string
  addLocation: string
  editLocation: string
  locationName: string
  locationActive: string
  active: string
  inactive: string
  emptyLocations: string
  deleteLocation: string
  deleteConfirm: string
  locationInUse: string
  close: string
  cancel: string
  country: string
  countrySearch: string
  countryEmpty: string
  addressSearch: string
  addressSearchPlaceholder: string
  manualEntry: string
  searchNoResults: string
  searchUnavailable: string
  searchLoading: string
  lookupByPostalCode: string
  lookup: string
  lookupHint: string
  lookupUnavailable: string
  addressLine1: string
  addressLine2: string
  street: string
  houseNumber: string
  addition: string
  postalCode: string
  city: string
  region: string
  addressHelp: string
  genericError: string
  companyHasLocations: string
  singleLocationError: string
}

type AddressDraft = CompanyAddress
type LocationDraft = AddressDraft & { name: string; isActive: boolean }

const blankAddress: AddressDraft = {
  addressLine1: '', addressLine2: '', street: '', houseNumber: '', houseNumberAddition: '', postalCode: '', city: '', region: '', countryCode: 'NL',
}

function addressSummary(address: CompanyAddress): string {
  return [address.addressLine1 ?? [address.street, address.houseNumber, address.houseNumberAddition].filter(Boolean).join(' '), [address.postalCode, address.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

function apiMessage(code: string | undefined, labels: CompanyDataLabels): string {
  if (code === 'COMPANY_HAS_LOCATIONS') return labels.companyHasLocations
  if (code === 'SINGLE_LOCATION_MODE') return labels.singleLocationError
  if (code === 'LOCATION_IN_USE') return labels.locationInUse
  return labels.genericError
}

function AddressFields({ values, onChange, labels, disabled = false }: { values: AddressDraft; onChange: (next: AddressDraft) => void; labels: CompanyDataLabels; disabled?: boolean }) {
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'failed'>('idle')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const isDutch = values.countryCode === 'NL'
  const countryLabel = new Intl.DisplayNames(['nl'], { type: 'region' }).of(values.countryCode) ?? values.countryCode
  const set = (key: keyof AddressDraft, value: string) => onChange({ ...values, [key]: value })
  const updateQuery = (value: string): void => {
    setQuery(value)
    if (value.trim().length < 3) { setSuggestions([]); setSearchState('idle') }
  }
  const updateCountry = (value: string): void => {
    onChange({ ...values, countryCode: value })
    setQuery(''); setSuggestions([]); setSearchState('idle')
  }
  const applySuggestion = (suggestion: AddressSuggestion): void => {
    onChange({ ...values, countryCode: suggestion.countryCode, addressLine1: suggestion.addressLine1, addressLine2: suggestion.addressLine2 ?? '', street: suggestion.street ?? '', houseNumber: suggestion.houseNumber ?? '', houseNumberAddition: suggestion.houseNumberAddition ?? '', postalCode: suggestion.postalCode ?? '', city: suggestion.city ?? '', region: suggestion.region ?? '' })
    setQuery(suggestion.label); setSuggestions([]); setSearchState('idle')
  }

  useEffect(() => {
    if (query.trim().length < 3 || disabled) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchState('loading')
      try {
        const response = await fetch(`/api/address-suggestions?country=${values.countryCode}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        if (!response.ok) throw new Error('ADDRESS_SEARCH_UNAVAILABLE')
        const payload: { data?: AddressSuggestion[] } = await response.json()
        const result = payload.data ?? []
        setSuggestions(result); setSearchState(result.length > 0 ? 'idle' : 'empty')
      } catch {
        if (!controller.signal.aborted) { setSuggestions([]); setSearchState('failed') }
      }
    }, 300)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [disabled, query, values.countryCode])

  async function lookupByPostalCode(): Promise<void> {
    setLookupState('loading')
    try {
      const response = await fetch(`/api/address-lookup?country=NL&postcode=${encodeURIComponent(values.postalCode ?? '')}&houseNumber=${encodeURIComponent(values.houseNumber ?? '')}`)
      if (!response.ok) throw new Error('ADDRESS_LOOKUP_UNAVAILABLE')
      const payload: { data?: AddressSuggestion[] } = await response.json()
      if (payload.data?.[0]) applySuggestion(payload.data[0])
      setLookupState('idle')
    } catch { setLookupState('failed') }
  }

  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="grid gap-1.5 text-sm font-medium"><span>{labels.country}</span><CountryPicker emptyLabel={labels.countryEmpty} locale="nl" onChange={updateCountry} searchLabel={labels.countrySearch} value={values.countryCode} /></label>
    <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.addressSearch}</span><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input autoComplete="off" className="form-field pl-10" disabled={disabled} onChange={(event) => updateQuery(event.target.value)} placeholder={isDutch ? labels.addressSearchPlaceholder : `${labels.addressSearchPlaceholder} ${countryLabel}`} role="combobox" aria-autocomplete="list" aria-controls="company-address-suggestions" aria-expanded={suggestions.length > 0} value={query} /></div><div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{searchState === 'loading' && <span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />{labels.searchLoading}</span>}{searchState === 'failed' && <span className="text-destructive" role="alert">{labels.searchUnavailable}</span>}{searchState === 'empty' && <span>{labels.searchNoResults}</span>}</div>{suggestions.length > 0 && <ul className="mt-1 max-h-60 overflow-y-auto rounded-lg border bg-background shadow-sm" id="company-address-suggestions" role="listbox">{suggestions.map((suggestion) => <li key={`${suggestion.source}-${suggestion.sourceReference ?? suggestion.label}`} role="presentation"><button aria-selected={false} className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent" onClick={() => applySuggestion(suggestion)} role="option" type="button"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{suggestion.label}</span></button></li>)}</ul>}</label>
    <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.manualEntry}</p></div>
    {isDutch ? <>
      <label className="grid gap-1.5 text-sm font-medium"><span>{labels.street}</span><input className="form-field" disabled={disabled} onChange={(event) => set('street', event.target.value)} value={values.street ?? ''} /></label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-3">
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.houseNumber}</span><input className="form-field" disabled={disabled} onChange={(event) => set('houseNumber', event.target.value)} value={values.houseNumber ?? ''} /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.addition}</span><input className="form-field" disabled={disabled} onChange={(event) => set('houseNumberAddition', event.target.value)} value={values.houseNumberAddition ?? ''} /></label>
      </div>
    </> : <>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{labels.addressLine1}</span><input className="form-field" disabled={disabled} onChange={(event) => set('addressLine1', event.target.value)} value={values.addressLine1 ?? ''} /></label>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{labels.addressLine2}</span><input className="form-field" disabled={disabled} onChange={(event) => set('addressLine2', event.target.value)} value={values.addressLine2 ?? ''} /></label>
    </>}
    <label className="grid gap-1.5 text-sm font-medium"><span>{labels.postalCode}</span><input className="form-field uppercase" disabled={disabled} onChange={(event) => set('postalCode', event.target.value)} value={values.postalCode ?? ''} /></label>
    {isDutch && (values.postalCode ?? '').trim() && (values.houseNumber ?? '').trim() && !(values.city ?? '').trim() ? <div className="self-end"><button aria-label={`${labels.lookup}: ${labels.lookupByPostalCode}`} className="button-secondary inline-flex w-full justify-center gap-2" disabled={disabled || lookupState === 'loading'} onClick={() => void lookupByPostalCode()} type="button">{lookupState === 'loading' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{lookupState === 'loading' ? labels.searchLoading : labels.lookup}</button><p className="mt-1.5 text-xs text-muted-foreground">{labels.lookupHint}</p></div> : null}
    <label className="grid gap-1.5 text-sm font-medium"><span>{labels.city}</span><input className="form-field" disabled={disabled} onChange={(event) => set('city', event.target.value)} value={values.city ?? ''} /></label>
    <label className="grid gap-1.5 text-sm font-medium"><span>{labels.region}</span><input className="form-field" disabled={disabled} onChange={(event) => set('region', event.target.value)} value={values.region ?? ''} /></label>
    {lookupState === 'failed' ? <p className="text-xs text-destructive sm:col-span-2" role="alert">{labels.lookupUnavailable}</p> : null}
    <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">{labels.addressHelp}</p>
  </div>
}

export function CompanyDataManager({ initial, labels }: { initial: CompanyDataSettings; labels: CompanyDataLabels }) {
  const [company, setCompany] = useState<CompanyData>(initial.company)
  const [locations, setLocations] = useState<CompanyLocation[]>(initial.locations)
  const [companyState, setCompanyState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [locationState, setLocationState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState('')
  const [modal, setModal] = useState<{ id?: string; draft: LocationDraft } | null>(null)
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false)

  useEffect(() => {
    if (!modal) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modal])

  async function saveCompany(): Promise<void> {
    setCompanyState('saving'); setMessage('')
    const response = await fetch('/api/settings/company-data', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toCompanyDataUpdatePayload(company)) })
    const result = await response.json() as { data?: CompanyData; error?: string }
    if (!response.ok || !result.data) { setCompanyState('failed'); setMessage(apiMessage(result.error, labels)); return }
    setCompany(result.data); setCompanyState('saved')
  }

  async function saveLocation(): Promise<void> {
    if (!modal) return
    setLocationState('saving'); setMessage('')
    const payload = { name: modal.draft.name, isActive: modal.draft.isActive, addressLine1: modal.draft.addressLine1, addressLine2: modal.draft.addressLine2, street: modal.draft.street, houseNumber: modal.draft.houseNumber, houseNumberAddition: modal.draft.houseNumberAddition, postalCode: modal.draft.postalCode, city: modal.draft.city, region: modal.draft.region, countryCode: modal.draft.countryCode }
    const response = await fetch(modal.id ? `/api/settings/company-data/locations/${modal.id}` : '/api/settings/company-data/locations', { method: modal.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await response.json() as { data?: CompanyLocation; error?: string }
    if (!response.ok || !result.data) { setLocationState('failed'); setMessage(apiMessage(result.error, labels)); return }
    setLocations((current) => modal.id ? current.map((location) => location.id === result.data?.id ? result.data : location) : [...current, result.data as CompanyLocation])
    setModal(null); setLocationState('idle')
  }

  async function removeLocation(location: CompanyLocation): Promise<void> {
    if (location.used || !window.confirm(labels.deleteConfirm)) return
    setLocationState('saving'); setMessage('')
    const response = await fetch(`/api/settings/company-data/locations/${location.id}`, { method: 'DELETE' })
    const result = await response.json() as { error?: string }
    if (!response.ok) { setLocationState('failed'); setMessage(apiMessage(result.error, labels)); return }
    setLocations((current) => current.filter((item) => item.id !== location.id)); setLocationState('idle')
  }

  const modalView = modal && mounted ? createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center bg-sidebar/60 p-4 backdrop-blur-sm" onMouseDown={() => setModal(null)} role="presentation"><section aria-modal="true" className="max-h-[min(780px,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5 shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.locationsSection}</p><h2 className="mt-1 text-xl font-semibold">{modal.id ? labels.editLocation : labels.addLocation}</h2></div><button aria-label={labels.close} className="button-secondary" onClick={() => setModal(null)} type="button"><X size={16} /></button></header><form className="mt-6 grid gap-5" onSubmit={(event) => { event.preventDefault(); void saveLocation() }}><label className="grid gap-1.5 text-sm font-medium"><span>{labels.locationName}</span><input autoFocus className="form-field" onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, name: event.target.value } })} value={modal.draft.name} /></label><AddressFields labels={labels} onChange={(draft) => setModal({ ...modal, draft: { ...modal.draft, ...draft } })} values={modal.draft} /><label className="flex items-center gap-3 text-sm font-medium"><input checked={modal.draft.isActive} className="size-4 accent-primary" onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, isActive: event.target.checked } })} type="checkbox" />{labels.locationActive}</label><div className="flex flex-wrap justify-end gap-2 border-t pt-5"><button className="button-secondary" onClick={() => setModal(null)} type="button">{labels.cancel}</button><button className="button-primary" disabled={locationState === 'saving'} type="submit">{locationState === 'saving' ? <><LoaderCircle className="mr-2 animate-spin" size={16} />{labels.saving}</> : labels.save}</button></div>{locationState === 'failed' ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</form></section></div>, document.body) : null

  return <>
    <SettingsAccordion alwaysOpen initialOpen="companyData" sections={[
      { id: 'companyData', title: <span><span className="block">{labels.companySection}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{labels.companySectionDescription}</span></span>, children: <form className="grid gap-6" onSubmit={(event) => { event.preventDefault(); void saveCompany() }}><label className="flex items-start gap-3 rounded-xl border bg-background p-4 text-sm"><input checked={company.singleLocation} className="mt-0.5 size-4 accent-primary" onChange={(event) => setCompany({ ...company, singleLocation: event.target.checked })} type="checkbox" /><span><span className="block font-semibold">{labels.singleLocation}</span><span className="mt-1 block leading-5 text-muted-foreground">{labels.singleLocationDescription}</span></span></label><AddressFields labels={labels} onChange={(address) => setCompany({ ...company, ...address })} values={company} /><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className={`text-sm ${companyState === 'failed' ? 'text-destructive' : companyState === 'saved' ? 'text-success' : 'text-muted-foreground'}`} role={companyState === 'failed' ? 'alert' : 'status'}>{companyState === 'failed' ? message : companyState === 'saved' ? <><Check className="mr-1 inline" size={16} />{labels.saved}</> : ''}</p><button className="button-primary" disabled={companyState === 'saving'} type="submit">{companyState === 'saving' ? <><LoaderCircle className="mr-2 inline animate-spin" size={16} />{labels.saving}</> : labels.save}</button></div></form> },
      { id: 'locations', title: <span><span className="block">{labels.locationsSection}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{labels.locationsSectionDescription}</span></span>, children: <div><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{company.singleLocation ? labels.singleLocationDisabled : labels.locationsSectionDescription}</p><button className="button-primary inline-flex shrink-0 items-center gap-2" disabled={company.singleLocation} onClick={() => { setMessage(''); setModal({ draft: { ...blankAddress, name: '', isActive: true } }) }} type="button"><Plus size={16} />{labels.addLocation}</button></div><fieldset className={company.singleLocation ? 'opacity-50' : ''} disabled={company.singleLocation}><div className="grid gap-3">{locations.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{labels.emptyLocations}</div> : locations.map((location) => <article className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background p-4" key={location.id}><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><MapPin size={18} /></span><div className="min-w-0"><h3 className="font-semibold">{location.name}</h3><p className="mt-1 truncate text-sm text-muted-foreground">{addressSummary(location)}</p><div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold"><span className={location.isActive ? 'rounded-full bg-success/10 px-2 py-1 text-success' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>{location.isActive ? labels.active : labels.inactive}</span>{location.used ? <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">{labels.locationInUse}</span> : null}</div></div></div><div className="flex shrink-0 gap-2"><button aria-label={`${labels.editLocation}: ${location.name}`} className="button-secondary" onClick={() => setModal({ id: location.id, draft: { ...location } })} type="button"><Edit3 size={16} /></button><button aria-label={`${labels.deleteLocation}: ${location.name}`} className="button-secondary text-destructive" disabled={location.used || locationState === 'saving'} onClick={() => void removeLocation(location)} type="button"><Trash2 size={16} /></button></div></article>)}</div></fieldset><p className="mt-5 text-sm" role="status">{locationState === 'failed' ? <span className="text-destructive">{message}</span> : ''}</p></div> },
    ]} />{modalView}</>
}

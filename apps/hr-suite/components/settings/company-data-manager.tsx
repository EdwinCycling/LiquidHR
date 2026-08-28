'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Check, Edit3, LoaderCircle, MapPin, Plus, Search, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormActions } from '@/components/patterns/form-actions'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CountryPicker } from '@/components/ui/country-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { AddressSuggestion } from '@/lib/address/address-suggestions'
import type { CompanyAddress, CompanyData, CompanyDataSettings, CompanyLocation } from '@/lib/company-data/service'
import { toCompanyDataUpdatePayload } from '@/lib/company-data/payloads'

interface CompanyDataLabels {
  companySection: string
  companySectionDescription: string
  locationsSection: string
  locationsSectionDescription: string
  addressSearchHint: string
  saveHint: string
  singleLocation: string
  singleLocationDescription: string
  singleLocationDisabled: string
  save: string
  saving: string
  saved: string
  ready: string
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
  discardTitle: string
  discardDescription: string
  discardChanges: string
  keepEditing: string
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

const emptyHydrationSubscribe = () => () => undefined
const getClientHydrated = () => true
const getServerHydrated = () => false

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

function locationDraft(location?: CompanyLocation): LocationDraft {
  return {
    ...blankAddress,
    name: location?.name ?? '',
    isActive: location?.isActive ?? true,
    addressLine1: location?.addressLine1 ?? '',
    addressLine2: location?.addressLine2 ?? '',
    street: location?.street ?? '',
    houseNumber: location?.houseNumber ?? '',
    houseNumberAddition: location?.houseNumberAddition ?? '',
    postalCode: location?.postalCode ?? '',
    city: location?.city ?? '',
    region: location?.region ?? '',
    countryCode: location?.countryCode ?? 'NL',
  }
}

function AddressFields({ values, onChange, labels, disabled = false }: { values: AddressDraft; onChange: (next: AddressDraft) => void; labels: CompanyDataLabels; disabled?: boolean }) {
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'failed'>('idle')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const hydrated = useSyncExternalStore(emptyHydrationSubscribe, getClientHydrated, getServerHydrated)
  const isDutch = values.countryCode === 'NL'
  const countryLabel = hydrated ? new Intl.DisplayNames(['nl'], { type: 'region' }).of(values.countryCode) ?? values.countryCode : values.countryCode
  const set = (key: keyof AddressDraft, value: string) => onChange({ ...values, [key]: value })

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

  function updateQuery(value: string): void {
    setQuery(value)
    if (value.trim().length < 3) { setSuggestions([]); setSearchState('idle') }
  }

  function updateCountry(value: string): void {
    onChange({ ...values, countryCode: value }); setQuery(''); setSuggestions([]); setSearchState('idle')
  }

  function applySuggestion(suggestion: AddressSuggestion): void {
    onChange({ ...values, countryCode: suggestion.countryCode, addressLine1: suggestion.addressLine1, addressLine2: suggestion.addressLine2 ?? '', street: suggestion.street ?? '', houseNumber: suggestion.houseNumber ?? '', houseNumberAddition: suggestion.houseNumberAddition ?? '', postalCode: suggestion.postalCode ?? '', city: suggestion.city ?? '', region: suggestion.region ?? '' })
    setQuery(suggestion.label); setSuggestions([]); setSearchState('idle')
  }

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
    <div className="grid gap-1.5 text-sm"><span className="font-medium text-foreground">{labels.country}</span><CountryPicker emptyLabel={labels.countryEmpty} locale="nl" onChange={updateCountry} searchLabel={labels.countrySearch} value={values.countryCode} /></div>
    <div className="relative min-w-0">
      <FormField control={<TextInput aria-autocomplete="list" aria-controls="company-address-suggestions" aria-expanded={suggestions.length > 0} autoComplete="off" disabled={disabled} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => updateQuery(event.target.value)} placeholder={isDutch ? labels.addressSearchPlaceholder : `${labels.addressSearchPlaceholder} ${countryLabel}`} role="combobox" value={query} />} label={labels.addressSearch} />
      <div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{searchState === 'loading' && <span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />{labels.searchLoading}</span>}{searchState === 'failed' && <span className="text-destructive" role="alert">{labels.searchUnavailable}</span>}{searchState === 'empty' && <span>{labels.searchNoResults}</span>}</div>
      {suggestions.length > 0 && <ul className="absolute inset-x-0 top-[4.5rem] z-10 max-h-60 overflow-y-auto rounded-[var(--radius-overlay)] border border-border bg-surface-overlay p-1 shadow-[var(--elevation-overlay)]" id="company-address-suggestions" role="listbox">{suggestions.map((suggestion) => <li key={`${suggestion.source}-${suggestion.sourceReference ?? suggestion.label}`} role="presentation"><button aria-selected={false} className="flex min-h-10 w-full items-start gap-2 rounded-[var(--radius-control)] border-b border-border-subtle px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus" onClick={() => applySuggestion(suggestion)} role="option" type="button"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span>{suggestion.label}</span></button></li>)}</ul>}
    </div>
    <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.manualEntry}</p></div>
    {isDutch ? <>
      <FormField control={<TextInput disabled={disabled} onChange={(event) => set('street', event.target.value)} value={values.street ?? ''} />} label={labels.street} />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-3"><FormField control={<TextInput disabled={disabled} onChange={(event) => set('houseNumber', event.target.value)} value={values.houseNumber ?? ''} />} label={labels.houseNumber} /><FormField control={<TextInput disabled={disabled} onChange={(event) => set('houseNumberAddition', event.target.value)} value={values.houseNumberAddition ?? ''} />} label={labels.addition} /></div>
    </> : <>
      <div className="sm:col-span-2"><FormField control={<TextInput disabled={disabled} onChange={(event) => set('addressLine1', event.target.value)} value={values.addressLine1 ?? ''} />} label={labels.addressLine1} /></div>
      <div className="sm:col-span-2"><FormField control={<TextInput disabled={disabled} onChange={(event) => set('addressLine2', event.target.value)} value={values.addressLine2 ?? ''} />} label={labels.addressLine2} /></div>
    </>}
    <FormField control={<TextInput className="uppercase" disabled={disabled} onChange={(event) => set('postalCode', event.target.value)} value={values.postalCode ?? ''} />} label={labels.postalCode} />
    {isDutch && (values.postalCode ?? '').trim() && (values.houseNumber ?? '').trim() && !(values.city ?? '').trim() ? <div className="self-end"><Button aria-label={`${labels.lookup}: ${labels.lookupByPostalCode}`} disabled={disabled || lookupState === 'loading'} onClick={() => void lookupByPostalCode()} size="sm" type="button" variant="secondary">{lookupState === 'loading' ? labels.searchLoading : labels.lookup}</Button><p className="mt-1.5 text-xs text-muted-foreground">{labels.lookupHint}</p></div> : null}
    <FormField control={<TextInput disabled={disabled} onChange={(event) => set('city', event.target.value)} value={values.city ?? ''} />} label={labels.city} />
    <FormField control={<TextInput disabled={disabled} onChange={(event) => set('region', event.target.value)} value={values.region ?? ''} />} label={labels.region} />
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
  const [modal, setModal] = useState<{ id?: string; draft: LocationDraft; original: LocationDraft } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CompanyLocation | null>(null)
  const [activeSection, setActiveSection] = useState<'company' | 'locations'>('company')

  function updateCompany(next: CompanyData): void {
    setCompany(next); setCompanyState('idle'); setMessage('')
  }

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
    setLocationState('saving'); setMessage('')
    const response = await fetch(`/api/settings/company-data/locations/${location.id}`, { method: 'DELETE' })
    const result = await response.json() as { error?: string }
    if (!response.ok) { setLocationState('failed'); setMessage(apiMessage(result.error, labels)); return }
    setLocations((current) => current.filter((item) => item.id !== location.id)); setLocationState('idle'); setDeleteTarget(null)
  }

  const locationDirty = modal ? JSON.stringify(modal.draft) !== JSON.stringify(modal.original) : false

  return <>
    <div className="space-y-5">
      <ScrollableTabs ariaLabel={labels.companySection} contentProps={{ 'aria-label': labels.companySection, role: 'tablist' }} leftLabel={labels.companySection} rightLabel={labels.locationsSection}>
        <TabButton active={activeSection === 'company'} aria-controls="company-data-panel" onClick={() => setActiveSection('company')}>{labels.companySection}</TabButton>
        <TabButton active={activeSection === 'locations'} aria-controls="locations-panel" disabled={company.singleLocation} onClick={() => setActiveSection('locations')}>{labels.locationsSection} <Badge className="ml-1" tone="neutral">{locations.length}</Badge></TabButton>
      </ScrollableTabs>

      {activeSection === 'company' ? <Surface aria-labelledby="company-data-title" className="p-5 sm:p-7" id="company-data-panel" role="tabpanel">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.companySection}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight" id="company-data-title">{labels.companySection}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.companySectionDescription}</p></div><Badge tone={companyState === 'failed' ? 'danger' : companyState === 'saved' ? 'success' : 'neutral'}>{companyState === 'saved' ? labels.saved : companyState === 'failed' ? labels.failed : labels.ready}</Badge></header>
        <form className="mt-6 grid gap-5" onSubmit={(event) => { event.preventDefault(); void saveCompany() }}>
          <Surface className="p-4 sm:p-5" variant="subtle"><div className="mb-4"><p className="text-sm font-semibold">{labels.addressSearch}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{labels.addressSearchHint}</p></div><AddressFields labels={labels} onChange={(address) => updateCompany({ ...company, ...address })} values={company} /></Surface>
          <Checkbox checked={company.singleLocation} description={labels.singleLocationDescription} label={labels.singleLocation} onChange={(event) => { updateCompany({ ...company, singleLocation: event.target.checked }); setActiveSection('company') }} />
          <div className="border-t border-border-subtle pt-5"><p className={`mb-3 min-h-5 text-sm ${companyState === 'failed' ? 'text-destructive' : companyState === 'saved' ? 'text-success' : 'text-muted-foreground'}`} role={companyState === 'failed' ? 'alert' : 'status'}>{companyState === 'failed' ? message : companyState === 'saved' ? <><Check aria-hidden="true" className="mr-1 inline size-4" />{labels.saved}</> : labels.saveHint}</p><FormActions cancelLabel={labels.cancel} onCancel={() => { setCompany(initial.company); setCompanyState('idle'); setMessage('') }} saveLabel={labels.save} saving={companyState === 'saving'} /></div>
        </form>
      </Surface> : <Surface aria-labelledby="locations-title" className="p-5 sm:p-7" id="locations-panel" role="tabpanel">
        <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.locationsSection}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight" id="locations-title">{labels.locationsSection}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.locationsSectionDescription}</p></div><Button disabled={company.singleLocation} onClick={() => { setMessage(''); const draft = locationDraft(); setModal({ draft, original: draft }) }} size="sm" type="button"><Plus aria-hidden="true" />{labels.addLocation}</Button></header>
        {company.singleLocation ? <p className="mt-6 rounded-[var(--radius-control)] border border-warning/30 bg-warning-surface/60 p-4 text-sm leading-5 text-muted-foreground">{labels.singleLocationDisabled}</p> : null}
        <div className="mt-6">{locations.length === 0 ? <EmptyState description={labels.emptyLocations} title={labels.locationsSection} /> : <Surface className="overflow-hidden"><ol className="divide-y divide-border-subtle">{locations.map((location) => <li className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4" key={location.id}><div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><MapPin className="size-4" /></span><div className="min-w-0"><h3 className="break-words font-semibold">{location.name}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{addressSummary(location)}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={location.isActive ? 'success' : 'neutral'}>{location.isActive ? labels.active : labels.inactive}</Badge>{location.used ? <Badge tone="warning">{labels.locationInUse}</Badge> : null}</div></div></div><div className="flex shrink-0 gap-1"><IconButton label={`${labels.editLocation}: ${location.name}`} onClick={() => { const draft = locationDraft(location); setModal({ id: location.id, draft, original: draft }) }} size="sm" type="button" variant="ghost"><Edit3 aria-hidden="true" /></IconButton><IconButton label={`${labels.deleteLocation}: ${location.name}`} disabled={location.used || locationState === 'saving'} onClick={() => setDeleteTarget(location)} size="sm" type="button" variant="ghost"><Trash2 aria-hidden="true" /></IconButton></div></li>)}</ol></Surface>}</div>
        <p className="mt-5 min-h-5 text-sm" role={locationState === 'failed' ? 'alert' : 'status'}>{locationState === 'failed' ? <span className="text-destructive">{message}</span> : null}</p>
      </Surface>}
    </div>

    <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.locationsSectionDescription} dirty={locationDirty} dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardChanges, keepEditingLabel: labels.keepEditing }} onDiscard={() => setModal(null)} onOpenChange={(open) => { if (!open) setModal(null) }} onSubmit={(event) => { event.preventDefault(); void saveLocation() }} open={modal !== null} saveLabel={labels.save} saving={locationState === 'saving'} title={modal?.id ? labels.editLocation : labels.addLocation}>
      {modal ? <><FormField control={<TextInput autoFocus onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, name: event.target.value } })} value={modal.draft.name} />} label={labels.locationName} /><AddressFields disabled={locationState === 'saving'} labels={labels} onChange={(draft) => setModal({ ...modal, draft: { ...modal.draft, ...draft } })} values={modal.draft} /><Checkbox checked={modal.draft.isActive} label={labels.locationActive} onChange={(event) => setModal({ ...modal, draft: { ...modal.draft, isActive: event.target.checked } })} />{locationState === 'failed' ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}</> : null}
    </FormDrawer>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.deleteLocation} description={labels.deleteConfirm} destructive onConfirm={() => deleteTarget ? removeLocation(deleteTarget) : undefined} onOpenChange={(open) => { if (!open && locationState !== 'saving') setDeleteTarget(null) }} open={deleteTarget !== null} title={labels.deleteLocation} />
  </>
}

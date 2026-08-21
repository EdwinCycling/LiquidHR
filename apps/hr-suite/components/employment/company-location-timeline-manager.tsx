'use client'

import { MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { EmptyState } from '@/components/ui/empty-state'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { Surface } from '@/components/ui/surface'

interface CompanyAddress { address_line_1: string | null; address_line_2: string | null; street: string | null; house_number: string | null; house_number_addition: string | null; postal_code: string | null; city: string | null; region: string | null; country_code: string }
interface CompanyLocationOption { id: string; name: string; is_active: boolean }
interface CompanyLocationAssignment { id: string; location_id: string | null; effective_from: string; effective_to: string | null }
interface Labels {
  title: string; description: string; company: string; companyAddress: string; locations: string; current: string; history: string; active: string; notRecorded: string; readOnly: string; noLocations: string; location: string; locationSearch: string; locationSearchPlaceholder: string; noLocationResults: string; add: string; edit: string; save: string; cancel: string; effectiveOn: string; failed: string; saving: string; changeSaved: string; singleLocationMode: string
  discardTitle?: string; discardDescription?: string; discardConfirm?: string; discardCancel?: string
}

function formatAddress(address: CompanyAddress | null): string {
  if (!address) return ''
  const street = [address.street, address.house_number, address.house_number_addition].filter(Boolean).join(' ')
  const line = address.country_code === 'NL' ? street : address.address_line_1
  return [line, address.address_line_2, [address.postal_code, address.city].filter(Boolean).join(' '), address.region].filter(Boolean).join(', ')
}

export function CompanyLocationTimelineManager({ company, locations, assignments, employmentId, canWrite, labels }: { company: { name: string; single_location: boolean; address: CompanyAddress | null }; locations: CompanyLocationOption[]; assignments: CompanyLocationAssignment[]; employmentId: string; canWrite: boolean; labels: Labels }) {
  const router = useRouter()
  const [selected, setSelected] = useState<CompanyLocationAssignment | null>(null)
  const [mode, setMode] = useState<'edit' | 'add'>('add')
  const [effectiveOn, setEffectiveOn] = useState('')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [initialValues, setInitialValues] = useState('')
  const currentValues = JSON.stringify({ mode, selectedId: selected?.id ?? null, effectiveOn, locationId })
  const dirty = open && currentValues !== initialValues
  const activeLocations = locations.filter((location) => location.is_active)

  function openEdit(assignment: CompanyLocationAssignment): void {
    const nextValues = { mode: 'edit', selectedId: assignment.id, effectiveOn: assignment.effective_from, locationId: assignment.location_id ?? '' }
    setSelected(assignment); setMode('edit'); setEffectiveOn(nextValues.effectiveOn); setLocationId(nextValues.locationId); setError(''); setInitialValues(JSON.stringify(nextValues)); setOpen(true)
  }

  function add(): void {
    const current = assignments[0]
    const nextValues = { mode: 'add', selectedId: null, effectiveOn: '', locationId: current?.location_id ?? activeLocations[0]?.id ?? '' }
    setSelected(null); setMode('add'); setEffectiveOn(''); setLocationId(nextValues.locationId); setError(''); setInitialValues(JSON.stringify(nextValues)); setOpen(true)
  }

  function close(): void { setOpen(false); setSelected(null); setError('') }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    if (!canWrite) return
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch(`/api/employments/${employmentId}/company-location`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ placementId: mode === 'edit' ? selected?.id : null, effectiveOn, locationId }) })
      if (!response.ok) { const result = await response.json() as { code?: string }; setError(result.code ?? labels.failed); return }
      close(); router.refresh()
    } catch { setError(labels.failed) } finally { setSaving(false) }
  }

  if (company.single_location) return <Surface className="p-5"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.title}</p><h2 className="mt-1 text-xl font-semibold">{labels.company}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.singleLocationMode}</p></div><Badge tone="neutral">{labels.readOnly}</Badge></header><article className="mt-5 flex items-start gap-3 border-t border-subtle pt-4"><span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><MapPin aria-hidden="true" className="h-5 w-5" /></span><div><h3 className="font-semibold">{company.name}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.companyAddress}: {formatAddress(company.address) || labels.notRecorded}</p></div></article></Surface>

  return <Surface className="p-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.title}</p><h2 className="mt-1 text-xl font-semibold">{labels.locations}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.description}</p></div>{canWrite && activeLocations.length > 0 ? <Button onClick={add} type="button">{labels.add}</Button> : null}</header>
    {activeLocations.length === 0 ? <EmptyState className="mt-5" title={labels.noLocations} /> : null}
    {assignments.length > 0 ? <div className="mt-5 divide-y divide-subtle border-y border-subtle">{assignments.map((assignment, index) => { const location = locations.find((option) => option.id === assignment.location_id); const content = <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{index === 0 ? labels.current : labels.history}</p><p className="mt-1 font-semibold">{location?.name ?? labels.notRecorded}</p></div><Badge tone={index === 0 ? 'info' : 'neutral'}>{assignment.effective_to ?? labels.active}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{labels.effectiveOn}: {assignment.effective_from}</p></>; return canWrite ? <button className="w-full cursor-pointer px-2 py-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" key={assignment.id} onClick={() => openEdit(assignment)} type="button">{content}</button> : <article className="px-2 py-4 text-left" key={assignment.id}>{content}</article> })}</div> : null}
    {canWrite ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} dirty={dirty} dirtyProtection={{ title: labels.discardTitle ?? labels.cancel, description: labels.discardDescription ?? labels.failed, discardLabel: labels.discardConfirm ?? labels.cancel, keepEditingLabel: labels.discardCancel ?? labels.cancel }} onDiscard={close} onOpenChange={(nextOpen) => { if (!nextOpen) close() }} onSubmit={save} open={open} saveLabel={labels.save} saving={saving} title={mode === 'add' ? labels.add : labels.edit}>
      <FormField label={labels.location} required control={<DropdownSelect required searchable searchPlaceholder={labels.locationSearchPlaceholder} emptyLabel={labels.noLocationResults} value={locationId} onChange={(event) => setLocationId(event.target.value)}><option disabled value="">{labels.locationSearchPlaceholder}</option>{activeLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</DropdownSelect>} />
      <FormField label={labels.effectiveOn} required control={<TextInput required min={assignments[0]?.effective_from} readOnly={mode === 'edit'} type="date" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} />} />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </FormDrawer> : null}
  </Surface>
}

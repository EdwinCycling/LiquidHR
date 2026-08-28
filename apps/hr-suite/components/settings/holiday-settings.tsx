'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, CalendarPlus, Download, MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CountryPicker, type CountryPickerOption } from '@/components/ui/country-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { TextInput } from '@/components/ui/text-input'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'

type Holiday = { id: string; holiday_date: string; display_name: string | null; provider_name: string; source: string; is_active: boolean }
type CompanyActivity = { id: string; name: string; activity_date: string; is_active: boolean }
type Preview = { date: string; displayName: string; providerName: string }
type ActivityDraft = { id: string; name: string; date: string; isActive: boolean }
type Labels = Record<'year'|'country'|'countrySearch'|'countryEmpty'|'preview'|'import'|'imported'|'providerFailed'|'localTitle'|'localName'|'date'|'add'|'calendarTitle'|'empty'|'api'|'manual'|'included'|'excluded'|'activate'|'deactivate'|'saving'|'activityTitle'|'activityName'|'activityEmpty'|'activityAdd'|'activityAdded'|'activityEdit'|'activitySave'|'activityUpdated'|'activityDuplicate'|'activated'|'deactivated'|'failed'|'cancel'|'close'|'activityActive'|'activityInactive', string>

async function responseError(response: Response, fallback: string, duplicate: string): Promise<string> {
  try {
    const body = await response.json() as { error?: string }
    return body.error === 'COMPANY_ACTIVITY_DUPLICATE' ? duplicate : fallback
  } catch {
    return fallback
  }
}

export function HolidaySettings({ initial, initialActivities, initialYear, labels, locale }: { initial: Holiday[]; initialActivities: CompanyActivity[]; initialYear: number; labels: Labels; locale: string }) {
  const toastTimeout = useRef<number | null>(null)
  const [year, setYear] = useState(initialYear)
  const [countryCode, setCountryCode] = useState('NL')
  const [countries, setCountries] = useState<CountryPickerOption[]>([])
  const [holidays, setHolidays] = useState(initial)
  const [activities, setActivities] = useState(initialActivities)
  const [preview, setPreview] = useState<Preview[]>([])
  const [localName, setLocalName] = useState('')
  const [localDate, setLocalDate] = useState(`${initialYear}-01-01`)
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState(`${initialYear}-01-01`)
  const [activityModal, setActivityModal] = useState<ActivityDraft | null>(null)
  const [activityInitial, setActivityInitial] = useState<ActivityDraft | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle'|'loading'|'imported'|'failed'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/settings/holidays/countries', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { data?: CountryPickerOption[] }
      if (!cancelled && Array.isArray(body.data)) setCountries(body.data)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
  }, [])

  function showToast(message: string): void {
    setToast(message)
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
    toastTimeout.current = window.setTimeout(() => { setToast(null); toastTimeout.current = null }, 4000)
  }

  async function refresh(nextYear = year): Promise<void> {
    const [holidayResponse, activityResponse] = await Promise.all([
      fetch(`/api/settings/holidays?year=${nextYear}`, { cache: 'no-store' }),
      fetch(`/api/settings/company-activities?year=${nextYear}`, { cache: 'no-store' }),
    ])
    if (holidayResponse.ok) setHolidays((await holidayResponse.json()).data as Holiday[])
    if (activityResponse.ok) setActivities((await activityResponse.json()).data as CompanyActivity[])
  }

  async function showPreview(): Promise<void> {
    setStatus('loading')
    const response = await fetch(`/api/settings/holidays/preview?year=${year}&country=${countryCode}`)
    if (!response.ok) { setStatus('failed'); return }
    setPreview((await response.json()).data as Preview[])
    setStatus('idle')
  }

  async function importSnapshot(): Promise<void> {
    setStatus('loading')
    const response = await fetch('/api/settings/holidays', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'IMPORT', year, countryCode }) })
    if (!response.ok) { setStatus('failed'); return }
    await refresh()
    setStatus('imported')
  }

  async function addLocal(): Promise<void> {
    setStatus('loading')
    const response = await fetch('/api/settings/holidays', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'MANUAL', year, countryCode, date: localDate, name: localName }) })
    if (!response.ok) { setStatus('failed'); return }
    setLocalName('')
    await refresh()
    setStatus('idle')
  }

  async function addActivity(): Promise<void> {
    setStatus('loading')
    setErrorMessage(null)
    const response = await fetch('/api/settings/company-activities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year, date: activityDate, name: activityName }) })
    if (!response.ok) {
      setErrorMessage(await responseError(response, labels.failed, labels.activityDuplicate))
      setStatus('failed')
      return
    }
    setActivityName('')
    await refresh()
    setStatus('idle')
    showToast(labels.activityAdded)
  }

  async function toggle(holiday: Holiday): Promise<void> {
    const nextActive = !holiday.is_active
    const response = await fetch(`/api/settings/holidays/${holiday.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: nextActive }) })
    if (!response.ok) { setErrorMessage(labels.failed); return }
    setHolidays((current) => current.map((item) => item.id === holiday.id ? { ...item, is_active: nextActive } : item))
    showToast(nextActive ? labels.activated : labels.deactivated)
  }

  function openActivity(activity: CompanyActivity): void {
    const draft = { id: activity.id, name: activity.name, date: activity.activity_date, isActive: activity.is_active }
    setActivityModal(draft)
    setActivityInitial(draft)
    setErrorMessage(null)
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!activityModal || !activityModal.name.trim()) return
    setStatus('loading')
    setErrorMessage(null)
    const response = await fetch(`/api/settings/company-activities/${activityModal.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year, date: activityModal.date, name: activityModal.name, isActive: activityModal.isActive }) })
    if (!response.ok) {
      setErrorMessage(await responseError(response, labels.failed, labels.activityDuplicate))
      setStatus('failed')
      return
    }
    setActivityModal(null)
    setActivityInitial(null)
    await refresh()
    setStatus('idle')
    showToast(labels.activityUpdated)
  }

  const items = [
    ...holidays.map((holiday) => ({ kind: 'holiday' as const, date: holiday.holiday_date, holiday })),
    ...activities.map((activity) => ({ kind: 'activity' as const, date: activity.activity_date, activity })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind))
  const activityDirty = JSON.stringify(activityModal) !== JSON.stringify(activityInitial)

  return <div className="space-y-6">
    <Surface className="p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-accent text-primary"><Download aria-hidden="true" size={20} /></span><h2 className="font-semibold">{labels.import}</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-[10rem_10rem_1fr] sm:items-end"><FormField control={<TextInput max={2200} min={2000} onChange={(event) => { const next = Number(event.target.value); setYear(next); setLocalDate(`${next}-01-01`); setActivityDate(`${next}-01-01`); void refresh(next) }} type="number" value={year} />} label={labels.year} required /><div className="grid gap-1.5 text-sm"><span className="font-medium">{labels.country}</span><CountryPicker emptyLabel={labels.countryEmpty} locale={locale} onChange={setCountryCode} options={countries} searchLabel={labels.countrySearch} value={countryCode} /></div><div className="flex flex-wrap gap-2"><Button onClick={() => void showPreview()} size="sm" type="button" variant="secondary">{labels.preview}</Button><Button loading={status === 'loading'} onClick={() => void importSnapshot()} size="sm" type="button">{labels.import}</Button></div></div>{status === 'imported' ? <p className="mt-4 text-sm text-success" role="status">{labels.imported}</p> : null}{status === 'failed' && !errorMessage ? <p className="mt-4 text-sm text-destructive" role="alert">{labels.providerFailed}</p> : null}{preview.length ? <div className="mt-5 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{preview.map((holiday) => <div className="rounded-[var(--radius-control)] bg-muted px-3 py-2 text-sm" key={`${holiday.date}-${holiday.providerName}`}><span className="font-semibold">{holiday.date}</span><span className="ml-2 text-muted-foreground">{holiday.displayName}</span></div>)}</div> : null}</Surface>

    <Surface className="p-5"><div className="flex items-center gap-3"><CalendarPlus aria-hidden="true" className="text-primary" size={20} /><h2 className="font-semibold">{labels.localTitle}</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"><FormField control={<TextInput onChange={(event) => setLocalName(event.target.value)} value={localName} />} label={labels.localName} required /><FormField control={<TextInput onChange={(event) => setLocalDate(event.target.value)} type="date" value={localDate} />} label={labels.date} required /><Button disabled={!localName.trim() || status === 'loading'} onClick={() => void addLocal()} type="button">{labels.add}</Button></div></Surface>

    <Surface className="p-5"><div className="flex items-center gap-3"><CalendarDays aria-hidden="true" className="text-primary" size={20} /><h2 className="font-semibold">{labels.activityTitle}</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"><FormField control={<TextInput onChange={(event) => setActivityName(event.target.value)} value={activityName} />} label={labels.activityName} required /><FormField control={<TextInput onChange={(event) => setActivityDate(event.target.value)} type="date" value={activityDate} />} label={labels.date} required /><Button disabled={!activityName.trim() || status === 'loading'} onClick={() => void addActivity()} type="button">{labels.activityAdd}</Button></div>{errorMessage && !activityModal ? <p aria-live="polite" className="mt-4 text-sm text-destructive" role="alert">{errorMessage}</p> : null}</Surface>

    <Surface><div className="flex items-center gap-3 border-b border-subtle px-5 py-4"><MapPin aria-hidden="true" className="text-primary" size={20} /><h2 className="font-semibold">{labels.calendarTitle}</h2></div>{items.length === 0 ? <EmptyState className="m-5" title={labels.empty} /> : <div className="divide-y divide-border-subtle">{items.map((item) => item.kind === 'holiday' ? <div className={`flex flex-wrap items-center gap-4 px-5 py-3 ${item.holiday.is_active ? '' : 'opacity-60'}`} key={`holiday-${item.holiday.id}`}><time className="w-20 shrink-0 text-sm font-semibold" dateTime={item.holiday.holiday_date}>{item.holiday.holiday_date.slice(5)}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.holiday.display_name ?? item.holiday.provider_name}</p><p className="text-xs text-muted-foreground">{item.holiday.source === 'API' ? labels.api : labels.manual}</p></div><Badge tone={item.holiday.is_active ? 'success' : 'neutral'}>{item.holiday.is_active ? labels.included : labels.excluded}</Badge><Button aria-pressed={item.holiday.is_active} onClick={() => void toggle(item.holiday)} size="sm" type="button" variant="secondary">{item.holiday.is_active ? labels.deactivate : labels.activate}</Button></div> : <div className={`flex flex-wrap items-center gap-4 px-5 py-3 ${item.activity.is_active ? '' : 'opacity-60'}`} key={`activity-${item.activity.id}`}><time className="w-20 shrink-0 text-sm font-semibold text-primary" dateTime={item.activity.activity_date}>{item.activity.activity_date.slice(5)}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.activity.name}</p><p className="text-xs text-muted-foreground">{item.activity.is_active ? labels.activityActive : labels.activityInactive}</p></div><Button aria-label={`${labels.activityEdit}: ${item.activity.name}`} onClick={() => openActivity(item.activity)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" />{labels.activityEdit}</Button></div>)}</div>}</Surface>

    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">{toast ? <p className="rounded-[var(--radius-overlay)] border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground shadow-[var(--elevation-overlay)]">{toast}</p> : null}</div>

    {activityModal ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.activityTitle} dirty={activityDirty} dirtyProtection={{ description: labels.failed, discardLabel: labels.cancel, keepEditingLabel: labels.activityEdit, title: labels.close }} onDiscard={() => { setActivityModal(null); setActivityInitial(null) }} onOpenChange={(open) => { if (!open && !activityDirty) { setActivityModal(null); setActivityInitial(null) } }} onSubmit={(event) => void saveActivity(event)} open saveLabel={labels.activitySave} saving={status === 'loading'} title={labels.activityEdit}><FormField control={<TextInput onChange={(event) => setActivityModal((current) => current ? { ...current, name: event.target.value } : current)} required value={activityModal.name} />} label={labels.activityName} required /><FormField control={<TextInput onChange={(event) => setActivityModal((current) => current ? { ...current, date: event.target.value } : current)} required type="date" value={activityModal.date} />} label={labels.date} required /><Switch checked={activityModal.isActive} label={activityModal.isActive ? labels.activityActive : labels.activityInactive} onChange={(event) => setActivityModal((current) => current ? { ...current, isActive: event.target.checked } : current)} />{errorMessage ? <p aria-live="polite" className="text-sm text-destructive" role="alert">{errorMessage}</p> : null}</FormDrawer> : null}
  </div>
}

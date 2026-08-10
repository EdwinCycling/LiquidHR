'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, CalendarPlus, Download, LoaderCircle, MapPin, Pencil, X } from 'lucide-react'
import { CountryPicker, type CountryPickerOption } from '@/components/ui/country-picker'

type Holiday = { id: string; holiday_date: string; display_name: string | null; provider_name: string; source: string; is_active: boolean }
type CompanyActivity = { id: string; name: string; activity_date: string; is_active: boolean }
type Preview = { date: string; displayName: string; providerName: string }
type ActivityDraft = { id: string; name: string; date: string; isActive: boolean }
type Labels = Record<'year'|'country'|'countrySearch'|'countryEmpty'|'preview'|'import'|'imported'|'providerFailed'|'localTitle'|'localName'|'date'|'add'|'calendarTitle'|'empty'|'api'|'manual'|'included'|'excluded'|'activate'|'deactivate'|'saving'|'activityTitle'|'activityName'|'activityEmpty'|'activityAdd'|'activityAdded'|'activityEdit'|'activitySave'|'activityUpdated'|'activityDuplicate'|'activated'|'deactivated'|'failed'|'cancel'|'close'|'activityActive'|'activityInactive', string>

const emptySubscribe = () => () => undefined
const getClientMounted = () => true
const getServerMounted = () => false

async function responseError(response: Response, fallback: string, duplicate: string): Promise<string> {
  try {
    const body = await response.json() as { error?: string }
    return body.error === 'COMPANY_ACTIVITY_DUPLICATE' ? duplicate : fallback
  } catch {
    return fallback
  }
}

export function HolidaySettings({ initial, initialActivities, initialYear, labels, locale }: { initial: Holiday[]; initialActivities: CompanyActivity[]; initialYear: number; labels: Labels; locale: string }) {
  const mounted = useSyncExternalStore(emptySubscribe, getClientMounted, getServerMounted)
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

  function showToast(message: string) {
    setToast(message)
    if (toastTimeout.current !== null) window.clearTimeout(toastTimeout.current)
    toastTimeout.current = window.setTimeout(() => { setToast(null); toastTimeout.current = null }, 4000)
  }

  async function refresh(nextYear = year) {
    const [holidayResponse, activityResponse] = await Promise.all([
      fetch(`/api/settings/holidays?year=${nextYear}`, { cache: 'no-store' }),
      fetch(`/api/settings/company-activities?year=${nextYear}`, { cache: 'no-store' }),
    ])
    if (holidayResponse.ok) setHolidays((await holidayResponse.json()).data as Holiday[])
    if (activityResponse.ok) setActivities((await activityResponse.json()).data as CompanyActivity[])
  }

  async function showPreview() {
    setStatus('loading')
    const response = await fetch(`/api/settings/holidays/preview?year=${year}&country=${countryCode}`)
    if (!response.ok) { setStatus('failed'); return }
    setPreview((await response.json()).data as Preview[])
    setStatus('idle')
  }

  async function importSnapshot() {
    setStatus('loading')
    const response = await fetch('/api/settings/holidays', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'IMPORT', year, countryCode }) })
    if (!response.ok) { setStatus('failed'); return }
    await refresh()
    setStatus('imported')
  }

  async function addLocal() {
    setStatus('loading')
    const response = await fetch('/api/settings/holidays', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'MANUAL', year, countryCode, date: localDate, name: localName }) })
    if (!response.ok) { setStatus('failed'); return }
    setLocalName('')
    await refresh()
    setStatus('idle')
  }

  async function addActivity() {
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

  async function toggle(holiday: Holiday) {
    const nextActive = !holiday.is_active
    const response = await fetch(`/api/settings/holidays/${holiday.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: nextActive }) })
    if (!response.ok) { setErrorMessage(labels.failed); return }
    setHolidays((current) => current.map((item) => item.id === holiday.id ? { ...item, is_active: nextActive } : item))
    showToast(nextActive ? labels.activated : labels.deactivated)
  }

  function openActivity(activity: CompanyActivity) {
    setActivityModal({ id: activity.id, name: activity.name, date: activity.activity_date, isActive: activity.is_active })
    setErrorMessage(null)
  }

  async function saveActivity() {
    if (!activityModal) return
    setStatus('loading')
    setErrorMessage(null)
    const response = await fetch(`/api/settings/company-activities/${activityModal.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year, date: activityModal.date, name: activityModal.name, isActive: activityModal.isActive }) })
    if (!response.ok) {
      setErrorMessage(await responseError(response, labels.failed, labels.activityDuplicate))
      setStatus('failed')
      return
    }
    setActivityModal(null)
    await refresh()
    setStatus('idle')
    showToast(labels.activityUpdated)
  }

  const items = [
    ...holidays.map((holiday) => ({ kind: 'holiday' as const, date: holiday.holiday_date, holiday })),
    ...activities.map((activity) => ({ kind: 'activity' as const, date: activity.activity_date, activity })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind))

  return <div className="space-y-6">
    <section className="w-full rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><Download size={20} /></span><div><h2 className="font-semibold">{labels.import}</h2></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[10rem_10rem_1fr] sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium">{labels.year}<input className="form-field" min="2000" max="2200" onChange={(event) => { const next = Number(event.target.value); setYear(next); setLocalDate(`${next}-01-01`); setActivityDate(`${next}-01-01`); void refresh(next) }} type="number" value={year} /></label>
        <div className="grid gap-1.5 text-sm font-medium"><span>{labels.country}</span><CountryPicker emptyLabel={labels.countryEmpty} locale={locale} onChange={setCountryCode} options={countries} searchLabel={labels.countrySearch} value={countryCode} /></div>
        <div className="flex flex-wrap gap-2"><button className="button-secondary" onClick={showPreview} type="button">{labels.preview}</button><button className="button-primary" disabled={status === 'loading'} onClick={importSnapshot} type="button">{status === 'loading' ? <LoaderCircle className="animate-spin" size={16} /> : null}{labels.import}</button></div>
      </div>
      {status === 'imported' ? <p className="mt-4 text-sm text-success">{labels.imported}</p> : null}{status === 'failed' && !errorMessage ? <p className="mt-4 text-sm text-destructive">{labels.providerFailed}</p> : null}
      {preview.length ? <div className="mt-5 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{preview.map((holiday) => <div className="rounded-lg bg-muted px-3 py-2 text-sm" key={`${holiday.date}-${holiday.providerName}`}><span className="font-semibold">{holiday.date}</span><span className="ml-2 text-muted-foreground">{holiday.displayName}</span></div>)}</div> : null}
    </section>

    <section className="w-full rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><CalendarPlus size={20} /></span><h2 className="font-semibold">{labels.localTitle}</h2></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"><label className="grid gap-1.5 text-sm font-medium">{labels.localName}<input className="form-field" onChange={(event) => setLocalName(event.target.value)} value={localName} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.date}<input className="form-field" onChange={(event) => setLocalDate(event.target.value)} type="date" value={localDate} /></label><button className="button-primary" disabled={!localName.trim() || status === 'loading'} onClick={addLocal} type="button">{labels.add}</button></div>
    </section>

    <section className="w-full rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays size={20} /></span><h2 className="font-semibold">{labels.activityTitle}</h2></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"><label className="grid gap-1.5 text-sm font-medium">{labels.activityName}<input className="form-field" onChange={(event) => setActivityName(event.target.value)} value={activityName} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.date}<input className="form-field" onChange={(event) => setActivityDate(event.target.value)} type="date" value={activityDate} /></label><button className="button-primary" disabled={!activityName.trim() || status === 'loading'} onClick={addActivity} type="button">{labels.activityAdd}</button></div>
      {errorMessage ? <p aria-live="polite" className="mt-4 text-sm text-destructive" role="alert">{errorMessage}</p> : null}
    </section>

    <section className="w-full rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3"><MapPin className="text-primary" size={20} /><h2 className="font-semibold">{labels.calendarTitle}</h2></div>
      {items.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p> : <div className="mt-5 divide-y">{items.map((item) => item.kind === 'holiday' ? <div className={`flex items-center gap-4 rounded-lg px-2 py-3 ${item.holiday.is_active ? '' : 'opacity-55'} ${item.holiday.source === 'MANUAL' ? 'bg-accent/50' : ''}`} key={`holiday-${item.holiday.id}`}><time className="w-24 shrink-0 text-sm font-semibold" dateTime={item.holiday.holiday_date}>{item.holiday.holiday_date.slice(5)}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.holiday.display_name ?? item.holiday.provider_name}</p><p className={`text-xs ${item.holiday.source === 'MANUAL' ? 'font-semibold text-accent-foreground' : 'text-muted-foreground'}`}>{item.holiday.source === 'API' ? labels.api : labels.manual}</p></div><button aria-pressed={item.holiday.is_active} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${item.holiday.is_active ? 'bg-success-surface text-success' : 'bg-muted text-muted-foreground'}`} onClick={() => void toggle(item.holiday)} type="button">{item.holiday.is_active ? labels.deactivate : labels.activate}</button></div> : <div className={`flex items-center gap-4 rounded-lg border-l-4 border-primary/60 px-2 py-3 ${item.activity.is_active ? 'bg-primary/5' : 'bg-muted/40 opacity-60'}`} key={`activity-${item.activity.id}`}><time className="w-24 shrink-0 text-sm font-semibold text-primary" dateTime={item.activity.activity_date}>{item.activity.activity_date.slice(5)}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.activity.name}</p><p className="text-xs font-semibold text-primary">{item.activity.is_active ? labels.activityActive : labels.activityInactive}</p></div><button aria-label={`${labels.activityEdit}: ${item.activity.name}`} className="button-secondary shrink-0 gap-2" onClick={() => openActivity(item.activity)} type="button"><Pencil aria-hidden="true" size={15} />{labels.activityEdit}</button></div>)}</div>}
    </section>

    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-4">{toast ? <p className="rounded-xl border bg-surface px-4 py-3 text-sm font-medium text-foreground shadow-lg">{toast}</p> : null}</div>

    {mounted && activityModal ? createPortal(<div className="fixed inset-0 z-[9999] grid place-items-center bg-sidebar/60 p-4 backdrop-blur-sm" onMouseDown={() => setActivityModal(null)} role="presentation"><section aria-labelledby="company-activity-edit-title" aria-modal="true" className="w-full max-w-xl rounded-2xl border bg-surface p-5 shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.activityTitle}</p><h2 className="mt-1 text-xl font-semibold" id="company-activity-edit-title">{labels.activityEdit}</h2></div><button aria-label={labels.close} className="button-secondary" onClick={() => setActivityModal(null)} type="button"><X size={16} /></button></header><div className="mt-6 grid gap-4"><label className="grid gap-1.5 text-sm font-medium">{labels.activityName}<input autoFocus className="form-field" onChange={(event) => setActivityModal({ ...activityModal, name: event.target.value })} value={activityModal.name} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.date}<input className="form-field" onChange={(event) => setActivityModal({ ...activityModal, date: event.target.value })} type="date" value={activityModal.date} /></label><label className="flex items-center gap-3 text-sm font-medium"><input checked={activityModal.isActive} className="size-4 accent-primary" onChange={(event) => setActivityModal({ ...activityModal, isActive: event.target.checked })} type="checkbox" />{activityModal.isActive ? labels.activityActive : labels.activityInactive}</label>{errorMessage ? <p aria-live="polite" className="text-sm text-destructive" role="alert">{errorMessage}</p> : null}<div className="flex justify-end gap-2 border-t pt-5"><button className="button-secondary" onClick={() => setActivityModal(null)} type="button">{labels.cancel}</button><button className="button-primary" disabled={!activityModal.name.trim() || status === 'loading'} onClick={() => void saveActivity()} type="button">{status === 'loading' ? <LoaderCircle className="mr-2 animate-spin" size={16} /> : null}{labels.activitySave}</button></div></div></section></div>, document.body) : null}
  </div>
}

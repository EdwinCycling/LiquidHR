'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, CalendarPlus, Download, LoaderCircle, MapPin } from 'lucide-react'
import { CountryPicker, type CountryPickerOption } from '@/components/ui/country-picker'

type Holiday = { id: string; holiday_date: string; display_name: string | null; provider_name: string; source: string; is_active: boolean }
type CompanyActivity = { id: string; name: string; activity_date: string; is_active: boolean }
type Preview = { date: string; displayName: string; providerName: string }
type Labels = Record<'year'|'country'|'countrySearch'|'countryEmpty'|'preview'|'import'|'imported'|'providerFailed'|'localTitle'|'localName'|'date'|'add'|'calendarTitle'|'empty'|'api'|'manual'|'included'|'excluded'|'activate'|'deactivate'|'saving'|'activityTitle'|'activityName'|'activityEmpty'|'activityAdd'|'activityAdded', string>

export function HolidaySettings({ initial, initialActivities, initialYear, labels, locale }: { initial: Holiday[]; initialActivities: CompanyActivity[]; initialYear: number; labels: Labels; locale: string }) {
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
  const [status, setStatus] = useState<'idle'|'loading'|'imported'|'failed'>('idle')

  useEffect(() => {
    let cancelled = false
    void fetch('/api/settings/holidays/countries', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { data?: CountryPickerOption[] }
      if (!cancelled && Array.isArray(body.data)) setCountries(body.data)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

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
    const response = await fetch('/api/settings/company-activities', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year, date: activityDate, name: activityName }) })
    if (!response.ok) { setStatus('failed'); return }
    setActivityName('')
    await refresh()
    setStatus('idle')
  }

  async function toggle(holiday: Holiday) {
    const response = await fetch(`/api/settings/holidays/${holiday.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: !holiday.is_active }) })
    if (response.ok) setHolidays((current) => current.map((item) => item.id === holiday.id ? { ...item, is_active: !item.is_active } : item))
  }

  return <div className="space-y-6">
    <section className="rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><Download size={20} /></span><div><h2 className="font-semibold">{labels.import}</h2></div></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[10rem_10rem_1fr] sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium">{labels.year}<input className="form-field" min="2000" max="2200" onChange={(event) => { const next = Number(event.target.value); setYear(next); setLocalDate(`${next}-01-01`); setActivityDate(`${next}-01-01`); void refresh(next) }} type="number" value={year} /></label>
        <div className="grid gap-1.5 text-sm font-medium"><span>{labels.country}</span><CountryPicker emptyLabel={labels.countryEmpty} locale={locale} onChange={setCountryCode} options={countries} searchLabel={labels.countrySearch} value={countryCode} /></div>
        <div className="flex flex-wrap gap-2"><button className="button-secondary" onClick={showPreview} type="button">{labels.preview}</button><button className="button-primary" disabled={status === 'loading'} onClick={importSnapshot} type="button">{status === 'loading' ? <LoaderCircle className="animate-spin" size={16} /> : null}{labels.import}</button></div>
      </div>
      {status === 'imported' ? <p className="mt-4 text-sm text-success">{labels.imported}</p> : null}{status === 'failed' ? <p className="mt-4 text-sm text-destructive">{labels.providerFailed}</p> : null}
      {preview.length ? <div className="mt-5 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{preview.map((holiday) => <div className="rounded-lg bg-muted px-3 py-2 text-sm" key={`${holiday.date}-${holiday.providerName}`}><span className="font-semibold">{holiday.date}</span><span className="ml-2 text-muted-foreground">{holiday.displayName}</span></div>)}</div> : null}
    </section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><CalendarPlus size={20} /></span><h2 className="font-semibold">{labels.localTitle}</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"><label className="grid gap-1.5 text-sm font-medium">{labels.localName}<input className="form-field" onChange={(event) => setLocalName(event.target.value)} value={localName} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.date}<input className="form-field" onChange={(event) => setLocalDate(event.target.value)} type="date" value={localDate} /></label><button className="button-primary" disabled={!localName.trim() || status === 'loading'} onClick={addLocal} type="button">{labels.add}</button></div></section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><CalendarDays size={20} /></span><div><h2 className="font-semibold">{labels.activityTitle}</h2></div></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"><label className="grid gap-1.5 text-sm font-medium">{labels.activityName}<input className="form-field" onChange={(event) => setActivityName(event.target.value)} value={activityName} /></label><label className="grid gap-1.5 text-sm font-medium">{labels.date}<input className="form-field" onChange={(event) => setActivityDate(event.target.value)} type="date" value={activityDate} /></label><button className="button-primary" disabled={!activityName.trim() || status === 'loading'} onClick={addActivity} type="button">{labels.activityAdd}</button></div></section>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><MapPin className="text-primary" size={20} /><h2 className="font-semibold">{labels.calendarTitle}</h2></div>{holidays.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p> : <div className="mt-5 divide-y">{holidays.map((holiday) => <div className={`flex items-center gap-4 rounded-lg px-2 py-3 ${holiday.is_active ? '' : 'opacity-55'} ${holiday.source === 'MANUAL' ? 'bg-accent/50' : ''}`} key={holiday.id}><time className="w-24 shrink-0 text-sm font-semibold" dateTime={holiday.holiday_date}>{holiday.holiday_date.slice(5)}</time><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{holiday.display_name ?? holiday.provider_name}</p><p className={`text-xs ${holiday.source === 'MANUAL' ? 'font-semibold text-accent-foreground' : 'text-muted-foreground'}`}>{holiday.source === 'API' ? labels.api : labels.manual}</p></div><button aria-pressed={holiday.is_active} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${holiday.is_active ? 'bg-success-surface text-success' : 'bg-muted text-muted-foreground'}`} onClick={() => toggle(holiday)} type="button">{holiday.is_active ? labels.deactivate : labels.activate}</button></div>)}</div>}</section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><CalendarDays className="text-primary" size={20} /><h2 className="font-semibold">{labels.activityTitle}</h2></div>{activities.length === 0 ? <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.activityEmpty}</p> : <div className="mt-5 divide-y">{activities.map((activity) => <div className="flex items-center gap-4 px-2 py-3" key={activity.id}><time className="w-24 shrink-0 text-sm font-semibold" dateTime={activity.activity_date}>{activity.activity_date.slice(5)}</time><p className="min-w-0 flex-1 truncate text-sm font-semibold">{activity.name}</p></div>)}</div>}</section>
    </div>
  </div>
}

'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { workCalendarConfigSchema, workCalendarModelSchema, workCalendarPreviewSchema, type HolidayChoice, type WorkCalendarModel, type WorkCalendarPreview } from '@/lib/work-calendars/schemas'
import type { WorkCalendarLabels } from '@/lib/work-calendars/labels'

type Entry = WorkCalendarModel['calendars'][number]
type Draft = {
  administrationId: string | null; expectedRevision: number; name: string; weekdays: number[]; validFrom: string; validUntil: string
  holidayIds: string[]; exceptions: { date: string; isWorkday: boolean; label: string }[]; holidaySelectionConfirmed: boolean; reason: string
}
export function WorkCalendarSettings({ initial, groupName, administrationId, administrationName, timeZone, labels: l, locale }: {
  initial: WorkCalendarModel; groupName: string; administrationId: string | null; administrationName: string | null; timeZone: string; labels: WorkCalendarLabels; locale: string
}) {
  const [model,setModel] = useState(initial)
  const [search,setSearch] = useState('')
  const [draft,setDraft] = useState<Draft | null>(null)
  const [initialDraft,setInitialDraft] = useState('')
  const [holidays,setHolidays] = useState<HolidayChoice[]>([])
  const [holidaysLoaded,setHolidaysLoaded] = useState(false)
  const [holidayNotice,setHolidayNotice] = useState(false)
  const holidayRequest = useRef(0)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState<string | null>(null)
  const [status,setStatus] = useState<string | null>(null)
  const [previewVersion,setPreviewVersion] = useState(initial.effectiveVersionId ?? '')
  const [previewDate,setPreviewDate] = useState(()=>new Date().toISOString().slice(0,10))
  const [previewTime,setPreviewTime] = useState('09:00')
  const [previewDays,setPreviewDays] = useState(2)
  const [preview,setPreview] = useState<WorkCalendarPreview | null>(null)
  const [previewBusy,setPreviewBusy] = useState(false)
  const scopeLabel = (id: string | null) => id === null ? `${l.groupScope} — ${groupName}` : `${l.administrationScope} — ${administrationName ?? ''}`
  const message = (code: unknown) => l.errors[typeof code === 'string' ? code : ''] ?? l.errors.WORK_CALENDAR_OPERATION_FAILED
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))
  const change = (patch: Partial<Draft>) => setDraft(current => current ? { ...current,...patch } : current)

  async function loadHolidays(value: Draft) {
    const requestId = ++holidayRequest.current
    setHolidaysLoaded(false); setError(null)
    try {
      const response = await fetch(`/api/settings/work-calendars/holidays?from=${value.validFrom}&until=${value.validUntil}`)
      const body = await response.json() as { data?: HolidayChoice[]; code?: string }
      if (requestId !== holidayRequest.current) return
      if (!response.ok || !Array.isArray(body.data)) { setError(message(body.code)); return }
      const available = new Set(body.data.map(day => day.id))
      const removed = value.holidayIds.some(id => !available.has(id))
      setHolidays(body.data); setHolidaysLoaded(true); setHolidayNotice(removed)
      setDraft(current => current ? { ...current,holidayIds: current.holidayIds.filter(id => available.has(id)),holidaySelectionConfirmed:false } : current)
    } catch { if (requestId === holidayRequest.current) setError(message(null)) }
  }
  function open(id: string | null, entry?: Entry) {
    const year = new Date().getFullYear()
    const value: Draft = {
      administrationId:id,expectedRevision:entry?.revision ?? 0,name:entry?.version.name ?? scopeLabel(id),
      weekdays:entry?.version.weekdays ?? [1,2,3,4,5],validFrom:entry?.version.valid_from ?? `${year}-01-01`,validUntil:entry?.version.valid_until ?? `${year}-12-31`,
      holidayIds:entry?.exceptions.flatMap(day => day.sourceHolidayId ? [day.sourceHolidayId] : []) ?? [],
      exceptions:entry?.exceptions.filter(day => !day.sourceHolidayId).map(({date,isWorkday,label})=>({date,isWorkday,label})) ?? [],holidaySelectionConfirmed:false,reason:'',
    }
    setDraft(value); setInitialDraft(JSON.stringify(value)); setStatus(null); setError(null); setHolidays([]);setHolidayNotice(false)
    void loadHolidays(value)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || !holidaysLoaded) return
    const {administrationId:scope,expectedRevision,...config} = draft
    const parsed = workCalendarConfigSchema.safeParse(config)
    if (!parsed.success) { setError(message('WORK_CALENDAR_INPUT_INVALID')); return }
    setBusy(true);setError(null)
    try {
      const response = await fetch('/api/settings/work-calendars',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({administrationId:scope,expectedRevision,config:parsed.data})})
      const body = await response.json() as { data?: unknown; code?: string }
      const updated = workCalendarModelSchema.safeParse(body.data)
      if (!response.ok || !updated.success) { setError(message(body.code));return }
      setModel(updated.data);setPreviewVersion(updated.data.effectiveVersionId ?? '');setPreview(null);setDraft(null);setStatus(l.published)
    } catch { setError(message(null)) } finally { setBusy(false) }
  }
  async function calculate(event: FormEvent) {
    event.preventDefault();setPreviewBusy(true);setError(null);setPreview(null)
    try {
      const response = await fetch('/api/settings/work-calendars/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({versionId:previewVersion,date:previewDate,time:previewTime,days:previewDays})})
      const body = await response.json() as {data?:unknown;code?:string}
      const result = workCalendarPreviewSchema.safeParse(body.data)
      if (!response.ok || !result.success) { setError(message(body.code));return }
      setPreview(result.data)
    } catch { setError(message(null)) } finally {setPreviewBusy(false)}
  }
  const scopes = [null,...(administrationId ? [administrationId] : [])]
  const missingYears = draft && holidaysLoaded ? Array.from({length:Math.min(11,Math.max(0,Number(draft.validUntil.slice(0,4))-Number(draft.validFrom.slice(0,4))+1))},(_,index)=>Number(draft.validFrom.slice(0,4))+index).filter(year=>!holidays.some(day=>day.date.startsWith(`${year}-`))) : []
  return <div className="space-y-6">
    <p className="text-sm leading-6 text-muted-foreground">{l.changePolicy}</p>
    {status ? <p role="status" className="text-sm text-primary">{status}</p> : null}
    {error && !draft ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <label className="grid max-w-md gap-2 text-sm font-medium">{l.search}<TextInput type="search" value={search} placeholder={l.searchPlaceholder} onChange={event=>setSearch(event.target.value)} /></label>
    <Surface className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead className="border-b border-border-subtle"><tr><th className="p-4">{l.scope}</th><th className="p-4">{l.name}</th><th className="p-4">{l.coverage}</th><th className="p-4">{l.revision}</th><th className="p-4"><span className="sr-only">{l.edit}</span></th></tr></thead><tbody>
        {scopes.map(id => ({id,entry:model.calendars.find(c=>c.administrationId===id)})).filter(({id,entry})=>`${scopeLabel(id)} ${entry?.version.name ?? ''}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))).map(({id,entry})=><tr key={id ?? 'group'} className="border-b border-border-subtle last:border-b-0">
          <td className="p-4"><button className="text-left font-medium text-primary focus-visible:outline-2 focus-visible:outline-focus" onClick={()=>open(id,entry)}>{scopeLabel(id)}</button>{entry?.version.id===model.effectiveVersionId ? <Badge className="ml-2">{l.effective}</Badge>:null}</td>
          <td className="p-4">{entry?.version.name ?? (id ? l.defaultInheritance:l.noCalendar)}{entry?<p className="mt-1 text-xs text-muted-foreground">{l.timeZone}: {entry.version.time_zone}</p>:null}</td><td className="p-4">{entry ? `${formatDate(entry.version.valid_from)} – ${formatDate(entry.version.valid_until)}`:'—'}</td><td className="p-4">{entry?.revision ?? '—'}</td>
          <td className="p-4"><Button variant="secondary" onClick={()=>open(id,entry)}>{entry?l.edit:l.configure}</Button></td>
        </tr>)}
      </tbody></table>
    </Surface>
    <section className="border-t border-border-subtle pt-6" aria-labelledby="work-calendar-preview-title">
      <h2 id="work-calendar-preview-title" className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={20}/>{l.preview}</h2><p className="mt-2 text-sm text-muted-foreground">{l.previewHelp}</p>
      {model.calendars.length ? <form onSubmit={event=>void calculate(event)} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label={l.scope} control={<DropdownSelect aria-label={l.scope} value={previewVersion} onChange={event=>{setPreviewVersion(event.target.value);setPreview(null)}}>{model.calendars.map(c=><option key={c.id} value={c.version.id}>{scopeLabel(c.administrationId)} — {c.version.name}</option>)}</DropdownSelect>}/>
        <FormField label={l.previewDate} control={<TextInput aria-label={l.previewDate} type="date" required value={previewDate} onChange={event=>setPreviewDate(event.target.value)}/>}/>
        <FormField label={l.previewTime} control={<TextInput aria-label={l.previewTime} type="time" required value={previewTime} onChange={event=>setPreviewTime(event.target.value)}/>}/>
        <FormField label={l.previewDays} control={<TextInput aria-label={l.previewDays} type="number" min={1} max={3660} required value={previewDays} onChange={event=>setPreviewDays(Number(event.target.value))}/>}/>
        <div><Button type="submit" loading={previewBusy}>{l.preview}</Button></div>
      </form>:<p className="mt-4 text-sm text-muted-foreground">{l.previewRequiresCalendar}</p>}
      {preview ? <div className="mt-4 space-y-2 border-l-2 border-primary pl-4" role="status"><p className="font-semibold">{l.previewResult}: {new Intl.DateTimeFormat(locale,{dateStyle:'long',timeStyle:'short',timeZone:preview.timeZone}).format(new Date(preview.deadlineAt))}</p><p className="text-sm">{l.timeZone}: {preview.timeZone} · {l.revision} {preview.revision}</p><p className="text-sm">{l.countedDays}: {preview.countedDates.map(formatDate).join(', ')}</p><p className="text-sm text-muted-foreground">{l.skippedDays}: {preview.skippedDates.length ? preview.skippedDates.map(formatDate).join(', '):'—'}</p></div>:null}
    </section>
    {draft ? <FormDrawer open onOpenChange={value=>{if(!value){holidayRequest.current++;setDraft(null);setError(null)}}} title={`${l.edit} — ${scopeLabel(draft.administrationId)}`} description={l.changePolicy} closeLabel={l.close} cancelLabel={l.cancel} saveLabel={l.publish} saving={busy} disabled={!holidaysLoaded || !draft.holidaySelectionConfirmed} dirty={JSON.stringify(draft)!==initialDraft} dirtyProtection={{title:l.discardTitle,discardLabel:l.discard,keepEditingLabel:l.keepEditing}} onSubmit={event=>void save(event)}>
      <p className="text-sm text-muted-foreground">{l.timeZone}: {timeZone}</p>
      <FormField label={l.name} required control={<TextInput aria-label={l.name} required maxLength={120} value={draft.name} onChange={event=>change({name:event.target.value})}/>}/>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label={l.validFrom} required control={<TextInput aria-label={l.validFrom} type="date" required value={draft.validFrom} onChange={event=>{holidayRequest.current++;setHolidaysLoaded(false);change({validFrom:event.target.value,holidaySelectionConfirmed:false})}}/>}/><FormField label={l.validUntil} required control={<TextInput aria-label={l.validUntil} type="date" required value={draft.validUntil} onChange={event=>{holidayRequest.current++;setHolidaysLoaded(false);change({validUntil:event.target.value,holidaySelectionConfirmed:false})}}/>}/></div>
      <fieldset><legend className="text-sm font-semibold">{l.weekdays}</legend><div className="mt-2 flex flex-wrap gap-4">{l.days.map((day,index)=><Checkbox key={day} label={day} checked={draft.weekdays.includes(index+1)} onChange={event=>change({weekdays:event.target.checked?[...draft.weekdays,index+1].sort():draft.weekdays.filter(d=>d!==index+1)})}/>)}</div></fieldset>
      <section className="space-y-3 border-t border-border-subtle pt-4"><h3 className="font-semibold">{l.holidays}</h3><p className="text-sm text-muted-foreground">{l.holidayHelp} <Link className="text-primary underline" href="/settings/holidays">{l.holidays}</Link></p><Button variant="secondary" type="button" onClick={()=>void loadHolidays(draft)}>{l.loadHolidays}</Button>
        {holidayNotice ? <p role="status" className="text-sm text-muted-foreground">{l.holidaySelectionChanged}</p>:null}
        {missingYears.length ? <p role="status" className="text-sm text-muted-foreground">{l.holidayMissingYears} {missingYears.join(', ')}</p>:null}
        {holidaysLoaded && !holidays.length ? <p className="text-sm text-muted-foreground">{l.holidayEmpty}</p>:null}
        {holidaysLoaded ? <div className="max-h-64 space-y-2 overflow-auto">{holidays.map(day=><Checkbox key={day.id} label={`${formatDate(day.date)} — ${day.label}`} checked={draft.holidayIds.includes(day.id)} onChange={event=>change({holidayIds:event.target.checked?[...draft.holidayIds,day.id]:draft.holidayIds.filter(id=>id!==day.id),holidaySelectionConfirmed:false})}/>)}</div>:null}
        <Checkbox label={l.holidayConfirmed} disabled={!holidaysLoaded} checked={draft.holidaySelectionConfirmed} onChange={event=>change({holidaySelectionConfirmed:event.target.checked})}/>
      </section>
      <section className="space-y-3 border-t border-border-subtle pt-4"><h3 className="font-semibold">{l.exceptions}</h3>{draft.exceptions.map((day,index)=><div key={index} className="grid grid-cols-1 gap-2 border-b border-border-subtle pb-3 sm:grid-cols-2">
        <TextInput type="date" aria-label={`${l.exceptionDate} ${index+1}`} required value={day.date} onChange={event=>change({exceptions:draft.exceptions.map((d,i)=>i===index?{...d,date:event.target.value}:d)})}/>
        <TextInput aria-label={`${l.exceptionName} ${index+1}`} required maxLength={160} value={day.label} onChange={event=>change({exceptions:draft.exceptions.map((d,i)=>i===index?{...d,label:event.target.value}:d)})}/>
        <DropdownSelect aria-label={`${l.exceptions} ${index+1}`} value={day.isWorkday?'open':'closed'} onChange={event=>change({exceptions:draft.exceptions.map((d,i)=>i===index?{...d,isWorkday:event.target.value==='open'}:d)})}><option value="closed">{l.closedDay}</option><option value="open">{l.openDay}</option></DropdownSelect>
        <Button type="button" variant="ghost" aria-label={`${l.remove} ${index+1}`} onClick={()=>change({exceptions:draft.exceptions.filter((_,i)=>i!==index)})}><Trash2 size={16}/>{l.remove}</Button>
      </div>)}<Button type="button" variant="secondary" onClick={()=>change({exceptions:[...draft.exceptions,{date:draft.validFrom,isWorkday:false,label:''}]})}><Plus size={16}/>{l.addException}</Button></section>
      <FormField label={l.reason} required control={<TextInput aria-label={l.reason} required maxLength={500} value={draft.reason} onChange={event=>change({reason:event.target.value})}/>}/>
      {model.calendars.find(c=>c.administrationId===draft.administrationId)?.history.length ? <section className="border-t border-border-subtle pt-4"><h3 className="font-semibold">{l.history}</h3><ol className="mt-2 space-y-2 text-sm">{model.calendars.find(c=>c.administrationId===draft.administrationId)?.history.map(item=><li key={item.revision}>{l.revision} {item.revision} — {item.reason}</li>)}</ol></section>:null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p>:null}
    </FormDrawer>:null}
  </div>
}

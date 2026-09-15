'use client'

import { useState } from 'react'
import type { Tables } from '@scope/db'
import { useRouter } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'

type ActualWorkType = Tables<'work_hour_types'>
type ActualWorkPeriod = Tables<'actual_work_periods'>
type Family = 'WORK' | 'ADDITIONAL' | 'OVERTIME' | 'TRANSPARENT'
type Granularity = 'DAY' | 'PERIOD' | 'BOTH'

export type ActualWorkSettingsLabels = {
  title: string
  description: string
  back: string
  list: string
  create: string
  edit: string
  newType: string
  noSelection: string
  code: string
  name: string
  family: string
  validFrom: string
  validUntil: string
  granularity: string
  commentRequired: string
  futureAllowed: string
  teamOverview: string
  calendar: string
  approval: string
  displayOrder: string
  limits: string
  limitDay: string
  limitWeek: string
  limitMonth: string
  maxHours: string
  save: string
  saving: string
  saved: string
  failed: string
  empty: string
  identityHelp: string
  periods: string
  periodStatus: string
  open: string
  closed: string
  close: string
  closeConfirm: string
  closedMessage: string
  familyWork: string
  familyAdditional: string
  familyOvertime: string
  familyTransparent: string
  day: string
  period: string
  both: string
  selectFamily: string
}

type Draft = {
  id: string | null
  code: string
  name: string
  family: Family
  validFrom: string
  validUntil: string
  granularity: Granularity
  commentRequired: boolean
  futureAllowed: boolean
  teamOverview: boolean
  calendar: boolean
  approval: boolean
  displayOrder: string
  limits: { day: string; week: string; month: string }
}

function typeFamily(family: Family, labels: ActualWorkSettingsLabels): string {
  if (family === 'ADDITIONAL') return labels.familyAdditional
  if (family === 'OVERTIME') return labels.familyOvertime
  if (family === 'TRANSPARENT') return labels.familyTransparent
  return labels.familyWork
}

function newDraft(): Draft {
  return {
    id: null,
    code: '',
    name: '',
    family: 'WORK',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: '',
    granularity: 'DAY',
    commentRequired: false,
    futureAllowed: false,
    teamOverview: false,
    calendar: false,
    approval: false,
    displayOrder: '0',
    limits: { day: '', week: '', month: '' },
  }
}

function draftFromType(type: ActualWorkType): Draft {
  return {
    id: type.id,
    code: type.code ?? '',
    name: type.name,
    family: type.family,
    validFrom: type.valid_from,
    validUntil: type.valid_until ?? '',
    granularity: type.entry_granularity,
    commentRequired: type.comment_required,
    futureAllowed: type.future_entry_allowed,
    teamOverview: type.show_in_team_overview,
    calendar: type.show_in_calendar,
    approval: type.approval_required,
    displayOrder: String(type.display_order),
    limits: { day: '', week: '', month: '' },
  }
}

export function ActualWorkSettings({ initialTypes, initialPeriods, labels }: {
  initialTypes: ActualWorkType[]
  initialPeriods: ActualWorkPeriod[]
  labels: ActualWorkSettingsLabels
}) {
  const router = useRouter()
  const [types, setTypes] = useState(initialTypes)
  const [periods, setPeriods] = useState(initialPeriods)
  const [draft, setDraft] = useState<Draft>(() => newDraft())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function selectType(type: ActualWorkType): void {
    setMessage(null)
    setError(null)
    setDraft(draftFromType(type))
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save(): Promise<void> {
    setSaving(true)
    setMessage(null)
    setError(null)
    const base = {
      validFrom: draft.validFrom,
      validUntil: draft.validUntil || null,
      entryGranularity: draft.granularity,
      commentRequired: draft.commentRequired,
      futureEntryAllowed: draft.futureAllowed,
      showInTeamOverview: draft.teamOverview,
      showInCalendar: draft.calendar,
      approvalRequired: draft.approval,
      displayOrder: Number(draft.displayOrder),
      limits: [
        draft.limits.day ? { scope: 'DAY', maxHours: draft.limits.day } : null,
        draft.limits.week ? { scope: 'WEEK', maxHours: draft.limits.week } : null,
        draft.limits.month ? { scope: 'MONTH', maxHours: draft.limits.month } : null,
      ].filter((value): value is { scope: 'DAY' | 'WEEK' | 'MONTH'; maxHours: string } => value !== null),
    }
    const payload = draft.id ? base : { ...base, code: draft.code, name: draft.name, family: draft.family }
    try {
      const response = await fetch(draft.id ? '/api/actual-work/types/' + draft.id : '/api/actual-work/types', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json() as { data?: ActualWorkType; error?: string }
      if (!response.ok || !body.data) throw new Error(body.error ?? labels.failed)
      const saved = body.data
      setTypes((current) => draft.id ? current.map((type) => type.id === saved.id ? saved : type) : [saved, ...current])
      setDraft(draft.id ? draftFromType(saved) : newDraft())
      setMessage(labels.saved)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function closePeriod(period: ActualWorkPeriod): Promise<void> {
    if (!window.confirm(labels.closeConfirm)) return
    setError(null)
    try {
      const response = await fetch('/api/actual-work/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart: period.period_start, periodEnd: period.period_end }),
      })
      const body = await response.json() as { data?: ActualWorkPeriod; error?: string }
      if (!response.ok || !body.data) throw new Error(body.error ?? labels.failed)
      setPeriods((current) => current.map((candidate) => candidate.id === body.data?.id ? body.data : candidate))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    }
  }

  return <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <AdminSettingsPageHeader backHref="/settings" backLabel={labels.back} eyebrow={labels.title} subtitle={labels.description} title={labels.title} />
    <div className="grid gap-6 xl:grid-cols-[minmax(18rem,.75fr)_minmax(0,1.25fr)]">
      <Surface className="p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{labels.list}</h2><Button onClick={() => { setDraft(newDraft()); setMessage(null); setError(null) }} size="sm" type="button">{labels.create}</Button></div>
        {types.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">{labels.empty}</p> : <div className="mt-5 space-y-2">{types.map((type) => <button className={'w-full rounded-[var(--radius-control)] border p-3 text-left transition-colors hover:bg-surface-raised ' + (draft.id === type.id ? 'border-primary bg-primary/5' : 'border-border')} key={type.id} onClick={() => selectType(type)} type="button"><div className="flex items-start justify-between gap-2"><span className="font-medium">{type.name}</span><span className="text-xs text-muted-foreground">{type.code}</span></div><p className="mt-1 text-sm text-muted-foreground">{typeFamily(type.family, labels)} · {type.valid_from}</p></button>)}</div>}
      </Surface>

      <Surface className="p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{draft.id ? labels.edit : labels.newType}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.identityHelp}</p></div>{draft.id ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{draft.code}</span> : null}</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.code}</span><TextInput disabled={Boolean(draft.id)} onChange={(event) => change('code', event.target.value.toUpperCase())} required value={draft.code} /></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.name}</span><TextInput disabled={Boolean(draft.id)} onChange={(event) => change('name', event.target.value)} required value={draft.name} /></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.family}</span><DropdownSelect aria-label={labels.family} disabled={Boolean(draft.id)} onChange={(event) => change('family', event.target.value as Family)} placeholder={labels.selectFamily} value={draft.family}><option value="WORK">{labels.familyWork}</option><option value="ADDITIONAL">{labels.familyAdditional}</option><option value="OVERTIME">{labels.familyOvertime}</option><option value="TRANSPARENT">{labels.familyTransparent}</option></DropdownSelect></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.granularity}</span><DropdownSelect aria-label={labels.granularity} onChange={(event) => change('granularity', event.target.value as Granularity)} value={draft.granularity}><option value="DAY">{labels.day}</option><option value="PERIOD">{labels.period}</option><option value="BOTH">{labels.both}</option></DropdownSelect></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.validFrom}</span><TextInput onChange={(event) => change('validFrom', event.target.value)} required type="date" value={draft.validFrom} /></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.validUntil}</span><TextInput onChange={(event) => change('validUntil', event.target.value)} type="date" value={draft.validUntil} /></label>
          <label className="grid gap-1.5 text-sm font-medium"><span>{labels.displayOrder}</span><TextInput min="0" onChange={(event) => change('displayOrder', event.target.value)} type="number" value={draft.displayOrder} /></label>
          <div className="grid gap-2 text-sm font-medium"><span>{labels.limits}</span><div className="grid grid-cols-3 gap-2"><label className="grid gap-1 text-xs text-muted-foreground"><span>{labels.limitDay}</span><TextInput inputMode="decimal" onChange={(event) => change('limits', { ...draft.limits, day: event.target.value })} placeholder={labels.maxHours} value={draft.limits.day} /></label><label className="grid gap-1 text-xs text-muted-foreground"><span>{labels.limitWeek}</span><TextInput inputMode="decimal" onChange={(event) => change('limits', { ...draft.limits, week: event.target.value })} placeholder={labels.maxHours} value={draft.limits.week} /></label><label className="grid gap-1 text-xs text-muted-foreground"><span>{labels.limitMonth}</span><TextInput inputMode="decimal" onChange={(event) => change('limits', { ...draft.limits, month: event.target.value })} placeholder={labels.maxHours} value={draft.limits.month} /></label></div></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{([['commentRequired', labels.commentRequired], ['futureAllowed', labels.futureAllowed], ['teamOverview', labels.teamOverview], ['calendar', labels.calendar], ['approval', labels.approval]] as const).map(([key, label]) => <label className="flex items-center gap-2 text-sm" key={key}><input checked={draft[key]} className="size-4 accent-primary" onChange={(event) => change(key, event.target.checked)} type="checkbox" />{label}</label>)}</div>
        {message ? <p aria-live="polite" className="mt-4 text-sm text-chart-2">{message}</p> : null}
        {error ? <p aria-live="assertive" className="mt-4 text-sm text-destructive">{error}</p> : null}
        <div className="mt-5"><Button disabled={saving} onClick={() => void save()} type="button">{saving ? labels.saving : labels.save}</Button></div>
      </Surface>
    </div>

    <Surface className="p-5">
      <h2 className="text-lg font-semibold">{labels.periods}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{periods.map((period) => <div className="rounded-[var(--radius-control)] border border-border p-4" key={period.id}><div className="flex items-start justify-between gap-2"><p className="font-medium tabular-nums">{period.period_start} → {period.period_end}</p><span className="text-xs font-semibold">{period.status === 'CLOSED' ? labels.closed : labels.open}</span></div>{period.status === 'OPEN' ? <Button className="mt-4" onClick={() => void closePeriod(period)} size="sm" type="button" variant="secondary">{labels.close}</Button> : <p className="mt-4 text-xs text-muted-foreground">{labels.closedMessage}</p>}</div>)}</div>
    </Surface>
  </div>
}

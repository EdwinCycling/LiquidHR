'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { ActualWorkEmployeeProjection } from '@/lib/actual-work/actual-work-service'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'

export type ActualWorkEmployeeLabels = {
  title: string
  description: string
  back: string
  month: string
  previousMonth: string
  nextMonth: string
  schedule: string
  partTime: string
  week: string
  periodStatus: string
  open: string
  closed: string
  entries: string
  noEntries: string
  type: string
  family: string
  date: string
  hours: string
  note: string
  reason: string
  save: string
  saving: string
  saved: string
  failed: string
  newEntry: string
  edit: string
  correction: string
  correctionReason: string
  granularity: string
  day: string
  period: string
  closedMessage: string
  revisionHistory: string
  original: string
  current: string
  delta: string
  actor: string
  noTypes: string
  selectType: string
  searchTypes: string
  scheduleNotFound: string
  familyWork: string
  familyAdditional: string
  familyOvertime: string
  familyTransparent: string
}

type Draft = {
  entryId: string | null
  workHourTypeId: string
  entryGranularity: 'DAY' | 'PERIOD'
  subjectPeriodStart: string
  hours: string
  note: string
  correctionReason: string
}

function monthOffset(month: string, offset: number): string {
  const value = new Date(month + '-01T00:00:00Z')
  value.setUTCMonth(value.getUTCMonth() + offset)
  return value.toISOString().slice(0, 7)
}

function familyLabel(family: string, labels: ActualWorkEmployeeLabels): string {
  if (family === 'ADDITIONAL') return labels.familyAdditional
  if (family === 'OVERTIME') return labels.familyOvertime
  if (family === 'TRANSPARENT') return labels.familyTransparent
  return labels.familyWork
}

function displayHours(value: number): string {
  return String(value)
}

function displayEmployeeName(employee: ActualWorkEmployeeProjection['employee']): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ') || employee.employee_number
}

export function ActualWorkEmployeeWorkspace({ employeeId, month, projection, labels }: {
  employeeId: string
  month: string
  projection: ActualWorkEmployeeProjection
  labels: ActualWorkEmployeeLabels
}) {
  const router = useRouter()
  const activeTypes = useMemo(() => projection.types.filter((type) => type.is_active), [projection.types])
  const defaultType = activeTypes.find((type) => type.family !== 'TRANSPARENT') ?? activeTypes[0]
  const [draft, setDraft] = useState<Draft>(() => ({
    entryId: null,
    workHourTypeId: defaultType?.id ?? '',
    entryGranularity: defaultType?.entry_granularity === 'PERIOD' ? 'PERIOD' : 'DAY',
    subjectPeriodStart: month + '-01',
    hours: '',
    note: '',
    correctionReason: '',
  }))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const periodClosed = projection.period?.status === 'CLOSED'
  const selectedType = activeTypes.find((type) => type.id === draft.workHourTypeId) ?? null
  const employeeName = displayEmployeeName(projection.employee)

  function startNewEntry(): void {
    setMessage(null)
    setError(null)
    setDraft({
      entryId: null,
      workHourTypeId: defaultType?.id ?? '',
      entryGranularity: defaultType?.entry_granularity === 'PERIOD' ? 'PERIOD' : 'DAY',
      subjectPeriodStart: month + '-01',
      hours: '',
      note: '',
      correctionReason: '',
    })
  }

  function editEntry(entry: ActualWorkEmployeeProjection['entries'][number]): void {
    setMessage(null)
    setError(null)
    setDraft({
      entryId: entry.id,
      workHourTypeId: entry.work_hour_type_id,
      entryGranularity: entry.entry_granularity === 'PERIOD' ? 'PERIOD' : 'DAY',
      subjectPeriodStart: entry.subject_period_start,
      hours: String(entry.hours),
      note: entry.note ?? '',
      correctionReason: '',
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch('/api/actual-work/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          employmentId: projection.employment.id,
          entryId: draft.entryId,
          workHourTypeId: draft.workHourTypeId,
          entryGranularity: draft.entryGranularity,
          subjectPeriodStart: draft.subjectPeriodStart,
          hours: draft.hours,
          note: draft.note || null,
          correctionReason: draft.entryId ? draft.correctionReason || null : null,
        }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? labels.failed)
      setMessage(labels.saved)
      startNewEntry()
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader
      actions={<div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised" href={'/employees/' + employeeId}>{labels.back}</Link><Link aria-label={labels.previousMonth} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised" href={'/employees/' + employeeId + '/hours?month=' + monthOffset(month, -1)}>← {monthOffset(month, -1)}</Link><Link aria-label={labels.nextMonth} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised" href={'/employees/' + employeeId + '/hours?month=' + monthOffset(month, 1)}>{monthOffset(month, 1)} →</Link></div>}
      description={labels.description + ' · ' + employeeName}
      title={labels.title + ' · ' + month}
    />

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.8fr)]">
      <Surface className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{labels.entries}</h2><p className="mt-1 text-sm text-muted-foreground">{projection.entries.length} · {month}</p></div>
          <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + (periodClosed ? 'bg-destructive/10 text-destructive' : 'bg-chart-2/10 text-chart-2')}>{labels.periodStatus}: {periodClosed ? labels.closed : labels.open}</span>
        </div>
        {periodClosed ? <p className="mt-4 rounded-[var(--radius-control)] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{labels.closedMessage}</p> : null}
        {projection.entries.length === 0 ? <p className="mt-5 rounded-[var(--radius-control)] border border-dashed p-6 text-center text-sm text-muted-foreground">{labels.noEntries}</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><th className="px-3 py-3">{labels.date}</th><th className="px-3 py-3">{labels.type}</th><th className="px-3 py-3">{labels.family}</th><th className="px-3 py-3">{labels.hours}</th><th className="px-3 py-3">{labels.note}</th><th className="px-3 py-3" /></tr></thead><tbody className="divide-y">{projection.entries.map((entry) => { const type = projection.types.find((candidate) => candidate.id === entry.work_hour_type_id); return <tr key={entry.id}><td className="px-3 py-3 tabular-nums">{entry.subject_period_start}</td><td className="px-3 py-3 font-medium">{type?.name ?? entry.work_hour_type_id}</td><td className="px-3 py-3">{type ? familyLabel(type.family, labels) : '—'}</td><td className="px-3 py-3 tabular-nums">{displayHours(entry.hours)}</td><td className="max-w-44 px-3 py-3 text-muted-foreground">{entry.note ?? '—'}</td><td className="px-3 py-3 text-right">{periodClosed ? null : <button className="font-medium text-primary hover:underline" onClick={() => editEntry(entry)} type="button">{labels.edit}</button>}</td></tr> })}</tbody></table></div>}
      </Surface>

      <Surface className="p-5">
        <h2 className="text-lg font-semibold">{labels.schedule}</h2>
        {projection.schedule.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.scheduleNotFound}</p> : <div className="mt-4 space-y-3">{projection.schedule.map((schedule) => <div className="rounded-[var(--radius-control)] border border-border p-3 text-sm" key={schedule.valid_from + '-' + (schedule.valid_until ?? 'open')}><p className="font-medium">{schedule.valid_from} → {schedule.valid_until ?? '∞'}</p><dl className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground"><div><dt>{labels.partTime}</dt><dd className="font-medium text-foreground">{String(schedule.part_time_factor)}</dd></div><div><dt>{labels.week}</dt><dd className="font-medium text-foreground">{String(schedule.average_hours_per_week ?? schedule.fulltime_hours_per_week)}</dd></div></dl></div>)}</div>}
      </Surface>
    </div>

    <Surface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{draft.entryId ? labels.correction : labels.newEntry}</h2><p className="mt-1 text-sm text-muted-foreground">{draft.entryId ? labels.correctionReason : labels.type}</p></div>{draft.entryId ? <Button onClick={startNewEntry} type="button" variant="secondary">{labels.newEntry}</Button> : null}</div>
      {activeTypes.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{labels.noTypes}</p> : <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.type}</span><DropdownSelect aria-label={labels.selectType} disabled={Boolean(draft.entryId)} onChange={(event) => setDraft((current) => { const nextType = activeTypes.find((type) => type.id === event.target.value); return { ...current, workHourTypeId: event.target.value, entryGranularity: nextType?.entry_granularity === 'PERIOD' ? 'PERIOD' : nextType?.entry_granularity === 'DAY' ? 'DAY' : current.entryGranularity } })} placeholder={labels.selectType} searchable searchPlaceholder={labels.searchTypes} value={draft.workHourTypeId}>{activeTypes.map((type) => <option key={type.id} value={type.id}>{type.code ? type.code + ' · ' : ''}{type.name} · {familyLabel(type.family, labels)}</option>)}</DropdownSelect></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.granularity}</span><DropdownSelect aria-label={labels.granularity} disabled={Boolean(draft.entryId) || selectedType?.entry_granularity === 'DAY' || selectedType?.entry_granularity === 'PERIOD'} onChange={(event) => setDraft((current) => ({ ...current, entryGranularity: event.target.value as Draft['entryGranularity'] }))} value={draft.entryGranularity}><option value="DAY">{labels.day}</option><option value="PERIOD">{labels.period}</option></DropdownSelect></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.date}</span><TextInput disabled={periodClosed} onChange={(event) => setDraft((current) => ({ ...current, subjectPeriodStart: event.target.value }))} required type="date" value={draft.subjectPeriodStart} /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.hours}</span><TextInput disabled={periodClosed} inputMode="decimal" onChange={(event) => setDraft((current) => ({ ...current, hours: event.target.value }))} placeholder="0.0000" required type="text" value={draft.hours} /></label>
        <label className="grid gap-1.5 text-sm font-medium lg:col-span-2"><span>{labels.note}</span><Textarea disabled={periodClosed} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} value={draft.note} /></label>
        {draft.entryId ? <label className="grid gap-1.5 text-sm font-medium lg:col-span-2"><span>{labels.correctionReason}</span><Textarea disabled={periodClosed} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, correctionReason: event.target.value }))} required value={draft.correctionReason} /></label> : null}
        {message ? <p aria-live="polite" className="text-sm text-chart-2 lg:col-span-2">{message}</p> : null}
        {error ? <p aria-live="assertive" className="text-sm text-destructive lg:col-span-2">{error}</p> : null}
        <div className="lg:col-span-2"><Button disabled={saving || periodClosed || !draft.workHourTypeId} type="submit">{saving ? labels.saving : labels.save}</Button></div>
      </form>}
    </Surface>

    {projection.revisions.length ? <Surface className="p-5"><h2 className="text-lg font-semibold">{labels.revisionHistory}</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><th className="px-3 py-3">{labels.date}</th><th className="px-3 py-3">{labels.original}</th><th className="px-3 py-3">{labels.current}</th><th className="px-3 py-3">{labels.delta}</th><th className="px-3 py-3">{labels.actor}</th><th className="px-3 py-3">{labels.reason}</th></tr></thead><tbody className="divide-y">{projection.revisions.map((revision) => <tr key={revision.id}><td className="px-3 py-3">{revision.created_at.slice(0, 10)}</td><td className="px-3 py-3 tabular-nums">{revision.previous_hours === null ? '—' : displayHours(revision.previous_hours)}</td><td className="px-3 py-3 tabular-nums">{revision.current_hours === null ? '—' : displayHours(revision.current_hours)}</td><td className="px-3 py-3 tabular-nums">{displayHours(revision.delta_hours)}</td><td className="px-3 py-3">{revision.actor_user_id}</td><td className="px-3 py-3">{revision.reason ?? '—'}</td></tr>)}</tbody></table></div></Surface> : null}
  </PageShell>
}

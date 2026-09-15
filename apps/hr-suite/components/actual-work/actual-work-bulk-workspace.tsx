'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActualWorkBulkProjection } from '@/lib/actual-work/actual-work-service'
import { formatExactHours, formatExactTime, parseExactHours, parseExactTime } from '@/lib/actual-work/exact-hours'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'

type Presentation = 'DECIMAL' | 'TIME'

export type ActualWorkBulkLabels = {
  title: string
  description: string
  back: string
  previousMonth: string
  nextMonth: string
  month: string
  type: string
  selectType: string
  searchTypes: string
  family: string
  familyWork: string
  familyAdditional: string
  familyOvertime: string
  familyTransparent: string
  view: string
  day: string
  period: string
  employee: string
  employeePlaceholder: string
  department: string
  allDepartments: string
  search: string
  grid: string
  noEmployees: string
  noTypes: string
  hoursPlaceholder: string
  decimal: string
  time: string
  periodStatus: string
  open: string
  closed: string
  closedMessage: string
  closedCorrection: string
  additionalUnavailable: string
  note: string
  noteHelp: string
  correctionReason: string
  correctionReasonHelp: string
  limits: string
  limitDay: string
  limitWeek: string
  limitMonth: string
  save: string
  saving: string
  saved: string
  failed: string
  invalidValue: string
  noChanges: string
  changedCells: string
  periodFact: string
  errorLimit: string
  errorAdditional: string
  errorComment: string
  errorFuture: string
  errorScope: string
  errorDate: string
  errorType: string
}

type CellDescriptor = {
  key: string
  date: string
  entry: ActualWorkBulkProjection['employees'][number]['entries'][number] | null
}

function monthOffset(month: string, offset: number): string {
  const value = new Date(month + '-01T00:00:00Z')
  value.setUTCMonth(value.getUTCMonth() + offset)
  return value.toISOString().slice(0, 7)
}

function familyLabel(family: string, labels: ActualWorkBulkLabels): string {
  if (family === 'ADDITIONAL') return labels.familyAdditional
  if (family === 'OVERTIME') return labels.familyOvertime
  if (family === 'TRANSPARENT') return labels.familyTransparent
  return labels.familyWork
}

function employeeName(employee: ActualWorkBulkProjection['employees'][number]['employee']): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ') || employee.employee_number
}

function canonicalFromStoredHours(hours: number): string {
  return formatExactHours(parseExactHours(String(hours)))
}

function displayStoredHours(hours: number, presentation: Presentation): string {
  const exact = parseExactHours(String(hours))
  return presentation === 'TIME' ? formatExactTime(exact) : formatExactHours(exact)
}

function cellKey(employmentId: string, date: string): string {
  return `${employmentId}:${date}`
}

function valueToCanonical(value: string, presentation: Presentation): string {
  return presentation === 'TIME' ? formatExactHours(parseExactTime(value)) : formatExactHours(parseExactHours(value))
}

function formatLimit(value: number): string {
  return String(value)
}

function errorMessage(code: string, labels: ActualWorkBulkLabels): string {
  if (code === labels.noChanges || code === labels.closedCorrection) return code
  if (code === 'ACTUAL_WORK_HOURS_FORMAT_INVALID' || code === 'ACTUAL_WORK_TIME_PRECISION_INVALID' || code === 'ACTUAL_WORK_HOURS_PRECISION_INVALID') return labels.invalidValue
  if (code === 'ACTUAL_WORK_LIMIT_EXCEEDED' || code === 'ACTUAL_WORK_PERIOD_LIMIT_UNSUPPORTED') return labels.errorLimit
  if (code === 'ACTUAL_WORK_ADDITIONAL_ONLY_PART_TIME') return labels.errorAdditional
  if (code === 'ACTUAL_WORK_COMMENT_REQUIRED') return labels.errorComment
  if (code === 'ACTUAL_WORK_FUTURE_NOT_ALLOWED') return labels.errorFuture
  if (code === 'ACTUAL_WORK_BULK_SCOPE_INVALID') return labels.errorScope
  if (code === 'ACTUAL_WORK_BULK_DATE_INVALID') return labels.errorDate
  if (code === 'ACTUAL_WORK_TYPE_NOT_ACTIVE') return labels.errorType
  if (code === 'ACTUAL_WORK_PERIOD_CLOSED' || code === 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED') return labels.closedCorrection
  return labels.failed
}

export function ActualWorkBulkWorkspace({ projection, labels, initialEmployeeQuery = '', initialDepartmentId = '' }: {
  projection: ActualWorkBulkProjection
  labels: ActualWorkBulkLabels
  initialEmployeeQuery?: string
  initialDepartmentId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedType = projection.types.find((type) => type.id === projection.selectedTypeId) ?? null
  const periodClosed = projection.period?.status === 'CLOSED'
  const [presentation, setPresentation] = useState<Presentation>('DECIMAL')
  const [values, setValues] = useState<Record<string, string>>({})
  const [employeeQuery, setEmployeeQuery] = useState(initialEmployeeQuery)
  const [note, setNote] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cellsByRow = useMemo(() => projection.employees.map((row) => ({
    row,
    cells: (projection.entryGranularity === 'PERIOD' ? [projection.month + '-01'] : projection.days).map((date): CellDescriptor => ({
      key: cellKey(row.employment.id, date),
      date,
      entry: row.entries.find((entry) => entry.subject_period_start === date) ?? null,
    })),
  })), [projection])

  const initialValues = useMemo(() => Object.fromEntries(cellsByRow.flatMap(({ cells }) => cells.map((cell) => [cell.key, cell.entry ? displayStoredHours(cell.entry.hours, presentation) : '']))), [cellsByRow, presentation])
  const initialCanonicalValues = useMemo(() => Object.fromEntries(cellsByRow.flatMap(({ cells }) => cells.map((cell) => [cell.key, cell.entry ? canonicalFromStoredHours(cell.entry.hours) : '']))), [cellsByRow])
  const projectionKey = useMemo(() => projection.month + '|' + projection.selectedTypeId + '|' + projection.entryGranularity + '|' + cellsByRow.map(({ row, cells }) => row.employment.id + ':' + cells.map((cell) => cell.entry ? cell.entry.id + ':' + cell.entry.updated_at + ':' + cell.entry.hours : cell.key).join(',')).join('|'), [cellsByRow, projection.entryGranularity, projection.month, projection.selectedTypeId])
  const lastProjectionKey = useRef<string | null>(null)

  useEffect(() => {
    if (lastProjectionKey.current === projectionKey) return
    lastProjectionKey.current = projectionKey
    setValues(initialValues)
    setMessage(null)
    setError(null)
    setNote('')
    setCorrectionReason('')
  }, [initialValues, projectionKey])

  function navigate(next: Record<string, string | undefined>): void {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  function changePresentation(next: Presentation): void {
    if (next === presentation) return
    setValues((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => {
      if (!value.trim()) return [key, value]
      try {
        const canonical = valueToCanonical(value, presentation)
        const exact = parseExactHours(canonical)
        return [key, next === 'TIME' ? formatExactTime(exact) : formatExactHours(exact)]
      } catch {
        return [key, value]
      }
    })))
    setPresentation(next)
  }

  function changesForSave(): Array<{
    employeeId: string
    employmentId: string
    entryId: string | null
    subjectPeriodStart: string
    hours: string
    note: string | null
    correctionReason: string | null
  }> {
    const changes: Array<{
      employeeId: string
      employmentId: string
      entryId: string | null
      subjectPeriodStart: string
      hours: string
      note: string | null
      correctionReason: string | null
    }> = []
    for (const { row, cells } of cellsByRow) {
      for (const cell of cells) {
        const displayed = values[cell.key] ?? ''
        if (!displayed.trim()) continue
        const canonical = valueToCanonical(displayed, presentation)
        if (canonical === initialCanonicalValues[cell.key]) continue
        changes.push({
          employeeId: row.employee.id,
          employmentId: row.employment.id,
          entryId: cell.entry?.id ?? null,
          subjectPeriodStart: cell.date,
          hours: canonical,
          note: note.trim() || cell.entry?.note || null,
          correctionReason: periodClosed ? correctionReason.trim() || null : null,
        })
      }
    }
    return changes
  }

  async function save(): Promise<void> {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const changes = changesForSave()
      if (changes.length === 0) throw new Error(labels.noChanges)
      if (periodClosed && (!correctionReason.trim() || changes.some((change) => change.entryId === null))) throw new Error(labels.closedCorrection)
      const response = await fetch('/api/actual-work/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: projection.month, workHourTypeId: projection.selectedTypeId, entryGranularity: projection.entryGranularity, changes }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? labels.failed)
      setMessage(labels.saved)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  const typeAllowsPeriod = selectedType?.entry_granularity === 'PERIOD' || selectedType?.entry_granularity === 'BOTH'
  const changedCount = Object.entries(values).filter(([key, value]) => {
    if (!value.trim()) return false
    try {
      return valueToCanonical(value, presentation) !== initialCanonicalValues[key]
    } catch {
      return true
    }
  }).length

  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader
      actions={<div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised" href="/actual-work/team">{labels.back}</Link><Link aria-label={labels.previousMonth} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised" href={'/actual-work/bulk?month=' + monthOffset(projection.month, -1) + (projection.selectedTypeId ? '&typeId=' + projection.selectedTypeId : '')}>{'← ' + monthOffset(projection.month, -1)}</Link><Link aria-label={labels.nextMonth} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised" href={'/actual-work/bulk?month=' + monthOffset(projection.month, 1) + (projection.selectedTypeId ? '&typeId=' + projection.selectedTypeId : '')}>{monthOffset(projection.month, 1) + ' →'}</Link></div>}
      description={labels.description}
      title={labels.title + ' · ' + projection.month}
    />

    <Surface className="p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(12rem,.8fr)_minmax(16rem,1.1fr)_minmax(12rem,.7fr)_minmax(16rem,1.1fr)]">
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.month}</span><TextInput onChange={(event) => navigate({ month: event.target.value })} type="month" value={projection.month} /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.type}</span><DropdownSelect aria-label={labels.selectType} onChange={(event) => navigate({ typeId: event.target.value, view: undefined })} placeholder={labels.selectType} searchable searchPlaceholder={labels.searchTypes} value={projection.selectedTypeId ?? ''}>{projection.types.map((type) => <option key={type.id} value={type.id}>{type.code ? type.code + ' · ' : ''}{type.name} · {familyLabel(type.family, labels)}</option>)}</DropdownSelect></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.view}</span><DropdownSelect aria-label={labels.view} disabled={!typeAllowsPeriod} onChange={(event) => navigate({ view: event.target.value === 'PERIOD' ? 'period' : undefined })} value={projection.entryGranularity}>{typeAllowsPeriod ? <option value="DAY">{labels.day}</option> : null}<option value="PERIOD" disabled={!typeAllowsPeriod}>{labels.period}</option></DropdownSelect></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.department}</span><DropdownSelect aria-label={labels.department} onChange={(event) => navigate({ departmentId: event.target.value || undefined })} searchable searchPlaceholder={labels.department} value={initialDepartmentId}><option value="">{labels.allDepartments}</option>{projection.departments.map((department) => <option key={department.id} value={department.id}>{department.code} · {department.name}</option>)}</DropdownSelect></label>
      </div>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); navigate({ employee: employeeQuery.trim() || undefined }) }}>
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium"><span>{labels.employee}</span><TextInput onChange={(event) => setEmployeeQuery(event.target.value)} placeholder={labels.employeePlaceholder} value={employeeQuery} /></label>
        <Button type="submit" variant="secondary">{labels.search}</Button>
      </form>
    </Surface>

    <Surface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{labels.grid}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedType ? selectedType.name + ' · ' + familyLabel(selectedType.family, labels) : labels.noTypes}{projection.entryGranularity === 'PERIOD' ? ' · ' + labels.periodFact : ''}</p></div>
        <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + (periodClosed ? 'bg-destructive/10 text-destructive' : 'bg-chart-2/10 text-chart-2')}>{labels.periodStatus}: {periodClosed ? labels.closed : labels.open}</span>
      </div>
      {periodClosed ? <p className="mt-4 rounded-[var(--radius-control)] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{labels.closedMessage}</p> : null}
      {projection.limits.length ? <details className="mt-4 rounded-[var(--radius-control)] border border-border-subtle p-3 text-sm"><summary className="cursor-pointer font-medium">{labels.limits}</summary><dl className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-3">{projection.limits.map((limit) => <div key={limit.limit_scope}><dt>{limit.limit_scope === 'DAY' ? labels.limitDay : limit.limit_scope === 'WEEK' ? labels.limitWeek : labels.limitMonth}</dt><dd className="font-medium text-foreground tabular-nums">{formatLimit(limit.max_hours)}</dd></div>)}</dl></details> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm"><span>{labels.hoursPlaceholder}</span><Button onClick={() => changePresentation('DECIMAL')} size="sm" type="button" variant={presentation === 'DECIMAL' ? 'primary' : 'secondary'}>{labels.decimal}</Button><Button onClick={() => changePresentation('TIME')} size="sm" type="button" variant={presentation === 'TIME' ? 'primary' : 'secondary'}>{labels.time}</Button></div>
        <span className="text-sm text-muted-foreground">{labels.changedCells}: {changedCount}</span>
      </div>
      {projection.employees.length === 0 ? <p className="mt-5 rounded-[var(--radius-control)] border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.noEmployees}</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm"><thead><tr><th className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-3 font-semibold">{labels.employee}</th>{(projection.entryGranularity === 'PERIOD' ? [projection.month + '-01'] : projection.days).map((date) => <th className="border-b border-border px-2 py-3 text-center text-xs font-semibold tabular-nums text-muted-foreground" key={date}>{projection.entryGranularity === 'PERIOD' ? projection.month : date.slice(8)}</th>)}</tr></thead><tbody>{cellsByRow.map(({ row, cells }) => <tr key={row.employment.id}><th className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-3 align-top font-medium"><Link className="hover:text-primary hover:underline" href={'/employees/' + row.employee.id + '/hours?employmentId=' + row.employment.id + '&month=' + projection.month}>{employeeName(row.employee)}</Link><span className="mt-1 block text-xs font-normal text-muted-foreground">{row.department?.name ?? row.employee.employee_number}</span></th>{cells.map((cell) => { const additionalAllowed = selectedType?.family !== 'ADDITIONAL' || (projection.entryGranularity === 'PERIOD' ? row.additionalEligibleForPeriod : row.additionalEligibleDates.includes(cell.date)); const disabled = saving || (periodClosed && !cell.entry) || !additionalAllowed; return <td className="border-b border-border px-1.5 py-1.5 align-top" key={cell.key}>{disabled && !cell.entry ? <span className="block px-2 py-2 text-center text-muted-foreground" title={additionalAllowed ? undefined : labels.additionalUnavailable}>—</span> : <TextInput aria-label={employeeName(row.employee) + ' ' + cell.date} className="min-w-20 text-center tabular-nums" disabled={disabled} inputMode={presentation === 'TIME' ? 'text' : 'decimal'} onChange={(event) => setValues((current) => ({ ...current, [cell.key]: event.target.value }))} placeholder={presentation === 'TIME' ? '00:00:00.00' : labels.hoursPlaceholder} title={periodClosed && cell.entry ? labels.closedCorrection : undefined} value={values[cell.key] ?? ''} />}</td> })}</tr>)}</tbody></table></div>}
    </Surface>

    <Surface className="p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.note}</span><Textarea maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /><span className="text-xs font-normal text-muted-foreground">{labels.noteHelp}</span></label>
        {periodClosed ? <label className="grid gap-1.5 text-sm font-medium"><span>{labels.correctionReason}</span><Textarea maxLength={500} onChange={(event) => setCorrectionReason(event.target.value)} required value={correctionReason} /><span className="text-xs font-normal text-muted-foreground">{labels.correctionReasonHelp}</span></label> : null}
      </div>
      {message ? <p aria-live="polite" className="mt-4 text-sm text-chart-2">{message}</p> : null}
      {error ? <p aria-live="assertive" className="mt-4 text-sm text-destructive">{errorMessage(error, labels)}</p> : null}
      <div className="mt-5"><Button disabled={saving || !selectedType || projection.employees.length === 0} onClick={() => void save()} type="button">{saving ? labels.saving : labels.save}</Button></div>
    </Surface>
  </PageShell>
}

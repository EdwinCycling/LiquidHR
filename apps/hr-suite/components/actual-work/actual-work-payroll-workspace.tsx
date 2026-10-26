'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import type { getActualWorkPayrollReview } from '@/lib/actual-work/payroll-work-hours-service'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'

type ReviewData = Awaited<ReturnType<typeof getActualWorkPayrollReview>>
type ReviewRow = ReviewData['employees'][number]
type ImportPreview = { rows: Array<{ rowNumber: number; employeeNumber: string; workHourTypeCode: string; subjectPeriodStart: string; subjectPeriodEnd: string; payrollPeriodStart: string; hours: string; valid: boolean; error: string | null; duplicate: boolean }>; saved?: Array<{ rowNumber: number; duplicate: boolean; status: string }> }

export type ActualWorkPayrollLabels = {
  title: string; description: string; period: string; load: string; bulkInput: string; importTitle: string; importHelp: string
  chooseFile: string; preview: string; confirmImport: string; rows: string; valid: string; invalid: string; duplicate: string
  filter: string; exceptionsOnly: string; noEntries: string; select: string; saved: string; approved: string; released: string
  needsReview: string; approve: string; release: string; mappingTitle: string; type: string; target: string; payment: string
  premium: string; tvt: string; tvtSourceGap: string; informational: string; factor: string; validFrom: string; saveMapping: string; done: string
  failed: string; importSaved: string; approvedSaved: string; releasedSaved: string; administration: string; sourceGap: string; twkRequired: string
  csvEmployee: string; csvEmployment: string; csvType: string; csvPeriod: string; csvHours: string; csvColumn: string
  csvComment: string; csvReference: string; payrollComponent: string
}

function humanError(code: string | null | undefined, labels: ActualWorkPayrollLabels): string {
  if (!code) return labels.failed
  if (code.includes('EMPLOYEE')) return labels.csvEmployee
  if (code.includes('EMPLOYMENT')) return labels.csvEmployment
  if (code.includes('TYPE') || code.includes('GRANULARITY')) return labels.csvType
  if (code.includes('PERIOD') || code.includes('DAY_INVALID')) return labels.csvPeriod
  if (code.includes('HOURS') || code.includes('FACTOR')) return labels.csvHours
  if (code.includes('HEADER') || code.includes('COLUMN') || code.includes('QUOTE')) return labels.csvColumn
  if (code.includes('COMMENT')) return labels.csvComment
  if (code.includes('REFERENCE')) return labels.csvReference
  if (code.includes('MAPPING') || code.includes('SOURCE_GAP') || code.includes('COMPONENT')) return labels.sourceGap
  return labels.failed
}

function rowName(row: ReviewRow): string {
  if (!row.employee) return row.employee_id
  return [row.employee.first_name, row.employee.birth_name_prefix, row.employee.birth_name].filter(Boolean).join(' ') || row.employee.employee_number
}

function rowState(row: ReviewRow, labels: ActualWorkPayrollLabels): string {
  if (row.tvtConfigured) return labels.tvtSourceGap
  if (row.effectiveMappings.some((mapping) => mapping.processing_target === 'PREMIUM')
    || (row.workType?.family === 'OVERTIME' && row.effectiveMappings.some((mapping) => mapping.processing_target === 'PAYMENT'))) return labels.sourceGap
  if (row.release?.release_class === 'TWK_REQUIRED') return labels.twkRequired
  if (row.release) return labels.released
  if (row.needsPayrollReview) return labels.needsReview
  if (row.informational) return labels.informational
  return row.status === 'APPROVED' ? labels.approved : labels.saved
}

export function ActualWorkPayrollWorkspace({ initial, labels }: { initial: ReviewData; labels: ActualWorkPayrollLabels }) {
  const [data, setData] = useState(initial)
  const [periodStart, setPeriodStart] = useState(initial.periodStart)
  const [filter, setFilter] = useState('')
  const [exceptionsOnly, setExceptionsOnly] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [workHourTypeId, setWorkHourTypeId] = useState(initial.availableTypes[0]?.id ?? '')
  const [target, setTarget] = useState<'PAYMENT' | 'PREMIUM' | 'TVT' | 'INFORMATIONAL'>('PAYMENT')
  const [factor, setFactor] = useState('1.0000')
  const [validFrom, setValidFrom] = useState(initial.periodStart)

  const visibleRows = useMemo(() => data.employees.filter((row) => {
    const needle = filter.trim().toLocaleLowerCase()
    const matches = !needle || [rowName(row), row.employee?.employee_number ?? '', row.workType?.code ?? '', row.workType?.name ?? ''].join(' ').toLocaleLowerCase().includes(needle)
    const payrollMapping = row.effectiveMappings.some((mapping) => mapping.processing_target === 'PAYMENT' || mapping.processing_target === 'PREMIUM')
    const unsupportedMapping = row.effectiveMappings.some((mapping) => mapping.processing_target === 'PREMIUM')
      || (row.workType?.family === 'OVERTIME' && row.effectiveMappings.some((mapping) => mapping.processing_target === 'PAYMENT'))
    const exception = row.status !== 'APPROVED' || row.needsPayrollReview || row.tvtConfigured || unsupportedMapping || (payrollMapping && !row.release)
    return matches && (!exceptionsOnly || exception)
  }), [data.employees, exceptionsOnly, filter])

  const refresh = useCallback(async (nextPeriod = periodStart) => {
    const response = await fetch(`/api/actual-work/payroll?periodStart=${encodeURIComponent(nextPeriod)}`, { cache: 'no-store' })
    const payload = await response.json() as { data?: ReviewData; error?: string }
    if (!response.ok || !payload.data) throw new Error(payload.error ?? labels.failed)
    setData(payload.data)
    setSelected([])
  }, [labels.failed, periodStart])

  async function runAction(body: Record<string, unknown>, success: string): Promise<void> {
    setBusy(true); setError(null); setMessage(null)
    try {
      const response = await fetch('/api/actual-work/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(humanError(payload.error, labels))
      await refresh()
      setMessage(success)
    } catch (caught) { setError(caught instanceof Error ? humanError(caught.message, labels) : labels.failed) }
    finally { setBusy(false) }
  }

  async function previewImport(confirm = false): Promise<void> {
    setBusy(true); setError(null); setMessage(null)
    try {
      const response = await fetch('/api/actual-work/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: csvText, confirm }) })
      const payload = await response.json() as { data?: ImportPreview; error?: string }
      if (!response.ok || !payload.data) throw new Error(humanError(payload.error, labels))
      setPreview(payload.data)
      if (confirm) { setMessage(labels.importSaved); await refresh() }
    } catch (caught) { setError(caught instanceof Error ? humanError(caught.message, labels) : labels.failed) }
    finally { setBusy(false) }
  }

  const selectedPending = selected.filter((id) => data.employees.some((row) => row.id === id && row.status === 'PENDING'))
  const selectedApproved = selected.filter((id) => data.employees.some((row) => row.id === id && row.status === 'APPROVED' && !row.release && !row.needsPayrollReview && !row.tvtConfigured && !row.effectiveMappings.some((mapping) => mapping.processing_target === 'PREMIUM') && row.workType?.family !== 'OVERTIME' && row.effectiveMappings.filter((mapping) => mapping.processing_target === 'PAYMENT').length === 1))
  const selectedRows = selected.flatMap((id) => { const row = data.employees.find((entry) => entry.id === id); return row ? [row] : [] })
  const totalHours = visibleRows.reduce((total, row) => total + row.hours, 0)

  return <PageShell className="space-y-5 py-6 sm:py-8" width="wide">
    <PageHeader actions={<Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-raised" href={`/actual-work/bulk?month=${periodStart.slice(0, 7)}&view=period`}>{labels.bulkInput}</Link>} description={labels.description} title={labels.title} />
    <Surface className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.period}</span><TextInput onChange={(event) => setPeriodStart(event.target.value ? `${event.target.value}-01` : '')} type="month" value={periodStart.slice(0, 7)} /></label>
      <Button disabled={busy || periodStart.length !== 10} onClick={() => { setBusy(true); setError(null); void refresh().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : labels.failed)).finally(() => setBusy(false)) }} type="button" variant="secondary">{labels.load}</Button>
    </Surface>

    <Surface className="space-y-4 p-4 sm:p-5">
      <div><h2 className="text-lg font-semibold">{labels.importTitle}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{labels.importHelp}</p></div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.chooseFile}</span><input accept=".csv,text/csv" className="max-w-full text-sm file:mr-3 file:min-h-10 file:rounded-[var(--radius-control)] file:border file:border-border file:bg-surface file:px-3 file:text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then((text) => { setCsvText(text); setPreview(null) }) }} type="file" /></label>
        <Button disabled={busy || !csvText} onClick={() => void previewImport(false)} type="button" variant="secondary">{labels.preview}</Button>
      </div>
      {preview ? <div className="space-y-3">
        <p className="text-sm">{labels.valid}: {preview.rows.filter((row) => row.valid).length} · {labels.invalid}: {preview.rows.filter((row) => !row.valid).length} · {labels.duplicate}: {preview.rows.filter((row) => row.duplicate).length}</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{preview.rows.map((row) => <div className={`min-w-0 rounded-[var(--radius-control)] border p-3 text-sm ${row.valid ? 'border-chart-2/30' : 'border-destructive/35'}`} key={`${row.rowNumber}-${row.employeeNumber}`}><p className="break-words font-medium">#{row.rowNumber} · {row.employeeNumber} · {row.workHourTypeCode}</p><p className="mt-1 text-muted-foreground">{row.subjectPeriodStart} → {row.subjectPeriodEnd} · {row.hours} h · {row.payrollPeriodStart}</p><p className={row.valid ? 'mt-1 text-chart-2' : 'mt-1 text-destructive'}>{row.duplicate ? labels.duplicate : row.error ? humanError(row.error, labels) : labels.valid}</p></div>)}</div>
        {preview.rows.some((row) => row.valid) ? <Button disabled={busy} onClick={() => void previewImport(true)} type="button">{labels.confirmImport}</Button> : null}
      </div> : null}
    </Surface>

    <Surface className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.filter}</span><TextInput onChange={(event) => setFilter(event.target.value)} value={filter} /></label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input checked={exceptionsOnly} onChange={(event) => setExceptionsOnly(event.target.checked)} type="checkbox" />{labels.exceptionsOnly}</label>
        <div className="text-sm text-muted-foreground">{visibleRows.length} {labels.rows} · {totalHours.toFixed(4)} h</div>
      </div>
      {visibleRows.length === 0 ? <p className="rounded-[var(--radius-control)] border border-dashed p-6 text-center text-sm text-muted-foreground">{labels.noEntries}</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleRows.map((row) => <article className="min-w-0 rounded-[var(--radius-control)] border border-border p-3 sm:p-4" key={row.id}>
          <div className="flex items-start gap-3"><input aria-label={`${labels.select} ${row.employee?.employee_number ?? row.employee_id}`} checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, row.id])] : current.filter((id) => id !== row.id))} type="checkbox" /><div className="min-w-0 flex-1"><p className="break-words font-semibold">{rowName(row)}</p><p className="text-xs text-muted-foreground">{row.employee?.employee_number ?? row.employee_id} · {row.workType?.code ?? '—'}</p></div></div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm"><div><dt className="text-xs text-muted-foreground">{labels.type}</dt><dd className="break-words">{row.workType?.name ?? row.work_hour_type_id}</dd></div><div><dt className="text-xs text-muted-foreground">{labels.period}</dt><dd className="break-words">{row.subject_period_start} → {row.subject_period_end}</dd></div><div><dt className="text-xs text-muted-foreground">{labels.rows}</dt><dd className="tabular-nums">{String(row.hours)} h</dd></div><div><dt className="text-xs text-muted-foreground">{labels.target}</dt><dd className="break-words">{row.release?.mapping?.salary_component_code ?? (row.effectiveMappings.length ? row.effectiveMappings.map((mapping) => mapping.processing_target).join(', ') : labels.sourceGap)}</dd></div></dl>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.release ? 'bg-chart-2/10 text-chart-2' : row.status === 'PENDING' || row.needsPayrollReview ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>{rowState(row, labels)}</span>{row.release ? <span className="font-mono text-[10px] text-muted-foreground" title={row.release.content_fingerprint}>{row.release.content_fingerprint.slice(0, 12)}</span> : null}</div>
        </article>)}
      </div>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || selectedPending.length === 0} onClick={() => void runAction({ action: 'approve', entryIds: selectedPending }, labels.approvedSaved)} type="button" variant="secondary">{labels.approve} ({selectedPending.length})</Button><Button disabled={busy || selectedApproved.length === 0} onClick={() => void runAction({ action: 'release', periodStart, entryIds: selectedApproved }, labels.releasedSaved)} type="button">{labels.release} ({selectedApproved.length})</Button></div>
      {selectedRows.some((row) => row.needsPayrollReview) ? <p className="text-sm text-destructive">{labels.needsReview}</p> : null}
      {message ? <p aria-live="polite" className="text-sm text-chart-2">{message}</p> : null}{error ? <p aria-live="assertive" className="break-words text-sm text-destructive">{error}</p> : null}
    </Surface>

    <Surface className="space-y-4 p-4 sm:p-5">
      <div><h2 className="text-lg font-semibold">{labels.mappingTitle}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{labels.administration}: {data.administrationId}</p><p className="mt-1 break-words text-sm text-muted-foreground">{labels.payrollComponent}: PAYFULL02_VARIABLE_REGULAR_WAGE</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.type}</span><DropdownSelect onChange={(event) => setWorkHourTypeId(event.target.value)} value={workHourTypeId}>{data.availableTypes.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}</DropdownSelect></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.target}</span><DropdownSelect onChange={(event) => setTarget(event.target.value as typeof target)} value={target}><option value="PAYMENT">{labels.payment}</option><option disabled value="PREMIUM">{labels.premium} · {labels.sourceGap}</option><option value="TVT">{labels.tvt}</option><option value="INFORMATIONAL">{labels.informational}</option></DropdownSelect></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.factor}</span><TextInput disabled={target === 'TVT' || target === 'INFORMATIONAL'} inputMode="decimal" onChange={(event) => setFactor(event.target.value)} value={factor} /></label>
        <label className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{labels.validFrom}</span><TextInput onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} /></label>
      </div>
      <Button disabled={busy || !workHourTypeId} onClick={() => void runAction({ action: 'map', mapping: { workHourTypeId, processingTarget: target, factor, validFrom } }, labels.done)} type="button" variant="secondary">{labels.saveMapping}</Button>
    </Surface>
  </PageShell>
}

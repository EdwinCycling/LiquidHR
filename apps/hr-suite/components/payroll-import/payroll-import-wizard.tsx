'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'

type PublicAnalysis = {
  sourceType: 'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'
  sourceFilename: string
  sourceHash: string
  rows: Array<{
    sourceRowNumber: number
    externalEmployeeNumber?: string
    initials?: string
    prefix?: string
    firstName?: string
    birthName?: string
    birthDate?: string
    gender?: string
    nationality?: string
    address?: Record<string, string>
    incomeRelationships: Array<{ payrollTaxNumber: string; ikvNumber: number; startsOn?: string; endsOn?: string }>
    status: 'GREEN' | 'WARNING' | 'BLOCKING'
    match: { status: string; employeeId?: string; reason?: string }
    issues: Array<{ code: string; severity: string; field?: string }>
  }>
  summary: { total: number; green: number; warnings: number; blocking: number; incomeRelationships: number; ambiguousMatches: number }
}

type Labels = Record<string, string>
type FinalizeReport = { employeesImported: number; employmentsCreated: number; incomeRelationshipsImported: number; warnings: string[] }
const stepKeys = ['stepExplanation', 'stepPreflight', 'stepFile', 'stepAnalyze', 'stepEmployer', 'stepPeople', 'stepSelect', 'stepPerson', 'stepConflicts', 'stepPreview', 'stepFinal', 'stepReport'] as const

export function PayrollImportWizard({ administrationId, labels }: { administrationId: string | null; labels: Labels }) {
  const [step, setStep] = useState(0)
  const [sourceType, setSourceType] = useState<'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'>('INTERNAL_REPRESENTATIVE')
  const [file, setFile] = useState<File | null>(null)
  const [taxYear, setTaxYear] = useState('2026')
  const [periodStart, setPeriodStart] = useState('2026-01-01')
  const [periodEnd, setPeriodEnd] = useState('2026-12-31')
  const [analysis, setAnalysis] = useState<PublicAnalysis | null>(null)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [report, setReport] = useState<FinalizeReport | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canContinue = Boolean(administrationId && file)
  const selected = useMemo(() => new Set(selectedRows), [selectedRows])

  function setFileFromEvent(event: ChangeEvent<HTMLInputElement>): void {
    setFile(event.target.files?.[0] ?? null)
    setError(null)
  }

  async function analyze(): Promise<void> {
    if (!file || !administrationId) {
      setError(labels.error)
      return
    }
    setPending(true)
    setError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('sourceType', sourceType)
    form.set('taxYear', taxYear)
    form.set('periodStart', periodStart)
    form.set('periodEnd', periodEnd)
    form.set('administrationId', administrationId)
    try {
      const response = await fetch('/api/payroll/import/analyze', { method: 'POST', body: form })
      const payload = await response.json() as { data?: PublicAnalysis; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'REAL_XML_PENDING' ? labels.xsdPending : payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setAnalysis(payload.data)
      setSelectedRows(payload.data.rows.filter((row) => row.status !== 'BLOCKING' && row.match.status !== 'MANUAL_REVIEW').map((row) => row.sourceRowNumber))
      setStep(4)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  async function stage(): Promise<void> {
    if (!file || !administrationId) return
    setPending(true)
    setError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('sourceType', sourceType)
    form.set('taxYear', taxYear)
    form.set('periodStart', periodStart)
    form.set('periodEnd', periodEnd)
    form.set('administrationId', administrationId)
    try {
      const response = await fetch('/api/payroll/import/stage', { method: 'POST', body: form })
      const payload = await response.json() as { data?: { batchId: string; analysis: PublicAnalysis }; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setBatchId(payload.data.batchId)
      setAnalysis(payload.data.analysis)
      setStep(10)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  async function finalize(): Promise<void> {
    if (!batchId || !administrationId) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/payroll/import/finalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId, administrationId, selectedRowNumbers: selectedRows }) })
      const payload = await response.json() as { data?: FinalizeReport; error?: string }
      if (!response.ok || !payload.data) {
        setError(payload.error === 'CONVERGENCE_REQUIRED' ? labels.convergenceRequired : labels.error)
        return
      }
      setReport(payload.data)
      setStep(11)
    } catch {
      setError(labels.error)
    } finally {
      setPending(false)
    }
  }

  function toggleRow(rowNumber: number): void {
    setSelectedRows((current) => current.includes(rowNumber) ? current.filter((value) => value !== rowNumber) : [...current, rowNumber])
  }

  return <div className="space-y-6">
    <Surface className="overflow-x-auto p-3"><ol className="flex min-w-max gap-2" aria-label={labels.title}>{stepKeys.map((key, index) => <li className={`rounded-[var(--radius-control)] px-3 py-2 text-xs font-medium ${index === step ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} key={key}>{index + 1}. {labels[key]}</li>)}</ol></Surface>
    <Surface className="p-5 sm:p-7">
      {step === 0 ? <div className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{labels.description}</p><p className="rounded-[var(--radius-control)] bg-surface-subtle p-4 text-sm text-muted-foreground">{labels.previewNoWrites}</p><Button onClick={() => setStep(1)} type="button">{labels.next}</Button></div> : null}
      {step === 1 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">{administrationId ? labels.stepPreflight : labels.noActiveAdministration}</p><Button disabled={!administrationId} onClick={() => setStep(2)} type="button">{labels.next}</Button></div> : null}
      {step === 2 ? <div className="space-y-5"><label className="block text-sm font-medium">{labels.sourceType}<DropdownSelect className="mt-2" onChange={(event) => setSourceType(event.target.value as typeof sourceType)} searchable value={sourceType}><option value="INTERNAL_REPRESENTATIVE">{labels.internalRepresentative}</option><option value="LOONAANGIFTE_XML">{labels.loonaangifteXml}</option></DropdownSelect></label><label className="block text-sm font-medium">{labels.file}<TextInput className="mt-2" onChange={setFileFromEvent} type="file" /></label><p className="text-sm leading-6 text-muted-foreground">{labels.fixtureHint}</p><Button disabled={!file} onClick={() => setStep(3)} type="button">{labels.next}</Button></div> : null}
      {step === 3 ? <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm font-medium">{labels.taxYear}<TextInput className="mt-2" inputMode="numeric" onChange={(event) => setTaxYear(event.target.value)} value={taxYear} /></label><label className="block text-sm font-medium">{labels.periodStart}<TextInput className="mt-2" onChange={(event) => setPeriodStart(event.target.value)} type="date" value={periodStart} /></label><label className="block text-sm font-medium">{labels.periodEnd}<TextInput className="mt-2" onChange={(event) => setPeriodEnd(event.target.value)} type="date" value={periodEnd} /></label></div><Button disabled={!canContinue} loading={pending} onClick={analyze} type="button">{pending ? labels.analyzing : labels.analyze}</Button></div> : null}
      {step >= 4 && step <= 9 && analysis ? <div className="space-y-5"><h2 className="text-xl font-semibold">{labels.analysisTitle}</h2><p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p><div className="grid gap-3 sm:grid-cols-4">{([[labels.total, analysis.summary.total], [labels.green, analysis.summary.green], [labels.warnings, analysis.summary.warnings], [labels.blocking, analysis.summary.blocking]] as const).map(([label, value]) => <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-2 py-3">{labels.select}</th><th className="px-2 py-3">{labels.row}</th><th className="px-2 py-3">{labels.status}</th><th className="px-2 py-3">{labels.match}</th><th className="px-2 py-3">{labels.issues}</th></tr></thead><tbody className="divide-y divide-border">{analysis.rows.map((row) => <tr key={row.sourceRowNumber}><td className="px-2 py-3"><input aria-label={`${labels.select} ${row.sourceRowNumber}`} checked={selected.has(row.sourceRowNumber)} disabled={row.status === 'BLOCKING' || row.match.status === 'MANUAL_REVIEW'} onChange={() => toggleRow(row.sourceRowNumber)} type="checkbox" /></td><td className="px-2 py-3">{row.sourceRowNumber} · {row.firstName ?? row.initials ?? labels.emptyValue} {row.birthName ?? ''}</td><td className="px-2 py-3">{labels[`status_${row.status}`] ?? row.status}</td><td className="px-2 py-3">{labels[`match_${row.match.status}`] ?? row.match.status}</td><td className="px-2 py-3">{row.issues.map((item) => labels[`issue_${item.code}`] ?? item.code).join(', ') || labels.emptyValue}</td></tr>)}</tbody></table></div><div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} type="button">{labels.back}</Button><Button loading={pending} onClick={() => step === 9 ? stage() : setStep(step + 1)} type="button">{step === 9 ? labels.confirmPreview : labels.next}</Button></div></div> : null}
      {step === 10 && analysis ? <div className="space-y-5"><p className="rounded-[var(--radius-control)] bg-success-subtle p-4 text-sm text-success">{labels.staged}</p><p className="text-sm text-muted-foreground">{labels.previewNoWrites}</p><Button loading={pending} onClick={finalize} type="button">{pending ? labels.finalizing : labels.finalize}</Button></div> : null}
      {step === 11 && report ? <div className="space-y-5"><h2 className="text-xl font-semibold">{labels.reportTitle}</h2><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.employeesImported}</p><p className="mt-1 text-2xl font-semibold">{report.employeesImported}</p></div><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.employmentsCreated}</p><p className="mt-1 text-2xl font-semibold">{report.employmentsCreated}</p></div><div className="rounded-[var(--radius-control)] bg-surface-subtle p-3"><p className="text-xs text-muted-foreground">{labels.incomeRelationshipsImported}</p><p className="mt-1 text-2xl font-semibold">{report.incomeRelationshipsImported}</p></div></div><h3 className="font-semibold">{labels.warningsTitle}</h3>{report.warnings.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noWarnings}</p> : <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{report.warnings.map((warning) => { const match = /^ROW_(\d+)_(.+)$/.exec(warning); const template = labels[`warning_${match?.[2] ?? warning}`] ?? labels.unknownWarning; return <li key={warning}>{template.replace('{row}', match?.[1] ?? '')}</li> })}</ul>}</div> : null}
      {error ? <p className="mt-5 rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
    </Surface>
  </div>
}

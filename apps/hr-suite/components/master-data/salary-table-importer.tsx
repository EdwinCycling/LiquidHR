'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/patterns/form-field'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'
import type { SalaryStructureDraftInput } from '@/lib/salary-structures/schemas'
import { jsonValueEquals } from '@/lib/salary-structures/json-value-equality'
import { parseSalaryTableImport, type SalaryTableImportMetadata } from '@/lib/salary-structures/table-import'

export type SalaryTableImporterLabels = {
  title: string
  description: string
  effectiveFrom: string
  effectiveTo: string
  salaryBasis: string
  monthly: string
  fourWeekly: string
  annual: string
  hourly: string
  sourceTitle: string
  sourceVersion: string
  sourceUrl: string
  sourceFile: string
  sourceFileHelp: string
  sourceFileInvalid: string
  sourceSha256: string
  sourceSha256Help: string
  csvFile: string
  csvFileHelp: string
  csvFileInvalid: string
  csv: string
  csvHelp: string
  preview: string
  previewRequired: string
  rowCount: string
  added: string
  changed: string
  unchanged: string
  removed: string
  scale: string
  step: string
  amount: string
  hourlyAmount: string
  sourceRule: string
  sourceRuleNotice: string
  status: string
  addedStatus: string
  changedStatus: string
  unchangedStatus: string
  removedStatus: string
  sourceConfirmation: string
  sourceReferenceNotice: string
  sourceStatus: string
  referenceOnly: string
  sourceConfirmationPending: string
  correctionNotice: string
  correctionConfirmation: string
  correctedByRevision: string
  correctsRevision: string
  validationErrors: string
  saving: string
  saveDraft: string
  draftSaved: string
  readbackPending: string
  readbackConfirmed: string
  readbackFailed: string
  refreshReadback: string
  openDraft: string
  existingDraft: string
  close: string
  cancel: string
  failed: string
  failureCode: string
  sourceInvalid: string
  effectivePeriodInvalid: string
  csvInvalid: string
  rowLabel: string
  rowInvalid: string
  tableInvalid: string
}

type Revision = SalaryStructureCatalog['revisions'][number]
type Draft = Extract<SalaryStructureDraftInput, { structureType: 'SCALE_WITH_STEPS' }>
type Status = 'added' | 'changed' | 'unchanged' | 'removed'

function money(value: number | string | null | undefined, locale: string, digits: number): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(Number(value))
}

function rowKey(scale: string, step: string): string { return `${scale.toUpperCase()}\u0000${step.toUpperCase()}` }

function withLogicalScaleIds(catalog: SalaryStructureCatalog, revision: Revision | null, draft: Draft): Draft {
  if (!revision) return draft
  const scaleIdsByCode = new Map<string, string>()
  for (const value of catalog.scaleValues.filter((item) => item.salary_structure_revision_id === revision.id)) {
    const scale = catalog.scales.find((item) => item.id === value.salary_scale_id)
    if (scale) scaleIdsByCode.set(value.code.toUpperCase(), scale.id)
  }
  return {
    ...draft,
    scales: draft.scales.map((scale) => {
      const logicalScaleId = scaleIdsByCode.get(scale.code.toUpperCase())
      return logicalScaleId ? { ...scale, logicalScaleId } : scale
    }),
  }
}

function currentRows(catalog: SalaryStructureCatalog, revision: Revision | null): Map<string, { scale: string; step: string; fulltime: string; hourly: string | null }> {
  const rows = new Map<string, { scale: string; step: string; fulltime: string; hourly: string | null }>()
  if (!revision) return rows
  const scaleValues = catalog.scaleValues.filter((item) => item.salary_structure_revision_id === revision.id)
  const scales = new Map(scaleValues.map((item) => [item.salary_scale_id, item.code]))
  for (const item of catalog.steps.filter((step) => step.salary_structure_revision_id === revision.id)) {
    const scaleCode = scales.get(item.salary_scale_id)
    if (!scaleCode) continue
    rows.set(rowKey(scaleCode, item.step_code), {
      scale: scaleCode,
      step: item.step_code,
      fulltime: Number(item.fulltime_amount).toFixed(2),
      hourly: item.hourly_amount === null ? null : Number(item.hourly_amount).toFixed(4),
    })
  }
  return rows
}

function importedRows(draft: Draft): Map<string, { scale: string; step: string; fulltime: string; hourly: string | null }> {
  const rows = new Map<string, { scale: string; step: string; fulltime: string; hourly: string | null }>()
  for (const scale of draft.scales) for (const step of scale.steps) rows.set(rowKey(scale.code, step.stepCode), {
    scale: scale.code,
    step: step.stepCode,
    fulltime: step.fulltimeAmount,
    hourly: step.hourlyAmount ?? null,
  })
  return rows
}

function statusFor(key: string, current: ReturnType<typeof currentRows>, incoming: ReturnType<typeof importedRows>): Exclude<Status, 'removed'> {
  const before = current.get(key)
  const after = incoming.get(key)
  if (!before && after) return 'added'
  if (!before || !after) return 'unchanged'
  return before.fulltime === after.fulltime && before.hourly === after.hourly ? 'unchanged' : 'changed'
}

function readbackMatches(catalog: SalaryStructureCatalog, revisionId: string, draft: Draft): boolean {
  const revision = catalog.revisions.find((item) => item.id === revisionId)
  if (!revision || revision.status !== 'DRAFT' || revision.effective_from !== draft.effectiveFrom
    || revision.salary_basis !== draft.salaryBasis || revision.currency_code !== draft.currencyCode
    || revision.description !== draft.description
    || revision.correction_of_revision_id !== (draft.correctionOfRevisionId ?? null)) return false
  const actualSource = revision.source_metadata && typeof revision.source_metadata === 'object' && !Array.isArray(revision.source_metadata)
    ? revision.source_metadata as Record<string, unknown> : null
  if (!actualSource || !draft.sourceMetadata
    || actualSource.title !== draft.sourceMetadata.title
    || actualSource.version !== draft.sourceMetadata.version
    || actualSource.effectiveFrom !== draft.sourceMetadata.effectiveFrom
    || actualSource.effectiveTo !== draft.sourceMetadata.effectiveTo
    || actualSource.url !== draft.sourceMetadata.url
    || actualSource.sha256 !== draft.sourceMetadata.sha256
    || actualSource.fileName !== draft.sourceMetadata.fileName
    || actualSource.rowCount !== draft.sourceMetadata.rowCount
    || !jsonValueEquals(actualSource.stepRules ?? [], draft.sourceMetadata.stepRules ?? [])
    || !jsonValueEquals(actualSource.stepAdjustments ?? [], draft.sourceMetadata.stepAdjustments ?? [])
    || actualSource.sourceValidationStatus !== 'REFERENCE_ONLY') return false
  const actualScaleValues = catalog.scaleValues.filter((item) => item.salary_structure_revision_id === revisionId)
  if (actualScaleValues.length !== draft.scales.length) return false
  for (const expectedScale of draft.scales) {
    const scaleValue = actualScaleValues.find((item) => item.code.toUpperCase() === expectedScale.code.toUpperCase())
    if (!scaleValue || scaleValue.name !== expectedScale.name || scaleValue.description !== expectedScale.description
      || scaleValue.sort_order !== expectedScale.sortOrder || scaleValue.progression_type !== expectedScale.progressionType
      || scaleValue.default_months_to_next_step !== expectedScale.defaultMonthsToNextStep) return false
    const actualSteps = catalog.steps.filter((step) => step.salary_structure_revision_id === revisionId && step.salary_scale_id === scaleValue.salary_scale_id)
    if (actualSteps.length !== expectedScale.steps.length) return false
    for (const expectedStep of expectedScale.steps) {
      const actualStep = actualSteps.find((step) => step.step_code.toUpperCase() === expectedStep.stepCode.toUpperCase())
      if (!actualStep || actualStep.step_name !== expectedStep.stepName || actualStep.sequence_number !== expectedStep.sequenceNumber
        || Number(actualStep.fulltime_amount).toFixed(2) !== expectedStep.fulltimeAmount
        || (actualStep.hourly_amount === null ? null : Number(actualStep.hourly_amount).toFixed(4)) !== (expectedStep.hourlyAmount ?? null)
        || actualStep.progression_type !== expectedStep.progressionType || actualStep.months_to_next_step !== expectedStep.monthsToNextStep
        || actualStep.step_kind !== expectedStep.stepKind) return false
    }
  }
  return true
}

function validationMessage(error: string, labels: SalaryTableImporterLabels): string {
  const rowMatch = /^CSV_ROW_(\d+)_(.+)$/.exec(error)
  if (rowMatch) return `${labels.rowLabel} ${rowMatch[1]}: ${labels.rowInvalid}`
  if (error === 'EFFECTIVE_PERIOD_INVALID') return labels.effectivePeriodInvalid
  if (error.startsWith('SOURCE_')) return labels.sourceInvalid
  if (error.startsWith('CSV_') || error.startsWith('SCALE_')) return labels.csvInvalid
  return labels.tableInvalid
}

export function SalaryTableImporter({
  catalog, structureId, existingRevision, locale, labels, onCancel, onDraftReady,
}: {
  catalog: SalaryStructureCatalog
  structureId: string
  existingRevision: Revision | null
  locale: string
  labels: SalaryTableImporterLabels
  onCancel: () => void
  onDraftReady: (revisionId: string) => void
}) {
  const router = useRouter()
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [salaryBasis, setSalaryBasis] = useState<SalaryTableImportMetadata['salaryBasis']>('MONTHLY_BASE')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceVersion, setSourceVersion] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceSha256, setSourceSha256] = useState('')
  const [sourceFileName, setSourceFileName] = useState('')
  const [sourceFileError, setSourceFileError] = useState(false)
  const [csvFileName, setCsvFileName] = useState('')
  const [csvFileError, setCsvFileError] = useState(false)
  const [csv, setCsv] = useState('')
  const [sourceConfirmed, setSourceConfirmed] = useState(false)
  const [correctionConfirmed, setCorrectionConfirmed] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [validationVisible, setValidationVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failureCode, setFailureCode] = useState('')
  const [savedDraft, setSavedDraft] = useState<{ id: string; revisionNumber: number } | null>(null)

  const metadata = useMemo<SalaryTableImportMetadata>(() => ({ effectiveFrom, effectiveTo, salaryBasis, sourceTitle, sourceVersion, sourceUrl, sourceSha256, sourceFileName }), [effectiveFrom, effectiveTo, salaryBasis, sourceTitle, sourceVersion, sourceUrl, sourceSha256, sourceFileName])
  const parsed = useMemo(() => parseSalaryTableImport(csv, metadata), [csv, metadata])
  const correctionTargetRevision = catalog.revisions.find((revision) => revision.salary_structure_id === structureId
    && revision.status === 'PUBLISHED' && revision.effective_from === effectiveFrom) ?? null
  const draft = useMemo(() => parsed.draft?.structureType === 'SCALE_WITH_STEPS'
    ? { ...withLogicalScaleIds(catalog, existingRevision, parsed.draft), correctionOfRevisionId: correctionConfirmed ? correctionTargetRevision?.id ?? null : null }
    : null, [catalog, existingRevision, parsed.draft, correctionConfirmed, correctionTargetRevision])
  const existingDraft = catalog.revisions.some((revision) => revision.salary_structure_id === structureId && revision.status === 'DRAFT')
  const current = useMemo(() => currentRows(catalog, existingRevision), [catalog, existingRevision])
  const incoming = useMemo(() => draft ? importedRows(draft) : new Map(), [draft])
  const sourceRulesByRow = new Map(parsed.rows.filter((row) => row.sourceRule).map((row) => [rowKey(row.scaleCode, row.stepCode), row.sourceRule]))
  const previewRows: Array<{ key: string; row: { scale: string; step: string; fulltime: string; hourly: string | null }; status: Status; sourceRule: string | null }> = [
    ...[...incoming.entries()].map(([key, row]) => ({ key, row, status: statusFor(key, current, incoming), sourceRule: sourceRulesByRow.get(key) ? `${sourceRulesByRow.get(key)?.sourceCell} · ${sourceRulesByRow.get(key)?.description}` : null })),
    ...[...current.entries()].filter(([key]) => !incoming.has(key)).map(([key, row]) => ({ key, row, status: 'removed' as const, sourceRule: null })),
  ]
  const counts = {
    added: previewRows.filter((row) => row.status === 'added').length,
    changed: previewRows.filter((row) => row.status === 'changed').length,
    unchanged: previewRows.filter((row) => row.status === 'unchanged').length,
    removed: previewRows.filter((row) => row.status === 'removed').length,
  }
  const importedPreview = previewReady && draft !== null
  const readbackConfirmed = savedDraft !== null && draft !== null && readbackMatches(catalog, savedDraft.id, draft)
  const readbackExists = savedDraft !== null && catalog.revisions.some((revision) => revision.id === savedDraft.id)

  function invalidateReview(): void {
    setPreviewReady(false)
    setSourceConfirmed(false)
    setCorrectionConfirmed(false)
    setValidationVisible(true)
  }

  async function hashSource(file: File): Promise<void> {
    setSourceFileName(file.name)
    setSourceSha256('')
    setSourceFileError(false)
    invalidateReview()
    try {
      if (file.size < 5 || file.size > 25_000_000) throw new Error('SOURCE_FILE_SIZE_INVALID')
      const bytes = await file.arrayBuffer()
      const header = new Uint8Array(bytes.slice(0, 8))
      const isPdf = new TextDecoder().decode(header.slice(0, 5)) === '%PDF-'
      const isXlsx = header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04
      const extension = file.name.toLocaleLowerCase('en-US').split('.').pop()
      if (!(isPdf && extension === 'pdf') && !(isXlsx && extension === 'xlsx')) throw new Error('SOURCE_FILE_FORMAT_INVALID')
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      setSourceSha256([...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''))
    } catch {
      setSourceFileError(true)
    }
    setPreviewReady(false)
  }

  async function loadCsv(file: File): Promise<void> {
    setCsvFileName(file.name)
    setCsvFileError(false)
    invalidateReview()
    try {
      if (file.size === 0 || file.size > 900_000 || !file.name.toLocaleLowerCase('en-US').endsWith('.csv')) {
        throw new Error('CSV_FILE_INVALID')
      }
      setCsv(await file.text())
    } catch {
      setCsv('')
      setCsvFileError(true)
    }
  }

  async function saveDraft(): Promise<void> {
    if (!draft || !previewReady || !sourceConfirmed || (correctionTargetRevision !== null && !correctionConfirmed) || existingDraft || savedDraft) return
    setSaving(true)
    setFailed(false)
    setFailureCode('')
    let failureReference = ''
    try {
      const response = await fetch(`/api/master-data/salary-structures/${structureId}/drafts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftId: null, expectedLockVersion: null, draft }),
      })
      const result = await response.json().catch(() => null) as { code?: unknown; data?: { id?: string; revisionNumber?: number } } | null
      const responseCode = typeof result?.code === 'string' && /^[A-Z0-9_]+$/.test(result.code) ? result.code : ''
      if (!response.ok) {
        failureReference = responseCode || `HTTP_${response.status}`
        throw new Error('salary table draft save failed')
      }
      if (!result?.data?.id || typeof result.data.revisionNumber !== 'number') {
        failureReference = 'DRAFT_READBACK_MISSING'
        throw new Error('salary table draft readback failed')
      }
      setSavedDraft({ id: result.data.id, revisionNumber: result.data.revisionNumber })
      router.refresh()
    } catch {
      setFailureCode(failureReference || 'NETWORK_ERROR')
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const modalFooter = <div className="flex flex-wrap justify-end gap-2">
    {readbackConfirmed
      ? <Button onClick={() => onDraftReady(savedDraft.id)} type="button">{labels.openDraft}</Button>
      : savedDraft
        ? <Button onClick={() => router.refresh()} type="button" variant="secondary">{labels.refreshReadback}</Button>
        : <Button disabled={!importedPreview || !sourceConfirmed || (correctionTargetRevision !== null && !correctionConfirmed) || existingDraft || saving} loading={saving} onClick={() => void saveDraft()} type="button">{saving ? labels.saving : labels.saveDraft}</Button>}
    <Button onClick={onCancel} type="button" variant="secondary">{savedDraft ? labels.close : labels.cancel}</Button>
  </div>
  const validationErrors = [...new Set(parsed.errors.map((error) => validationMessage(error, labels)))]

  return <Dialog closeLabel={labels.close} description={labels.description} footer={modalFooter} onOpenChange={(open) => { if (!open) onCancel() }} open title={labels.title} panelClassName="max-w-6xl">
    <div className="space-y-4">
      {existingDraft && !savedDraft ? <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm" role="status">{labels.existingDraft}</p> : null}
      <p className="rounded-lg border border-subtle bg-surface-subtle p-3 text-sm text-muted-foreground">{labels.sourceReferenceNotice}</p>
      {!savedDraft ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField control={<TextInput onChange={(event) => { setEffectiveFrom(event.target.value); invalidateReview() }} type="date" value={effectiveFrom} />} label={labels.effectiveFrom} required />
          <FormField control={<TextInput onChange={(event) => { setEffectiveTo(event.target.value); invalidateReview() }} type="date" value={effectiveTo} />} label={labels.effectiveTo} required />
          <FormField control={<select aria-label={labels.salaryBasis} className="form-field" onChange={(event) => { setSalaryBasis(event.target.value as typeof salaryBasis); invalidateReview() }} value={salaryBasis}>
            <option value="MONTHLY_BASE">{labels.monthly}</option><option value="FOUR_WEEKLY_BASE">{labels.fourWeekly}</option><option value="ANNUAL_BASE">{labels.annual}</option><option value="HOURLY">{labels.hourly}</option>
          </select>} label={labels.salaryBasis} required />
          <FormField control={<TextInput maxLength={80} onChange={(event) => { setSourceVersion(event.target.value); invalidateReview() }} value={sourceVersion} />} label={labels.sourceVersion} required />
          <FormField control={<TextInput maxLength={180} onChange={(event) => { setSourceTitle(event.target.value); invalidateReview() }} value={sourceTitle} />} label={labels.sourceTitle} required />
          <FormField control={<TextInput maxLength={500} onChange={(event) => { setSourceUrl(event.target.value); invalidateReview() }} value={sourceUrl} />} label={labels.sourceUrl} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">{labels.sourceFile}<input accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx" className="form-field" onChange={(event) => { const file = event.target.files?.[0]; if (file) void hashSource(file) }} type="file" />{sourceFileName ? <span className="break-all text-xs font-normal text-muted-foreground">{sourceFileName} · SHA-256 {sourceSha256 || '—'}</span> : null}{sourceFileError ? <span className="text-xs text-destructive" role="alert">{labels.sourceFileInvalid}</span> : null}<span className="text-xs font-normal text-muted-foreground">{labels.sourceFileHelp}</span></label>
          <FormField control={<TextInput autoCapitalize="off" autoComplete="off" maxLength={64} onChange={(event) => { setSourceSha256(event.target.value.toLocaleLowerCase('en-US')); invalidateReview() }} pattern="[0-9a-f]{64}" readOnly={Boolean(sourceFileName && !sourceFileError)} spellCheck={false} value={sourceSha256} />} description={labels.sourceSha256Help} label={labels.sourceSha256} required />
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-medium">{labels.csvFile}<input accept=".csv,text/csv" className="form-field" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadCsv(file) }} type="file" />{csvFileName ? <span className="break-all text-xs font-normal text-muted-foreground">{csvFileName}</span> : null}{csvFileError ? <span className="text-xs text-destructive" role="alert">{labels.csvFileInvalid}</span> : null}<span className="text-xs font-normal text-muted-foreground">{labels.csvFileHelp}</span></label>
            <FormField control={<Textarea className="min-h-36 font-mono text-xs" onChange={(event) => { setCsv(event.target.value); setCsvFileError(false); invalidateReview() }} value={csv} />} label={labels.csv} required />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{labels.csvHelp}</p>
          <Button disabled={!parsed.draft || existingDraft || sourceFileError || csvFileError} onClick={() => setPreviewReady(true)} type="button" variant="secondary">{labels.preview}</Button>
        </div>
        {validationVisible && validationErrors.length > 0 ? <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" aria-label={labels.validationErrors}>
          <p className="font-semibold text-destructive">{labels.validationErrors}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </section> : null}
      </> : null}
      {importedPreview ? <>
        <div className="grid gap-2 sm:grid-cols-5">
          {[[labels.rowCount, previewRows.length], [labels.added, counts.added], [labels.changed, counts.changed], [labels.unchanged, counts.unchanged], [labels.removed, counts.removed]].map(([label, value]) => <div className="rounded-lg border border-subtle p-3" key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}
        </div>
        <p className="text-xs text-muted-foreground">{labels.previewRequired}</p>
        {parsed.rows.some((row) => row.sourceRule) ? <p className="rounded-lg border border-subtle bg-surface-subtle p-3 text-sm text-muted-foreground">{labels.sourceRuleNotice}</p> : null}
        <div className="max-h-80 overflow-auto rounded-lg border border-subtle">
          <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-surface"><tr><th className="p-2">{labels.scale}</th><th className="p-2">{labels.step}</th><th className="p-2">{labels.amount}</th><th className="p-2">{labels.hourlyAmount}</th><th className="p-2">{labels.sourceRule}</th><th className="p-2">{labels.status}</th></tr></thead><tbody>{previewRows.map(({ key, row, status, sourceRule }) => <tr className="border-t border-subtle" key={key}><td className="p-2">{row.scale}</td><td className="p-2">{row.step}</td><td className="p-2 tabular-nums">{money(row.fulltime, locale, 2)}</td><td className="p-2 tabular-nums">{row.hourly ? money(row.hourly, locale, 4) : '—'}</td><td className="p-2 text-xs text-muted-foreground">{sourceRule ?? '—'}</td><td className="p-2"><Badge tone={status === 'changed' || status === 'added' || status === 'removed' ? 'warning' : 'neutral'}>{status === 'added' ? labels.addedStatus : status === 'changed' ? labels.changedStatus : status === 'removed' ? labels.removedStatus : labels.unchangedStatus}</Badge></td></tr>)}</tbody></table>
        </div>
        {counts.removed > 0 ? <p className="text-sm text-warning">{labels.removed}: {counts.removed}</p> : null}
        {correctionTargetRevision ? <section className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3"><p className="text-sm">{labels.correctionNotice} {correctionTargetRevision.revision_number} · {correctionTargetRevision.effective_from}</p><label className="flex items-start gap-2 text-sm"><input checked={correctionConfirmed} onChange={(event) => setCorrectionConfirmed(event.target.checked)} type="checkbox" /><span>{labels.correctionConfirmation}</span></label></section> : null}
        <label className="flex items-start gap-2 rounded-lg border border-subtle p-3 text-sm"><input checked={sourceConfirmed} onChange={(event) => setSourceConfirmed(event.target.checked)} type="checkbox" /><span>{labels.sourceConfirmation}</span></label>
      </> : null}
      {savedDraft ? <div className="space-y-2 rounded-lg border border-subtle bg-surface-subtle p-4" role="status">
        <p className="font-semibold">{labels.draftSaved} · {savedDraft.revisionNumber}</p>
        {!readbackExists ? <p className="text-sm text-muted-foreground">{labels.readbackPending}</p> : readbackConfirmed ? <p className="text-sm text-success">{labels.readbackConfirmed} · {parsed.rows.length}</p> : <p className="text-sm text-destructive">{labels.readbackFailed}</p>}
      </div> : null}
        {failed ? <p className="text-sm text-destructive" role="alert">{labels.failed} {labels.failureCode}: {failureCode}</p> : null}
    </div>
  </Dialog>
}

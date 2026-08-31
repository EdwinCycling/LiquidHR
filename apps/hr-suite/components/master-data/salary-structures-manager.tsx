'use client'

import type { SalaryStructureCatalog, SalaryStructureMigrationConflictAction } from '@/lib/salary-structures/service'
import type { SalaryStructureDraftInput } from '@/lib/salary-structures/schemas'
import { calculateBandMetrics, deriveAnchorsFromMidpointAndSpread, deriveMidpointFromMinimumAndMaximum } from '@/lib/salary-structures/calculations'
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, CircleAlert, GitCompare, History, Layers3, LockKeyhole, Pencil, Plus, Trash2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'

type Locale = 'nl' | 'en'
type Labels = {
  tabs: { salaryBands: string; scalesAndSteps: string }
  structures: string
  structure: string
  revisions: string
  revision: string
  code: string
  name: string
  description: string
  type: string
  effectiveFrom: string
  publishedAt: string
  currentRevision: string
  futureRevision: string
  draft: string
  published: string
  historical: string
  future: string
  view: string
  history: string
  newStructure: string
  createStructureTitle: string
  createStructureDescription: string
  create: string
  cancel: string
  save: string
  saveAndClose: string
  saving: string
  failed: string
  empty: string
  noRevision: string
  newRevision: string
  continueDraft: string
  readOnly: string
  publishedReadOnly: string
  amountsRestricted: string
  back: string
  structureCreated: string
  revisionSaved: string
  publish: string
  publishReview: string
  reviewDescription: string
  blockers: string
  warnings: string
  noBlockers: string
  noWarnings: string
  publishBlocked: string
  publishedMessage: string
  salaryBasis: string
  currency: string
  monthlyBase: string
  fourWeeklyBase: string
  annualBase: string
  hourlyBase: string
  salaryBands: string
  scales: string
  band: string
  bands: string
  scale: string
  step: string
  steps: string
  addBand: string
  removeBand: string
  addScale: string
  removeScale: string
  addStep: string
  removeStep: string
  moveUp: string
  moveDown: string
  order: string
  stepLabel: string
  stepName: string
  amount: string
  timeToNextStep: string
  defaultTimeToNextStep: string
  progressionType: string
  manual: string
  timeInStep: string
  fixedDate: string
  orderHint: string
  twoStepHint: string
  noAutomaticProgression: string
  minimum: string
  hundredPercent: string
  midpoint: string
  maximum: string
  noMaximum: string
  spread: string
  midpointProgression: string
  overlap: string
  gap: string
  inputMethod: string
  midpointSpread: string
  minMax: string
  manualAnchors: string
  recommended: string
  openHighestBand: string
  bandDescription: string
  metricWarning: string
  gapWarning: string
  noCaoLinks: string
  caoLinks: string
  conflictLink: string
  conflictCount: string
  migrationTitle: string
  migrationDescription: string
  sourceAdministrations: string
  legacyScaleCode: string
  reason: string
  resolution: string
  open: string
  resolved: string
  ignored: string
  keepSeparate: string
  renameOrRecode: string
  treatAsSame: string
  later: string
  decisionNote: string
  confirmDecision: string
  decisionSaved: string
  dirtyConfirm: string
  noActiveRevision: string
  details: string
  amountLabel: string
  noData: string
}

type Structure = SalaryStructureCatalog['structures'][number]
type Revision = SalaryStructureCatalog['revisions'][number]
type Conflict = SalaryStructureCatalog['migrationConflicts'][number]
type Draft = SalaryStructureDraftInput
type ScaleDraft = Extract<Draft, { structureType: 'SCALE_WITH_STEPS' }>
type BandDraft = Extract<Draft, { structureType: 'SALARY_BAND' }>
type DraftScale = ScaleDraft['scales'][number]
type DraftStep = DraftScale['steps'][number]
type DraftBand = BandDraft['bands'][number]

const fieldClass = 'form-field'
const panelClass = 'rounded-[var(--radius-surface)] border border-subtle bg-surface p-5'
const subtlePanelClass = 'rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-4'

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
}

function formatMoney(value: number | string | null, locale: Locale): string {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(Number(value))
}

function moneyString(value: number | string | null): string {
  if (value === null || value === undefined || value === '') return '0.00'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

function hourlyString(value: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(4) : null
}

function percentageString(value: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : null
}

function displayPercentage(value: string | null): string {
  return value === null ? '—' : `${value}%`
}

function normalizeDecimal(value: string): string {
  return value.replace(',', '.').replace(/[^0-9.]/g, '')
}

function queryUrl(pathname: string, values: Record<string, string | null>): string {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value) })
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function statusForRevision(revision: Revision, revisions: Revision[], labels: Labels): { text: string; tone: BadgeTone } {
  if (revision.status === 'DRAFT') return { text: labels.draft, tone: 'info' }
  const today = new Date().toISOString().slice(0, 10)
  if (revision.effective_from > today) return { text: labels.future, tone: 'info' }
  const latest = revisions.filter((item) => item.status === 'PUBLISHED' && item.effective_from <= today).sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0]
  return revision.id === latest?.id ? { text: labels.published, tone: 'success' } : { text: labels.historical, tone: 'neutral' }
}

function latestPublishedRevision(revisions: Revision[], structureId: string): Revision | null {
  const today = new Date().toISOString().slice(0, 10)
  return revisions.filter((revision) => revision.salary_structure_id === structureId && revision.status === 'PUBLISHED' && revision.effective_from <= today).sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0] ?? null
}

function preferredRevision(revisions: Revision[], structureId: string): Revision | null {
  return revisions.filter((revision) => revision.salary_structure_id === structureId).sort((left, right) => {
    if (left.status === 'DRAFT' && right.status !== 'DRAFT') return -1
    if (right.status === 'DRAFT' && left.status !== 'DRAFT') return 1
    return right.effective_from.localeCompare(left.effective_from)
  })[0] ?? null
}

function anchorsForBand(band: DraftBand): { minimum: string; midpoint: string; maximum: string | null } {
  try {
    if (band.inputMethod === 'MIDPOINT_SPREAD' && band.inputSpreadPercentage) {
      const derived = deriveAnchorsFromMidpointAndSpread(band.midpoint, band.inputSpreadPercentage)
      return { ...derived, maximum: band.maximum === null ? null : derived.maximum }
    }
    if (band.inputMethod === 'MIN_MAX' && band.maximum !== null) {
      return { minimum: band.minimum, midpoint: deriveMidpointFromMinimumAndMaximum(band.minimum, band.maximum), maximum: band.maximum }
    }
  } catch {
    return { minimum: band.minimum, midpoint: band.midpoint, maximum: band.maximum }
  }
  return { minimum: band.minimum, midpoint: band.midpoint, maximum: band.maximum }
}

function bandMetrics(band: DraftBand, previous?: DraftBand) {
  try {
    return calculateBandMetrics(anchorsForBand(band), previous ? anchorsForBand(previous) : undefined)
  } catch {
    return { rangeSpreadPercentage: null, midpointProgressionPercentage: null, overlapPercentage: null, hasGap: null }
  }
}

function draftFromRevision(catalog: SalaryStructureCatalog, structure: Structure, revision: Revision): Draft {
  if (structure.structure_type === 'SCALE_WITH_STEPS') {
    const values = catalog.scaleValues.filter((value) => value.salary_structure_revision_id === revision.id).sort((left, right) => left.sort_order - right.sort_order)
    return {
      structureType: 'SCALE_WITH_STEPS',
      effectiveFrom: revision.effective_from,
      salaryBasis: revision.salary_basis,
      currencyCode: revision.currency_code,
      description: revision.description,
      scales: values.map((value) => ({
        logicalScaleId: value.salary_scale_id,
        code: value.code,
        name: value.name,
        description: value.description,
        sortOrder: value.sort_order,
        progressionType: value.progression_type,
        defaultMonthsToNextStep: value.default_months_to_next_step,
        steps: catalog.steps.filter((step) => step.salary_structure_revision_id === revision.id && step.salary_scale_id === value.salary_scale_id).sort((left, right) => left.sequence_number - right.sequence_number).map((step) => ({
          stepCode: step.step_code,
          stepName: step.step_name,
          sequenceNumber: step.sequence_number,
          fulltimeAmount: moneyString(step.fulltime_amount),
          hourlyAmount: hourlyString(step.hourly_amount),
          progressionType: step.progression_type,
          monthsToNextStep: step.months_to_next_step,
          stepKind: step.step_kind,
        })),
      })),
    }
  }
  const values = catalog.bandValues.filter((value) => value.salary_structure_revision_id === revision.id).sort((left, right) => left.sort_order - right.sort_order)
  return {
    structureType: 'SALARY_BAND',
    effectiveFrom: revision.effective_from,
    salaryBasis: revision.salary_basis,
    currencyCode: revision.currency_code,
    description: revision.description,
    bands: values.map((value) => ({
      logicalBandId: value.salary_band_id,
      identityKey: catalog.bands.find((band) => band.id === value.salary_band_id)?.identity_key ?? value.code,
      code: value.code,
      name: value.name,
      sortOrder: value.sort_order,
      inputMethod: value.input_method,
      minimum: moneyString(value.minimum_amount),
      midpoint: moneyString(value.midpoint_amount),
      maximum: value.maximum_amount === null ? null : moneyString(value.maximum_amount),
      inputSpreadPercentage: percentageString(value.input_spread_percentage),
    })),
  }
}

function emptyDraft(structure: Structure): Draft {
  if (structure.structure_type === 'SCALE_WITH_STEPS') return {
    structureType: 'SCALE_WITH_STEPS', effectiveFrom: new Date().toISOString().slice(0, 10), salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR', description: null,
    scales: [{ code: structure.code ?? 'S1', name: structure.name, description: structure.description, sortOrder: 1, progressionType: 'MANUAL', defaultMonthsToNextStep: null, steps: [{ stepCode: '1', stepName: '1', sequenceNumber: 1, fulltimeAmount: '0.00', hourlyAmount: null, progressionType: 'MANUAL', monthsToNextStep: null, stepKind: 'MAXIMUM' }] }],
  }
  return {
    structureType: 'SALARY_BAND', effectiveFrom: new Date().toISOString().slice(0, 10), salaryBasis: 'MONTHLY_BASE', currencyCode: 'EUR', description: null,
    bands: [{ identityKey: 'B1', code: 'B1', name: structure.name, sortOrder: 1, inputMethod: 'MANUAL_ANCHORS', minimum: '0.00', midpoint: '0.00', maximum: '0.00', inputSpreadPercentage: null }],
  }
}

function updateBandDraft(band: DraftBand, patch: Partial<DraftBand>): DraftBand {
  const next = { ...band, ...patch }
  if (next.inputMethod === 'MIDPOINT_SPREAD') {
    const withSpread = next.inputSpreadPercentage ? next : { ...next, inputSpreadPercentage: '40.00' }
    const derived = anchorsForBand(withSpread)
    return { ...withSpread, ...derived }
  }
  if (next.inputMethod === 'MIN_MAX' && next.maximum === null) return { ...next, maximum: '0.00' }
  if (next.inputMethod === 'MIN_MAX' && next.maximum !== null) return { ...next, midpoint: anchorsForBand(next).midpoint }
  return next
}

function validateDraft(draft: Draft, labels: Labels): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = []
  const warnings: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom)) blockers.push(labels.effectiveFrom)
  if (draft.structureType === 'SALARY_BAND') {
    const codes = new Set<string>()
    const identities = new Set<string>()
    const orders = new Set<number>()
    draft.bands.forEach((band, index) => {
      const anchors = anchorsForBand(band)
      if (codes.has(band.code.trim().toUpperCase())) blockers.push(`${labels.code}: ${band.code}`)
      if (identities.has(band.identityKey.trim().toUpperCase())) blockers.push(`${labels.band}: ${band.identityKey}`)
      if (orders.has(band.sortOrder)) blockers.push(`${labels.order}: ${band.sortOrder}`)
      codes.add(band.code.trim().toUpperCase()); identities.add(band.identityKey.trim().toUpperCase()); orders.add(band.sortOrder)
      if (!band.code.trim() || !band.name.trim()) blockers.push(labels.name)
      if (!/^\d+\.\d{2}$/.test(anchors.minimum) || !/^\d+\.\d{2}$/.test(anchors.midpoint) || (anchors.maximum !== null && !/^\d+\.\d{2}$/.test(anchors.maximum))) blockers.push(`${labels.band} ${index + 1}`)
      try {
        const metrics = bandMetrics(band, index > 0 ? draft.bands[index - 1] : undefined)
        if (metrics.hasGap) warnings.push(labels.gapWarning)
        if (metrics.rangeSpreadPercentage !== null && (Number(metrics.rangeSpreadPercentage) < 15 || Number(metrics.rangeSpreadPercentage) > 60)) warnings.push(labels.metricWarning)
        if (metrics.midpointProgressionPercentage !== null && (Number(metrics.midpointProgressionPercentage) < 5 || Number(metrics.midpointProgressionPercentage) > 35)) warnings.push(labels.metricWarning)
        if (metrics.overlapPercentage !== null && (Number(metrics.overlapPercentage) < 10 || Number(metrics.overlapPercentage) > 80)) warnings.push(labels.metricWarning)
      } catch { blockers.push(`${labels.band} ${index + 1}`) }
      if (band.maximum === null && band.sortOrder !== Math.max(...draft.bands.map((item) => item.sortOrder))) blockers.push(labels.openHighestBand)
    })
  } else {
    const scaleCodes = new Set<string>()
    const scaleOrders = new Set<number>()
    draft.scales.forEach((scale) => {
      if (scaleCodes.has(scale.code.trim().toUpperCase())) blockers.push(`${labels.code}: ${scale.code}`)
      if (scaleOrders.has(scale.sortOrder)) blockers.push(`${labels.order}: ${scale.sortOrder}`)
      scaleCodes.add(scale.code.trim().toUpperCase()); scaleOrders.add(scale.sortOrder)
      const stepCodes = new Set<string>(); const stepOrders = new Set<number>()
      scale.steps.forEach((step) => {
        if (!step.stepCode.trim() || !step.stepName.trim() || !/^\d+\.\d{2}$/.test(step.fulltimeAmount) || Number(step.fulltimeAmount) <= 0) blockers.push(`${labels.step}: ${step.stepCode}`)
        if (stepCodes.has(step.stepCode.trim().toUpperCase())) blockers.push(`${labels.stepLabel}: ${step.stepCode}`)
        if (stepOrders.has(step.sequenceNumber)) blockers.push(`${labels.order}: ${step.sequenceNumber}`)
        stepCodes.add(step.stepCode.trim().toUpperCase()); stepOrders.add(step.sequenceNumber)
      })
      const last = [...scale.steps].sort((left, right) => right.sequenceNumber - left.sequenceNumber)[0]
      if (last && (last.monthsToNextStep !== null || last.progressionType !== 'MANUAL')) blockers.push(labels.timeToNextStep)
    })
  }
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] }
}

function navigateTo(router: ReturnType<typeof useRouter>, pathname: string, values: Record<string, string | null>): void {
  router.push(queryUrl(pathname, values))
}

function StructureCatalog({ catalog, labels, locale, type, pathname, onCreate }: { catalog: SalaryStructureCatalog; labels: Labels; locale: Locale; type: 'SALARY_BAND' | 'SCALE_WITH_STEPS'; pathname: string; onCreate: () => void }) {
  const router = useRouter()
  const structures = catalog.structures.filter((structure) => structure.structure_type === type)
  const openConflicts = catalog.migrationConflicts.filter((conflict) => conflict.status === 'OPEN')
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-semibold">{labels.structures}</p><p className="mt-1 text-sm text-muted-foreground">{type === 'SALARY_BAND' ? labels.tabs.salaryBands : labels.tabs.scalesAndSteps}</p></div>
       {catalog.canWriteStructures ? <Button onClick={onCreate} type="button"><Plus size={17} />{labels.newStructure}</Button> : null}
    </div>
    {catalog.canReadAmounts ? null : <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 shrink-0 text-primary" size={17} />{labels.amountsRestricted}</div>}
    {structures.length === 0 ? <div className={`${panelClass} text-sm text-muted-foreground`}>{labels.empty}</div> : <div className="grid gap-3">
      {structures.map((structure) => {
        const revisions = catalog.revisions.filter((revision) => revision.salary_structure_id === structure.id)
        const current = latestPublishedRevision(catalog.revisions, structure.id)
        const draft = revisions.find((revision) => revision.status === 'DRAFT')
        const relations = catalog.laborConditionRelations.filter((relation) => relation.salary_structure_id === structure.id)
        const status: { text: string; tone: BadgeTone } = current ? statusForRevision(current, revisions, labels) : draft ? { text: labels.draft, tone: 'info' } : { text: labels.noRevision, tone: 'neutral' }
        return <button className="grid gap-4 rounded-[var(--radius-surface)] border border-subtle bg-surface p-5 text-left transition-colors hover:border-primary/40 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center" key={structure.id} onClick={() => navigateTo(router, pathname, { view: 'detail', type, structureId: structure.id, revisionId: (draft ?? current)?.id ?? null })} type="button">
          <span><span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{structure.name}</span><Badge>{structure.code ?? '—'}</Badge></span><span className="mt-1 block text-sm text-muted-foreground">{structure.description ?? labels.tabs[type === 'SALARY_BAND' ? 'salaryBands' : 'scalesAndSteps']}</span></span>
          <span className="text-sm"><span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.currentRevision}</span><span className="mt-1 block"><Badge tone={status.tone}>{status.text}</Badge> {current ? formatDate(current.effective_from, locale) : '—'}</span></span>
          <span className="text-sm"><span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.revisions}</span><span className="mt-1 block">{revisions.length} · {relations.length === 0 ? labels.noCaoLinks : `${relations.length} ${labels.caoLinks}`}</span></span>
          <ChevronDown className="-rotate-90 text-primary lg:justify-self-end" size={18} />
        </button>
      })}
    </div>}
    {openConflicts.length > 0 ? <button className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline" onClick={() => navigateTo(router, pathname, { view: 'conflicts', type, structureId: null, revisionId: null })} type="button"><GitCompare size={16} />{openConflicts.length} {labels.conflictCount}</button> : null}
  </div>
}

function CreateStructureDialog({ labels, defaultType, onCancel, onCreated }: { labels: Labels; defaultType: 'SALARY_BAND' | 'SCALE_WITH_STEPS'; onCancel: () => void; onCreated: (id: string) => void }) {
  const [structureType, setStructureType] = useState(defaultType)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true); setFailed(false)
    const response = await fetch('/api/master-data/salary-structures', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ structureType, name: name.trim(), code: code.trim() ? code.trim().toUpperCase() : null, description: description.trim() || null }) })
    setSaving(false)
    if (!response.ok) { setFailed(true); return }
    const payload = await response.json() as { data?: { id?: string } }
    if (!payload.data?.id) { setFailed(true); return }
    onCreated(payload.data.id)
  }
  const dirty = Boolean(name || code || description)
  return <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} description={labels.createStructureDescription} dirty={dirty} dirtyProtection={{ description: labels.dirtyConfirm, discardLabel: labels.cancel, keepEditingLabel: labels.cancel, title: labels.cancel }} onDiscard={onCancel} onOpenChange={(open) => { if (!open && !dirty) onCancel() }} onSubmit={(event) => void submit(event)} open saveLabel={labels.create} saving={saving} title={labels.createStructureTitle}><FormField control={<DropdownSelect aria-label={labels.type} onChange={(event) => setStructureType(event.target.value as typeof structureType)} value={structureType}><option value="SALARY_BAND">{labels.tabs.salaryBands}</option><option value="SCALE_WITH_STEPS">{labels.tabs.scalesAndSteps}</option></DropdownSelect>} label={labels.type} required /><FormField control={<TextInput autoFocus maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} />} label={labels.name} required /><FormField control={<TextInput maxLength={80} onChange={(event) => setCode(event.target.value)} value={code} />} label={labels.code} /><FormField control={<Textarea maxLength={1000} onChange={(event) => setDescription(event.target.value)} value={description} />} label={labels.description} />{failed ? <p className="text-sm text-destructive" role="alert">{labels.failed}</p> : null}</FormDrawer>
}

function BandTable({ catalog, revision, labels, locale, editable = false }: { catalog: SalaryStructureCatalog; revision: Revision; labels: Labels; locale: Locale; editable?: boolean }) {
  const values = catalog.bandValues.filter((value) => value.salary_structure_revision_id === revision.id).sort((left, right) => left.sort_order - right.sort_order)
  return <div className="overflow-x-auto rounded-xl border">
    <table className="min-w-[760px] w-full text-left text-sm">
      <thead className="bg-muted/60 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-3">{labels.order}</th><th className="px-3 py-3">{labels.band}</th><th className="px-3 py-3 text-right">{labels.minimum}</th><th className="px-3 py-3 text-right">{labels.hundredPercent}</th><th className="px-3 py-3 text-right">{labels.maximum}</th><th className="px-3 py-3 text-right">{labels.spread}</th><th className="px-3 py-3 text-right">{labels.midpointProgression}</th><th className="px-3 py-3 text-right">{labels.overlap}</th>{editable ? <th className="px-3 py-3" /> : null}</tr></thead>
      <tbody className="divide-y">
        {values.map((value, index) => {
          const previous = index > 0 ? values[index - 1] : null
          const metrics = calculateBandMetrics({ minimum: moneyString(value.minimum_amount), midpoint: moneyString(value.midpoint_amount), maximum: value.maximum_amount === null ? null : moneyString(value.maximum_amount) }, previous ? { minimum: moneyString(previous.minimum_amount), midpoint: moneyString(previous.midpoint_amount), maximum: previous.maximum_amount === null ? null : moneyString(previous.maximum_amount) } : undefined)
          return <tr key={value.id}><td className="px-3 py-3 tabular-nums text-muted-foreground">{value.sort_order}</td><td className="px-3 py-3"><span className="font-semibold">{value.code}</span><span className="block text-xs text-muted-foreground">{value.name}</span></td><td className="px-3 py-3 text-right tabular-nums">{formatMoney(value.minimum_amount, locale)}</td><td className="px-3 py-3 text-right tabular-nums font-semibold">{formatMoney(value.midpoint_amount, locale)}</td><td className="px-3 py-3 text-right tabular-nums">{value.maximum_amount === null ? labels.noMaximum : formatMoney(value.maximum_amount, locale)}</td><td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{displayPercentage(metrics.rangeSpreadPercentage)}</td><td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{displayPercentage(metrics.midpointProgressionPercentage)}</td><td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{displayPercentage(metrics.overlapPercentage)}</td>{editable ? <td className="px-3 py-3"><Pencil aria-hidden="true" size={15} /></td> : null}</tr>
        })}
      </tbody>
    </table>
  </div>
}

function ScaleTable({ catalog, revision, labels, locale, scaleId }: { catalog: SalaryStructureCatalog; revision: Revision; labels: Labels; locale: Locale; scaleId?: string }) {
  const values = catalog.scaleValues.filter((value) => value.salary_structure_revision_id === revision.id && (!scaleId || value.salary_scale_id === scaleId)).sort((left, right) => left.sort_order - right.sort_order)
  return <div className="space-y-3">
    {values.map((value, index) => {
      const steps = catalog.steps.filter((step) => step.salary_structure_revision_id === revision.id && step.salary_scale_id === value.salary_scale_id).sort((left, right) => left.sequence_number - right.sequence_number)
      return <details className="group rounded-xl border bg-background/60" open={index < 2} key={value.id}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">{value.code}</span><span className="min-w-0"><span className="block truncate font-semibold">{value.name}</span><span className="block text-xs text-muted-foreground">{steps.length} {labels.steps} · {value.default_months_to_next_step ?? '—'} {labels.timeToNextStep}</span></span></span><ChevronDown className="shrink-0 transition group-open:rotate-180" size={18} /></summary><div className="border-t p-3 sm:p-4"><div className="overflow-x-auto rounded-xl border"><table className="min-w-[560px] w-full text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-3">{labels.order}</th><th className="px-3 py-3">{labels.step}</th><th className="px-3 py-3 text-right">{labels.amount}</th><th className="px-3 py-3 text-right">{labels.timeToNextStep}</th></tr></thead><tbody className="divide-y">{steps.map((step) => <tr key={step.id}><td className="px-3 py-3 tabular-nums text-muted-foreground">{step.sequence_number}</td><td className="px-3 py-3"><span className="font-semibold">{step.step_code}</span><span className="block text-xs text-muted-foreground">{step.step_name}</span></td><td className="px-3 py-3 text-right tabular-nums font-semibold">{catalog.canReadAmounts ? formatMoney(step.fulltime_amount, locale) : '—'}</td><td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{step.months_to_next_step ?? '—'}</td></tr>)}</tbody></table></div></div></details>
    })}
  </div>
}

function ReadOnlyRevision({ catalog, structure, revision, labels, locale }: { catalog: SalaryStructureCatalog; structure: Structure; revision: Revision; labels: Labels; locale: Locale }) {
  const status = statusForRevision(revision, catalog.revisions.filter((item) => item.salary_structure_id === structure.id), labels)
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.revision} {revision.revision_number}</p><p className="mt-1 font-semibold">{labels.effectiveFrom}: {formatDate(revision.effective_from, locale)}</p></div><Badge tone={status.tone}>{status.text}</Badge></div>
    {!catalog.canReadAmounts ? <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 shrink-0 text-primary" size={17} />{labels.amountsRestricted}</div> : structure.structure_type === 'SALARY_BAND' ? <BandTable catalog={catalog} revision={revision} labels={labels} locale={locale} /> : <ScaleTable catalog={catalog} revision={revision} labels={labels} locale={locale} />}
  </div>
}

function RevisionReview({ draft, labels, locale, onCancel, onPublish, publishing }: { draft: Draft; labels: Labels; locale: Locale; onCancel: () => void; onPublish: () => void; publishing: boolean }) {
  const validation = validateDraft(draft, labels)
  return <Dialog closeLabel={labels.cancel} description={`${labels.reviewDescription} ${labels.effectiveFrom}: ${draft.effectiveFrom} · ${draft.currencyCode}`} onOpenChange={(open) => { if (!open) onCancel() }} open title={labels.publishReview} panelClassName="max-w-6xl" footer={<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{validation.blockers.length > 0 ? labels.publishBlocked : labels.publishedReadOnly}</p><div className="flex gap-3"><Button onClick={onCancel} size="sm" type="button" variant="secondary">{labels.cancel}</Button><Button disabled={validation.blockers.length > 0 || publishing} loading={publishing} onClick={onPublish} size="sm" type="button">{labels.publish}</Button></div></div>}>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"><h3 className="flex items-center gap-2 font-semibold"><CircleAlert size={17} />{labels.blockers}</h3>{validation.blockers.length === 0 ? <p className="mt-2 text-sm text-success">{labels.noBlockers}</p> : <ul className="mt-2 space-y-1 text-sm text-destructive">{validation.blockers.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul>}</section><section className="rounded-xl border border-warning/30 bg-warning/5 p-4"><h3 className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} />{labels.warnings}</h3>{validation.warnings.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{labels.noWarnings}</p> : <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{validation.warnings.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}</ul>}</section></div>
    <div className="mt-5">{draft.structureType === 'SALARY_BAND' ? <div className="space-y-3">{draft.bands.map((band, index) => { const anchors = anchorsForBand(band); const metrics = bandMetrics(band, index > 0 ? draft.bands[index - 1] : undefined); return <article className={subtlePanelClass} key={`${band.identityKey}-${index}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{band.code} · {band.name}</p><p className="text-xs text-muted-foreground">{band.inputMethod === 'MIDPOINT_SPREAD' ? labels.midpointSpread : band.inputMethod === 'MIN_MAX' ? labels.minMax : labels.manualAnchors}</p></div><Badge>{band.sortOrder}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label={labels.minimum} value={formatMoney(anchors.minimum, locale)} /><Metric label={labels.hundredPercent} value={formatMoney(anchors.midpoint, locale)} /><Metric label={labels.maximum} value={anchors.maximum === null ? labels.noMaximum : formatMoney(anchors.maximum, locale)} /></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span>{labels.spread}: {displayPercentage(metrics.rangeSpreadPercentage)}</span><span>{labels.midpointProgression}: {displayPercentage(metrics.midpointProgressionPercentage)}</span><span>{labels.overlap}: {displayPercentage(metrics.overlapPercentage)}</span>{metrics.hasGap ? <span>{labels.gap}</span> : null}</div></article> })}</div> : <div className="space-y-3">{draft.scales.map((scale) => <article className={subtlePanelClass} key={`${scale.code}-${scale.sortOrder}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{scale.code} · {scale.name}</p><p className="text-xs text-muted-foreground">{scale.steps.length} {labels.steps} · {scale.defaultMonthsToNextStep ?? '—'} {labels.timeToNextStep}</p></div><Badge>{scale.sortOrder}</Badge></div><div className="mt-3 overflow-x-auto rounded-xl border"><table className="min-w-[500px] w-full text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-3 py-2">{labels.order}</th><th className="px-3 py-2">{labels.step}</th><th className="px-3 py-2 text-right">{labels.amount}</th><th className="px-3 py-2 text-right">{labels.timeToNextStep}</th></tr></thead><tbody className="divide-y">{[...scale.steps].sort((left, right) => left.sequenceNumber - right.sequenceNumber).map((step) => <tr key={`${step.stepCode}-${step.sequenceNumber}`}><td className="px-3 py-2">{step.sequenceNumber}</td><td className="px-3 py-2"><span className="font-semibold">{step.stepCode}</span><span className="block text-xs text-muted-foreground">{step.stepName}</span></td><td className="px-3 py-2 text-right font-semibold">{formatMoney(step.fulltimeAmount, locale)}</td><td className="px-3 py-2 text-right text-muted-foreground">{step.monthsToNextStep ?? '—'}</td></tr>)}</tbody></table></div></article>)}</div>}</div>
   </Dialog>
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div> }

function BandEditor({ band, index, total, labels, locale, onChange, onRemove, onMove }: { band: DraftBand; index: number; total: number; labels: Labels; locale: Locale; onChange: (patch: Partial<DraftBand>) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void }) {
  const anchors = anchorsForBand(band)
  const metrics = bandMetrics(band)
  const isHighest = index === total - 1
  return <article className={`${subtlePanelClass} space-y-4`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">{band.sortOrder}</span><h3 className="font-semibold">{band.name || `${labels.band} ${index + 1}`}</h3></div><p className="mt-1 text-xs text-muted-foreground">{labels.bandDescription}</p></div><div className="flex items-center gap-1"><button aria-label={labels.moveUp} className="rounded-lg border p-2 disabled:opacity-40" disabled={index === 0} onClick={() => onMove(-1)} type="button"><ArrowUp size={15} /></button><button aria-label={labels.moveDown} className="rounded-lg border p-2 disabled:opacity-40" disabled={index === total - 1} onClick={() => onMove(1)} type="button"><ArrowDown size={15} /></button><button aria-label={labels.removeBand} className="rounded-lg border border-destructive/20 p-2 text-destructive disabled:opacity-40" disabled={total <= 1} onClick={onRemove} type="button"><Trash2 size={15} /></button></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{labels.code}<input className={fieldClass} value={band.code} onChange={(event) => onChange({ code: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">{labels.name}<input className={fieldClass} value={band.name} onChange={(event) => onChange({ name: event.target.value })} /></label></div>
    <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3"><label className="grid gap-1 text-sm font-medium">{labels.inputMethod}<select className={fieldClass} value={band.inputMethod} onChange={(event) => onChange({ inputMethod: event.target.value as DraftBand['inputMethod'] })}><option value="MIDPOINT_SPREAD">{labels.midpointSpread} · {labels.recommended}</option><option value="MIN_MAX">{labels.minMax}</option><option value="MANUAL_ANCHORS">{labels.manualAnchors}</option></select></label><div className="mt-3 grid gap-3 sm:grid-cols-3">
      {band.inputMethod === 'MIDPOINT_SPREAD' ? <><label className="grid gap-1 text-sm font-medium">{labels.hundredPercent}<input className={fieldClass} inputMode="decimal" value={band.midpoint} onChange={(event) => onChange({ midpoint: normalizeDecimal(event.target.value) })} /></label><label className="grid gap-1 text-sm font-medium">{labels.spread}<input className={fieldClass} inputMode="decimal" value={band.inputSpreadPercentage ?? ''} onChange={(event) => onChange({ inputSpreadPercentage: normalizeDecimal(event.target.value) })} /></label><Metric label={labels.minimum} value={formatMoney(anchors.minimum, locale)} /></> : band.inputMethod === 'MIN_MAX' ? <><label className="grid gap-1 text-sm font-medium">{labels.minimum}<input className={fieldClass} inputMode="decimal" value={band.minimum} onChange={(event) => onChange({ minimum: normalizeDecimal(event.target.value) })} /></label><label className="grid gap-1 text-sm font-medium">{labels.maximum}<input className={fieldClass} inputMode="decimal" value={band.maximum ?? ''} onChange={(event) => onChange({ maximum: normalizeDecimal(event.target.value) })} /></label><Metric label={labels.hundredPercent} value={formatMoney(anchors.midpoint, locale)} /></> : <><label className="grid gap-1 text-sm font-medium">{labels.minimum}<input className={fieldClass} inputMode="decimal" value={band.minimum} onChange={(event) => onChange({ minimum: normalizeDecimal(event.target.value) })} /></label><label className="grid gap-1 text-sm font-medium">{labels.hundredPercent}<input className={fieldClass} inputMode="decimal" value={band.midpoint} onChange={(event) => onChange({ midpoint: normalizeDecimal(event.target.value) })} /></label><label className="grid gap-1 text-sm font-medium">{labels.maximum}<input className={fieldClass} inputMode="decimal" value={band.maximum ?? ''} onChange={(event) => onChange({ maximum: normalizeDecimal(event.target.value) })} /></label></>}
    </div><div className="mt-3 grid gap-3 sm:grid-cols-3"><Metric label={labels.minimum} value={formatMoney(anchors.minimum, locale)} /><Metric label={labels.hundredPercent} value={formatMoney(anchors.midpoint, locale)} /><Metric label={labels.maximum} value={anchors.maximum === null ? labels.noMaximum : formatMoney(anchors.maximum, locale)} /></div>
    {isHighest ? <label className="mt-3 flex items-center gap-2 text-sm font-medium"><input checked={band.maximum === null} className="size-4 accent-primary" disabled={band.inputMethod === 'MIN_MAX'} onChange={(event) => onChange({ maximum: event.target.checked ? null : anchors.maximum ?? '0.00' })} type="checkbox" />{labels.openHighestBand}</label> : null}
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span>{labels.spread}: {displayPercentage(metrics.rangeSpreadPercentage)}</span><span>{labels.midpointProgression}: {displayPercentage(metrics.midpointProgressionPercentage)}</span><span>{labels.overlap}: {displayPercentage(metrics.overlapPercentage)}</span>{metrics.hasGap ? <span className="text-warning">{labels.gap}</span> : null}</div></div>
  </article>
}

function BandRevisionEditor({ draft, setDraft, labels, locale }: { draft: BandDraft; setDraft: Dispatch<SetStateAction<Draft>>; labels: Labels; locale: Locale }) {
  function updateBand(index: number, patch: Partial<DraftBand>): void {
    setDraft((current) => current.structureType !== 'SALARY_BAND' ? current : { ...current, bands: current.bands.map((band, bandIndex) => bandIndex === index ? updateBandDraft(band, patch) : band).map((band, bandIndex) => ({ ...band, sortOrder: bandIndex + 1 })) })
  }
  function moveBand(index: number, direction: -1 | 1): void {
    setDraft((current) => {
      if (current.structureType !== 'SALARY_BAND') return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.bands.length) return current
      const bands = [...current.bands]; const [item] = bands.splice(index, 1); bands.splice(nextIndex, 0, item)
      return { ...current, bands: bands.map((band, bandIndex) => ({ ...band, sortOrder: bandIndex + 1 })) }
    })
  }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{labels.salaryBands}</p><p className="mt-1 text-sm text-muted-foreground">{labels.bandDescription}</p></div><button className="button-secondary inline-flex items-center gap-2" onClick={() => setDraft((current) => current.structureType !== 'SALARY_BAND' ? current : { ...current, bands: [...current.bands, { identityKey: `B${current.bands.length + 1}`, code: `B${current.bands.length + 1}`, name: `${labels.band} ${current.bands.length + 1}`, sortOrder: current.bands.length + 1, inputMethod: 'MANUAL_ANCHORS', minimum: '0.00', midpoint: '0.00', maximum: '0.00', inputSpreadPercentage: null }] })} type="button"><Plus size={16} />{labels.addBand}</button></div>{draft.bands.map((band, index) => <BandEditor band={band} index={index} key={`${band.identityKey}-${index}`} labels={labels} locale={locale} onChange={(patch) => updateBand(index, patch)} onMove={(direction) => moveBand(index, direction)} onRemove={() => setDraft((current) => current.structureType !== 'SALARY_BAND' ? current : { ...current, bands: current.bands.filter((_, bandIndex) => bandIndex !== index).map((item, bandIndex) => ({ ...item, sortOrder: bandIndex + 1 })) })} total={draft.bands.length} />)}</div>
}

function StepEditor({ step, index, total, labels, onChange, onRemove, onMove }: { step: DraftStep; index: number; total: number; labels: Labels; onChange: (patch: Partial<DraftStep>) => void; onRemove: () => void; onMove: (direction: -1 | 1) => void }) {
  return <div className="grid gap-2 rounded-xl border bg-background/60 p-3 md:grid-cols-[4rem_8rem_1fr_10rem_9rem_auto] md:items-end"><span className="pb-2 text-sm tabular-nums text-muted-foreground">{index + 1}</span><label className="grid gap-1 text-xs font-semibold text-muted-foreground">{labels.stepLabel}<input className={fieldClass} value={step.stepCode} onChange={(event) => onChange({ stepCode: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">{labels.stepName}<input className={fieldClass} value={step.stepName} onChange={(event) => onChange({ stepName: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">{labels.amount}<input className={fieldClass} inputMode="decimal" value={step.fulltimeAmount} onChange={(event) => onChange({ fulltimeAmount: normalizeDecimal(event.target.value) })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">{labels.timeToNextStep}<input className={fieldClass} min="1" type="number" value={step.monthsToNextStep ?? ''} onChange={(event) => onChange({ monthsToNextStep: event.target.value ? Number(event.target.value) : null, progressionType: event.target.value ? 'TIME_IN_STEP' : 'MANUAL' })} /></label><div className="flex items-center gap-1 md:justify-end"><button aria-label={labels.moveUp} className="rounded-lg border p-2 disabled:opacity-40" disabled={index === 0} onClick={() => onMove(-1)} type="button"><ArrowUp size={15} /></button><button aria-label={labels.moveDown} className="rounded-lg border p-2 disabled:opacity-40" disabled={index === total - 1} onClick={() => onMove(1)} type="button"><ArrowDown size={15} /></button><button aria-label={labels.removeStep} className="rounded-lg border border-destructive/20 p-2 text-destructive disabled:opacity-40" disabled={total <= 1} onClick={onRemove} type="button"><Trash2 size={15} /></button></div></div>
}

function ScaleEditor({ scale, scaleIndex, labels, setDraft }: { scale: DraftScale; scaleIndex: number; labels: Labels; setDraft: Dispatch<SetStateAction<Draft>> }) {
  function updateScale(patch: Partial<DraftScale>): void { setDraft((current) => current.structureType !== 'SCALE_WITH_STEPS' ? current : { ...current, scales: current.scales.map((item, index) => index === scaleIndex ? { ...item, ...patch } : item) }) }
  function updateStep(stepIndex: number, patch: Partial<DraftStep>): void { updateScale({ steps: scale.steps.map((step, index) => index === stepIndex ? { ...step, ...patch } : step) }) }
  function moveStep(index: number, direction: -1 | 1): void { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= scale.steps.length) return; const steps = [...scale.steps]; const [item] = steps.splice(index, 1); steps.splice(nextIndex, 0, item); updateScale({ steps: steps.map((step, stepIndex) => ({ ...step, sequenceNumber: stepIndex + 1, stepKind: stepIndex === steps.length - 1 ? 'MAXIMUM' : stepIndex === 0 ? 'START' : 'REGULAR', progressionType: stepIndex === steps.length - 1 ? 'MANUAL' : step.progressionType, monthsToNextStep: stepIndex === steps.length - 1 ? null : step.monthsToNextStep })) }) }
  return <details className="group rounded-2xl border bg-surface" open={scaleIndex < 2}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5"><span className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">{scale.code || scaleIndex + 1}</span><span className="min-w-0"><span className="block truncate font-semibold">{scale.name || `${labels.scale} ${scaleIndex + 1}`}</span><span className="block text-xs text-muted-foreground">{scale.steps.length} {labels.steps}</span></span></span><ChevronDown className="shrink-0 transition group-open:rotate-180" size={18} /></summary><div className="space-y-4 border-t p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{labels.code}<input className={fieldClass} value={scale.code} onChange={(event) => updateScale({ code: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium">{labels.name}<input className={fieldClass} value={scale.name} onChange={(event) => updateScale({ name: event.target.value })} /></label><label className="grid gap-1 text-sm font-medium sm:col-span-2">{labels.defaultTimeToNextStep}<input className={fieldClass} min="1" type="number" value={scale.defaultMonthsToNextStep ?? ''} onChange={(event) => updateScale({ defaultMonthsToNextStep: event.target.value ? Number(event.target.value) : null })} /></label></div><div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground"><Layers3 className="mt-0.5 shrink-0 text-primary" size={16} /><span>{labels.orderHint} {labels.twoStepHint} {labels.noAutomaticProgression}</span></div><div className="space-y-2">{scale.steps.map((step, index) => <StepEditor index={index} key={`${step.stepCode}-${index}`} labels={labels} onChange={(patch) => updateStep(index, patch)} onMove={(direction) => moveStep(index, direction)} onRemove={() => updateScale({ steps: scale.steps.filter((_, stepIndex) => stepIndex !== index).map((item, stepIndex) => ({ ...item, sequenceNumber: stepIndex + 1, stepKind: stepIndex === scale.steps.length - 2 ? 'MAXIMUM' : stepIndex === 0 ? 'START' : 'REGULAR', progressionType: stepIndex === scale.steps.length - 2 ? 'MANUAL' : item.progressionType, monthsToNextStep: stepIndex === scale.steps.length - 2 ? null : item.monthsToNextStep })) })} step={step} total={scale.steps.length} />)}</div><div className="flex flex-wrap justify-between gap-2"><button className="button-secondary inline-flex items-center gap-2" onClick={() => updateScale({ steps: [...scale.steps, { stepCode: String(scale.steps.length + 1), stepName: String(scale.steps.length + 1), sequenceNumber: scale.steps.length + 1, fulltimeAmount: '0.00', hourlyAmount: null, progressionType: 'MANUAL', monthsToNextStep: null, stepKind: 'MAXIMUM' }] })} type="button"><Plus size={16} />{labels.addStep}</button>{scaleIndex > 0 ? <button className="inline-flex items-center gap-2 text-sm font-semibold text-destructive hover:underline" onClick={() => setDraft((current) => current.structureType !== 'SCALE_WITH_STEPS' ? current : { ...current, scales: current.scales.filter((_, index) => index !== scaleIndex).map((item, index) => ({ ...item, sortOrder: index + 1 })) })} type="button"><Trash2 size={15} />{labels.removeScale}</button> : null}</div></div></details>
}

function ScaleRevisionEditor({ draft, setDraft, labels }: { draft: ScaleDraft; setDraft: Dispatch<SetStateAction<Draft>>; labels: Labels }) {
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{labels.tabs.scalesAndSteps}</p><p className="mt-1 text-sm text-muted-foreground">{labels.orderHint} {labels.twoStepHint}</p></div><button className="button-secondary inline-flex items-center gap-2" onClick={() => setDraft((current) => current.structureType !== 'SCALE_WITH_STEPS' ? current : { ...current, scales: [...current.scales, { code: `S${current.scales.length + 1}`, name: `${labels.scale} ${current.scales.length + 1}`, description: null, sortOrder: current.scales.length + 1, progressionType: 'MANUAL', defaultMonthsToNextStep: null, steps: [{ stepCode: '1', stepName: '1', sequenceNumber: 1, fulltimeAmount: '0.00', hourlyAmount: null, progressionType: 'MANUAL', monthsToNextStep: null, stepKind: 'MAXIMUM' }] }] })} type="button"><Plus size={16} />{labels.addScale}</button></div>{draft.scales.map((scale, index) => <ScaleEditor key={`${scale.code}-${index}`} labels={labels} scale={scale} scaleIndex={index} setDraft={setDraft} />)}</div>
}

type View = 'catalog' | 'detail' | 'history' | 'editor' | 'conflicts'

function isView(value: string | null): value is View {
  return value === 'catalog' || value === 'detail' || value === 'history' || value === 'editor' || value === 'conflicts'
}

function isStructureType(value: string | null): value is 'SALARY_BAND' | 'SCALE_WITH_STEPS' {
  return value === 'SALARY_BAND' || value === 'SCALE_WITH_STEPS'
}

function StructureDetail({
  catalog,
  structure,
  revision,
  labels,
  locale,
  onBack,
  onHistory,
  onSelectRevision,
  onNewRevision,
  onContinueDraft,
}: {
  catalog: SalaryStructureCatalog
  structure: Structure
  revision: Revision | null
  labels: Labels
  locale: Locale
  onBack: () => void
  onHistory: () => void
  onSelectRevision: (revisionId: string) => void
  onNewRevision: () => void
  onContinueDraft: () => void
}) {
  const revisions = catalog.revisions
    .filter((item) => item.salary_structure_id === structure.id)
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))
  const selectedStatus = revision ? statusForRevision(revision, revisions, labels) : null
  const canEdit = catalog.canWriteStructures && catalog.canReadAmounts
  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <button aria-label={labels.back} className="rounded-lg border p-2 hover:bg-muted" onClick={onBack} type="button"><ArrowLeft size={18} /></button>
        <div><p className="eyebrow">{labels.structure}</p><h2 className="mt-1 text-2xl font-semibold">{structure.name}</h2><p className="mt-1 text-sm text-muted-foreground">{structure.code ?? '—'} · {structure.structure_type === 'SALARY_BAND' ? labels.tabs.salaryBands : labels.tabs.scalesAndSteps}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="button-secondary inline-flex items-center gap-2" onClick={onHistory} type="button"><History size={16} />{labels.history}</button>
        {canEdit && revision?.status === 'DRAFT' ? <button className="button-primary inline-flex items-center gap-2" onClick={onContinueDraft} type="button"><Pencil size={16} />{labels.continueDraft}</button> : canEdit ? <button className="button-primary inline-flex items-center gap-2" onClick={onNewRevision} type="button"><Plus size={16} />{labels.newRevision}</button> : null}
      </div>
    </div>
    {!canEdit && catalog.canWriteStructures ? <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 shrink-0 text-primary" size={17} />{labels.amountsRestricted}</div> : null}
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{labels.revisions}</p><p className="mt-1 text-sm text-muted-foreground">{labels.publishedReadOnly}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{revisions.length}</span></div>
      {revisions.length === 0 ? <div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-muted-foreground"><p>{labels.noRevision}</p>{canEdit ? <button className="mt-3 button-primary" onClick={onNewRevision} type="button">{labels.newRevision}</button> : null}</div> : <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={labels.revisions}>
        {revisions.map((item) => {
          const status = statusForRevision(item, revisions, labels)
          return <button aria-selected={revision?.id === item.id} className={`min-w-[12rem] rounded-xl border p-3 text-left transition ${revision?.id === item.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`} key={item.id} onClick={() => onSelectRevision(item.id)} role="tab" type="button"><span className="flex items-center justify-between gap-2"><span className="font-semibold">{labels.revision} {item.revision_number}</span><Badge tone={status.tone}>{status.text}</Badge></span><span className="mt-2 block text-xs text-muted-foreground">{labels.effectiveFrom}: {formatDate(item.effective_from, locale)}</span></button>
        })}
      </div>}
    </section>
    {revision && selectedStatus ? <section className={panelClass}><ReadOnlyRevision catalog={catalog} structure={structure} revision={revision} labels={labels} locale={locale} /></section> : null}
  </div>
}

function RevisionHistory({ structure, revisions, labels, locale, onBack, onView }: { structure: Structure; revisions: Revision[]; labels: Labels; locale: Locale; onBack: () => void; onView: (revisionId: string) => void }) {
  const items = revisions.filter((revision) => revision.salary_structure_id === structure.id).sort((left, right) => right.effective_from.localeCompare(left.effective_from))
  return <div className="space-y-5">
    <div className="flex items-start gap-3"><button aria-label={labels.back} className="rounded-lg border p-2 hover:bg-muted" onClick={onBack} type="button"><ArrowLeft size={18} /></button><div><p className="eyebrow">{labels.history}</p><h2 className="mt-1 text-2xl font-semibold">{structure.name}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.revisions}</p></div></div>
    <section className={panelClass}><div className="space-y-3">{items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noRevision}</p> : items.map((revision, index) => { const status = statusForRevision(revision, items, labels); return <div className="relative flex flex-col gap-3 border-l-2 border-primary/20 pl-5 sm:flex-row sm:items-center sm:justify-between" key={revision.id}><span className="absolute -left-[0.42rem] top-1 size-3 rounded-full border-2 border-background bg-primary" /><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{labels.revision} {revision.revision_number} · {formatDate(revision.effective_from, locale)}</p><p className="mt-1 font-semibold">{revision.description ?? labels.structure}</p><p className="mt-1 text-sm text-muted-foreground">{revision.published_at ? `${labels.publishedAt}: ${formatDate(revision.published_at.slice(0, 10), locale)}` : labels.draft}</p></div><div className="flex items-center gap-3"><Badge tone={status.tone}>{status.text}</Badge><button className="button-secondary" onClick={() => onView(revision.id)} type="button">{labels.view}</button></div>{index === items.length - 1 ? null : <span aria-hidden="true" />}</div> })}</div></section>
  </div>
}

function conflictStatus(status: Conflict['status'], labels: Labels): { text: string; tone: BadgeTone } {
  if (status === 'RESOLVED') return { text: labels.resolved, tone: 'success' }
  if (status === 'IGNORED') return { text: labels.ignored, tone: 'neutral' }
  return { text: labels.open, tone: 'warning' }
}

function MigrationConflicts({ catalog, labels, onBack }: { catalog: SalaryStructureCatalog; labels: Labels; onBack: () => void }) {
  const router = useRouter()
  const [actions, setActions] = useState<Record<string, SalaryStructureMigrationConflictAction>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [confirmConflict, setConfirmConflict] = useState<Conflict | null>(null)
  async function resolve(conflict: Conflict): Promise<void> {
    const action = actions[conflict.id] ?? 'LATER'
    setSavingId(conflict.id); setFailedId(null)
    const response = await fetch(`/api/master-data/salary-structures/migration-conflicts/${conflict.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, note: notes[conflict.id]?.trim() || null }) })
    setSavingId(null)
    if (!response.ok) { setFailedId(conflict.id); return }
    setConfirmConflict(null)
    router.refresh()
  }
  function startResolve(conflict: Conflict): void {
    if ((actions[conflict.id] ?? 'LATER') === 'TREAT_AS_SAME') setConfirmConflict(conflict)
    else void resolve(conflict)
  }
  return <div className="space-y-5">
    <div className="flex items-start gap-3"><button aria-label={labels.back} className="rounded-lg border p-2 hover:bg-muted" onClick={onBack} type="button"><ArrowLeft size={18} /></button><div><p className="eyebrow">{labels.migrationTitle}</p><h2 className="mt-1 text-2xl font-semibold">{labels.migrationTitle}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.migrationDescription}</p></div></div>
    {catalog.migrationConflicts.length === 0 ? <EmptyState title={labels.empty} /> : <div className="space-y-3">{catalog.migrationConflicts.map((conflict) => { const status = conflictStatus(conflict.status, labels); const related = conflict.salary_structure_ids.map((id) => catalog.structures.find((structure) => structure.id === id)?.name ?? id); const sourceCount = conflict.source_administration_ids.length; const selectedAction = actions[conflict.id] ?? 'LATER'; return <article className={panelClass} key={conflict.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{labels.legacyScaleCode}: {conflict.legacy_scale_code}</span><Badge tone={status.tone}>{status.text}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{conflict.reason}</p></div><span className="text-xs text-muted-foreground">{labels.sourceAdministrations}: {sourceCount}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.structures}</p><p className="mt-1">{related.length > 0 ? related.join(' · ') : labels.noData}</p></div><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.resolution}</p><p className="mt-1">{conflict.resolution ? labels.decisionSaved : labels.noData}</p></div></div>{catalog.canWriteRelations && conflict.status === 'OPEN' ? <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"><label className="grid gap-1 text-sm font-medium">{labels.resolution}<DropdownSelect aria-label={labels.resolution} onChange={(event) => setActions((current) => ({ ...current, [conflict.id]: event.target.value as SalaryStructureMigrationConflictAction }))} value={selectedAction}><option value="KEEP_SEPARATE">{labels.keepSeparate}</option><option value="RENAME_OR_RECODE">{labels.renameOrRecode}</option><option value="TREAT_AS_SAME">{labels.treatAsSame}</option><option value="LATER">{labels.later}</option></DropdownSelect></label><FormField control={<TextInput maxLength={500} onChange={(event) => setNotes((current) => ({ ...current, [conflict.id]: event.target.value }))} value={notes[conflict.id] ?? ''} />} label={labels.decisionNote} /><Button disabled={savingId === conflict.id} onClick={() => startResolve(conflict)} size="sm" type="button">{savingId === conflict.id ? labels.saving : labels.save}</Button></div> : null}{failedId === conflict.id ? <p className="mt-3 text-sm text-destructive" role="alert">{labels.failed}</p> : null}</article> })}</div>}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.treatAsSame} destructive description={labels.confirmDecision} onConfirm={() => { if (confirmConflict) return resolve(confirmConflict) }} onOpenChange={(open) => { if (!open) setConfirmConflict(null) }} open={confirmConflict !== null} pending={savingId !== null} title={labels.confirmDecision} />
  </div>
}

function RevisionEditor({ catalog, structure, revision, sourceRevision, labels, locale, onBack, onPublished }: { catalog: SalaryStructureCatalog; structure: Structure; revision: Revision | null; sourceRevision: Revision | null; labels: Labels; locale: Locale; onBack: () => void; onPublished: (revisionId: string) => void }) {
  const isExistingDraft = revision?.status === 'DRAFT'
  const [draft, setDraft] = useState<Draft>(() => isExistingDraft && revision ? draftFromRevision(catalog, structure, revision) : sourceRevision ? draftFromRevision(catalog, structure, sourceRevision) : emptyDraft(structure))
  const [draftId, setDraftId] = useState<string | null>(() => isExistingDraft && revision ? revision.id : null)
  const [lockVersion, setLockVersion] = useState<number | null>(() => isExistingDraft && revision ? revision.lock_version : null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const validation = validateDraft(draft, labels)
  useEffect(() => {
    if (!dirty) return
    function beforeUnload(event: BeforeUnloadEvent): void { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  function leave(): void {
    if (dirty) { setLeaveConfirmOpen(true); return }
    onBack()
  }
  function changeDraft(next: Draft): void { setDraft(next); setDirty(true); setMessage(null); setError(false) }
  async function persist(): Promise<{ id: string; lockVersion: number } | null> {
    if (validation.blockers.length > 0) { setError(true); setMessage(labels.publishBlocked); return null }
    setSaving(true); setError(false); setMessage(null)
    const response = await fetch(`/api/master-data/salary-structures/${structure.id}/drafts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId, expectedLockVersion: draftId === null ? null : lockVersion, draft }) })
    setSaving(false)
    if (!response.ok) { setError(true); setMessage(labels.failed); return null }
    const payload = await response.json() as { data?: { id?: string; lockVersion?: number } }
    if (!payload.data?.id || typeof payload.data.lockVersion !== 'number') { setError(true); setMessage(labels.failed); return null }
    const result = { id: payload.data.id, lockVersion: payload.data.lockVersion }
    setDraftId(result.id); setLockVersion(result.lockVersion); setDirty(false); setMessage(labels.revisionSaved)
    return result
  }
  async function saveAndClose(): Promise<void> { const result = await persist(); if (result) onBack() }
  async function publish(): Promise<void> {
    if (validation.blockers.length > 0) return
    setPublishing(true); setError(false); setMessage(null)
    const saved = await persist()
    if (!saved) { setPublishing(false); return }
    const response = await fetch(`/api/master-data/salary-structures/revisions/${saved.id}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedLockVersion: saved.lockVersion }) })
    setPublishing(false)
    if (!response.ok) { setError(true); setMessage(labels.failed); return }
    setReviewOpen(false); setDirty(false); onPublished(saved.id)
  }
  const title = isExistingDraft ? labels.continueDraft : labels.newRevision
  if (!catalog.canReadAmounts || !catalog.canWriteStructures) return <div className="space-y-5"><Button onClick={leave} type="button" variant="secondary"><ArrowLeft size={16} />{labels.back}</Button><div className={`${panelClass} flex items-start gap-3 text-sm text-muted-foreground`}><LockKeyhole className="mt-0.5 shrink-0 text-primary" size={17} />{labels.readOnly}</div></div>
  return <div className="space-y-5">
     <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><button aria-label={labels.back} className="rounded-lg border p-2 hover:bg-muted" onClick={leave} type="button"><ArrowLeft size={18} /></button><div><p className="eyebrow">{labels.revision}</p><h2 className="mt-1 text-2xl font-semibold">{structure.name}</h2><p className="mt-1 text-sm text-muted-foreground">{title}</p></div></div><Badge tone="info">{labels.draft}</Badge></div>
     <section className={panelClass}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FormField control={<TextInput onChange={(event) => changeDraft({ ...draft, effectiveFrom: event.target.value })} type="date" value={draft.effectiveFrom} />} label={labels.effectiveFrom} required /><FormField control={<DropdownSelect aria-label={labels.salaryBasis} onChange={(event) => changeDraft({ ...draft, salaryBasis: event.target.value as Draft['salaryBasis'] })} value={draft.salaryBasis}><option value="MONTHLY_BASE">{labels.monthlyBase}</option><option value="FOUR_WEEKLY_BASE">{labels.fourWeeklyBase}</option><option value="ANNUAL_BASE">{labels.annualBase}</option><option value="HOURLY">{labels.hourlyBase}</option></DropdownSelect>} label={labels.salaryBasis} required /><FormField control={<TextInput maxLength={3} onChange={(event) => changeDraft({ ...draft, currencyCode: event.target.value.toUpperCase() })} value={draft.currencyCode} />} label={labels.currency} required /><FormField className="sm:col-span-2 lg:col-span-1" control={<TextInput onChange={(event) => changeDraft({ ...draft, description: event.target.value || null })} value={draft.description ?? ''} />} label={labels.description} /></div></section>
    <section className={panelClass}>{draft.structureType === 'SALARY_BAND' ? <BandRevisionEditor draft={draft} setDraft={(updater) => { setDraft((current) => { const next = typeof updater === 'function' ? updater(current) : updater; setDirty(true); return next }) }} labels={labels} locale={locale} /> : <ScaleRevisionEditor draft={draft} setDraft={(updater) => { setDraft((current) => { const next = typeof updater === 'function' ? updater(current) : updater; setDirty(true); return next }) }} labels={labels} />}</section>
    {message ? <p aria-live="polite" className={`text-sm ${error ? 'text-destructive' : 'text-success'}`}>{message}</p> : null}
     <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border-subtle bg-background/95 p-3 shadow-lg backdrop-blur"><span className="text-sm text-muted-foreground">{dirty ? labels.draft : labels.revisionSaved}</span><div className="flex flex-wrap gap-2"><Button disabled={saving || publishing} onClick={leave} type="button" variant="secondary">{labels.cancel}</Button><Button disabled={saving || publishing || validation.blockers.length > 0} onClick={() => void saveAndClose()} type="button" variant="secondary">{saving ? labels.saving : labels.saveAndClose}</Button><Button disabled={saving || publishing} onClick={() => setReviewOpen(true)} type="button" variant="secondary"><Check size={16} />{labels.publishReview}</Button><Button disabled={saving || publishing || validation.blockers.length > 0} onClick={() => void persist()} type="button">{saving ? labels.saving : labels.save}</Button></div></div>
    {reviewOpen ? <RevisionReview draft={draft} labels={labels} locale={locale} onCancel={() => setReviewOpen(false)} onPublish={() => void publish()} publishing={publishing} /> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.back} destructive description={labels.dirtyConfirm} onConfirm={() => { setLeaveConfirmOpen(false); onBack() }} onOpenChange={setLeaveConfirmOpen} open={leaveConfirmOpen} title={labels.dirtyConfirm} />
  </div>
}

export function SalaryStructuresManager({ catalog, labels, locale }: { catalog: SalaryStructureCatalog; labels: Labels; locale: Locale }) {
  const pathname = usePathname() ?? '/master-data/salary-scales'
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeType = isStructureType(searchParams.get('type')) ? searchParams.get('type') as 'SALARY_BAND' | 'SCALE_WITH_STEPS' : 'SCALE_WITH_STEPS'
  const view = isView(searchParams.get('view')) ? searchParams.get('view') as View : 'catalog'
  const structureId = searchParams.get('structureId')
  const queryRevisionId = searchParams.get('revisionId')
  const structure = useMemo(() => catalog.structures.find((item) => item.id === structureId) ?? null, [catalog.structures, structureId])
  const structureRevisions = useMemo(() => structure ? catalog.revisions.filter((item) => item.salary_structure_id === structure.id) : [], [catalog.revisions, structure])
  const selectedRevision = structureRevisions.find((item) => item.id === queryRevisionId) ?? (structure ? preferredRevision(catalog.revisions, structure.id) : null)
  const newRevision = searchParams.get('newRevision') === '1'
  const [createOpen, setCreateOpen] = useState(false)
  function openCatalog(type: 'SALARY_BAND' | 'SCALE_WITH_STEPS' = activeType): void { navigateTo(router, pathname, { view: 'catalog', type, structureId: null, revisionId: null, newRevision: null }) }
  function openDetail(revisionId: string | null = null): void { navigateTo(router, pathname, { view: 'detail', type: activeType, structureId, revisionId, newRevision: null }) }
  function openHistory(): void { navigateTo(router, pathname, { view: 'history', type: activeType, structureId, revisionId: null, newRevision: null }) }
  function openNewRevision(): void {
    const source = selectedRevision?.status === 'PUBLISHED' ? selectedRevision : latestPublishedRevision(catalog.revisions, structure?.id ?? '')
    navigateTo(router, pathname, { view: 'editor', type: activeType, structureId, revisionId: source?.id ?? null, newRevision: '1' })
  }
  function openDraft(): void { navigateTo(router, pathname, { view: 'editor', type: activeType, structureId, revisionId: selectedRevision?.id ?? null, newRevision: null }) }
  const content = view === 'conflicts' ? <MigrationConflicts catalog={catalog} labels={labels} onBack={() => openCatalog()} />
    : !structure ? <StructureCatalog catalog={catalog} labels={labels} locale={locale} type={activeType} pathname={pathname} onCreate={() => setCreateOpen(true)} />
      : view === 'history' ? <RevisionHistory structure={structure} revisions={catalog.revisions} labels={labels} locale={locale} onBack={() => openDetail(selectedRevision?.id ?? null)} onView={(revisionId) => openDetail(revisionId)} />
        : view === 'editor' && (newRevision || selectedRevision?.status === 'DRAFT') ? <RevisionEditor key={`${structure.id}-${newRevision ? 'new' : selectedRevision?.id ?? 'empty'}`} catalog={catalog} structure={structure} revision={newRevision ? selectedRevision : selectedRevision} sourceRevision={newRevision ? selectedRevision : null} labels={labels} locale={locale} onBack={() => openDetail(selectedRevision?.id ?? null)} onPublished={(revisionId) => openDetail(revisionId)} />
          : <StructureDetail catalog={catalog} structure={structure} revision={selectedRevision} labels={labels} locale={locale} onBack={() => openCatalog()} onHistory={openHistory} onSelectRevision={(revisionId) => openDetail(revisionId)} onNewRevision={openNewRevision} onContinueDraft={openDraft} />
  return <div className="space-y-5">
    {view !== 'editor' && view !== 'history' && view !== 'conflicts' ? <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">{labels.structures}</p><h2 className="mt-1 text-xl font-semibold">{labels.details}</h2></div><nav aria-label={labels.structures} className="flex gap-2" role="tablist"><button aria-selected={activeType === 'SCALE_WITH_STEPS' && view !== 'detail'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeType === 'SCALE_WITH_STEPS' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} onClick={() => openCatalog('SCALE_WITH_STEPS')} role="tab" type="button">{labels.tabs.scalesAndSteps}</button><button aria-selected={activeType === 'SALARY_BAND' && view !== 'detail'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${activeType === 'SALARY_BAND' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`} onClick={() => openCatalog('SALARY_BAND')} role="tab" type="button">{labels.tabs.salaryBands}</button></nav></div> : null}
    {content}
    {createOpen ? <CreateStructureDialog defaultType={activeType} labels={labels} onCancel={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); router.refresh(); navigateTo(router, pathname, { view: 'detail', type: activeType, structureId: id, revisionId: null, newRevision: null }) }} /> : null}
  </div>
}

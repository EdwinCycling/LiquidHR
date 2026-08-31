'use client'

import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import { Surface } from '@/components/ui/surface'
import { FormField } from '@/components/patterns/form-field'
import { PageHeader } from '@/components/patterns/page-header'
import { SectionHeader } from '@/components/patterns/section-header'
import type { AnalysisResult } from '@/lib/insights/analysis-result'
import { ANALYSIS_DIMENSIONS, type AnalysisDimensionKey } from '@/lib/insights/analysis-semantic-layer'
import type { AnalysisSpecV1 } from '@/lib/insights/analysis-spec'
import { AnalysisExploration, type AnalysisExplorationLabels } from './analysis-exploration'

type ExploreDimension = '' | AnalysisDimensionKey
type ExploreSort = 'none' | 'label' | 'value'
type ExploreDirection = 'asc' | 'desc'
type ExplorePresentation = AnalysisSpecV1['presentation']

export interface AnalysisExploreLabels {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly setupTitle: string
  readonly setupDescription: string
  readonly startingPoint: string
  readonly workforce: string
  readonly measure: string
  readonly headcount: string
  readonly dimension: string
  readonly noDimension: string
  readonly department: string
  readonly job: string
  readonly employmentStatus: string
  readonly filters: string
  readonly noFilter: string
  readonly filterValue: string
  readonly filterValuePlaceholder: string
  readonly filterStatusActive: string
  readonly filterStatusFuture: string
  readonly filterStatusFormer: string
  readonly filterStatusNever: string
  readonly filterEquals: string
  readonly filterDescription: string
  readonly filterRequired: string
  readonly presentation: string
  readonly auto: string
  readonly kpi: string
  readonly table: string
  readonly presentationDescription: string
  readonly sort: string
  readonly noSort: string
  readonly sortLabel: string
  readonly sortValue: string
  readonly direction: string
  readonly ascending: string
  readonly descending: string
  readonly limit: string
  readonly execute: string
  readonly executing: string
  readonly resultTitle: string
  readonly saveTitle: string
  readonly saveDescription: string
  readonly name: string
  readonly namePlaceholder: string
  readonly save: string
  readonly saving: string
  readonly saved: string
  readonly openSaved: string
  readonly searchPlaceholder: string
  readonly executionFailed: string
  readonly saveFailed: string
  readonly nameRequired: string
  readonly exploration: Omit<AnalysisExplorationLabels, 'canvas' | 'workforce' | 'department' | 'job' | 'employmentStatus'>
  readonly canvas: AnalysisExplorationLabels['canvas']
}

type AnalysisApiPayload = {
  readonly data: AnalysisResult
}

type SavedAnalysisApiPayload = {
  readonly data: {
    readonly id: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rows) || !Array.isArray(value.columns) || !Array.isArray(value.dimensions)) return false
  const summary = value.summary
  return isRecord(summary) && typeof summary.headcount === 'number'
}

function readAnalysisPayload(value: unknown): AnalysisApiPayload | null {
  if (!isRecord(value) || !isAnalysisResult(value.data)) return null
  return { data: value.data }
}

function readSavedAnalysisPayload(value: unknown): SavedAnalysisApiPayload | null {
  if (!isRecord(value) || !isRecord(value.data) || typeof value.data.id !== 'string') return null
  return { data: { id: value.data.id } }
}

function dimensionLabel(dimension: ExploreDimension, labels: AnalysisExploreLabels): string {
  switch (dimension) {
    case 'department':
      return labels.department
    case 'job':
      return labels.job
    case 'employment_status':
      return labels.employmentStatus
    default:
      return labels.noDimension
  }
}

function isDimension(value: string): value is AnalysisDimensionKey {
  return ANALYSIS_DIMENSIONS.some((dimension) => dimension === value)
}

function buildSpec(
  dimension: ExploreDimension,
  filterDimension: ExploreDimension,
  filterValue: string,
  presentation: ExplorePresentation,
  sort: ExploreSort,
  direction: ExploreDirection,
  limit: string,
): AnalysisSpecV1 {
  return {
    version: 1,
    source: 'workforce',
    entity: 'employees',
    measures: ['headcount'],
    dimensions: dimension ? [dimension] : [],
    filters: filterDimension && filterValue.trim()
      ? [{ dimension: filterDimension, operator: 'eq', value: filterValue.trim() }]
      : [],
    sort: sort === 'none' ? null : { by: sort, direction },
    limit: Number(limit),
    presentation,
  }
}

export function AnalysisExplore({ labels }: { readonly labels: AnalysisExploreLabels }) {
  const [dimension, setDimension] = useState<ExploreDimension>('')
  const [filterDimension, setFilterDimension] = useState<ExploreDimension>('')
  const [filterValue, setFilterValue] = useState('')
  const [presentation, setPresentation] = useState<ExplorePresentation>('auto')
  const [sort, setSort] = useState<ExploreSort>('none')
  const [direction, setDirection] = useState<ExploreDirection>('desc')
  const [limit, setLimit] = useState('25')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [executedSpec, setExecutedSpec] = useState<AnalysisSpecV1 | null>(null)
  const [activeResult, setActiveResult] = useState<AnalysisResult | null>(null)
  const [activeSpec, setActiveSpec] = useState<AnalysisSpecV1 | null>(null)
  const [executionKey, setExecutionKey] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  function markDefinitionChanged(): void {
    setIsDirty(true)
    setResult(null)
    setExecutedSpec(null)
    setActiveResult(null)
    setActiveSpec(null)
    setFeedback(null)
    setSavedId(null)
  }

  function handleDimensionChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value
    const nextDimension: ExploreDimension = next && isDimension(next) ? next : ''
    setDimension(nextDimension)
    if (nextDimension && presentation === 'kpi') setPresentation('auto')
    markDefinitionChanged()
  }

  function handleFilterDimensionChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value
    setFilterDimension(next && isDimension(next) ? next : '')
    setFilterValue('')
    markDefinitionChanged()
  }

  async function handleExecute(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (filterDimension && !filterValue.trim()) {
      setError(labels.filterRequired)
      return
    }

    const spec = buildSpec(dimension, filterDimension, filterValue, presentation, sort, direction, limit)
    setIsExecuting(true)
    setError(null)
    setFeedback(null)
    setSaveError(null)
    setSavedId(null)
    try {
      const response = await fetch('/api/insights/analysis', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(spec),
      })
      const payload: unknown = await response.json()
      const parsed = readAnalysisPayload(payload)
      if (!response.ok || !parsed) throw new Error(labels.executionFailed)
      setResult(parsed.data)
      setExecutedSpec(spec)
      setActiveResult(parsed.data)
      setActiveSpec(spec)
      setExecutionKey((value) => value + 1)
      setIsDirty(false)
    } catch {
      setResult(null)
      setExecutedSpec(null)
      setActiveResult(null)
      setActiveSpec(null)
      setError(labels.executionFailed)
    } finally {
      setIsExecuting(false)
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!activeSpec || !activeResult || isDirty) return
    if (!saveName.trim()) {
      setSaveError(labels.nameRequired)
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setFeedback(null)
    try {
      const response = await fetch('/api/insights/saved-analyses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), analysisSpec: activeSpec }),
      })
      const payload: unknown = await response.json()
      const parsed = readSavedAnalysisPayload(payload)
      if (!response.ok || !parsed) throw new Error(labels.saveFailed)
      setSavedId(parsed.data.id)
      setFeedback(labels.saved)
    } catch {
      setSaveError(labels.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCurrentChange = useCallback((nextSpec: AnalysisSpecV1, nextResult: AnalysisResult): void => {
    setActiveSpec(nextSpec)
    setActiveResult(nextResult)
  }, [])

  return (
    <div className="space-y-6" data-analysis-explore="v1">
      <div>
        <p className="eyebrow">{labels.eyebrow}</p>
        <PageHeader className="mt-2" description={labels.intro} title={labels.title} />
      </div>

      <form className="space-y-4" onSubmit={(event) => void handleExecute(event)}>
        <Surface className="p-5">
          <SectionHeader description={labels.setupDescription} title={labels.setupTitle} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField control={<DropdownSelect disabled value="workforce"><option value="workforce">{labels.workforce}</option></DropdownSelect>} label={labels.startingPoint} />
            <FormField control={<DropdownSelect disabled value="headcount"><option value="headcount">{labels.headcount}</option></DropdownSelect>} label={labels.measure} />
            <FormField control={<DropdownSelect onChange={handleDimensionChange} searchable searchPlaceholder={labels.searchPlaceholder} value={dimension}><option value="">{labels.noDimension}</option><option value="department">{labels.department}</option><option value="job">{labels.job}</option><option value="employment_status">{labels.employmentStatus}</option></DropdownSelect>} label={labels.dimension} description={dimensionLabel(dimension, labels)} />
            <FormField control={<DropdownSelect onChange={(event) => { setPresentation(event.target.value as ExplorePresentation); markDefinitionChanged() }} searchable searchPlaceholder={labels.searchPlaceholder} value={presentation}><option value="auto">{labels.auto}</option><option disabled={Boolean(dimension)} value="kpi">{labels.kpi}</option><option value="table">{labels.table}</option></DropdownSelect>} description={labels.presentationDescription} label={labels.presentation} />
          </div>
        </Surface>

        <Surface className="p-5">
          <SectionHeader title={labels.filters} />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField control={<DropdownSelect onChange={handleFilterDimensionChange} searchable searchPlaceholder={labels.searchPlaceholder} value={filterDimension}><option value="">{labels.noFilter}</option><option value="department">{labels.department}</option><option value="job">{labels.job}</option><option value="employment_status">{labels.employmentStatus}</option></DropdownSelect>} label={labels.filters} description={labels.filterDescription} />
            {filterDimension === 'employment_status' ? (
              <FormField control={<DropdownSelect onChange={(event) => { setFilterValue(event.target.value); markDefinitionChanged() }} searchable searchPlaceholder={labels.searchPlaceholder} value={filterValue}><option value="">{labels.filterValue}</option><option value="ACTIVE_EMPLOYEE">{labels.filterStatusActive}</option><option value="FUTURE_EMPLOYEE">{labels.filterStatusFuture}</option><option value="FORMER_EMPLOYEE">{labels.filterStatusFormer}</option><option value="NEVER_EMPLOYED">{labels.filterStatusNever}</option></DropdownSelect>} label={labels.filterValue} required />
            ) : filterDimension ? (
              <FormField control={<TextInput onChange={(event) => { setFilterValue(event.target.value); markDefinitionChanged() }} placeholder={labels.filterValuePlaceholder} value={filterValue} />} label={labels.filterValue} required />
            ) : null}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{labels.filterEquals}</p>
        </Surface>

        <Surface className="p-5">
          <SectionHeader title={labels.sort} />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FormField control={<DropdownSelect onChange={(event) => { setSort(event.target.value as ExploreSort); markDefinitionChanged() }} searchable searchPlaceholder={labels.searchPlaceholder} value={sort}><option value="none">{labels.noSort}</option><option value="label">{labels.sortLabel}</option><option value="value">{labels.sortValue}</option></DropdownSelect>} label={labels.sort} />
            <FormField control={<DropdownSelect onChange={(event) => { setDirection(event.target.value as ExploreDirection); markDefinitionChanged() }} searchable searchPlaceholder={labels.searchPlaceholder} value={direction}><option value="desc">{labels.descending}</option><option value="asc">{labels.ascending}</option></DropdownSelect>} label={labels.direction} />
            <FormField control={<DropdownSelect onChange={(event) => { setLimit(event.target.value); markDefinitionChanged() }} searchable searchPlaceholder={labels.searchPlaceholder} value={limit}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></DropdownSelect>} label={labels.limit} />
          </div>
        </Surface>

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button loading={isExecuting} type="submit">{isExecuting ? labels.executing : labels.execute}</Button>
        </div>
      </form>

      {result && executedSpec ? (
        <AnalysisExploration
          key={executionKey}
          labels={{
            ...labels.exploration,
            canvas: labels.canvas,
            department: labels.department,
            employmentStatus: labels.employmentStatus,
            job: labels.job,
            workforce: labels.workforce,
          }}
          onCurrentChange={handleCurrentChange}
          rootResult={result}
          rootSpec={executedSpec}
        />
      ) : <EmptyState title={labels.resultTitle} />}

      <Surface className="p-5">
        <SectionHeader description={labels.saveDescription} title={labels.saveTitle} />
        <form className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" onSubmit={(event) => void handleSave(event)}>
          <FormField control={<TextInput disabled={!result || isDirty} onChange={(event) => { setSaveName(event.target.value); setSaveError(null) }} placeholder={labels.namePlaceholder} value={saveName} />} label={labels.name} required />
          <Button disabled={!result || isDirty} loading={isSaving} type="submit">{isSaving ? labels.saving : labels.save}</Button>
        </form>
        {saveError ? <p className="mt-3 text-sm text-destructive" role="alert">{saveError}</p> : null}
        {feedback ? <p className="mt-3 text-sm text-success" role="status">{feedback}</p> : null}
        {savedId ? <a className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/insights/analysis/my-analyses/${savedId}`}>{labels.openSaved}</a> : null}
      </Surface>
    </div>
  )
}

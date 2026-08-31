'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import type { AnalysisComparisonResult } from '@/lib/insights/analysis-comparison'
import { validateAnalysisSpec, type AnalysisSpecV1 } from '@/lib/insights/analysis-spec'
import type { AnalysisResult, AnalysisResultRow } from '@/lib/insights/analysis-result'
import { ANALYSIS_DIMENSIONS, type AnalysisDimensionKey } from '@/lib/insights/analysis-semantic-layer'
import { LiquidCanvas, type LiquidCanvasLabels } from './liquid-canvas'

interface ExplorationStep {
  readonly analysisSpec: AnalysisSpecV1
  readonly result: AnalysisResult
  readonly context: { readonly dimension: AnalysisDimensionKey; readonly value: string } | null
}

export interface AnalysisExplorationLabels {
  readonly workforce: string
  readonly contextTitle: string
  readonly contextDescription: string
  readonly drillTitle: string
  readonly drillDescription: string
  readonly drillInto: string
  readonly drill: string
  readonly drilling: string
  readonly back: string
  readonly reset: string
  readonly compareTitle: string
  readonly compareDescription: string
  readonly compareLeft: string
  readonly compareRight: string
  readonly compareBreakdown: string
  readonly compareNoBreakdown: string
  readonly compare: string
  readonly comparing: string
  readonly compareFailed: string
  readonly compareNotPersisted: string
  readonly difference: string
  readonly noComparisonOptions: string
  readonly department: string
  readonly job: string
  readonly employmentStatus: string
  readonly canvas: LiquidCanvasLabels
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rows) || !Array.isArray(value.columns) || !Array.isArray(value.dimensions)) return false
  const summary = value.summary
  return isRecord(summary) && typeof summary.headcount === 'number'
}

function isComparisonResult(value: unknown): value is AnalysisComparisonResult {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rows) || !Array.isArray(value.comparisonValues)) return false
  const summary = value.summary
  return isRecord(summary)
    && typeof summary.left === 'number'
    && typeof summary.right === 'number'
    && typeof summary.difference === 'number'
}

function dimensionLabel(dimension: AnalysisDimensionKey, labels: AnalysisExplorationLabels): string {
  switch (dimension) {
    case 'department':
      return labels.department
    case 'job':
      return labels.job
    case 'employment_status':
      return labels.employmentStatus
  }
}

function readDrillPayload(value: unknown): { readonly analysisSpec: AnalysisSpecV1; readonly result: AnalysisResult } | null {
  if (!isRecord(value) || !isRecord(value.data) || !isAnalysisResult(value.data.result)) return null
  try {
    return { analysisSpec: validateAnalysisSpec(value.data.analysisSpec), result: value.data.result }
  } catch {
    return null
  }
}

function readComparisonPayload(value: unknown): AnalysisComparisonResult | null {
  if (!isRecord(value) || !isComparisonResult(value.data)) return null
  return value.data
}

function currentDimension(step: ExplorationStep): AnalysisDimensionKey | null {
  return step.analysisSpec.dimensions[0] ?? null
}

function valuesFromResult(step: ExplorationStep): readonly string[] {
  return step.result.rows
    .map((row) => row.values.dimension)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

export function AnalysisExploration({ labels, onCurrentChange, rootResult, rootSpec }: {
  readonly labels: AnalysisExplorationLabels
  readonly onCurrentChange?: (analysisSpec: AnalysisSpecV1, result: AnalysisResult) => void
  readonly rootResult: AnalysisResult | null
  readonly rootSpec: AnalysisSpecV1 | null
}) {
  const [steps, setSteps] = useState<readonly ExplorationStep[]>(() => rootSpec && rootResult ? [{ analysisSpec: rootSpec, result: rootResult, context: null }] : [])
  const [selectedRow, setSelectedRow] = useState<{ readonly dimension: AnalysisDimensionKey; readonly value: string } | null>(null)
  const [nextDimension, setNextDimension] = useState<AnalysisDimensionKey | ''>('')
  const [isDrilling, setIsDrilling] = useState(false)
  const [drillError, setDrillError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<AnalysisComparisonResult | null>(null)
  const [comparisonLeft, setComparisonLeft] = useState('')
  const [comparisonRight, setComparisonRight] = useState('')
  const [comparisonBreakdown, setComparisonBreakdown] = useState<AnalysisDimensionKey | ''>('')
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)

  const current = steps[steps.length - 1] ?? null
  const currentResultValues = current ? valuesFromResult(current) : []
  const currentResultDimension = current ? currentDimension(current) : null
  const drillDimensions = currentResultDimension
    ? ANALYSIS_DIMENSIONS.filter((dimension) => dimension !== currentResultDimension)
    : []

  useEffect(() => {
    if (!current) return
    onCurrentChange?.(current.analysisSpec, current.result)
  }, [current, onCurrentChange])

  const leftValue = currentResultValues.includes(comparisonLeft) ? comparisonLeft : currentResultValues[0] ?? ''
  const rightValue = currentResultValues.includes(comparisonRight) && comparisonRight !== leftValue
    ? comparisonRight
    : currentResultValues.find((value) => value !== leftValue) ?? ''

  function selectRow(row: AnalysisResultRow): void {
    if (!currentResultDimension || typeof row.values.dimension !== 'string') return
    setSelectedRow({ dimension: currentResultDimension, value: row.values.dimension })
    setNextDimension('')
    setDrillError(null)
  }

  async function handleDrill(): Promise<void> {
    if (!current || !selectedRow || !nextDimension) return
    setIsDrilling(true)
    setDrillError(null)
    setComparison(null)
    try {
      const response = await fetch('/api/insights/analysis/drill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          analysisSpec: current.analysisSpec,
          contextDimension: selectedRow.dimension,
          contextValue: selectedRow.value,
          nextDimension,
        }),
      })
      const payload: unknown = await response.json()
      const parsed = readDrillPayload(payload)
      if (!response.ok || !parsed) throw new Error(labels.drill)
      setSteps((existing) => [...existing, { ...parsed, context: selectedRow }])
      setSelectedRow(null)
      setNextDimension('')
    } catch {
      setDrillError(labels.drill)
    } finally {
      setIsDrilling(false)
    }
  }

  function handleBack(): void {
    setSteps((existing) => existing.length > 1 ? existing.slice(0, -1) : existing)
    setSelectedRow(null)
    setNextDimension('')
    setComparison(null)
    setComparisonError(null)
  }

  function handleReset(): void {
    setSteps((existing) => existing.length > 0 ? existing.slice(0, 1) : existing)
    setSelectedRow(null)
    setNextDimension('')
    setComparison(null)
    setComparisonError(null)
  }

  async function handleCompare(): Promise<void> {
    if (!current || !currentResultDimension || !leftValue || !rightValue || leftValue === rightValue) return
    const comparisonSpec: AnalysisSpecV1 = {
      ...current.analysisSpec,
      dimensions: comparisonBreakdown ? [comparisonBreakdown] : [],
      presentation: comparisonBreakdown && current.analysisSpec.presentation === 'kpi' ? 'auto' : current.analysisSpec.presentation,
    }
    setIsComparing(true)
    setComparisonError(null)
    try {
      const response = await fetch('/api/insights/analysis/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          analysisSpec: comparisonSpec,
          comparisonDimension: currentResultDimension,
          comparisonValues: [leftValue, rightValue],
        }),
      })
      const payload: unknown = await response.json()
      const parsed = readComparisonPayload(payload)
      if (!response.ok || !parsed) throw new Error(labels.compareFailed)
      setComparison(parsed)
    } catch {
      setComparison(null)
      setComparisonError(labels.compareFailed)
    } finally {
      setIsComparing(false)
    }
  }

  if (!current) return <EmptyState title={labels.canvas.noResults} />

  return (
    <div className="space-y-6" data-analysis-exploration="v1">
      <Surface className="p-4" data-analysis-context="true">
        <nav aria-label={labels.contextTitle}>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <li className="font-semibold text-foreground">{labels.workforce}</li>
            {steps.slice(1).map((step, index) => step.context ? (
              <li className="flex flex-wrap items-center gap-x-2" key={`${step.context.dimension}-${step.context.value}-${index}`}>
                <span aria-hidden="true">›</span>
                <span className="font-medium text-foreground">{dimensionLabel(step.context.dimension, labels)}: {step.context.value}</span>
                <span aria-hidden="true">›</span>
                <span>{currentDimension(step) ? dimensionLabel(currentDimension(step) as AnalysisDimensionKey, labels) : labels.workforce}</span>
              </li>
            ) : null)}
          </ol>
        </nav>
        <p className="mt-2 text-xs text-muted-foreground">{labels.contextDescription}</p>
        {steps.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={handleBack} size="sm" type="button" variant="secondary">{labels.back}</Button>
            <Button onClick={handleReset} size="sm" type="button" variant="ghost">{labels.reset}</Button>
          </div>
        ) : null}
      </Surface>

      <LiquidCanvas labels={labels.canvas} onRowSelect={selectRow} result={current.result} />

      {selectedRow ? (
        <Surface className="p-5" data-analysis-drill="true">
          <SectionHeader description={`${labels.drillDescription} ${selectedRow.value}`} title={labels.drillTitle} />
          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <FormField control={<DropdownSelect onChange={(event) => setNextDimension(event.target.value as AnalysisDimensionKey | '')} searchable value={nextDimension}>
              <option value="">{labels.drillInto}</option>
              {drillDimensions.map((dimension) => <option key={dimension} value={dimension}>{dimensionLabel(dimension, labels)}</option>)}
            </DropdownSelect>} label={labels.drillInto} />
            <Button disabled={!nextDimension} loading={isDrilling} onClick={() => void handleDrill()} type="button">{isDrilling ? labels.drilling : labels.drill}</Button>
          </div>
          {drillError ? <p className="mt-3 text-sm text-destructive" role="alert">{drillError}</p> : null}
        </Surface>
      ) : null}

      {currentResultDimension && currentResultValues.length >= 2 ? (
        <Surface className="p-5" data-analysis-compare="true">
          <SectionHeader description={labels.compareDescription} title={labels.compareTitle} />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FormField control={<DropdownSelect onChange={(event) => { setComparisonLeft(event.target.value); setComparison(null) }} searchable value={leftValue}>
              {currentResultValues.map((value) => <option key={`left-${value}`} value={value}>{value}</option>)}
            </DropdownSelect>} label={labels.compareLeft} />
            <FormField control={<DropdownSelect onChange={(event) => { setComparisonRight(event.target.value); setComparison(null) }} searchable value={rightValue}>
              {currentResultValues.map((value) => <option key={`right-${value}`} value={value}>{value}</option>)}
            </DropdownSelect>} label={labels.compareRight} />
            <FormField control={<DropdownSelect onChange={(event) => { setComparisonBreakdown(event.target.value as AnalysisDimensionKey | ''); setComparison(null) }} searchable value={comparisonBreakdown}>
              <option value="">{labels.compareNoBreakdown}</option>
              {ANALYSIS_DIMENSIONS.filter((dimension) => dimension !== currentResultDimension).map((dimension) => <option key={dimension} value={dimension}>{dimensionLabel(dimension, labels)}</option>)}
            </DropdownSelect>} label={labels.compareBreakdown} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{labels.compareNotPersisted}</p>
            <Button disabled={leftValue === rightValue} loading={isComparing} onClick={() => void handleCompare()} type="button">{isComparing ? labels.comparing : labels.compare}</Button>
          </div>
          {comparisonError ? <p className="mt-3 text-sm text-destructive" role="alert">{comparisonError}</p> : null}
          {comparison ? <AnalysisComparisonView labels={labels} result={comparison} /> : null}
        </Surface>
      ) : null}
    </div>
  )
}

function AnalysisComparisonView({ labels, result }: { readonly labels: AnalysisExplorationLabels; readonly result: AnalysisComparisonResult }) {
  const [left, right] = result.comparisonValues
  if (result.presentation === 'kpi') {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-3" data-analysis-comparison-result="kpi">
        <ComparisonMetric label={left} value={result.summary.left} />
        <ComparisonMetric label={right} value={result.summary.right} />
        <ComparisonMetric label={labels.difference} value={result.summary.difference} />
      </div>
    )
  }

  return (
    <div className="mt-5" data-analysis-comparison-result="table">
      <DataTableComparison labels={labels} result={result} />
    </div>
  )
}

function ComparisonMetric({ label, value }: { readonly label: string; readonly value: number }) {
  return <div className="border border-subtle p-4"><p className="text-sm text-muted-foreground">{label}</p><output className="mt-2 block text-2xl font-semibold tabular-nums text-foreground">{value}</output></div>
}

function DataTableComparison({ labels, result }: { readonly labels: AnalysisExplorationLabels; readonly result: AnalysisComparisonResult }) {
  const [left, right] = result.comparisonValues
  return (
    <DataTableShell caption={labels.compareTitle} state={result.rows.length > 0 ? 'ready' : 'empty'} stateContent={<EmptyState title={labels.noComparisonOptions} />}>
        <thead>
          <tr className="border-b border-subtle text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium" scope="col">{result.breakdownDimension ? dimensionLabel(result.breakdownDimension, labels) : labels.canvas.dimension}</th>
            <th className="px-4 py-3 font-medium" scope="col">{left}</th>
            <th className="px-4 py-3 font-medium" scope="col">{right}</th>
            <th className="px-4 py-3 font-medium" scope="col">{labels.difference}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle">
          {result.rows.map((row, index) => <tr key={`${row.dimension ?? 'unknown'}-${index}`}>
            <td className="px-4 py-3 text-foreground">{row.dimension ?? labels.canvas.unknown}</td>
            <td className="px-4 py-3 tabular-nums text-foreground">{row.left}</td>
            <td className="px-4 py-3 tabular-nums text-foreground">{row.right}</td>
            <td className="px-4 py-3 tabular-nums text-foreground">{row.difference > 0 ? `+${row.difference}` : row.difference}</td>
          </tr>)}
        </tbody>
    </DataTableShell>
  )
}

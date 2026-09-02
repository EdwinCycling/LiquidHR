import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import type { AnalysisResultV2 } from '@/lib/insights/analysis-result-v2'
import type { AnalysisEmploymentType, AnalysisV2DimensionKey } from '@/lib/insights/analysis-semantic-layer'

export interface AnalysisV2CanvasLabels {
  readonly title: string
  readonly summary: string
  readonly table: string
  readonly headcount: string
  readonly comparisonHeadcount: string
  readonly delta: string
  readonly deltaPct: string
  readonly unknown: string
  readonly noResults: string
  readonly unavailable: string
  readonly department: string
  readonly job: string
  readonly employmentType: string
  readonly employmentTypeLabels: Readonly<Record<AnalysisEmploymentType, string>>
}

function dimensionLabel(dimension: AnalysisV2DimensionKey, labels: AnalysisV2CanvasLabels): string {
  switch (dimension) {
    case 'department': return labels.department
    case 'job': return labels.job
    case 'employment_type': return labels.employmentType
  }
}

function display(dimension: AnalysisV2DimensionKey, value: string | null | undefined, labels: AnalysisV2CanvasLabels): string {
  if (dimension === 'employment_type' && value !== null && value !== undefined && value in labels.employmentTypeLabels) {
    return labels.employmentTypeLabels[value as AnalysisEmploymentType]
  }
  return value ?? labels.unknown
}

export function AnalysisV2Canvas({ labels, result }: { readonly labels: AnalysisV2CanvasLabels; readonly result: AnalysisResultV2 }) {
  const isComparison = result.comparison !== null
  const isKpi = result.presentationHints.preferred === 'kpi' && result.dimensions.length === 0
  if (result.metadata.complete !== true) {
    return <EmptyState title={labels.unavailable} />
  }

  return (
    <section aria-label={labels.title} className="space-y-4" data-liquid-canvas="v2">
      <SectionHeader description={labels.summary} title={labels.title} />
      {isKpi ? (
        <Surface className="p-5" data-liquid-canvas-view="v2-kpi">
          <p className="text-sm text-muted-foreground">{labels.headcount}</p>
          <output className="mt-2 block text-3xl font-semibold tracking-tight text-foreground">{result.summary.headcount}</output>
        </Surface>
      ) : (
        <DataTableShell caption={labels.table} state={result.rows.length > 0 ? 'ready' : 'empty'} stateContent={<EmptyState title={labels.noResults} />}>
          <thead>
            <tr className="border-b border-subtle text-xs uppercase tracking-wide text-muted-foreground">
              {result.dimensions.map((dimension) => <th className="px-4 py-3 font-medium" key={dimension} scope="col">{dimensionLabel(dimension, labels)}</th>)}
              <th className="px-4 py-3 font-medium" scope="col">{labels.headcount}</th>
              {isComparison ? <><th className="px-4 py-3 font-medium" scope="col">{labels.comparisonHeadcount}</th><th className="px-4 py-3 font-medium" scope="col">{labels.delta}</th><th className="px-4 py-3 font-medium" scope="col">{labels.deltaPct}</th></> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {result.rows.map((row, index) => <tr key={index}>
              {result.dimensions.map((dimension) => <td className="px-4 py-3 text-foreground" key={dimension}>{display(dimension, row.values.dimensions[dimension], labels)}</td>)}
              <td className="px-4 py-3 tabular-nums text-foreground">{row.values.headcount}</td>
              {isComparison ? <><td className="px-4 py-3 tabular-nums text-foreground">{row.values.comparisonHeadcount ?? 0}</td><td className="px-4 py-3 tabular-nums text-foreground">{row.values.delta !== undefined && row.values.delta > 0 ? `+${row.values.delta}` : row.values.delta ?? 0}</td><td className="px-4 py-3 tabular-nums text-foreground">{row.values.deltaPct === null || row.values.deltaPct === undefined ? labels.unknown : row.values.deltaPct}</td></> : null}
            </tr>)}
          </tbody>
        </DataTableShell>
      )}
    </section>
  )
}

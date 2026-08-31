import type { ReactNode } from 'react'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { SectionHeader } from '@/components/patterns/section-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { AnalysisResult, AnalysisResultColumnKey, AnalysisResultRow } from '@/lib/insights/analysis-result'

export interface LiquidCanvasLabels {
  readonly title: string
  readonly summary: string
  readonly table: string
  readonly dimension: string
  readonly headcount: string
  readonly noResults: string
  readonly unknown: string
  readonly fallback: string
  readonly selectRow: string
}

function columnLabel(key: AnalysisResultColumnKey, labels: LiquidCanvasLabels): string {
  switch (key) {
    case 'dimension':
      return labels.dimension
    case 'headcount':
      return labels.headcount
  }
}

function cellValue(key: AnalysisResultColumnKey, row: AnalysisResultRow, labels: LiquidCanvasLabels): ReactNode {
  switch (key) {
    case 'dimension':
      return row.values.dimension ?? labels.unknown
    case 'headcount':
      return String(row.values.headcount)
  }
}

export function LiquidCanvas({ labels, onRowSelect, result }: { labels: LiquidCanvasLabels; onRowSelect?: (row: AnalysisResultRow) => void; result: AnalysisResult }) {
  const showKpi = result.presentationHints.preferred === 'kpi' && result.dimensions.length === 0
  const showFallback = result.presentationHints.preferred === 'unsupported'
  const emptyDimensionResult = result.dimensions.length > 0 && result.rows.length === 0

  return (
    <section aria-label={labels.title} className="space-y-4" data-liquid-canvas="v1">
      <SectionHeader description={labels.summary} title={labels.title} />
      {showKpi ? (
        <Surface className="p-5" data-liquid-canvas-view="kpi">
          <p className="text-sm text-muted-foreground">{labels.headcount}</p>
          <output className="mt-2 block text-3xl font-semibold tracking-tight text-foreground">{String(result.summary.headcount)}</output>
        </Surface>
      ) : (
        <div className="space-y-3" data-liquid-canvas-view="table">
          {showFallback ? <p className="text-sm text-muted-foreground" data-liquid-canvas-fallback="true" role="status">{labels.fallback}</p> : null}
          <DataTableShell
            caption={labels.table}
            state={emptyDimensionResult ? 'empty' : 'ready'}
            stateContent={<EmptyState title={labels.noResults} />}
          >
            <thead>
              <tr className="border-b border-subtle text-xs uppercase tracking-wide text-muted-foreground">
                {result.columns.map((column) => <th className="px-4 py-3 font-medium" key={column.key} scope="col">{columnLabel(column.key, labels)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {result.rows.map((row, rowIndex) => (
                <tr key={`${row.values.dimension ?? 'unknown'}-${rowIndex}`}>
                  {result.columns.map((column) => <td className="px-4 py-3 text-foreground" key={column.key}>
                    {column.key === 'dimension' && onRowSelect && row.values.dimension !== null && row.values.dimension !== undefined ? (
                      <button
                        aria-label={`${labels.selectRow}: ${row.values.dimension}`}
                        className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        onClick={() => onRowSelect(row)}
                        type="button"
                      >
                        {cellValue(column.key, row, labels)}
                      </button>
                    ) : cellValue(column.key, row, labels)}
                  </td>)}
                </tr>
              ))}
            </tbody>
          </DataTableShell>
        </div>
      )}
    </section>
  )
}

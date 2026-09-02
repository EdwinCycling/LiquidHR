import type { AnalysisV2DimensionKey } from './analysis-semantic-layer'
import type { AnalysisV2Comparison, AnalysisV2Period, AnalysisSpecV2 } from './analysis-spec-v2'

export type AnalysisResultV2ColumnKey = AnalysisV2DimensionKey | 'headcount' | 'comparisonHeadcount' | 'delta' | 'deltaPct'

export interface AnalysisResultV2Column {
  readonly key: AnalysisResultV2ColumnKey
  readonly dataType: 'string' | 'integer' | 'number'
}

export interface AnalysisResultV2Row {
  readonly values: {
    readonly dimensions: Readonly<Partial<Record<AnalysisV2DimensionKey, string | null>>>
    readonly headcount: number
    readonly comparisonHeadcount?: number
    readonly delta?: number
    readonly deltaPct?: number | null
  }
}

export interface AnalysisResultV2 {
  readonly version: 2
  readonly source: 'workforce'
  readonly entity: 'employees'
  readonly measures: readonly ['headcount']
  readonly dimensions: readonly AnalysisV2DimensionKey[]
  readonly period: AnalysisV2Period
  readonly comparison: AnalysisV2Comparison | null
  readonly metadata: {
    readonly complete: true
    readonly matchedEmployeeCount: number
    readonly comparisonMatchedEmployeeCount?: number
    readonly groupCount: number
  }
  readonly columns: readonly AnalysisResultV2Column[]
  readonly rows: readonly AnalysisResultV2Row[]
  readonly summary: {
    readonly headcount: number
    readonly comparisonHeadcount?: number
    readonly delta?: number
    readonly deltaPct?: number | null
  }
  readonly presentationHints: {
    readonly preferred: 'kpi' | 'table' | 'comparison' | 'unsupported'
    readonly fallback: 'table'
  }
}

export type AnalysisResultAny = AnalysisResultV2

export function resultDimensions(spec: AnalysisSpecV2): readonly AnalysisV2DimensionKey[] {
  return spec.dimensions
}

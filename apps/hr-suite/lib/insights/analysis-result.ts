import type {
  AnalysisDimensionKey,
  AnalysisEntityKey,
  AnalysisMeasureKey,
  AnalysisSourceKey,
} from './analysis-semantic-layer'

export type AnalysisResultColumnKey = 'dimension' | 'headcount'
export type AnalysisResultDataType = 'string' | 'integer'
export type AnalysisResultPresentation = 'kpi' | 'table' | 'unsupported'

export interface AnalysisResultColumn {
  readonly key: AnalysisResultColumnKey
  readonly dataType: AnalysisResultDataType
}

export interface AnalysisResultRow {
  readonly values: {
    readonly dimension?: string | null
    readonly headcount: number
  }
}

export interface AnalysisResult {
  readonly version: 1
  readonly source: AnalysisSourceKey
  readonly entity: AnalysisEntityKey
  readonly measures: readonly [AnalysisMeasureKey]
  readonly dimensions: readonly AnalysisDimensionKey[]
  readonly metadata: {
    readonly matchedRecordCount: number
    readonly groupCount: number
  }
  readonly columns: readonly AnalysisResultColumn[]
  readonly rows: readonly AnalysisResultRow[]
  readonly summary: {
    readonly headcount: number
  }
  readonly presentationHints: {
    readonly preferred: AnalysisResultPresentation
    readonly fallback: 'table'
  }
}

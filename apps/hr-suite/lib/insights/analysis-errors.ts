export type AnalysisErrorCode =
  | 'ANALYSIS_SPEC_INVALID'
  | 'ANALYSIS_UNSUPPORTED_SPEC_VERSION'
  | 'ANALYSIS_UNSUPPORTED_SOURCE'
  | 'ANALYSIS_UNSUPPORTED_ENTITY'
  | 'ANALYSIS_UNSUPPORTED_MEASURE'
  | 'ANALYSIS_UNSUPPORTED_DIMENSION'
  | 'ANALYSIS_UNSUPPORTED_FILTER'
  | 'ANALYSIS_INVALID_OPERATOR'
  | 'ANALYSIS_INVALID_FILTER_VALUE'
  | 'ANALYSIS_INCOMPATIBLE_MEASURE_DIMENSION'
  | 'ANALYSIS_INCOMPATIBLE_PRESENTATION'
  | 'ANALYSIS_UNAUTHORIZED'
  | 'ANALYSIS_SCOPE_VIOLATION'

export type AnalysisErrorStatus = 400 | 403 | 500

export class AnalysisEngineError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    readonly status: AnalysisErrorStatus,
    message = code,
  ) {
    super(message)
    this.name = 'AnalysisEngineError'
  }
}

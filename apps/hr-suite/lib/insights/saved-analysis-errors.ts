export type SavedAnalysisErrorCode =
  | 'SAVED_ANALYSIS_INPUT_INVALID'
  | 'SAVED_ANALYSIS_INVALID_ID'
  | 'SAVED_ANALYSIS_NOT_FOUND'
  | 'SAVED_ANALYSIS_DEFINITION_INVALID'
  | 'SAVED_ANALYSIS_DATA_INVALID'
  | 'SAVED_ANALYSIS_READ_FAILED'
  | 'SAVED_ANALYSIS_SAVE_FAILED'
  | 'SAVED_ANALYSIS_UPDATE_FAILED'
  | 'SAVED_ANALYSIS_DELETE_FAILED'
  | 'SAVED_ANALYSIS_VERSION_UNAVAILABLE'

export type SavedAnalysisErrorStatus = 400 | 404 | 409 | 500

export class SavedAnalysisError extends Error {
  constructor(
    readonly code: SavedAnalysisErrorCode,
    readonly status: SavedAnalysisErrorStatus,
    message = code,
  ) {
    super(message)
    this.name = 'SavedAnalysisError'
  }
}

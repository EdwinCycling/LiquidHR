export class AbsenceInsightsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'AbsenceInsightsServiceError'
  }
}

export class PerformanceReviewError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'PerformanceReviewError'
  }
}

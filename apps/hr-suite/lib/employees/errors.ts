export class EmployeeServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 404 | 409 | 500,
    readonly details?: Record<string, string>,
  ) {
    super(code)
  }
}

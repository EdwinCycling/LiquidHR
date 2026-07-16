import { EmployeeServiceError } from './errors'

interface EmployeeErrorBody {
  error: string
  details?: Record<string, string>
}

export function employeeErrorPayload(error: unknown): {
  status: 400 | 404 | 409 | 500
  body: EmployeeErrorBody
} {
  if (error instanceof EmployeeServiceError) {
    return {
      status: error.status,
      body: error.details ? { error: error.code, details: error.details } : { error: error.code },
    }
  }
  return { status: 500, body: { error: 'EMPLOYEE_INTERNAL_ERROR' } }
}

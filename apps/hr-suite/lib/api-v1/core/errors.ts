import { apiJsonResponse, type ApiResponseOptions } from './responses'
import { resolveApiRequestContext, type ApiRequestContext } from './request-context'

const API_ERROR_DEFINITIONS = {
  INVALID_REQUEST: { status: 400, message: 'The request is invalid.' },
  UNAUTHORIZED: { status: 401, message: 'Authentication is required.' },
  FORBIDDEN: { status: 403, message: 'Access to this resource is not allowed.' },
  NOT_FOUND: { status: 404, message: 'The requested resource was not found.' },
  METHOD_NOT_ALLOWED: { status: 405, message: 'The HTTP method is not allowed.' },
  REQUEST_TOO_LARGE: { status: 413, message: 'The request is too large.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests.' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'The service is temporarily unavailable.' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected error occurred.' },
} as const

export type ApiErrorCode = keyof typeof API_ERROR_DEFINITIONS
export type ApiErrorStatus = (typeof API_ERROR_DEFINITIONS)[ApiErrorCode]['status']

export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: ApiErrorCode
    readonly requestId: string
  }
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: ApiErrorStatus

  constructor(code: ApiErrorCode) {
    super(API_ERROR_DEFINITIONS[code].message)
    this.name = 'ApiError'
    this.code = code
    this.status = API_ERROR_DEFINITIONS[code].status
  }
}

export class ApiValidationError extends ApiError {
  readonly issueCount: number

  constructor(issueCount = 1) {
    super('INVALID_REQUEST')
    this.name = 'ApiValidationError'
    this.issueCount = Math.max(1, Math.floor(issueCount))
  }
}

export class ApiRequestTooLargeError extends ApiError {
  constructor() {
    super('REQUEST_TOO_LARGE')
    this.name = 'ApiRequestTooLargeError'
  }
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR')
}

/**
 * Geeft het externe foutcontract terug. Interne meldingen, causes,
 * validatiefouten, stacktraces en provider-/databasedetails blijven buiten de
 * response.
 */
export function apiErrorResponse(
  error: unknown,
  options: ApiResponseOptions = {},
): Response {
  const safeError = toApiError(error)
  const context: ApiRequestContext = resolveApiRequestContext(options.context)
  const body: ApiErrorEnvelope = {
    error: {
      code: safeError.code,
      requestId: context.requestId,
    },
  }
  return apiJsonResponse(body, { ...options, context, status: safeError.status })
}

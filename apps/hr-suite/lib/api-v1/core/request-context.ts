export const API_REQUEST_ID_HEADER = 'X-Request-Id'
export const API_CORRELATION_ID_HEADER = 'X-Correlation-Id'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ApiIdFactory = () => string

export interface ApiRequestContext {
  readonly requestId: string
  readonly correlationId: string
}

export function isValidApiId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim())
}

function createApiId(idFactory: ApiIdFactory): string {
  const value = idFactory().trim().toLowerCase()
  if (!isValidApiId(value)) throw new Error('API id factory returned an invalid id.')
  return value
}

function readApiId(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim().toLowerCase() ?? null
  return value !== null && isValidApiId(value) ? value : null
}

function defaultApiIdFactory(): string {
  return globalThis.crypto.randomUUID()
}

/**
 * Bepaalt trace-identifiers op de HTTP-grens. Inkomende waarden worden alleen
 * geaccepteerd als UUID; willekeurige headerwaarden bereiken geen response of
 * log. Zonder correlation-id volgt één aanvraag het request-id.
 */
export function createApiRequestContext(
  request?: Request,
  idFactory: ApiIdFactory = defaultApiIdFactory,
): ApiRequestContext {
  const headers = request?.headers ?? new Headers()
  const requestId = readApiId(headers, API_REQUEST_ID_HEADER) ?? createApiId(idFactory)
  const correlationId = readApiId(headers, API_CORRELATION_ID_HEADER) ?? requestId

  return Object.freeze({ requestId, correlationId })
}

export function resolveApiRequestContext(context?: ApiRequestContext): ApiRequestContext {
  if (!context || !isValidApiId(context.requestId) || !isValidApiId(context.correlationId)) {
    return createApiRequestContext()
  }

  return Object.freeze({
    requestId: context.requestId.trim().toLowerCase(),
    correlationId: context.correlationId.trim().toLowerCase(),
  })
}

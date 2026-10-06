import {
  API_CORRELATION_ID_HEADER,
  API_REQUEST_ID_HEADER,
  type ApiRequestContext,
  resolveApiRequestContext,
} from './request-context'

export const API_NO_STORE_HEADER = 'Cache-Control'
export const API_NO_STORE_VALUE = 'no-store'

export interface ApiResponseOptions extends ResponseInit {
  readonly context?: ApiRequestContext
}

export function apiResponseHeaders(
  headers?: HeadersInit,
  context?: ApiRequestContext,
): Headers {
  const result = new Headers(headers)
  const resolvedContext = resolveApiRequestContext(context)

  // HR-data mag niet door browser, proxy of CDN worden opgeslagen. Zet deze
  // waarde na de caller-headers zodat een route de standaard niet verzwakt.
  result.set(API_NO_STORE_HEADER, API_NO_STORE_VALUE)
  result.set(API_REQUEST_ID_HEADER, resolvedContext.requestId)
  result.set(API_CORRELATION_ID_HEADER, resolvedContext.correlationId)
  return result
}

export function apiResponse(
  body: BodyInit | null,
  options: ApiResponseOptions = {},
): Response {
  const { context, ...init } = options
  return new Response(body, {
    ...init,
    headers: apiResponseHeaders(init.headers, context),
  })
}

export function apiJsonResponse<T>(
  body: T,
  options: ApiResponseOptions = {},
): Response {
  const serialized = JSON.stringify(body)
  if (serialized === undefined) throw new TypeError('API JSON body must be serializable.')

  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return apiResponse(serialized, { ...options, headers })
}

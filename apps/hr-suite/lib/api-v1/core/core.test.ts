import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  API_CORRELATION_ID_HEADER,
  API_NO_STORE_HEADER,
  API_REQUEST_ID_HEADER,
  ApiError,
  ApiRequestTooLargeError,
  ApiValidationError,
  apiErrorResponse,
  apiJsonResponse,
  createApiRequestContext,
  parseApiInput,
  parseApiJsonBody,
  parseApiQuery,
  strictApiObject,
} from './index'

const requestId = '11111111-1111-4111-8111-111111111111'
const correlationId = '22222222-2222-4222-8222-222222222222'

describe('API v1 request context', () => {
  it('accepts only UUID request and correlation headers', () => {
    const context = createApiRequestContext(new Request('https://example.test', {
      headers: {
        [API_REQUEST_ID_HEADER]: requestId.toUpperCase(),
        [API_CORRELATION_ID_HEADER]: correlationId,
      },
    }), () => '33333333-3333-4333-8333-333333333333')

    expect(context).toEqual({ requestId, correlationId })
  })

  it('accepts UUIDv7 trace identifiers consistently with database IDs', () => {
    const requestIdV7 = '01890f1e-7c70-7cc2-98c4-dc0c0c07398f'
    const context = createApiRequestContext(new Request('https://example.test', {
      headers: { [API_REQUEST_ID_HEADER]: requestIdV7 },
    }), () => '33333333-3333-4333-8333-333333333333')

    expect(context).toEqual({ requestId: requestIdV7, correlationId: requestIdV7 })
  })

  it('generates a request id and follows it for a missing correlation id', () => {
    const generated = '33333333-3333-4333-8333-333333333333'
    const context = createApiRequestContext(new Request('https://example.test', {
      headers: { [API_REQUEST_ID_HEADER]: 'untrusted header value' },
    }), () => generated)

    expect(context).toEqual({ requestId: generated, correlationId: generated })
  })
})

describe('API v1 responses', () => {
  it('returns JSON with no-store and trace headers', async () => {
    const response = apiJsonResponse({ ok: true }, {
      status: 200,
      context: { requestId, correlationId },
      headers: { 'Cache-Control': 'public, max-age=60', 'X-Test': 'kept' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get(API_NO_STORE_HEADER)).toBe('no-store')
    expect(response.headers.get(API_REQUEST_ID_HEADER)).toBe(requestId)
    expect(response.headers.get(API_CORRELATION_ID_HEADER)).toBe(correlationId)
    expect(response.headers.get('X-Test')).toBe('kept')
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('does not echo an invalid caller-supplied context into response headers', () => {
    const response = apiJsonResponse({ ok: true }, {
      context: { requestId: 'untrusted', correlationId: 'also-untrusted' },
    })

    expect(response.headers.get(API_REQUEST_ID_HEADER)).not.toBe('untrusted')
    expect(response.headers.get(API_CORRELATION_ID_HEADER)).not.toBe('also-untrusted')
  })

  it('redacts unknown errors and keeps the stable request id envelope', async () => {
    const response = apiErrorResponse(new Error('database secret and stack details'), {
      context: { requestId, correlationId },
    })

    expect(response.status).toBe(500)
    const body = await response.json() as unknown
    expect(body).toEqual({ error: { code: 'INTERNAL_ERROR', requestId } })
    expect(JSON.stringify(body)).not.toContain('database secret')
    expect(JSON.stringify(body)).not.toContain('stack details')
    expect(response.headers.get(API_NO_STORE_HEADER)).toBe('no-store')
  })

  it('preserves safe typed status codes but never validation details', async () => {
    const response = apiErrorResponse(new ApiError('FORBIDDEN'), {
      context: { requestId, correlationId },
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: { code: 'FORBIDDEN', requestId } })
  })
})

describe('API v1 request validation', () => {
  const querySchema = strictApiObject({ status: z.enum(['active', 'archived']).optional() })
  const bodySchema = strictApiObject({ name: z.string().trim().min(1).max(40) })

  it('parses typed values and rejects unknown query fields', () => {
    const valid = parseApiQuery(new Request('https://example.test/api/v1/resource?status=active'), querySchema)
    expect(valid).toEqual({ status: 'active' })

    expect(() => parseApiQuery(new Request('https://example.test/api/v1/resource?unexpected=value'), querySchema))
      .toThrow(ApiValidationError)
  })

  it('rejects duplicate query parameters instead of silently choosing one', () => {
    expect(() => parseApiQuery(new Request('https://example.test/api/v1/resource?status=active&status=archived'), querySchema))
      .toThrow(ApiValidationError)
  })

  it('requires JSON and parses a bounded body', async () => {
    await expect(parseApiJsonBody(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    }), bodySchema)).resolves.toEqual({ name: 'Ada' })

    await expect(parseApiJsonBody(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ name: 'Ada' }),
    }), bodySchema)).rejects.toBeInstanceOf(ApiValidationError)
  })

  it('fails closed for malformed JSON, unknown body fields and oversized streams', async () => {
    await expect(parseApiJsonBody(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    }), bodySchema)).rejects.toBeInstanceOf(ApiValidationError)

    await expect(parseApiJsonBody(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', unexpected: true }),
    }), bodySchema)).rejects.toBeInstanceOf(ApiValidationError)

    await expect(parseApiJsonBody(new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    }), bodySchema, 5)).rejects.toBeInstanceOf(ApiRequestTooLargeError)
  })

  it('reports one stable validation error for direct input parsing', () => {
    expect(() => parseApiInput({ name: ' ' }, bodySchema)).toThrow(ApiValidationError)
  })
})

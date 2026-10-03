import { describe, expect, it } from 'vitest'
import {
  API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS,
  API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS,
  apiRateLimitedResponse,
  boundedRetryAfterSeconds,
} from './rate-limit-response'

const context = {
  requestId: '11111111-1111-4111-8111-111111111111',
  correlationId: '22222222-2222-4222-8222-222222222222',
}

describe('API rate-limit response', () => {
  it('bounds Retry-After to a safe integer range and keeps the error envelope redacted', async () => {
    expect(boundedRetryAfterSeconds(0)).toBe(API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS)
    expect(boundedRetryAfterSeconds(2.2)).toBe(3)
    expect(boundedRetryAfterSeconds(Number.POSITIVE_INFINITY)).toBe(API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS)
    expect(boundedRetryAfterSeconds(10_000)).toBe(API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS)

    const response = apiRateLimitedResponse(context, 10_000)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe(String(API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS))
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RATE_LIMITED',
        requestId: context.requestId,
      },
    })
  })
})

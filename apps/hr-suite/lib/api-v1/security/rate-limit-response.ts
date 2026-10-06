import {
  apiErrorResponse,
  ApiError,
  type ApiRequestContext,
} from '@/lib/api-v1/core'

export const API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS = 1
export const API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS = 900

export function boundedRetryAfterSeconds(value: number): number {
  if (!Number.isFinite(value)) return API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS
  return Math.min(
    API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS,
    Math.max(API_RATE_LIMIT_MIN_RETRY_AFTER_SECONDS, Math.ceil(value)),
  )
}

export function apiRateLimitedResponse(
  context: ApiRequestContext,
  retryAfterSeconds: number,
): Response {
  return apiErrorResponse(new ApiError('RATE_LIMITED'), {
    context,
    headers: {
      'Retry-After': String(boundedRetryAfterSeconds(retryAfterSeconds)),
    },
  })
}

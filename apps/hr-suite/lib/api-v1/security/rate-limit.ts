import {
  API_RATE_LIMIT_RESOURCE_KEYS,
  type ApiRateLimitResource,
} from './resources'

export { API_RATE_LIMIT_RESOURCE_KEYS }
export type { ApiRateLimitResource }

export const API_RATE_LIMIT_RPC_NAME = 'consume_api_rate_limit' as const
export const API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS = 900

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_CLIENT_ID_LENGTH = 128
const MAX_REMAINING = 1_000_000_000

export interface ApiRateLimitRpcResult {
  readonly data: unknown
  readonly error: unknown
}

/**
 * This role marker is deliberate. A service-role client must never be passed
 * to the request-path limiter. The production adapter has no service-role
 * fallback and only accepts a wrapper explicitly bound to authenticated RLS.
 */
export interface AuthenticatedApiRateLimitRpcClient {
  readonly role: 'authenticated'
  rpc(name: string, args: Record<string, unknown>): Promise<ApiRateLimitRpcResult>
}

export interface ApiRateLimitInput {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly resource: ApiRateLimitResource
  readonly oauthClientId: string
}

export interface ApiRateLimitDecision {
  readonly allowed: boolean
  readonly remaining: number
  readonly retryAfterSeconds?: number
}

export interface AtomicApiRateLimiter {
  consume(input: ApiRateLimitInput): Promise<ApiRateLimitDecision>
}

export class ApiRateLimitUnavailableError extends Error {
  readonly status = 503
  readonly code = 'API_RATE_LIMIT_UNAVAILABLE' as const

  constructor() {
    super('The API rate limiter is unavailable.')
    this.name = 'ApiRateLimitUnavailableError'
  }
}

export class ApiRateLimitConfigurationError extends Error {
  readonly status = 500
  readonly code = 'API_RATE_LIMIT_CONFIGURATION_INVALID' as const

  constructor() {
    super('The API rate limiter configuration is invalid.')
    this.name = 'ApiRateLimitConfigurationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

function isResource(value: unknown): value is ApiRateLimitResource {
  return typeof value === 'string' && (API_RATE_LIMIT_RESOURCE_KEYS as readonly string[]).includes(value)
}

function isSafeClientId(value: string): boolean {
  return value.length > 0
    && value.length <= MAX_CLIENT_ID_LENGTH
    && value.trim() === value
    && !/[\u0000-\u0020\u007f-\u009f]/u.test(value)
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_REMAINING
}

function validateInput(input: ApiRateLimitInput): void {
  if (!isUuid(input.tenantId) || !isUuid(input.hrGroupId) || !isResource(input.resource) || !isSafeClientId(input.oauthClientId)) {
    throw new ApiRateLimitConfigurationError()
  }
}

function parseDecision(value: unknown): ApiRateLimitDecision {
  if (!isRecord(value) || typeof value.allowed !== 'boolean' || !isSafeNonNegativeInteger(value.remaining)) {
    throw new ApiRateLimitUnavailableError()
  }

  if (value.allowed) return { allowed: true, remaining: value.remaining }

  if (!isSafeNonNegativeInteger(value.retryAfterSeconds)
    || value.retryAfterSeconds < 1
    || value.retryAfterSeconds > API_RATE_LIMIT_MAX_RETRY_AFTER_SECONDS) {
    throw new ApiRateLimitUnavailableError()
  }

  return {
    allowed: false,
    remaining: value.remaining,
    retryAfterSeconds: value.retryAfterSeconds,
  }
}

/**
 * Production adapter for a database-side atomic limiter. The SQL function is
 * responsible for policy lookup, actor derivation from auth.uid(), client
 * claim binding, group membership and the atomic bucket update. This adapter
 * intentionally does not accept a clock, actor id, IP address or quota.
 */
export class PostgresApiRateLimiter implements AtomicApiRateLimiter {
  constructor(private readonly client: AuthenticatedApiRateLimitRpcClient) {
    if (client.role !== 'authenticated') throw new ApiRateLimitConfigurationError()
  }

  async consume(input: ApiRateLimitInput): Promise<ApiRateLimitDecision> {
    validateInput(input)

    let result: ApiRateLimitRpcResult
    try {
      result = await this.client.rpc(API_RATE_LIMIT_RPC_NAME, {
        requested_tenant_id: input.tenantId,
        requested_hr_group_id: input.hrGroupId,
        requested_resource_key: input.resource,
        requested_oauth_client_id: input.oauthClientId,
      })
    } catch {
      throw new ApiRateLimitUnavailableError()
    }

    if (result.error !== null && result.error !== undefined) throw new ApiRateLimitUnavailableError()
    return parseDecision(result.data)
  }
}

import 'server-only'

import {
  API_RATE_LIMIT_RESOURCE_KEYS,
  type ApiRateLimitResource,
} from './rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

export const API_READ_AUDIT_RPC_NAME = 'record_api_read_audit' as const

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_CLIENT_ID_LENGTH = 128

export type ApiReadAuditOutcome = 'ALLOWED' | 'DENIED' | 'RATE_LIMITED'

type TrustedApiReadAuditRpcClient = {
  readonly role: 'service_role'
  rpc(name: string, args: Record<string, unknown>): Promise<{ readonly data: unknown; readonly error: unknown }>
}

/**
 * Typed allowlist for the trusted server-only canonical READ-audit RPC. Only
 * the route supplies the actor, outcome and status after it has authenticated,
 * authorized, limited, read and projected the resource. The database RPC is
 * executable only by service_role; the ordinary bearer/RLS client cannot call
 * it. This privileged client is wrapped to expose `rpc` only and is never
 * used to read HR data.
 */
export interface ApiReadAuditRpcPayload extends Record<string, unknown> {
  readonly requested_tenant_id: string
  readonly requested_actor_user_id: string
  readonly requested_hr_group_id: string
  readonly requested_administration_id: string | null
  readonly requested_resource_key: ApiRateLimitResource
  readonly requested_oauth_client_id: string
  readonly requested_correlation_id: string
  readonly requested_outcome: ApiReadAuditOutcome
  readonly requested_status_code: number
}

export interface ApiReadAuditInput {
  readonly tenantId: string
  readonly actorUserId: string
  readonly hrGroupId: string
  readonly administrationId?: string | null
  readonly resource: ApiRateLimitResource
  readonly oauthClientId: string
  readonly correlationId: string
  readonly outcome: ApiReadAuditOutcome
  readonly statusCode: number
}

export interface ApiReadAuditWriter {
  record(input: ApiReadAuditInput): Promise<void>
}

export class ApiReadAuditUnavailableError extends Error {
  readonly status = 503
  readonly code = 'API_READ_AUDIT_UNAVAILABLE' as const

  constructor() {
    super('The API read audit is unavailable.')
    this.name = 'ApiReadAuditUnavailableError'
  }
}

export class ApiReadAuditConfigurationError extends Error {
  readonly status = 500
  readonly code = 'API_READ_AUDIT_CONFIGURATION_INVALID' as const

  constructor() {
    super('The API read audit configuration is invalid.')
    this.name = 'ApiReadAuditConfigurationError'
  }
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

function validateInput(input: ApiReadAuditInput): void {
  const validAdministration = input.administrationId === undefined
    || input.administrationId === null
    || isUuid(input.administrationId)
  const validOutcomeStatus = input.outcome === 'ALLOWED'
    ? input.statusCode >= 200 && input.statusCode < 300
    : input.outcome === 'DENIED'
      ? input.statusCode === 403 || input.statusCode === 404
      : input.statusCode === 429
  if (!isUuid(input.tenantId)
    || !isUuid(input.actorUserId)
    || !isUuid(input.hrGroupId)
    || !validAdministration
    || !isResource(input.resource)
    || !isSafeClientId(input.oauthClientId)
    || !isUuid(input.correlationId)
    || !Number.isSafeInteger(input.statusCode)
    || input.statusCode < 100
    || input.statusCode > 599
    || !validOutcomeStatus) {
    throw new ApiReadAuditConfigurationError()
  }
}

class PostgresApiReadAuditWriter implements ApiReadAuditWriter {
  constructor(private readonly client: TrustedApiReadAuditRpcClient) {}

  async record(input: ApiReadAuditInput): Promise<void> {
    validateInput(input)

    let result: { readonly data: unknown; readonly error: unknown }
    try {
      const payload: ApiReadAuditRpcPayload = {
        requested_tenant_id: input.tenantId,
        requested_actor_user_id: input.actorUserId,
        requested_hr_group_id: input.hrGroupId,
        requested_administration_id: input.administrationId ?? null,
        requested_resource_key: input.resource,
        requested_oauth_client_id: input.oauthClientId,
        requested_correlation_id: input.correlationId,
        requested_outcome: input.outcome,
        requested_status_code: input.statusCode,
      }
      if (this.client.role !== 'service_role') throw new ApiReadAuditConfigurationError()
      result = await this.client.rpc(API_READ_AUDIT_RPC_NAME, payload)
    } catch {
      throw new ApiReadAuditUnavailableError()
    }

    if (result.error !== null && result.error !== undefined) throw new ApiReadAuditUnavailableError()
  }
}

/**
 * Creates the narrowly wrapped privileged audit sink. This admin client is
 * intentionally constructed only here and only its RPC method is retained;
 * the request-bound bearer RLS client remains the sole HR-data reader.
 */
export function createPostgresApiReadAuditWriter(): ApiReadAuditWriter {
  let trustedClient: TrustedApiReadAuditRpcClient
  try {
    const admin = createAdminClient()
    if (typeof admin.rpc !== 'function') throw new Error('Audit RPC is unavailable.')
    const rpc = admin.rpc.bind(admin) as unknown as TrustedApiReadAuditRpcClient['rpc']
    trustedClient = {
      role: 'service_role',
      rpc,
    }
  } catch {
    throw new ApiReadAuditUnavailableError()
  }
  return new PostgresApiReadAuditWriter(trustedClient)
}

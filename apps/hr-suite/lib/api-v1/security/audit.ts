import 'server-only'

import {
  API_RATE_LIMIT_RESOURCE_KEYS,
  type ApiRateLimitResource,
} from './rate-limit'
import { createAdminRpcClient, getAdminCredentialMode } from '@/lib/supabase/admin'

export const API_READ_AUDIT_RPC_NAME = 'record_api_read_audit' as const

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_CLIENT_ID_LENGTH = 128
const AUDIT_DIAGNOSTICS_PREFIX = '[DEBUG-APIAI07-AUDIT-20261009]'

export type ApiReadAuditOutcome = 'ALLOWED' | 'DENIED' | 'RATE_LIMITED' | 'FAILED'

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

function getInvalidInputFields(input: ApiReadAuditInput): string[] {
  const invalidFields: string[] = []
  const validAdministration = input.administrationId === undefined
    || input.administrationId === null
    || isUuid(input.administrationId)
  const validOutcomeStatus = input.outcome === 'ALLOWED'
    ? input.statusCode >= 200 && input.statusCode < 300
    : input.outcome === 'DENIED'
      ? input.statusCode === 403 || input.statusCode === 404
      : input.outcome === 'RATE_LIMITED'
        ? input.statusCode === 429
        : input.statusCode >= 500 && input.statusCode < 600
  if (!isUuid(input.tenantId)) invalidFields.push('tenantId')
  if (!isUuid(input.actorUserId)) invalidFields.push('actorUserId')
  if (!isUuid(input.hrGroupId)) invalidFields.push('hrGroupId')
  if (!validAdministration) invalidFields.push('administrationId')
  if (!isResource(input.resource)) invalidFields.push('resource')
  if (!isSafeClientId(input.oauthClientId)) invalidFields.push('oauthClientId')
  if (!isUuid(input.correlationId)) invalidFields.push('correlationId')
  if (!Number.isSafeInteger(input.statusCode) || input.statusCode < 100 || input.statusCode > 599) {
    invalidFields.push('statusCode')
  }
  if (!validOutcomeStatus) invalidFields.push('outcomeStatus')
  return invalidFields
}

function getSafeRpcErrorMetadata(error: unknown): { readonly code: string; readonly status: number | null } {
  if (typeof error !== 'object' || error === null) return { code: 'UNKNOWN', status: null }
  const record = error as Record<string, unknown>
  const code = typeof record.code === 'string' && /^[A-Z0-9_-]{1,32}$/iu.test(record.code)
    ? record.code
    : 'UNKNOWN'
  const status = typeof record.status === 'number'
    && Number.isSafeInteger(record.status)
    && record.status >= 100
    && record.status <= 599
    ? record.status
    : null
  return { code, status }
}

function validateInput(input: ApiReadAuditInput): void {
  const invalidFields = getInvalidInputFields(input)
  if (invalidFields.length > 0) {
    console.info(AUDIT_DIAGNOSTICS_PREFIX, {
      stage: 'input-validation',
      code: 'API_READ_AUDIT_CONFIGURATION_INVALID',
      credentialMode: getAdminCredentialMode(),
      invalidFields,
    })
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
      console.info(AUDIT_DIAGNOSTICS_PREFIX, {
        stage: 'rpc-attempt',
        credentialMode: getAdminCredentialMode(),
      })
      result = await this.client.rpc(API_READ_AUDIT_RPC_NAME, payload)
    } catch {
      console.info(AUDIT_DIAGNOSTICS_PREFIX, {
        stage: 'rpc-transport-error',
        code: 'API_READ_AUDIT_RPC_UNAVAILABLE',
        credentialMode: getAdminCredentialMode(),
      })
      throw new ApiReadAuditUnavailableError()
    }

    if (result.error !== null && result.error !== undefined) {
      console.info(AUDIT_DIAGNOSTICS_PREFIX, {
        stage: 'rpc-error',
        ...getSafeRpcErrorMetadata(result.error),
        credentialMode: getAdminCredentialMode(),
      })
      throw new ApiReadAuditUnavailableError()
    }
  }
}

/**
 * Creates the narrowly wrapped privileged audit sink. This isolated RPC client is
 * intentionally constructed only here and only its RPC method is retained;
 * the request-bound bearer RLS client remains the sole HR-data reader.
 */
export function createPostgresApiReadAuditWriter(): ApiReadAuditWriter {
  let trustedClient: TrustedApiReadAuditRpcClient
  try {
    const admin = createAdminRpcClient()
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

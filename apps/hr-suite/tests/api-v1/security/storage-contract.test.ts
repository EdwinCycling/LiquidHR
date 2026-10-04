import { describe, expect, it, vi } from 'vitest'
import { createSupabaseBearerRlsBinding } from '../../../lib/api-v1/auth/bearer-rls'
import type { DelegatedBearerRlsClient, SupabaseBearerRlsClient } from '../../../lib/api-v1/auth'
import {
  API_RATE_LIMIT_RPC_NAME,
  ApiRateLimitConfigurationError,
  ApiRateLimitUnavailableError,
  PostgresApiRateLimiter,
} from '../../../lib/api-v1/security/rate-limit'
import {
  API_READ_AUDIT_RPC_NAME,
  ApiReadAuditConfigurationError,
  PostgresApiReadAuditWriter,
} from '../../../lib/api-v1/security/audit'

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const correlationId = '33333333-3333-4333-8333-333333333333'

function brandedRls(
  rpc: ReturnType<typeof vi.fn>,
): DelegatedBearerRlsClient<SupabaseBearerRlsClient> {
  const rls = createSupabaseBearerRlsBinding({
    supabaseUrl: 'http://localhost:54321',
    publishableKey: 'sb_publishable_test',
    accessToken: 'synthetic.access-token.signature',
    supabaseUserId: 'user-1',
    identity: { issuer: 'https://issuer.synthetic.invalid', subject: 'subject-1' },
    account: { userId: 'user-1' },
  })
  vi.spyOn(rls.client, 'rpc').mockImplementation(rpc as never)
  return rls
}

describe('APIAI-01 security storage contracts', () => {
  it('keeps the atomic limiter payload bound to tenant, HR group, client and resource', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { allowed: true, remaining: 1 }, error: null })
    const rls = brandedRls(rpc)

    await new PostgresApiRateLimiter(rls).consume({
      tenantId,
      hrGroupId,
      resource: 'workforce-summary',
      oauthClientId: 'client-liquidhr-test',
    })

    expect(rpc).toHaveBeenCalledWith(API_RATE_LIMIT_RPC_NAME, {
      requested_tenant_id: tenantId,
      requested_hr_group_id: hrGroupId,
      requested_resource_key: 'workforce-summary',
      requested_oauth_client_id: 'client-liquidhr-test',
    })
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual([
      'requested_hr_group_id',
      'requested_oauth_client_id',
      'requested_resource_key',
      'requested_tenant_id',
    ])
    expect(payload).not.toHaveProperty('actor_user_id')
    expect(payload).not.toHaveProperty('ip_address')
    expect(payload).not.toHaveProperty('tokens')
    expect(payload).not.toHaveProperty('quota')
  })

  it('fails closed on an ambiguous denied limiter decision and rejects missing HR group scope', async () => {
    const unavailableRpc = vi.fn().mockResolvedValue({ data: { allowed: false, remaining: 1, retryAfterSeconds: 4 }, error: null })
    const unavailableRls = brandedRls(unavailableRpc)
    await expect(new PostgresApiRateLimiter(unavailableRls).consume({
      tenantId,
      hrGroupId,
      resource: 'workforce-summary',
      oauthClientId: 'client-liquidhr-test',
    })).rejects.toBeInstanceOf(ApiRateLimitUnavailableError)

    const invalidScopeRpc = vi.fn()
    const invalidScopeRls = brandedRls(invalidScopeRpc)
    await expect(new PostgresApiRateLimiter(invalidScopeRls).consume({
      tenantId,
      hrGroupId: 'not-a-uuid',
      resource: 'workforce-summary',
      oauthClientId: 'client-liquidhr-test',
    })).rejects.toBeInstanceOf(ApiRateLimitConfigurationError)
    expect(invalidScopeRpc).not.toHaveBeenCalled()
  })

  it('writes only typed tenant and HR-group read metadata to the canonical audit RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const rls = brandedRls(rpc)

    await new PostgresApiReadAuditWriter(rls).record({
      tenantId,
      hrGroupId,
      resource: 'development-plans',
      oauthClientId: 'client-liquidhr-test',
      correlationId,
      outcome: 'ALLOWED',
      statusCode: 200,
    })

    expect(rpc).toHaveBeenCalledWith(API_READ_AUDIT_RPC_NAME, {
      requested_tenant_id: tenantId,
      requested_hr_group_id: hrGroupId,
      requested_administration_id: null,
      requested_resource_key: 'development-plans',
      requested_oauth_client_id: 'client-liquidhr-test',
      requested_correlation_id: correlationId,
      requested_outcome: 'ALLOWED',
      requested_status_code: 200,
    })
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual([
      'requested_administration_id',
      'requested_correlation_id',
      'requested_hr_group_id',
      'requested_oauth_client_id',
      'requested_outcome',
      'requested_resource_key',
      'requested_status_code',
      'requested_tenant_id',
    ])
    expect(payload).not.toHaveProperty('action')
    expect(payload).not.toHaveProperty('entity_id')
    expect(payload).not.toHaveProperty('employee_id')
    expect(payload).not.toHaveProperty('result_count')
    expect(payload).not.toHaveProperty('request_id')
    expect(payload).not.toHaveProperty('raw_ip')
    expect(payload).not.toHaveProperty('access_token')
  })

  it('rejects an audit request without tenant or HR-group scope before invoking storage', async () => {
    const rpc = vi.fn()
    const rls = brandedRls(rpc)

    await expect(new PostgresApiReadAuditWriter(rls).record({
      tenantId,
      hrGroupId: 'invalid-group',
      resource: 'team-skills',
      oauthClientId: 'client-liquidhr-test',
      correlationId,
      outcome: 'DENIED',
      statusCode: 403,
    })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    expect(rpc).not.toHaveBeenCalled()
  })
})

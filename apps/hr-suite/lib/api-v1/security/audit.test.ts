import { describe, expect, it, vi } from 'vitest'
import {
  API_READ_AUDIT_RPC_NAME,
  ApiReadAuditConfigurationError,
  ApiReadAuditUnavailableError,
  PostgresApiReadAuditWriter,
  type AuthenticatedApiReadAuditRpcClient,
} from './audit'

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const correlationId = '33333333-3333-4333-8333-333333333333'

function client(): AuthenticatedApiReadAuditRpcClient {
  return {
    role: 'authenticated',
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}

describe('PostgresApiReadAuditWriter', () => {
  it('writes only bounded request metadata to the canonical audit RPC', async () => {
    const rpcClient = client()
    const writer = new PostgresApiReadAuditWriter(rpcClient)

    await expect(writer.record({
      tenantId,
      hrGroupId,
      administrationId: null,
      resource: 'development-plans',
      oauthClientId: 'client-liquidhr-test',
      correlationId,
      outcome: 'ALLOWED',
      statusCode: 200,
    })).resolves.toBeUndefined()

    expect(rpcClient.rpc).toHaveBeenCalledWith(API_READ_AUDIT_RPC_NAME, {
      requested_tenant_id: tenantId,
      requested_hr_group_id: hrGroupId,
      requested_administration_id: null,
      requested_resource_key: 'development-plans',
      requested_oauth_client_id: 'client-liquidhr-test',
      requested_correlation_id: correlationId,
      requested_outcome: 'ALLOWED',
      requested_status_code: 200,
    })
    const args = (rpcClient.rpc as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<string, unknown>
    expect(args).not.toHaveProperty('entity_id')
    expect(args).not.toHaveProperty('result_count')
    expect(args).not.toHaveProperty('authorization')
    expect(args).not.toHaveProperty('access_token')
  })

  it('supports denied and rate-limited outcomes without accepting free-text metadata', async () => {
    const rpcClient = client()
    const writer = new PostgresApiReadAuditWriter(rpcClient)

    await writer.record({ tenantId, hrGroupId, resource: 'team-skills', oauthClientId: 'client', correlationId, outcome: 'DENIED', statusCode: 403 })
    await writer.record({ tenantId, hrGroupId, resource: 'workforce-summary', oauthClientId: 'client', correlationId, outcome: 'RATE_LIMITED', statusCode: 429 })

    expect(rpcClient.rpc).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the audit RPC fails or returns an error', async () => {
    const rejectedClient: AuthenticatedApiReadAuditRpcClient = {
      role: 'authenticated',
      rpc: vi.fn().mockRejectedValue(new Error('audit store unavailable')),
    }
    const errorClient: AuthenticatedApiReadAuditRpcClient = {
      role: 'authenticated',
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } }),
    }

    await expect(new PostgresApiReadAuditWriter(rejectedClient).record({
      tenantId, hrGroupId, resource: 'team-skills', oauthClientId: 'client', correlationId, outcome: 'ALLOWED', statusCode: 200,
    })).rejects.toBeInstanceOf(ApiReadAuditUnavailableError)
    await expect(new PostgresApiReadAuditWriter(errorClient).record({
      tenantId, hrGroupId, resource: 'team-skills', oauthClientId: 'client', correlationId, outcome: 'ALLOWED', statusCode: 200,
    })).rejects.toBeInstanceOf(ApiReadAuditUnavailableError)
  })

  it('rejects invalid IDs, status codes and resources before the RPC', async () => {
    const rpcClient = client()
    const writer = new PostgresApiReadAuditWriter(rpcClient)
    const valid = { tenantId, hrGroupId, resource: 'team-skills' as const, oauthClientId: 'client', correlationId, outcome: 'ALLOWED' as const, statusCode: 200 }

    await expect(writer.record({ ...valid, correlationId: 'not-a-uuid' })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...valid, statusCode: 700 })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...valid, outcome: 'RATE_LIMITED', statusCode: 403 })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...valid, resource: 'unknown' as typeof valid.resource })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    expect(rpcClient.rpc).not.toHaveBeenCalled()
  })

  it('accepts UUIDv7 trace identifiers consistently with the HTTP boundary', async () => {
    const rpcClient = client()
    const writer = new PostgresApiReadAuditWriter(rpcClient)
    const valid = { tenantId, hrGroupId, resource: 'team-skills' as const, oauthClientId: 'client', correlationId: '01890f1e-7c70-7cc2-98c4-dc0c0c07398f', outcome: 'ALLOWED' as const, statusCode: 200 }

    await expect(writer.record(valid)).resolves.toBeUndefined()
    expect(rpcClient.rpc).toHaveBeenCalledTimes(1)
  })

  it('rejects a service-role wrapper', () => {
    const serviceRoleClient = {
      role: 'service_role',
      rpc: vi.fn(),
    } as unknown as AuthenticatedApiReadAuditRpcClient

    expect(() => new PostgresApiReadAuditWriter(serviceRoleClient)).toThrowError(ApiReadAuditConfigurationError)
  })
})

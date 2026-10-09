import { beforeEach, describe, expect, it, vi } from 'vitest'

const { adminRpc, adminFrom } = vi.hoisted(() => ({
  adminRpc: vi.fn<(...args: unknown[]) => Promise<{ readonly data: unknown; readonly error: unknown }>>(),
  adminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminRpcClient: () => ({
    rpc: adminRpc,
    from: adminFrom,
  }),
}))

import {
  API_READ_AUDIT_RPC_NAME,
  ApiReadAuditConfigurationError,
  ApiReadAuditUnavailableError,
  createPostgresApiReadAuditWriter,
  type ApiReadAuditInput,
} from './audit'

const tenantId = '11111111-1111-4111-8111-111111111111'
const actorUserId = '66666666-6666-4666-8666-666666666666'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const correlationId = '33333333-3333-4333-8333-333333333333'

const validInput: ApiReadAuditInput = {
  tenantId,
  actorUserId,
  hrGroupId,
  administrationId: null,
  resource: 'development-plans',
  oauthClientId: 'client-liquidhr-test',
  correlationId,
  outcome: 'ALLOWED',
  statusCode: 200,
}

describe('PostgresApiReadAuditWriter', () => {
  beforeEach(() => {
    adminRpc.mockReset()
    adminRpc.mockResolvedValue({ data: null, error: null })
    adminFrom.mockReset()
  })

  it('writes bounded, server supplied metadata through the trusted audit RPC', async () => {
    const writer = createPostgresApiReadAuditWriter()

    await expect(writer.record(validInput)).resolves.toBeUndefined()

    expect(adminRpc).toHaveBeenCalledWith(API_READ_AUDIT_RPC_NAME, {
      requested_tenant_id: tenantId,
      requested_actor_user_id: actorUserId,
      requested_hr_group_id: hrGroupId,
      requested_administration_id: null,
      requested_resource_key: 'development-plans',
      requested_oauth_client_id: 'client-liquidhr-test',
      requested_correlation_id: correlationId,
      requested_outcome: 'ALLOWED',
      requested_status_code: 200,
    })
    const args = adminRpc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(Object.keys(args).sort()).toEqual([
      'requested_actor_user_id',
      'requested_administration_id',
      'requested_correlation_id',
      'requested_hr_group_id',
      'requested_oauth_client_id',
      'requested_outcome',
      'requested_resource_key',
      'requested_status_code',
      'requested_tenant_id',
    ])
    expect(args).not.toHaveProperty('entity_id')
    expect(args).not.toHaveProperty('result_count')
    expect(args).not.toHaveProperty('request_id')
    expect(args).not.toHaveProperty('employee_id')
    expect(args).not.toHaveProperty('raw_ip')
    expect(args).not.toHaveProperty('payload')
    expect(args).not.toHaveProperty('authorization')
    expect(args).not.toHaveProperty('access_token')
    expect(adminFrom).not.toHaveBeenCalled()
  })

  it('accepts PostgreSQL UUID values without RFC version or variant bits', async () => {
    const administrationId = '00000000-0000-0000-0000-000000000001'

    await expect(createPostgresApiReadAuditWriter().record({
      ...validInput,
      administrationId,
    })).resolves.toBeUndefined()

    expect(adminRpc).toHaveBeenCalledWith(API_READ_AUDIT_RPC_NAME, expect.objectContaining({
      requested_administration_id: administrationId,
    }))
  })

  it('supports denied and rate limited outcomes without accepting free text metadata', async () => {
    const writer = createPostgresApiReadAuditWriter()

    await writer.record({ ...validInput, resource: 'team-skills', outcome: 'DENIED', statusCode: 403 })
    await writer.record({ ...validInput, resource: 'workforce-summary', outcome: 'RATE_LIMITED', statusCode: 429 })

    expect(adminRpc).toHaveBeenCalledTimes(2)
    expect(adminFrom).not.toHaveBeenCalled()
  })

  it('fails closed when the audit RPC rejects or returns an error', async () => {
    const rejectedWriter = createPostgresApiReadAuditWriter()
    adminRpc.mockRejectedValueOnce(new Error('audit store unavailable'))

    await expect(rejectedWriter.record(validInput)).rejects.toBeInstanceOf(ApiReadAuditUnavailableError)

    adminRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } })
    await expect(createPostgresApiReadAuditWriter().record(validInput)).rejects.toBeInstanceOf(ApiReadAuditUnavailableError)
    expect(adminFrom).not.toHaveBeenCalled()
  })

  it('rejects invalid actor IDs, status codes and resources before the RPC', async () => {
    const writer = createPostgresApiReadAuditWriter()

    await expect(writer.record({ ...validInput, actorUserId: 'not-a-uuid' })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...validInput, correlationId: 'not-a-uuid' })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...validInput, administrationId: 'not-a-uuid' })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...validInput, statusCode: 700 })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...validInput, statusCode: 500 })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...validInput, outcome: 'RATE_LIMITED', statusCode: 403 })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    await expect(writer.record({ ...validInput, resource: 'unknown' as typeof validInput.resource })).rejects.toBeInstanceOf(ApiReadAuditConfigurationError)
    expect(adminRpc).not.toHaveBeenCalled()
  })

  it('accepts UUIDv7 audit correlation identifiers', async () => {
    const writer = createPostgresApiReadAuditWriter()

    await expect(writer.record({
      ...validInput,
      correlationId: '01890f1e-7c70-7cc2-98c4-dc0c0c07398f',
    })).resolves.toBeUndefined()
    expect(adminRpc).toHaveBeenCalledTimes(1)
  })
})

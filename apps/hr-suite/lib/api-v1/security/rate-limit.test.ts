import { describe, expect, it, vi } from 'vitest'
import { createSupabaseBearerRlsBinding } from '@/lib/api-v1/auth/bearer-rls'
import type { DelegatedBearerRlsClient, SupabaseBearerRlsClient } from '@/lib/api-v1/auth'
import {
  API_RATE_LIMIT_RPC_NAME,
  ApiRateLimitConfigurationError,
  ApiRateLimitUnavailableError,
  PostgresApiRateLimiter,
  type ApiRateLimitInput,
  type AtomicApiRateLimiter,
} from './rate-limit'

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const input: ApiRateLimitInput = {
  tenantId,
  hrGroupId,
  resource: 'workforce-summary',
  oauthClientId: 'client-liquidhr-test',
}

function client(
  response: { readonly data: unknown; readonly error: unknown } = {
    data: { allowed: true, remaining: 4 },
    error: null,
  },
): {
  rls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>
  rpc: ReturnType<typeof vi.fn>
} {
  const rls = createSupabaseBearerRlsBinding({
    supabaseUrl: 'http://localhost:54321',
    publishableKey: 'sb_publishable_test',
    accessToken: 'synthetic.access-token.signature',
    supabaseUserId: 'user-1',
    identity: { issuer: 'https://issuer.synthetic.invalid', subject: 'subject-1' },
    account: { userId: 'user-1' },
  })
  const rpc = vi.fn().mockResolvedValue(response)
  vi.spyOn(rls.client, 'rpc').mockImplementation(rpc as never)
  return {
    rls,
    rpc,
  }
}

describe('PostgresApiRateLimiter', () => {
  it('calls only the authenticated atomic RPC contract and parses an allowed decision', async () => {
    const rpcClient = client()
    const limiter = new PostgresApiRateLimiter(rpcClient.rls)

    await expect(limiter.consume(input)).resolves.toEqual({ allowed: true, remaining: 4 })
    expect(rpcClient.rpc).toHaveBeenCalledWith(API_RATE_LIMIT_RPC_NAME, {
      requested_tenant_id: tenantId,
      requested_hr_group_id: hrGroupId,
      requested_resource_key: 'workforce-summary',
      requested_oauth_client_id: 'client-liquidhr-test',
    })
  })

  it('preserves a bounded denied decision for a 429 response', async () => {
    const limiter = new PostgresApiRateLimiter(client({
      data: { allowed: false, remaining: 0, retryAfterSeconds: 12 },
      error: null,
    }).rls)

    await expect(limiter.consume(input)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 12,
    })
  })

  it('fails closed when the RPC is unavailable or returns an invalid decision', async () => {
    const unavailable = new PostgresApiRateLimiter(client({ data: null, error: { message: 'database unavailable' } }).rls)
    await expect(unavailable.consume(input)).rejects.toBeInstanceOf(ApiRateLimitUnavailableError)

    const malformed = new PostgresApiRateLimiter(client({ data: { allowed: false, remaining: 0, retryAfterSeconds: 0 }, error: null }).rls)
    await expect(malformed.consume(input)).rejects.toBeInstanceOf(ApiRateLimitUnavailableError)

    const ambiguous = new PostgresApiRateLimiter(client({ data: { allowed: false, remaining: 1, retryAfterSeconds: 12 }, error: null }).rls)
    await expect(ambiguous.consume(input)).rejects.toBeInstanceOf(ApiRateLimitUnavailableError)
  })

  it('rejects malformed scope or client input before calling the database', async () => {
    const rpcClient = client()
    const limiter = new PostgresApiRateLimiter(rpcClient.rls)

    await expect(limiter.consume({ ...input, tenantId: 'tenant' })).rejects.toBeInstanceOf(ApiRateLimitConfigurationError)
    await expect(limiter.consume({ ...input, oauthClientId: 'client with whitespace' })).rejects.toBeInstanceOf(ApiRateLimitConfigurationError)
    await expect(limiter.consume({ ...input, resource: 'unknown-resource' as ApiRateLimitInput['resource'] })).rejects.toBeInstanceOf(ApiRateLimitConfigurationError)
    expect(rpcClient.rpc).not.toHaveBeenCalled()
  })

  it('accepts UUIDv7 scope identifiers consistently with the HTTP boundary', async () => {
    const rpcClient = client()
    const limiter = new PostgresApiRateLimiter(rpcClient.rls)

    await expect(limiter.consume({ ...input, tenantId: '01890f1e-7c70-7cc2-98c4-dc0c0c07398f' }))
      .resolves.toEqual({ allowed: true, remaining: 4 })
    expect(rpcClient.rpc).toHaveBeenCalledTimes(1)
  })

  it('rejects service-role wrappers instead of silently bypassing RLS', () => {
    const serviceRoleClient = {
      kind: 'supabase-bearer',
      client: { role: 'service_role', rpc: vi.fn() },
      userId: 'user-1',
      identity: { issuer: 'https://issuer.synthetic.invalid', subject: 'subject-1' },
    } as unknown as DelegatedBearerRlsClient<SupabaseBearerRlsClient>

    expect(() => new PostgresApiRateLimiter(serviceRoleClient)).toThrowError(ApiRateLimitConfigurationError)
  })

  it('rejects a copied authenticated marker without the private bearer binding', () => {
    const copiedMarker = {
      role: 'authenticated',
      rpc: vi.fn(),
    } as unknown as DelegatedBearerRlsClient<SupabaseBearerRlsClient>

    expect(() => new PostgresApiRateLimiter(copiedMarker)).toThrowError(ApiRateLimitConfigurationError)
  })
})

/** Test-only deterministic double. Production has no in-memory limiter fallback. */
class DeterministicAtomicRateLimitDouble implements AtomicApiRateLimiter {
  private readonly counts = new Map<string, number>()

  constructor(private readonly burst: number) {}

  async consume(value: ApiRateLimitInput) {
    await Promise.resolve()
    const key = [value.tenantId, value.hrGroupId, value.oauthClientId, value.resource].join(':')
    const next = (this.counts.get(key) ?? 0) + 1
    this.counts.set(key, next)
    return next <= this.burst
      ? { allowed: true, remaining: this.burst - next }
      : { allowed: false, remaining: 0, retryAfterSeconds: 3 }
  }
}

describe('AtomicApiRateLimiter contract', () => {
  it('keeps a concurrent burst atomic per tenant, group, client and resource', async () => {
    const limiter = new DeterministicAtomicRateLimitDouble(3)
    const decisions = await Promise.all(Array.from({ length: 20 }, () => limiter.consume(input)))

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3)
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(17)
    expect(decisions.filter((decision) => !decision.allowed).every((decision) => decision.retryAfterSeconds === 3)).toBe(true)
  })

  it('does not share a bucket across a different resource or OAuth client', async () => {
    const limiter = new DeterministicAtomicRateLimitDouble(1)
    await expect(limiter.consume(input)).resolves.toMatchObject({ allowed: true })
    await expect(limiter.consume(input)).resolves.toMatchObject({ allowed: false })
    await expect(limiter.consume({ ...input, resource: 'team-skills' })).resolves.toMatchObject({ allowed: true })
    await expect(limiter.consume({ ...input, oauthClientId: 'another-client' })).resolves.toMatchObject({ allowed: true })
  })
})

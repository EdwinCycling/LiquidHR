import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type { AccessibleContextOptions } from '@/lib/context/server-context'
import type { ApiReadAuditInput, ApiReadAuditWriter } from '@/lib/api-v1/security/audit'
import type { ApiRateLimitDecision, AtomicApiRateLimiter } from '@/lib/api-v1/security/rate-limit'
import type { TalentSelfDevelopmentPlan } from '@/lib/talent/goal-service'
import {
  bindIdentityBridgeToSupabaseAuth,
  createLiveDelegatedAccessTokenVerifier,
  resolveIdentityBridge,
  type IdentityBridgeAccountLinkResolver,
  type IdentityBridgeGrantResolver,
  type ProviderAccessTokenVerifier,
  type VerifiedDelegatedToken,
} from '@/lib/api-v1/auth'
import {
  authenticateDelegatedBearerRequest,
  createSupabaseBearerRlsBinding,
  loadBearerAuthContext,
  type DelegatedBearerRlsClient,
  type SupabaseBearerRlsClient,
} from '@/lib/api-v1/auth/bearer-rls'
import { createSelfDevelopmentPlansApiHandler } from './development-plans-handler'

const mocks = vi.hoisted(() => ({
  loadAccessibleContextOptions: vi.fn<typeof import('@/lib/context/server-context').loadAccessibleContextOptions>(),
  requireAuthContext: vi.fn<typeof import('@/lib/auth/permissions').requireAuthContext>(),
  listSelfDevelopmentPlans: vi.fn<typeof import('@/lib/talent/goal-service').listSelfDevelopmentPlans>(),
}))

vi.mock('@/lib/context/server-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/context/server-context')>()),
  loadAccessibleContextOptions: mocks.loadAccessibleContextOptions,
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/permissions')>()),
  requireAuthContext: mocks.requireAuthContext,
}))

vi.mock('@/lib/talent/goal-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/talent/goal-service')>()),
  listSelfDevelopmentPlans: mocks.listSelfDevelopmentPlans,
}))

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const administrationId = '33333333-3333-4333-8333-333333333333'
const userId = '66666666-6666-4666-8666-666666666666'
const wrongUserId = '77777777-7777-4777-8777-777777777777'
const issuer = 'https://issuer.synthetic.invalid'
const audience = 'liquidhr-api'
const clientId = 'synthetic-api-client'
const subject = 'synthetic-employee-subject'
const accessToken = 'synthetic.access-token.signature'
const nowEpochSeconds = 1_800_000_000

const authContext: AuthContext = {
  tenantId,
  hrGroupId,
  administrationId,
  userId,
  employeeId: 'synthetic-employee-1',
  activeRoles: ['HR_ADMIN'],
  permissions: ['self:talent-goal:read'],
}

const verifiedToken: VerifiedDelegatedToken = {
  issuer,
  subject,
  audience,
  expiresAtEpochSeconds: nowEpochSeconds + 300,
  revocation: 'active',
  scopes: ['development-plans.self.read'],
  clientId,
}

const plan: TalentSelfDevelopmentPlan = {
  tenant_id: tenantId,
  employee_id: authContext.employeeId ?? '',
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  progress_percent: 40,
  status: 'ACTIVE',
  completed_at: null,
}

const tenants: AccessibleContextOptions['tenants'] = [{
  id: tenantId,
  name: 'Synthetic tenant',
  slug: 'synthetic-tenant',
  administrationMode: 'SEPARATE',
  sharingMode: 'FULLY_ISOLATED',
  hrGroups: [{
    id: hrGroupId,
    tenantId,
    code: 'SYNTHETIC',
    name: 'Synthetic group',
    description: null,
    administrations: [{ id: administrationId, code: 'SYNTHETIC', name: 'Synthetic administration' }],
  }],
}]

function permissionClient(): SupabaseBearerRlsClient {
  function resolved(data: readonly Record<string, unknown>[]) {
    return Promise.resolve({ data, error: null })
  }
  function query(data: readonly Record<string, unknown>[]) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      or: () => resolved(data),
      in: () => resolved(data),
    }
    return builder
  }
  const client = {
    from(table: string) {
      if (table === 'management_roles') return query([{ id: 'employee-role', tenant_id: tenantId }])
      if (table === 'role_permissions') return query([{ permission_id: 'self-permission' }])
      if (table === 'permissions') return query([{ code: 'self:talent-goal:read' }])
      throw new Error(`Unexpected permission query: ${table}`)
    },
  }
  return client as unknown as SupabaseBearerRlsClient
}

function createRequest(): Request {
  return new Request('https://api.synthetic.invalid/api/v1/development-plans', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

function setup(input: { readonly supabaseSubject?: string; readonly accountLinks?: number } = {}) {
  const provider: ProviderAccessTokenVerifier = {
    verify: vi.fn(async () => verifiedToken),
    isActive: vi.fn(async () => true),
  }
  const verifier = createLiveDelegatedAccessTokenVerifier(provider)
  const grantResolver: IdentityBridgeGrantResolver = {
    isActiveClient: vi.fn(async () => true),
  }
  const accountLinkResolver: IdentityBridgeAccountLinkResolver = {
    findByIssuerAndSubject: vi.fn(async (identity) => Array.from({ length: input.accountLinks ?? 1 }, () => ({
      issuer: identity.issuer,
      subject: identity.subject,
      userId,
      isActive: true,
    }))),
  }

  let currentRls: DelegatedBearerRlsClient<SupabaseBearerRlsClient> | undefined
  const rlsClientFactory = {
    create: async (bindingInput: {
      readonly accessToken: string
      readonly verifiedToken: VerifiedDelegatedToken
      readonly account: { readonly userId: string }
    }) => {
      const resolution = await resolveIdentityBridge({
        verifiedToken: bindingInput.verifiedToken,
        expectedIssuer: issuer,
        expectedAudience: audience,
        expectedClientId: clientId,
        nowEpochSeconds,
        grantResolver,
        accountLinkResolver,
      })
      const rls = createSupabaseBearerRlsBinding({
        supabaseUrl: 'http://localhost:54321',
        publishableKey: 'sb_publishable_test',
        accessToken: bindingInput.accessToken,
        supabaseUserId: bindingInput.account.userId,
        identity: resolution.identity,
        account: bindingInput.account,
        verifiedToken: bindingInput.verifiedToken,
      })
      vi.spyOn(rls.client.auth, 'getClaims').mockResolvedValue({
        data: { claims: { sub: input.supabaseSubject ?? userId } },
        error: null,
      } as Awaited<ReturnType<SupabaseBearerRlsClient['auth']['getClaims']>>)
      vi.spyOn(rls.client, 'from').mockImplementation(permissionClient().from)
      await bindIdentityBridgeToSupabaseAuth({
        resolution,
        rls,
        expectedIssuer: issuer,
        expectedAudience: audience,
        expectedClientId: clientId,
        nowEpochSeconds,
      })
      currentRls = rls
      return rls
    },
  }

  const limiter: AtomicApiRateLimiter = {
    consume: vi.fn(async (): Promise<ApiRateLimitDecision> => ({ allowed: true, remaining: 4 })),
  }
  const auditInputs: ApiReadAuditInput[] = []
  const auditWriter: ApiReadAuditWriter = {
    record: vi.fn(async (record) => {
      auditInputs.push(record)
    }),
  }
  const handler = createSelfDevelopmentPlansApiHandler({
    authenticate: async (request) => authenticateDelegatedBearerRequest({
      request: {
        headers: request.headers,
        expectedIssuer: issuer,
        expectedAudience: audience,
        expectedClientId: clientId,
        nowEpochSeconds,
        verifier,
        clientRegistrationResolver: grantResolver,
        accountLinkResolver,
      },
      rlsClientFactory,
      authContextLoader: { load: loadBearerAuthContext },
    }),
    createRateLimiter: (rls) => {
      expect(rls).toBe(currentRls)
      return limiter
    },
    createAuditWriter: () => auditWriter,
    createAuditCorrelationId: () => '55555555-5555-4555-8555-555555555555',
  })

  return { handler, provider, grantResolver, accountLinkResolver, limiter, auditInputs }
}

describe('APIAI-01 self Development Plans authentication integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadAccessibleContextOptions.mockImplementation(async (requestedUserId, supabase) => ({
      supabase: supabase as AccessibleContextOptions['supabase'],
      userId: requestedUserId ?? userId,
      tenants,
    }))
    mocks.requireAuthContext.mockResolvedValue(authContext)
    mocks.listSelfDevelopmentPlans.mockResolvedValue([plan])
  })

  it('composes verified bearer, exact identity link, Supabase sub, current AuthContext and self-only read', async () => {
    const context = setup()
    const response = await context.handler(createRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toMatchObject({
      data: [{
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 40,
        status: 'ACTIVE',
        completedAt: null,
      }],
    })
    expect(context.provider.verify).toHaveBeenCalledTimes(1)
    expect(context.provider.verify).toHaveBeenCalledWith({
      accessToken,
      expectedIssuer: issuer,
      expectedAudience: audience,
      expectedClientId: clientId,
      nowEpochSeconds,
    })
    expect(context.provider.isActive).toHaveBeenCalledTimes(1)
    expect(context.provider.isActive).toHaveBeenCalledWith({ accessToken, token: verifiedToken })
    expect(context.grantResolver.isActiveClient).toHaveBeenCalledWith({ issuer, audience, clientId })
    expect(context.accountLinkResolver.findByIssuerAndSubject).toHaveBeenCalledWith({ issuer, subject })
    expect(mocks.loadAccessibleContextOptions).toHaveBeenCalledWith(userId, expect.anything())
    const scopedClient = mocks.loadAccessibleContextOptions.mock.calls[0]?.[1]
    expect(scopedClient).toBeDefined()
    expect(mocks.requireAuthContext).toHaveBeenCalledWith(scopedClient, expect.objectContaining({
      tenant: expect.objectContaining({ id: tenantId }),
      activeHrGroup: expect.objectContaining({ id: hrGroupId }),
      activeAdministration: expect.objectContaining({ id: administrationId }),
    }))
    expect(mocks.listSelfDevelopmentPlans).toHaveBeenCalledWith({
      authContext,
      rls: expect.objectContaining({ kind: 'supabase-bearer', userId }),
    })
    expect(context.limiter.consume).toHaveBeenCalledWith({
      tenantId,
      hrGroupId,
      resource: 'development-plans',
      oauthClientId: clientId,
    })
    expect(context.auditInputs.map((record) => record.outcome)).toEqual(['ALLOWED'])
    expect(context.auditInputs[0]?.actorUserId).toBe(userId)
  })

  it('rejects duplicate identity links before building a bearer client or reading plans', async () => {
    const context = setup({ accountLinks: 2 })
    const response = await context.handler(createRequest())

    expect(response.status).toBe(401)
    expect(context.provider.verify).toHaveBeenCalledTimes(1)
    expect(context.accountLinkResolver.findByIssuerAndSubject).toHaveBeenCalledTimes(1)
    expect(mocks.loadAccessibleContextOptions).not.toHaveBeenCalled()
    expect(mocks.listSelfDevelopmentPlans).not.toHaveBeenCalled()
    expect(context.limiter.consume).not.toHaveBeenCalled()
  })

  it('rejects a Supabase auth.uid that differs from the linked LiquidHR account', async () => {
    const context = setup({ supabaseSubject: wrongUserId })
    const response = await context.handler(createRequest())

    expect(response.status).toBe(401)
    expect(mocks.loadAccessibleContextOptions).not.toHaveBeenCalled()
    expect(mocks.requireAuthContext).not.toHaveBeenCalled()
    expect(mocks.listSelfDevelopmentPlans).not.toHaveBeenCalled()
    expect(context.limiter.consume).not.toHaveBeenCalled()
    expect(context.auditInputs).toHaveLength(0)
  })
})

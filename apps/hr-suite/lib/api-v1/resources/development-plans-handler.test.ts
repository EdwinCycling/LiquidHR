import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type {
  DelegatedBearerRequestAuthentication,
  DelegatedBearerRlsClient,
  SupabaseBearerRlsClient,
  VerifiedDelegatedToken,
} from '@/lib/api-v1/auth'
import { createSupabaseBearerRlsBinding } from '@/lib/api-v1/auth/bearer-rls'
import type { ApiReadAuditInput, ApiReadAuditWriter } from '@/lib/api-v1/security/audit'
import type { ApiRateLimitDecision, AtomicApiRateLimiter } from '@/lib/api-v1/security/rate-limit'
import type { TalentSelfDevelopmentPlan } from '@/lib/talent/goal-service'
import { listSelfDevelopmentPlans } from '@/lib/talent/goal-service'
import { createSelfDevelopmentPlansApiHandler } from './development-plans-handler'

const goalService = vi.hoisted(() => ({ listSelfDevelopmentPlans: vi.fn() }))
vi.mock('@/lib/talent/goal-service', () => goalService)

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const administrationId = '33333333-3333-4333-8333-333333333333'
const userId = '66666666-6666-4666-8666-666666666666'
const issuer = 'https://issuer.synthetic.invalid'
const subject = 'employee-subject-1'
const accessToken = 'synthetic.access-token.signature'
const plan: TalentSelfDevelopmentPlan = {
  tenant_id: tenantId,
  employee_id: 'employee-1',
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  progress_percent: 40,
  status: 'ACTIVE',
  completed_at: null,
}

const authContext: AuthContext = {
  tenantId,
  hrGroupId,
  administrationId,
  userId,
  employeeId: plan.employee_id,
  activeRoles: ['HR_ADMIN'],
  permissions: ['self:talent-goal:read', 'talent-goal:read'],
}

const verifiedToken: VerifiedDelegatedToken = {
  issuer,
  subject,
  audience: 'liquid-hr-api',
  expiresAtEpochSeconds: 2_000_000_000,
  revocation: 'active',
  scopes: ['development-plans.self.read'],
  clientId: 'synthetic-client',
}

function permissionClient(selfPermissions: readonly string[]): SupabaseBearerRlsClient {
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
      if (table === 'permissions') return query(selfPermissions.map((code) => ({ code })))
      throw new Error('Unexpected permission query.')
    },
  }
  return client as unknown as SupabaseBearerRlsClient
}

function setup(selfPermissions: readonly string[] = ['self:talent-goal:read']) {
  const rls = createSupabaseBearerRlsBinding({
    supabaseUrl: 'http://localhost:54321',
    publishableKey: 'sb_publishable_test',
    accessToken,
    supabaseUserId: userId,
    identity: { issuer, subject },
    account: { userId },
    verifiedToken,
  })
  vi.spyOn(rls.client, 'from').mockImplementation(permissionClient(selfPermissions).from)

  const authentication: DelegatedBearerRequestAuthentication<SupabaseBearerRlsClient> = {
    verifiedToken,
    account: { userId },
    authContext,
    rls,
  }
  const auditInputs: ApiReadAuditInput[] = []
  const auditWriter: ApiReadAuditWriter = {
    record: vi.fn(async (input: ApiReadAuditInput) => {
      auditInputs.push(input)
    }),
  }
  const limiter: AtomicApiRateLimiter = {
    consume: vi.fn(async (): Promise<ApiRateLimitDecision> => ({ allowed: true, remaining: 8 })),
  }
  const dependencies = {
    authenticate: vi.fn(async () => authentication),
    createRateLimiter: vi.fn((requestRls: DelegatedBearerRlsClient<SupabaseBearerRlsClient>) => {
      expect(requestRls).toBe(rls)
      return limiter
    }),
    createAuditWriter: vi.fn(() => auditWriter),
    createAuditCorrelationId: () => '55555555-5555-4555-8555-555555555555',
  }
  return {
    handler: createSelfDevelopmentPlansApiHandler(dependencies),
    dependencies,
    rls,
    limiter,
    auditInputs,
  }
}

describe('createSelfDevelopmentPlansApiHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listSelfDevelopmentPlans).mockResolvedValue([plan])
  })

  it('runs the protected self resource and returns only the approved fields', async () => {
    const context = setup()
    const response = await context.handler(new Request(
      'https://api.synthetic.invalid/api/v1/development-plans',
      { headers: { authorization: `Bearer ${accessToken}` } },
    ))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const payload = await response.json() as {
      readonly data: readonly Record<string, unknown>[]
      readonly requestId: string
    }
    expect(payload.data).toEqual([{
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      progressPercent: 40,
      status: 'ACTIVE',
      completedAt: null,
    }])
    expect(Object.keys(payload.data[0] ?? {}).sort()).toEqual([
      'completedAt',
      'periodEnd',
      'periodStart',
      'progressPercent',
      'status',
    ])
    expect(listSelfDevelopmentPlans).toHaveBeenCalledWith({
      authContext,
      rls: context.rls,
    })
    expect(context.dependencies.createRateLimiter).toHaveBeenCalledWith(context.rls)
    expect(context.limiter.consume).toHaveBeenCalledWith({
      tenantId,
      hrGroupId,
      resource: 'development-plans',
      oauthClientId: 'synthetic-client',
    })
    expect(context.auditInputs.map((input) => input.outcome)).toEqual(['ALLOWED'])
    expect(context.auditInputs[0]?.actorUserId).toBe(userId)
  })

  it('does not let an HR Admin or Manager permission replace the Employee self permission', async () => {
    const context = setup(['talent-goal:read'])
    const response = await context.handler(new Request(
      'https://api.synthetic.invalid/api/v1/development-plans',
      { headers: { authorization: `Bearer ${accessToken}` } },
    ))

    expect(response.status).toBe(403)
    expect(listSelfDevelopmentPlans).not.toHaveBeenCalled()
    expect(context.auditInputs.map((input) => input.outcome)).toEqual(['DENIED'])
    expect(context.limiter.consume).not.toHaveBeenCalled()
  })
})

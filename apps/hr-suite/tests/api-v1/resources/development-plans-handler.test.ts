import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseBearerRlsBinding } from '@/lib/api-v1/auth/bearer-rls'
import type {
  DelegatedBearerRequestAuthentication,
  SupabaseBearerRlsClient,
  VerifiedDelegatedToken,
} from '@/lib/api-v1/auth'
import type { AuthContext } from '@/lib/auth/permissions'
import type { ApiReadAuditInput } from '@/lib/api-v1/security/audit'
import type { TalentSelfDevelopmentPlan } from '@/lib/talent/goal-service'
import { readSelfDevelopmentPlans } from '@/lib/api-v1/resources/development-plans'
import { selfDevelopmentPlansProjectionSchema } from '@/lib/api-v1/resources/projections'
import { createProtectedApiGetHandler } from '@/lib/api-v1/core/protected-get'

const { listSelfDevelopmentPlans } = vi.hoisted(() => ({
  listSelfDevelopmentPlans: vi.fn(),
}))

vi.mock('@/lib/talent/goal-service', () => ({ listSelfDevelopmentPlans }))

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const administrationId = '33333333-3333-4333-8333-333333333333'
const accessToken = 'synthetic.access-token.signature'
const issuer = 'https://issuer.synthetic.invalid'

const verifiedToken: VerifiedDelegatedToken = {
  issuer,
  subject: 'employee-subject',
  audience: 'liquid-hr-api',
  expiresAtEpochSeconds: 2_000_000_000,
  revocation: 'active',
  scopes: ['development-plans.self.read'],
  clientId: 'synthetic-client',
}

function permissionClient(selfPermissions: readonly string[]): SupabaseBearerRlsClient {
  function query(data: readonly Record<string, unknown>[]) {
    const result = { data, error: null }
    const builder = {
      select: () => builder,
      eq: () => builder,
      or: async () => result,
      in: async () => result,
      maybeSingle: async () => ({ data: null, error: null }),
    }
    return builder
  }

  return {
    from(table: string) {
      if (table === 'management_roles') return query([{ id: 'employee-role', tenant_id: null }])
      if (table === 'role_permissions') return query([{ permission_id: 'self-permission' }])
      if (table === 'permissions') return query(selfPermissions.map((code) => ({ code })))
      if (table === 'employee_ess_access') return query([])
      throw new Error(`Unexpected permission query: ${table}`)
    },
  } as unknown as SupabaseBearerRlsClient
}

function setup(input: {
  readonly role: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'
  readonly selfPermissions: readonly string[]
  readonly employeeId: string | null
}) {
  const userIds: Readonly<Record<'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN', string>> = {
    EMPLOYEE: '66666666-6666-4666-8666-666666666666',
    MANAGER: '77777777-7777-4777-8777-777777777777',
    HR_ADMIN: '88888888-8888-4888-8888-888888888888',
  }
  const userId = userIds[input.role]
  const authContext: AuthContext = {
    tenantId,
    hrGroupId,
    administrationId,
    userId,
    employeeId: input.employeeId,
    activeRoles: [input.role],
    permissions: input.role === 'EMPLOYEE'
      ? []
      : ['employee:read', 'talent-goal:manage'],
  }
  const rls = createSupabaseBearerRlsBinding({
    supabaseUrl: 'http://localhost:54321',
    publishableKey: 'sb_publishable_test',
    accessToken,
    supabaseUserId: userId,
    identity: { issuer, subject: verifiedToken.subject },
    account: { userId },
    verifiedToken,
  })
  vi.spyOn(rls.client, 'from').mockImplementation(permissionClient(input.selfPermissions).from)

  const authentication: DelegatedBearerRequestAuthentication<SupabaseBearerRlsClient> = {
    verifiedToken,
    account: { userId },
    authContext,
    rls,
  }
  const auditEvents: ApiReadAuditInput[] = []
  const handler = createProtectedApiGetHandler({
    resource: 'development-plans',
    requiredApiScopes: ['development-plans.self.read'],
    requiredLiquidHrPermission: 'self:talent-goal:read',
    selfOnly: true,
    read: (scope) => readSelfDevelopmentPlans({
      authContext: scope.authContext,
      rls: scope.rls,
    }),
    project: (plans) => plans,
    responseSchema: selfDevelopmentPlansProjectionSchema,
  }, {
    authenticate: async () => authentication,
    createRateLimiter: () => ({ consume: async () => ({ allowed: true, remaining: 1 }) }),
    createAuditWriter: () => ({ record: async (event) => { auditEvents.push(event) } }),
  })

  return { handler, authContext, rls, auditEvents }
}

const selfPlan = (employeeId: string): TalentSelfDevelopmentPlan => ({
  tenant_id: tenantId,
  employee_id: employeeId,
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  progress_percent: 50,
  status: 'ACTIVE',
  completed_at: null,
})

describe('APIAI-01 Development Plans protected handler and self projection', () => {
  beforeEach(() => {
    listSelfDevelopmentPlans.mockReset()
  })

  it('returns the self-only allowlist after bearer, permission, limiter, service, and runtime-schema checks', async () => {
    const employee = setup({
      role: 'EMPLOYEE',
      selfPermissions: ['self:talent-goal:read'],
      employeeId: 'employee-1',
    })
    listSelfDevelopmentPlans.mockResolvedValueOnce([selfPlan('employee-1')])

    const response = await employee.handler(new Request('http://localhost:3015/api/v1/development-plans', {
      headers: { authorization: `Bearer ${accessToken}` },
    }))
    const body: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(body).toEqual({
      data: [{
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 50,
        status: 'ACTIVE',
        completedAt: null,
      }],
      requestId: expect.any(String),
    })
    expect(listSelfDevelopmentPlans).toHaveBeenCalledWith({
      authContext: employee.authContext,
      rls: employee.rls,
    })
    expect(employee.auditEvents).toHaveLength(1)
    expect(employee.auditEvents[0]).toMatchObject({ outcome: 'ALLOWED', statusCode: 200 })
  })

  it.each([
    { role: 'MANAGER' as const, label: 'Manager' },
    { role: 'HR_ADMIN' as const, label: 'HR Admin' },
  ])('does not let $label role grants widen this self-only resource without self permission', async ({ role }) => {
    const caller = setup({
      role,
      selfPermissions: [],
      employeeId: 'employee-1',
    })

    const response = await caller.handler(new Request('http://localhost:3015/api/v1/development-plans', {
      headers: { authorization: `Bearer ${accessToken}` },
    }))

    expect(response.status).toBe(403)
    expect(listSelfDevelopmentPlans).not.toHaveBeenCalled()
    expect(caller.auditEvents).toHaveLength(1)
    expect(caller.auditEvents[0]).toMatchObject({ outcome: 'DENIED', statusCode: 403 })
  })
})

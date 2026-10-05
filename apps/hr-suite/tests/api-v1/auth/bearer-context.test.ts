import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import {
  createSupabaseBearerRlsBinding,
  loadBearerAuthContext,
  type DelegatedBearerAuthContextInput,
  type SupabaseBearerRlsClient,
} from '@/lib/api-v1/auth'

const { loadAccessibleContextOptions, requireAuthContext, selectActiveContext } = vi.hoisted(() => ({
  loadAccessibleContextOptions: vi.fn(),
  requireAuthContext: vi.fn(),
  selectActiveContext: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/permissions')>()),
  requireAuthContext,
}))
vi.mock('@/lib/context/administration-context', () => ({ selectActiveContext }))
vi.mock('@/lib/context/server-context', () => ({ loadAccessibleContextOptions }))

const accountId = 'user-123'
const identity = { issuer: 'https://issuer.synthetic.invalid', subject: 'subject-123' }
const fetchRequests: Request[] = []
const authContext: AuthContext = {
  tenantId: 'tenant-123',
  hrGroupId: 'hr-group-123',
  administrationId: 'administration-123',
  userId: accountId,
  employeeId: 'employee-123',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['employee:read'],
}

function accessTokenForSubject(subject: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: subject, exp: 4_102_444_800 })}.synthetic-signature`
}

const tenant = {
  id: 'tenant-123',
  name: 'Tenant',
  slug: 'tenant',
  administrationMode: 'SEPARATE' as const,
  sharingMode: 'FULLY_ISOLATED' as const,
  hrGroups: [{
    id: 'hr-group-123',
    tenantId: 'tenant-123',
    code: 'GROUP',
    name: 'Group',
    description: null,
    administrations: [{
      id: 'administration-123',
      code: 'ADMIN',
      name: 'Administration',
      administrationNumber: 'ADMIN',
      cocNumber: null,
      vatNumber: null,
      parentId: null,
      isActive: true,
    }],
  }],
}

function input(subject = accountId): DelegatedBearerAuthContextInput<SupabaseBearerRlsClient> {
  const binding = createSupabaseBearerRlsBinding({
    supabaseUrl: 'https://project.supabase.co',
    publishableKey: 'publishable-test-key',
    accessToken: accessTokenForSubject(subject),
    supabaseUserId: accountId,
    identity,
    account: { userId: accountId },
    fetch: async (request, init) => {
      const captured = new Request(request, init)
      fetchRequests.push(captured)
      if (captured.url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: subject }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  return {
    userId: accountId,
    identity,
    rls: binding,
  }
}

describe('loadBearerAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRequests.length = 0
    loadAccessibleContextOptions.mockResolvedValue({ supabase: input().rls.client, userId: accountId, tenants: [tenant] })
    selectActiveContext.mockReturnValue({
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, administrationMode: tenant.administrationMode, sharingMode: tenant.sharingMode },
      hrGroups: tenant.hrGroups,
      activeHrGroup: tenant.hrGroups[0],
      administrationsInActiveHrGroup: tenant.hrGroups[0].administrations,
      activeAdministration: tenant.hrGroups[0].administrations[0],
    })
    requireAuthContext.mockImplementation(async (client: SupabaseBearerRlsClient) => {
      const claims = await client.auth.getClaims()
      if (claims.error || claims.data?.claims.sub !== accountId) {
        throw new Error('Bearer-bound AuthContext claims were unavailable')
      }
      return authContext
    })
  })

  it('loads the existing AuthContext with the exact bearer-bound client and no context cookies', async () => {
    const request = input()

    await expect(loadBearerAuthContext(request)).resolves.toEqual(authContext)
    expect(fetchRequests).toHaveLength(2)
    for (const request of fetchRequests) {
      expect(request.url).toContain('/auth/v1/user')
      expect(request.headers.get('authorization')).toBe(`Bearer ${accessTokenForSubject(accountId)}`)
      expect(request.headers.get('cookie')).toBeNull()
    }
    expect(loadAccessibleContextOptions).toHaveBeenCalledWith(accountId, request.rls.client)
    expect(selectActiveContext).toHaveBeenCalledWith({ tenants: [tenant] })
    expect(requireAuthContext).toHaveBeenCalledWith(request.rls.client, expect.anything())
  })

  it('rejects when the Supabase bearer subject differs from the mapped account', async () => {
    const request = input('different-user')

    await expect(loadBearerAuthContext(request)).rejects.toThrowError(
      expect.objectContaining({ code: 'RLS_SUBJECT_MISMATCH', status: 401 }),
    )
    expect(loadAccessibleContextOptions).not.toHaveBeenCalled()
  })

  it('does not choose a tenant implicitly when bearer-backed access is ambiguous', async () => {
    const request = input()
    loadAccessibleContextOptions.mockResolvedValue({
      supabase: request.rls.client,
      userId: accountId,
      tenants: [tenant, { ...tenant, id: 'tenant-456' }],
    })

    await expect(loadBearerAuthContext(request)).rejects.toThrowError(
      expect.objectContaining({ code: 'DELEGATED_CONTEXT_SELECTION_REQUIRED', status: 409 }),
    )
    expect(selectActiveContext).not.toHaveBeenCalled()
    expect(requireAuthContext).not.toHaveBeenCalled()
  })
})

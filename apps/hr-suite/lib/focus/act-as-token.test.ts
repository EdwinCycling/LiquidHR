import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthorizationContext } = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, getRequestAuthorizationContext }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import {
  createFocusActAsToken,
  FOCUS_ACT_AS_MODE,
  requireFocusActAsStartPermission,
  resolveFocusActAsSession,
} from './act-as-token'
import type { AuthContext } from '@/lib/auth/permissions'

const ACTOR_USER_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'
const HR_GROUP_ID = '33333333-3333-4333-8333-333333333333'
const SUBJECT_EMPLOYEE_ID = '44444444-4444-4444-8444-444444444444'

function authContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: TENANT_ID,
    hrGroupId: HR_GROUP_ID,
    administrationId: null,
    userId: ACTOR_USER_ID,
    employeeId: '55555555-5555-4555-8555-555555555555',
    activeRoles: ['HR_ADMIN'],
    permissions: ['focus:act-as-employee'],
    ...overrides,
  }
}

function actAsToken(): string {
  return createFocusActAsToken({
    actorUserId: ACTOR_USER_ID,
    tenantId: TENANT_ID,
    hrGroupId: HR_GROUP_ID,
    subjectEmployeeId: SUBJECT_EMPLOYEE_ID,
    mode: FOCUS_ACT_AS_MODE,
  })
}

function scopedSupabase(subject: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: subject, error: null })
  const select = vi.fn().mockReturnThis()
  const eq = vi.fn().mockReturnThis()
  const query = { select, eq, maybeSingle }
  const from = vi.fn().mockReturnValue(query)
  return {
    client: { from } as unknown as Parameters<typeof resolveFocusActAsSession>[2],
    from,
    select,
    eq,
  }
}

const ACTIVE_SUBJECT = {
  id: SUBJECT_EMPLOYEE_ID,
  first_name: 'Test',
  birth_name: 'Medewerker',
  is_active: true,
  is_archived: false,
  deleted_at: null,
}

const mismatchedContextOverrides: Array<[string, Partial<AuthContext>]> = [
  ['actor', { userId: '11111111-1111-4111-8111-111111111112' }],
  ['tenant', { tenantId: '66666666-6666-4666-8666-666666666666' }],
  ['HR group', { hrGroupId: '77777777-7777-4777-8777-777777777777' }],
  ['Manager role', { activeRoles: ['DIRECT_MANAGER'] }],
  ['Employee role', { activeRoles: ['EMPLOYEE'] }],
  ['capability', { permissions: [] }],
]

function requestContext(activeRoles: string[], permissions: string[]) {
  return {
    context: {
      tenantId: '07249eb9-545c-883b-b26b-d52f83b4f4a1',
      hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
      administrationId: null,
      userId: 'f9157157-6527-4348-8200-57ef57e28df1',
      employeeId: '8f2c3dd8-7e7a-4e4f-82b0-1b7bbf3d0a3a',
      activeRoles,
      permissions,
    },
      supabase: {},
  }
}

describe('Focus act-as start authorization contract', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('SUPABASE_SECRET_KEY', 'act-as-test-only-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['TENANT_ADMIN', 'Tenant Admin'],
    ['HR_ADMIN', 'HR Admin'],
  ])('allows the %s persona (%s) when the existing capability is present', async (role) => {
    const context = requestContext([role], ['focus:act-as-employee'])
    getRequestAuthorizationContext.mockResolvedValue(context)

    await expect(requireFocusActAsStartPermission()).resolves.toBe(context)
  })

  it.each([
    ['EMPLOYEE', 'Employee'],
    ['DIRECT_MANAGER', 'direct manager'],
  ])('rejects the %s persona (%s) even if the capability is incorrectly present', async (role) => {
    getRequestAuthorizationContext.mockResolvedValue(requestContext([role], ['focus:act-as-employee']))

    await expect(requireFocusActAsStartPermission()).rejects.toMatchObject({ status: 403 })
  })

  it('rejects an HR persona when the capability is absent', async () => {
    getRequestAuthorizationContext.mockResolvedValue(requestContext(['HR_ADMIN'], []))

    await expect(requireFocusActAsStartPermission()).rejects.toMatchObject({ status: 403 })
  })

  it('binds an ACT-AS session to the actor and scopes its employee lookup to the same tenant and HR group', async () => {
    const query = scopedSupabase(ACTIVE_SUBJECT)

    await expect(resolveFocusActAsSession(actAsToken(), authContext(), query.client)).resolves.toMatchObject({
      actorUserId: ACTOR_USER_ID,
      tenantId: TENANT_ID,
      hrGroupId: HR_GROUP_ID,
      subjectEmployeeId: SUBJECT_EMPLOYEE_ID,
      mode: FOCUS_ACT_AS_MODE,
      subjectName: 'Test Medewerker',
    })

    expect(query.from).toHaveBeenCalledWith('employees')
    expect(query.select).toHaveBeenCalledWith('id,first_name,birth_name,is_active,is_archived,deleted_at')
    expect(query.eq).toHaveBeenNthCalledWith(1, 'tenant_id', TENANT_ID)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'hr_group_id', HR_GROUP_ID)
    expect(query.eq).toHaveBeenNthCalledWith(3, 'id', SUBJECT_EMPLOYEE_ID)
  })

  it.each(mismatchedContextOverrides)('rejects an ACT-AS token when the current %s boundary does not match', async (_label, overrides) => {
    const query = scopedSupabase(ACTIVE_SUBJECT)

    await expect(resolveFocusActAsSession(actAsToken(), authContext(overrides), query.client)).rejects.toMatchObject({ status: 403 })
    expect(query.from).not.toHaveBeenCalled()
  })

  it('denies a subject that is unavailable inside the token tenant and HR group scope', async () => {
    const query = scopedSupabase(null)

    await expect(resolveFocusActAsSession(actAsToken(), authContext(), query.client)).rejects.toMatchObject({ status: 403 })
    expect(query.eq).toHaveBeenNthCalledWith(1, 'tenant_id', TENANT_ID)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'hr_group_id', HR_GROUP_ID)
    expect(query.eq).toHaveBeenNthCalledWith(3, 'id', SUBJECT_EMPLOYEE_ID)
  })
})

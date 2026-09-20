import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthorizationContext } = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, getRequestAuthorizationContext }
})
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { requireFocusActAsStartPermission } from './act-as-token'

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
  })

  it.each([
    ['TENANT_ADMIN', 'DEV HR Admin/TENANT_ADMIN'],
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
})

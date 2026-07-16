import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, loadActiveContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadActiveContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/context/server-context', () => ({ loadActiveContext }))

import { AuthorizationError, requirePermission } from './permissions'

interface FakeClientOptions {
  actor?: { id: string; tenant_id: string } | null
  accessRoleIds?: string[]
  assignmentRoleIds?: string[]
  roleCodes?: Record<string, string>
  rolePermissions?: Record<string, string[]>
  selfPermissionCodes?: string[]
}

function createFakeClient(options: FakeClientOptions = {}) {
  let requestedRoleIds: string[] = []
  const rpc = vi.fn()

  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null }),
    },
    rpc,
    from(table: string) {
      if (table === 'user_access') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          limit: vi.fn().mockResolvedValue({
            data: (options.accessRoleIds ?? ['tenant-admin-role']).map((management_role_id) => ({
              management_role_id,
            })),
            error: null,
          }),
        }
        return builder
      }

      if (table === 'employees') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: vi.fn().mockResolvedValue({
            data: options.actor === undefined
              ? { id: 'employee-1', tenant_id: 'tenant-1' }
              : options.actor,
            error: null,
          }),
        }
        return builder
      }

      if (table === 'department_management') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          lte: () => builder,
          or: vi.fn().mockResolvedValue({
            data: (options.assignmentRoleIds ?? []).map((management_role_id) => ({ management_role_id })),
            error: null,
          }),
        }
        return builder
      }

      if (table === 'management_roles') {
        return {
          select: () => ({
            in: (_column: string, roleIds: string[]) => {
              requestedRoleIds = roleIds
              return Promise.resolve({
                data: roleIds.map((id) => ({ id, code: options.roleCodes?.[id] ?? 'TENANT_ADMIN' })),
                error: null,
              })
            },
            eq: () => ({
              is: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'employee-role' }, error: null }),
              }),
            }),
          }),
        }
      }

      if (table === 'role_permissions') {
        return {
          select: () => ({
            in: (_column: string, roleIds: string[]) => {
              requestedRoleIds = roleIds
              const permissionIds = roleIds.flatMap((roleId) => {
                if (roleId === 'employee-role') {
                  return (options.selfPermissionCodes ?? []).map((_, index) => `self-${index}`)
                }
                return (options.rolePermissions?.[roleId] ?? []).map((_, index) => `${roleId}-${index}`)
              })
              return Promise.resolve({
                data: permissionIds.map((permission_id) => ({ permission_id })),
                error: null,
              })
            },
          }),
        }
      }

      if (table === 'permissions') {
        return {
          select: () => ({
            in: () => {
              const codes = requestedRoleIds.flatMap((roleId) =>
                roleId === 'employee-role'
                  ? options.selfPermissionCodes ?? []
                  : options.rolePermissions?.[roleId] ?? [],
              )
              return Promise.resolve({ data: codes.map((code) => ({ code })), error: null })
            },
          }),
        }
      }

      throw new Error(`Onverwachte tabel in test: ${table}`)
    },
  }
}

describe('requirePermission', () => {
  beforeEach(() => {
    createClient.mockReset()
    loadActiveContext.mockReset()
    loadActiveContext.mockResolvedValue({
      tenant: {
        id: 'tenant-1',
        name: 'Liquid HR Demo Holding',
        slug: 'liquid-hr-demo-holding',
        administrationMode: 'SEPARATE',
        sharingMode: 'FULLY_ISOLATED',
      },
      administration: { id: 'admin-1', code: 'HOLDING', name: 'Holding' },
      administrations: [{ id: 'admin-1', code: 'HOLDING', name: 'Holding' }],
    })
  })

  it('behandelt een algemeen self-leesrecht niet als wildcard', async () => {
    createClient.mockResolvedValue(
      createFakeClient({
        rolePermissions: { 'tenant-admin-role': ['salary:read'] },
        selfPermissionCodes: ['self:read'],
      }),
    )

    await expect(requirePermission('salary:read', 'employee-1')).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('retourneert user-access- en afdelingsrollen gescheiden van permissions', async () => {
    createClient.mockResolvedValue(
      createFakeClient({
        assignmentRoleIds: ['manager-role'],
        roleCodes: {
          'tenant-admin-role': 'TENANT_ADMIN',
          'manager-role': 'DIRECT_MANAGER',
        },
        rolePermissions: {
          'tenant-admin-role': ['department:read'],
          'manager-role': ['employee:read'],
        },
      }),
    )

    const context = await requirePermission('department:read')

    expect(context.activeRoles).toEqual(['TENANT_ADMIN', 'DIRECT_MANAGER'])
    expect(context.permissions).toEqual(['department:read', 'employee:read'])
    expect(context.administrationId).toBe('admin-1')
  })

  it('ondersteunt een hoofdgebruiker met expliciete toegang zonder medewerkerkoppeling', async () => {
    const client = createFakeClient({
      actor: null,
      roleCodes: { 'tenant-admin-role': 'TENANT_ADMIN' },
      rolePermissions: { 'tenant-admin-role': ['department:read'] },
    })
    createClient.mockResolvedValue(client)

    await expect(requirePermission('department:read')).resolves.toMatchObject({
      employeeId: null,
      activeRoles: ['TENANT_ADMIN'],
      permissions: ['department:read'],
    })
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, loadActiveContext, hasActiveFocusPreviewToken } = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadActiveContext: vi.fn(),
  hasActiveFocusPreviewToken: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/context/server-context', () => ({ loadActiveContext }))
vi.mock('@/lib/focus/preview-token', () => ({ hasActiveFocusPreviewToken }))

import { AuthorizationError, getRequestAuthorizationContext, requireAuthContext, requirePermission, requirePermissionInContext, type AuthContext } from './permissions'

interface FakeClientOptions {
  actor?: { id: string; tenant_id: string } | null
  accessRoleIds?: string[]
  assignmentRoleIds?: string[]
  roleCodes?: Record<string, string>
  roleTenants?: Record<string, string | null>
  tenantRoleOverrides?: Record<string, string>
  rolePermissions?: Record<string, string[]>
  selfPermissionCodes?: string[]
  essStatus?: 'ACTIVE' | 'BLOCKED'
  employments?: Array<{ starts_on: string; ends_on: string | null; record_status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'; deleted_at: string | null }>
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
      if (table === 'user_access' || table === 'user_hr_group_access') {
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

      if (table === 'employee_ess_access') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: options.essStatus ?? 'ACTIVE' },
            error: null,
          }),
        }
        return builder
      }

      if (table === 'employments') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          order: () => builder,
          limit: vi.fn().mockResolvedValue({
            data: options.employments ?? [],
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
        const builder = {
          in: (column: string, values: string[]) => {
            if (column === 'id') {
              requestedRoleIds = values
              return Promise.resolve({
                data: values.map((id) => ({
                  id,
                  code: options.roleCodes?.[id] ?? 'TENANT_ADMIN',
                  tenant_id: options.roleTenants?.[id] ?? null,
                })),
                error: null,
              })
            }
            return Promise.resolve({
              data: values.flatMap((code) => {
                const id = options.tenantRoleOverrides?.[code]
                return id ? [{ id, code }] : []
              }),
              error: null,
            })
          },
          eq: () => builder,
          or: vi.fn().mockResolvedValue({ data: [{ id: 'employee-role', tenant_id: null }], error: null }),
          is: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'employee-role' }, error: null }) }),
        }
        return { select: () => builder }
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
      hrGroups: [{
        id: 'group-1',
        tenantId: 'tenant-1',
        code: 'HOLDING',
        name: 'Holding',
        description: null,
        administrations: [{ id: 'admin-1', code: 'HOLDING', name: 'Holding' }],
      }],
      activeHrGroup: {
        id: 'group-1',
        tenantId: 'tenant-1',
        code: 'HOLDING',
        name: 'Holding',
        description: null,
        administrations: [{ id: 'admin-1', code: 'HOLDING', name: 'Holding' }],
      },
      administrationsInActiveHrGroup: [{ id: 'admin-1', code: 'HOLDING', name: 'Holding' }],
      activeAdministration: { id: 'admin-1', code: 'HOLDING', name: 'Holding' },
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

  it('gebruikt de permissions van een tenantoverride zonder globale permissions te erven', async () => {
    createClient.mockResolvedValue(
      createFakeClient({
        accessRoleIds: ['global-tenant-admin'],
        roleCodes: { 'global-tenant-admin': 'TENANT_ADMIN' },
        roleTenants: { 'global-tenant-admin': null },
        tenantRoleOverrides: { TENANT_ADMIN: 'tenant-tenant-admin' },
        rolePermissions: {
          'global-tenant-admin': ['department:read', 'payroll-import:read', 'payroll-import:write'],
          'tenant-tenant-admin': ['payroll-import:read', 'payroll-import:write'],
        },
      }),
    )

    const context = await requireAuthContext()

    expect(context.activeRoles).toEqual(['TENANT_ADMIN'])
    expect(context.permissions).toEqual(['payroll-import:read', 'payroll-import:write'])
    expect(context.permissions).not.toContain('department:read')
  })

  it('bouwt een volledige context zonder een kunstmatige permissioncheck', async () => {
    createClient.mockResolvedValue(
      createFakeClient({
        assignmentRoleIds: ['manager-role'],
        roleCodes: {
          'tenant-admin-role': 'HR_MANAGER',
          'manager-role': 'DIRECT_MANAGER',
        },
        rolePermissions: {
          'tenant-admin-role': ['salary:read'],
          'manager-role': ['employee:read'],
        },
      }),
    )

    await expect(requireAuthContext()).resolves.toMatchObject({
      tenantId: 'tenant-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['HR_MANAGER', 'DIRECT_MANAGER'],
      permissions: ['salary:read', 'employee:read'],
    })
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

  it('houdt een normaal HR Admin-request geautoriseerd naast een geldige Focus-preview', async () => {
    hasActiveFocusPreviewToken.mockResolvedValue(true)
    createClient.mockResolvedValue(createFakeClient({
      roleCodes: { 'tenant-admin-role': 'HR_ADMIN' },
    }))

    await expect(getRequestAuthorizationContext()).resolves.toMatchObject({
      context: { tenantId: 'tenant-1', activeRoles: ['HR_ADMIN'] },
    })
    expect(hasActiveFocusPreviewToken).not.toHaveBeenCalled()
  })

  it('blokkeert niet-allowlisted selfservice vóór de eerste werkdag', async () => {
    createClient.mockResolvedValue(createFakeClient({
      selfPermissionCodes: ['self:employee:read', 'self:leave:read'],
      employments: [{ starts_on: '2999-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }],
    }))

    await expect(requirePermission('self:leave:read')).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('laat eigen bankrekeninggegevens toe tijdens preboarding met een exacte selfpermission', async () => {
    createClient.mockResolvedValue(createFakeClient({
      selfPermissionCodes: ['self:bank-account:read', 'self:bank-account:write'],
      employments: [{ starts_on: '2999-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }],
    }))

    await expect(requirePermission('bank-account:write', 'employee-1')).resolves.toMatchObject({
      focusExperience: 'PREBOARDING',
    })
  })

  it('blokkeert gewone Employee-selfservice zonder actief of toekomstig dienstverband', async () => {
    createClient.mockResolvedValue(createFakeClient({
      roleCodes: { 'tenant-admin-role': 'EMPLOYEE' },
      selfPermissionCodes: ['self:leave:read'],
      employments: [],
    }))

    await expect(requirePermission('self:leave:read')).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('past bestaande selfpermissions en ESS-blokkering toe op een expliciet bearergebonden client', async () => {
    const client = createFakeClient({
      roleCodes: { 'tenant-admin-role': 'EMPLOYEE' },
      selfPermissionCodes: ['self:talent-goal:read'],
      essStatus: 'ACTIVE',
      employments: [{ starts_on: '2020-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }],
    })
    const context: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
      focusExperience: 'EMPLOYEE',
    }

    await expect(requirePermissionInContext(
      client as unknown as Parameters<typeof requirePermissionInContext>[0],
      context,
      'self:talent-goal:read',
      'employee-1',
    )).resolves.toBe(context)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('weigert selftoegang als de bestaande selfpermission ontbreekt, ook wanneer AuthContext die naam bevat', async () => {
    const client = createFakeClient({
      roleCodes: { 'tenant-admin-role': 'EMPLOYEE' },
      selfPermissionCodes: ['self:employee:read'],
      essStatus: 'ACTIVE',
      employments: [{ starts_on: '2020-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }],
    })
    const context: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: ['self:talent-goal:read'],
      focusExperience: 'EMPLOYEE',
    }

    await expect(requirePermissionInContext(
      client as unknown as Parameters<typeof requirePermissionInContext>[0],
      context,
      'self:talent-goal:read',
      'employee-1',
    )).rejects.toBeInstanceOf(AuthorizationError)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('weigert selftoegang wanneer de bearercontext door employee-ESS is geblokkeerd', async () => {
    const client = createFakeClient({
      roleCodes: { 'tenant-admin-role': 'EMPLOYEE' },
      selfPermissionCodes: ['self:talent-goal:read'],
      essStatus: 'BLOCKED',
      employments: [{ starts_on: '2020-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }],
    })
    const context: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: ['self:talent-goal:read'],
      focusExperience: 'EMPLOYEE',
    }

    await expect(requirePermissionInContext(
      client as unknown as Parameters<typeof requirePermissionInContext>[0],
      context,
      'self:talent-goal:read',
      'employee-1',
    )).rejects.toBeInstanceOf(AuthorizationError)
    expect(createClient).not.toHaveBeenCalled()
  })
})

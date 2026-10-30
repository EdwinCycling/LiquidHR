import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, loadActiveContext, hasActiveFocusPreviewToken } = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadActiveContext: vi.fn(),
  hasActiveFocusPreviewToken: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/context/server-context', () => ({ loadActiveContext }))
vi.mock('@/lib/focus/preview-token', () => ({ hasActiveFocusPreviewToken }))

import { AuthorizationError, getRequestAuthorizationContext, getSelfPermissions, requireAuthContext, requirePermission, requirePermissionInContext, type AuthContext } from './permissions'

interface FakeClientOptions {
  actor?: { id: string; tenant_id: string } | null
  accessRoleIds?: string[]
  assignmentRoleIds?: string[]
  roleCodes?: Record<string, string>
  roleRows?: Record<string, { code: string; tenantId: string | null; isActive: boolean; deletedAt?: string | null }>
  rolePermissions?: Record<string, string[]>
  selfPermissionCodes?: string[]
  essStatus?: 'ACTIVE' | 'BLOCKED'
  employments?: Array<{ starts_on: string; ends_on: string | null; record_status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'; deleted_at: string | null }>
}

function createFakeClient(options: FakeClientOptions = {}) {
  let requestedRoleIds: string[] = []
  const rpc = vi.fn()
  const allRoleIds = new Set([
    'employee-role',
    ...Object.keys(options.roleCodes ?? {}),
    ...Object.keys(options.roleRows ?? {}),
    ...Object.keys(options.rolePermissions ?? {}),
    ...(options.accessRoleIds ?? ['tenant-admin-role']),
    ...(options.assignmentRoleIds ?? []),
  ])
  const roleRow = (id: string) => options.roleRows?.[id] ?? {
    code: options.roleCodes?.[id] ?? (id === 'employee-role' ? 'EMPLOYEE' : 'TENANT_ADMIN'),
    tenantId: id === 'employee-role' ? null : 'tenant-1',
    isActive: true,
    deletedAt: null,
  }

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
        const filters = new Map<string, unknown>()
        let roleIdsFilter: string[] | null = null
        let codesFilter: string[] | null = null
        let tenantScope: string | null = null
        let allowGlobalTenantScope = false
        const queryRoles = () => [...allRoleIds]
          .filter((id) => roleIdsFilter === null || roleIdsFilter.includes(id))
          .filter((id) => codesFilter === null || codesFilter.includes(roleRow(id).code))
          .filter((id) => [...filters].every(([column, value]) => {
            const row = roleRow(id)
            if (column === 'code') return row.code === value
            if (column === 'tenant_id') return row.tenantId === value
            if (column === 'is_active') return row.isActive === value
            if (column === 'deleted_at') return (row.deletedAt ?? null) === value
            return true
          }))
          .filter((id) => tenantScope === null || roleRow(id).tenantId === tenantScope || (allowGlobalTenantScope && roleRow(id).tenantId === null))
          .map((id) => ({ id, code: roleRow(id).code, tenant_id: roleRow(id).tenantId, is_active: roleRow(id).isActive, deleted_at: roleRow(id).deletedAt ?? null }))
        const result = () => ({ data: queryRoles(), error: null })
        const builder = {
          in: (column: string, values: string[]) => {
            if (column === 'id') roleIdsFilter = values
            if (column === 'code') codesFilter = values
            return builder
          },
          eq: (column: string, value: unknown) => {
            filters.set(column, value)
            return builder
          },
          or: (expression: string) => {
            const tenantMatch = expression.match(/tenant_id\.eq\.([^,)]+)/)
            if (tenantMatch?.[1]) tenantScope = tenantMatch[1]
            allowGlobalTenantScope = expression.includes('tenant_id.is.null')
            return builder
          },
          is: (column: string, value: unknown) => {
            filters.set(column, value)
            return builder
          },
          maybeSingle: vi.fn().mockImplementation(async () => ({ data: queryRoles()[0] ?? null, error: null })),
          then: (
            onfulfilled?: ((value: ReturnType<typeof result>) => unknown) | null,
            onrejected?: ((reason: unknown) => unknown) | null,
          ) => Promise.resolve(result()).then(onfulfilled, onrejected),
        }
        return { select: () => builder }
      }

      if (table === 'role_permissions') {
        return {
          select: () => ({
            in: (_column: string, roleIds: string[]) => {
              requestedRoleIds = roleIds
              const permissionIds = roleIds.flatMap((roleId) => {
                if (roleRow(roleId).code === 'EMPLOYEE') {
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
                roleRow(roleId).code === 'EMPLOYEE'
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
        roleCodes: { 'tenant-admin-role': 'EMPLOYEE' },
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

  it('laat een HR Admin de eigen medewerker lezen met de exacte bestaande adminpermissie', async () => {
    const client = createFakeClient({
      selfPermissionCodes: [],
      essStatus: 'ACTIVE',
    })
    const context: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['HR_ADMIN'],
      permissions: ['salary:read'],
      focusExperience: 'EMPLOYEE',
    }

    await expect(requirePermissionInContext(
      client as unknown as Parameters<typeof requirePermissionInContext>[0],
      context,
      'salary:read',
      'employee-1',
    )).resolves.toBe(context)
  })

  it('eist de Employee-selfpermission voor een self-only read ondanks de exacte Admin AuthContext-permission', async () => {
    const client = createFakeClient({ selfPermissionCodes: [], essStatus: 'ACTIVE' })
    const context: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['HR_ADMIN'],
      permissions: ['self:talent-goal:read'],
      focusExperience: 'EMPLOYEE',
    }

    await expect(requirePermissionInContext(
      client as unknown as Parameters<typeof requirePermissionInContext>[0],
      context,
      'self:talent-goal:read',
      'employee-1',
      { requireEmployeeSelfPermission: true },
    )).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('laat een gewone medewerker geen adminpermissie gebruiken om zichzelf te lezen', async () => {
    const client = createFakeClient({
      roleCodes: { 'tenant-admin-role': 'EMPLOYEE' },
      selfPermissionCodes: [],
      essStatus: 'ACTIVE',
    })
    const context: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: 'admin-1',
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: ['salary:read'],
      focusExperience: 'EMPLOYEE',
    }

    await expect(requirePermissionInContext(
      client as unknown as Parameters<typeof requirePermissionInContext>[0],
      context,
      'salary:read',
      'employee-1',
    )).rejects.toBeInstanceOf(AuthorizationError)
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

  it('gebruikt alleen een actieve globale roltoewijzing en een actieve tenantoverride', async () => {
    createClient.mockResolvedValue(createFakeClient({
      accessRoleIds: ['global-manager-role'],
      roleRows: {
        'global-manager-role': { code: 'DIRECT_MANAGER', tenantId: null, isActive: true },
        'tenant-manager-role': { code: 'DIRECT_MANAGER', tenantId: 'tenant-1', isActive: true },
      },
      rolePermissions: {
        'global-manager-role': ['stale-global-permission'],
        'tenant-manager-role': ['report-absence:read'],
      },
    }))

    await expect(requireAuthContext()).resolves.toMatchObject({
      activeRoles: ['DIRECT_MANAGER'],
      permissions: ['report-absence:read'],
    })
  })

  it('weigert inactieve, verwijderde en vreemde-tenantrollen uit actieve snapshots zonder globale terugval', async () => {
    createClient.mockResolvedValue(createFakeClient({
      accessRoleIds: ['inactive-tenant-manager', 'deleted-tenant-manager', 'foreign-tenant-manager'],
      assignmentRoleIds: ['inactive-assignment-manager'],
      roleRows: {
        'global-manager-role': { code: 'DIRECT_MANAGER', tenantId: null, isActive: true },
        'inactive-tenant-manager': { code: 'DIRECT_MANAGER', tenantId: 'tenant-1', isActive: false },
        'deleted-tenant-manager': { code: 'DIRECT_MANAGER', tenantId: 'tenant-1', isActive: true, deletedAt: '2026-10-29T10:00:00Z' },
        'foreign-tenant-manager': { code: 'DIRECT_MANAGER', tenantId: 'tenant-2', isActive: true },
        'inactive-assignment-manager': { code: 'HR_ADMIN', tenantId: 'tenant-1', isActive: false },
      },
      rolePermissions: {
        'global-manager-role': ['global-admin:read'],
        'inactive-tenant-manager': ['report-absence:read'],
        'deleted-tenant-manager': ['report-absence:read'],
        'foreign-tenant-manager': ['report-absence:read'],
        'inactive-assignment-manager': ['global-admin:read'],
      },
    }))

    await expect(requireAuthContext()).resolves.toMatchObject({ activeRoles: [], permissions: [] })
    await expect(requirePermission('report-absence:read')).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('behoudt Employee-selfpermissions van een actieve rol', async () => {
    const client = createFakeClient({
      roleRows: {
        'employee-role': { code: 'EMPLOYEE', tenantId: null, isActive: true },
      },
      selfPermissionCodes: ['self:leave:read'],
    })

    await expect(getSelfPermissions(
      client as unknown as Parameters<typeof getSelfPermissions>[0],
      'tenant-1',
    )).resolves.toEqual(['self:leave:read'])
  })

  it('geeft geen Employee-selfpermissions terug voor een logisch verwijderde Employee-rol', async () => {
    const client = createFakeClient({
      roleRows: {
        'employee-role': { code: 'EMPLOYEE', tenantId: null, isActive: true, deletedAt: '2026-10-29T10:00:00Z' },
      },
      selfPermissionCodes: ['self:leave:read'],
    })

    await expect(getSelfPermissions(
      client as unknown as Parameters<typeof getSelfPermissions>[0],
      'tenant-1',
    )).resolves.toEqual([])
  })
})

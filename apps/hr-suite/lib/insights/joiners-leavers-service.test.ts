import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { getJoinersLeaversReport } from './joiners-leavers-service'
import { defaultJoinersLeaversQuery } from './joiners-leavers-query'

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  permission: vi.fn(),
  directTeam: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error { readonly status = 403 },
  getRequestAuthorizationContext: mocks.authorization,
  requireHrGroupId: (context: { hrGroupId?: string }) => context.hrGroupId ?? 'HR_GROUP_MISSING',
  requirePermissionInContext: mocks.permission,
}))

vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeScope: mocks.directTeam }))

const hrContext: AuthContext = {
  tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: 'admin-a', userId: 'user-hr', employeeId: null,
  activeRoles: ['HR_ADMIN'], permissions: ['employee:read', 'report-employee-department:read'],
}
const query = { ...defaultJoinersLeaversQuery(new Date('2026-10-29T12:00:00Z')), administrationIds: ['admin-b'] }

function configure(context: AuthContext, administrationIds: string[] = ['admin-a', 'admin-b'], sourceTruncated = false): void {
  mocks.authorization.mockResolvedValue({
    supabase: { from: mocks.from },
    context,
    activeContext: { administrationsInActiveHrGroup: administrationIds.map((id) => ({ id, name: id.toUpperCase() })) },
  })
  mocks.permission.mockResolvedValue(undefined)
  mocks.directTeam.mockResolvedValue({ employeeIds: ['employee-a'], sourceTruncated, members: [] })
  mocks.from.mockReset()
}

describe('Joiners & Leavers authorization boundary', () => {
  beforeEach(() => {
    mocks.authorization.mockReset()
    mocks.permission.mockReset()
    mocks.directTeam.mockReset()
    mocks.from.mockReset()
  })

  it('denies employees before any report source read', async () => {
    configure({ ...hrContext, activeRoles: ['EMPLOYEE'], permissions: ['employee:read'] })
    await expect(getJoinersLeaversReport(defaultJoinersLeaversQuery())).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.permission).not.toHaveBeenCalled()
  })

  it('requires the merged INS-01 HR Admin permissions and rejects an administration outside the active allowlist', async () => {
    configure(hrContext, ['admin-a'])
    await expect(getJoinersLeaversReport(query)).rejects.toMatchObject({ status: 403 })
    expect(mocks.permission.mock.calls.map((call) => call[2])).toEqual(['employee:read', 'report-employee-department:read'])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps a Manager on employee:read and the authenticated direct-team administration only', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'], administrationId: 'admin-a', employeeId: 'manager-a' }
    configure(manager)
    await expect(getJoinersLeaversReport(query)).rejects.toMatchObject({ status: 403 })
    expect(mocks.directTeam).toHaveBeenCalledOnce()
    expect(mocks.permission.mock.calls.map((call) => call[2])).toEqual(['employee:read'])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a Manager whose active administration is outside the authenticated allowlist', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'], administrationId: 'admin-outside', employeeId: 'manager-a' }
    configure(manager, ['admin-a'])
    await expect(getJoinersLeaversReport(defaultJoinersLeaversQuery())).rejects.toMatchObject({ status: 403 })
    expect(mocks.directTeam).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed when the direct-team employee scope is truncated', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'], administrationId: 'admin-a', employeeId: 'manager-a' }
    configure(manager, ['admin-a', 'admin-b'], true)
    await expect(getJoinersLeaversReport(defaultJoinersLeaversQuery())).rejects.toMatchObject({ status: 403, code: 'INSIGHTS_SCOPE_LIMIT_REACHED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

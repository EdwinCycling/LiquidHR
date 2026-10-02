import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError, type AuthContext } from '@/lib/auth/permissions'
import { requireComponentLibraryAccess } from './component-library-access'

const context: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
  userId: '10000000-0000-4000-8000-000000000005',
  employeeId: null, activeRoles: ['HR_ADMIN'], permissions: ['salary:read', 'salary:write'],
}
function dependencies(value = context) {
  return {
    enabled: vi.fn(() => true),
    requirePermission: vi.fn(async () => value),
    resolveAdministration: vi.fn(async () => ({ id: '10000000-0000-4000-8000-000000000004', displayName: 'TEST', status: 'ACTIVE' as const, capabilityEnabled: true })),
  }
}
describe('component library request authorization', () => {
  it('uses the authenticated full scope and actor for writes', async () => {
    const deps = dependencies()
    const access = await requireComponentLibraryAccess(true, deps)
    expect(deps.requirePermission).toHaveBeenCalledWith('salary:write')
    expect(access.scope).toEqual({ tenantId: context.tenantId, hrGroupId: context.hrGroupId, administrationId: context.administrationId })
    expect(access.actorUserId).toBe(context.userId)
    expect(access.canCopy).toBe(true)
  })
  it.each([
    { ...context, permissions: [] },
    { ...context, permissions: ['salary:write'] },
    { ...context, activeRoles: ['MANAGER'] },
    { ...context, hrGroupId: undefined },
    { ...context, administrationId: null },
    { ...context, tenantId: 'forged' },
  ])('rejects incomplete scope, missing permission or non-admin before repository reads', async value => {
    const deps = dependencies(value)
    await expect(requireComponentLibraryAccess(true, deps)).rejects.toBeInstanceOf(AuthorizationError)
    expect(deps.resolveAdministration).not.toHaveBeenCalled()
  })
  it('allows readers to inspect but rejects their copy action', async () => {
    const deps = dependencies({ ...context, permissions: ['salary:read'] })
    expect((await requireComponentLibraryAccess(false, deps)).canCopy).toBe(false)
    deps.resolveAdministration.mockClear()
    await expect(requireComponentLibraryAccess(true, deps)).rejects.toBeInstanceOf(AuthorizationError)
    expect(deps.resolveAdministration).not.toHaveBeenCalled()
  })
  it('fails closed before authentication when disabled', async () => {
    const deps = dependencies()
    deps.enabled.mockReturnValue(false)
    await expect(requireComponentLibraryAccess(false, deps)).rejects.toBeInstanceOf(AuthorizationError)
    expect(deps.requirePermission).not.toHaveBeenCalled()
  })
  it('rejects a missing scoped Lab administration', async () => {
    const deps = { ...dependencies(), resolveAdministration: vi.fn(async () => null) }
    await expect(requireComponentLibraryAccess(false, deps)).rejects.toBeInstanceOf(AuthorizationError)
  })
})

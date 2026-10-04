import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import type { SupabaseBearerRlsClient } from '@/lib/api-v1/auth'
import { ModuleError, requireTenantModule } from './module-service'

describe('requireTenantModule with explicit request dependencies', () => {
  it('reads enabled modules using the supplied bearer client and tenant context', async () => {
    const auth: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: null,
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    }
    const rows = [{ module_code: 'TALENT' }]
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    const from = vi.fn().mockReturnValue(query)
    const supabase = { from } as unknown as SupabaseBearerRlsClient

    await expect(requireTenantModule('TALENT', { auth, supabase })).resolves.toBeUndefined()

    expect(from).toHaveBeenCalledWith('tenant_modules')
    expect(query.eq).toHaveBeenNthCalledWith(1, 'tenant_id', 'tenant-1')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'is_enabled', true)
  })

  it('does not fall back to another tenant when the module is disabled', async () => {
    const auth: AuthContext = {
      tenantId: 'tenant-1',
      hrGroupId: 'group-1',
      administrationId: null,
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    }
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      then: (resolve: (value: { data: readonly unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    const supabase = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseBearerRlsClient

    await expect(requireTenantModule('TALENT', { auth, supabase })).rejects.toBeInstanceOf(ModuleError)
  })
})

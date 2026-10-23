import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listEmployeesOverview, permissionErrorResponse, requireAnyPermission } = vi.hoisted(() => ({
  listEmployeesOverview: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  requireAnyPermission: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse, requireAnyPermission }))
vi.mock('@/lib/employees/employee-service', () => ({ createEmployee: vi.fn() }))
vi.mock('@/lib/employment/employment-service', () => ({ listEmployeesOverview }))

import { GET } from './route'

describe('GET /api/employees', () => {
  beforeEach(() => {
    listEmployeesOverview.mockReset()
    listEmployeesOverview.mockResolvedValue([])
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    requireAnyPermission.mockReset()
  })

  it('forces Direct Manager reads to the server-side team scope even when the URL requests all', async () => {
    const managerContext = { activeRoles: ['DIRECT_MANAGER'] }
    requireAnyPermission.mockResolvedValue(managerContext)

    const response = await GET(new Request('http://localhost/api/employees?scope=all'))

    expect(response.status).toBe(200)
    expect(requireAnyPermission).toHaveBeenCalledWith(['employee:read', 'employee-directory:read'])
    expect(listEmployeesOverview).toHaveBeenCalledWith('active', 'team')
  })

  it('keeps the full scope for a tenant administrator', async () => {
    requireAnyPermission.mockResolvedValue({ activeRoles: ['TENANT_ADMIN'] })

    const response = await GET(new Request('http://localhost/api/employees'))

    expect(response.status).toBe(200)
    expect(listEmployeesOverview).toHaveBeenCalledWith('active', 'all')
  })
})

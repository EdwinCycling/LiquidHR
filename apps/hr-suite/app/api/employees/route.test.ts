import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listEmployeesOverview, listEmployeesOverviewPage, permissionErrorResponse, requireAnyPermission } = vi.hoisted(() => ({
  listEmployeesOverview: vi.fn(),
  listEmployeesOverviewPage: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  requireAnyPermission: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse, requireAnyPermission }))
vi.mock('@/lib/employees/employee-service', () => ({ createEmployee: vi.fn() }))
vi.mock('@/lib/employment/employment-service', () => ({ listEmployeesOverview, listEmployeesOverviewPage }))

import { GET } from './route'

describe('GET /api/employees', () => {
  beforeEach(() => {
    listEmployeesOverview.mockReset()
    listEmployeesOverview.mockResolvedValue([])
    listEmployeesOverviewPage.mockReset()
    listEmployeesOverviewPage.mockResolvedValue({
      employees: [],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      limitedDetailEmployeeIds: [],
      directoryVisibility: { showJobDepartment: false, showWorkEmail: false },
      directoryAccess: true,
    })
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    requireAnyPermission.mockReset()
  })

  it('forces Direct Manager reads to the server-side team scope even when the URL requests all', async () => {
    const managerContext = { activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'] }
    requireAnyPermission.mockResolvedValue(managerContext)

    const response = await GET(new Request('http://localhost/api/employees?scope=all'))

    expect(response.status).toBe(200)
    expect(requireAnyPermission).toHaveBeenCalledWith(['employee:read', 'employee-directory:read'])
    expect(listEmployeesOverview).toHaveBeenCalledWith('active', 'team')
    expect(listEmployeesOverviewPage).not.toHaveBeenCalled()
  })

  it('keeps the full scope for a tenant administrator', async () => {
    requireAnyPermission.mockResolvedValue({ activeRoles: ['TENANT_ADMIN'], permissions: ['employee:read'] })

    const response = await GET(new Request('http://localhost/api/employees'))

    expect(response.status).toBe(200)
    expect(listEmployeesOverview).toHaveBeenCalledWith('active', 'all')
  })

  it('routes directory-only reads through the scoped, visibility-filtered paginated service', async () => {
    requireAnyPermission.mockResolvedValue({ activeRoles: [], permissions: ['employee-directory:read'] })
    listEmployeesOverviewPage.mockResolvedValue({
      employees: [{ id: 'employee-1', employeeNumber: '', workEmail: null, employmentCount: 0 }],
      totalCount: 1,
      page: 2,
      pageSize: 50,
      limitedDetailEmployeeIds: [],
      directoryVisibility: { showJobDepartment: false, showWorkEmail: false },
      directoryAccess: true,
    })

    const response = await GET(new Request('http://localhost/api/employees?scope=all&archive=all&status=all&administrationId=other&search=Sam&page=2&sort=first-name'))

    expect(response.status).toBe(200)
    expect(listEmployeesOverview).not.toHaveBeenCalled()
    expect(listEmployeesOverviewPage).toHaveBeenCalledWith({
      archiveFilter: 'active',
      statusFilter: 'ACTIVE_EMPLOYEE',
      search: 'Sam',
      sort: 'first-name',
      scope: 'all',
      page: 2,
    })
    await expect(response.json()).resolves.toMatchObject({
      data: [{ employeeNumber: '', workEmail: null }],
      totalCount: 1,
      directoryVisibility: { showJobDepartment: false, showWorkEmail: false },
      directoryAccess: true,
    })
  })

  it('keeps directory-only Manager API reads within the server-derived team scope', async () => {
    requireAnyPermission.mockResolvedValue({ activeRoles: ['DIRECT_MANAGER'], permissions: ['employee-directory:read'] })

    const response = await GET(new Request('http://localhost/api/employees?scope=all'))

    expect(response.status).toBe(200)
    expect(listEmployeesOverview).not.toHaveBeenCalled()
    expect(listEmployeesOverviewPage).toHaveBeenCalledWith(expect.objectContaining({ scope: 'team' }))
  })

  it('fails closed when the administration has disabled directory access', async () => {
    requireAnyPermission.mockResolvedValue({ activeRoles: [], permissions: ['employee-directory:read'] })
    listEmployeesOverviewPage.mockResolvedValue({
      employees: [],
      totalCount: 0,
      page: 1,
      pageSize: 50,
      limitedDetailEmployeeIds: [],
      directoryVisibility: { showJobDepartment: false, showWorkEmail: false },
      directoryAccess: false,
    })

    const response = await GET(new Request('http://localhost/api/employees'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'EMPLOYEE_DIRECTORY_UNAVAILABLE' })
  })

  it('rejects invalid page values before a directory RPC', async () => {
    requireAnyPermission.mockResolvedValue({ activeRoles: [], permissions: ['employee-directory:read'] })

    const response = await GET(new Request('http://localhost/api/employees?page=1.5'))

    expect(response.status).toBe(400)
    expect(listEmployeesOverviewPage).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { AuthorizationError } from '@/lib/auth/permissions'
import {
  listEmployeesOverviewPage,
  type EmployeeOverviewPageRequest,
  type EmployeeOverviewReadDependencies,
} from './employment-service'

vi.mock('server-only', () => ({}))

const context: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '20000000-0000-4000-8000-000000000001',
  administrationId: '30000000-0000-4000-8000-000000000001',
  userId: '40000000-0000-4000-8000-000000000001',
  employeeId: null,
  activeRoles: ['HR_ADMIN'],
  permissions: ['employee:read'],
}

const request: EmployeeOverviewPageRequest = {
  archiveFilter: 'active',
  statusFilter: 'ACTIVE_EMPLOYEE',
  search: '  Lina  ',
  sort: 'last-name',
  scope: 'all',
  page: 2,
}

function dependencies(response: { data: unknown; error: unknown }, overrides: Partial<AuthContext> = {}) {
  const rpc = vi.fn(async (functionName: string, args: Record<string, unknown>) => {
    void functionName
    void args
    return response
  })
  const supabase = { rpc } as unknown as EmployeeOverviewReadDependencies['supabase']
  return {
    rpc,
    dependencies: {
      context: { ...context, ...overrides },
      supabase,
    } satisfies EmployeeOverviewReadDependencies,
  }
}

describe('listEmployeesOverviewPage', () => {
  it('returns an exact empty page without treating it as a database failure', async () => {
    const { rpc, dependencies: deps } = dependencies({
      data: [{
        total_count: 0,
        employees: [],
        directory_visibility: { showJobDepartment: true, showWorkEmail: true },
        directory_access: true,
      }],
      error: null,
    })

    await expect(listEmployeesOverviewPage(request, deps)).resolves.toMatchObject({
      employees: [],
      totalCount: 0,
      page: 2,
      pageSize: 50,
      directoryAccess: true,
    })
    expect(rpc).toHaveBeenCalledWith('list_employee_overviews_page', expect.objectContaining({
      requested_tenant_id: context.tenantId,
      requested_hr_group_id: context.hrGroupId,
      requested_administration_id: context.administrationId,
      requested_search: 'Lina',
      requested_page: 2,
    }))
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('requested_as_of')
  })

  it('rejects a missing employee-list permission before any RPC', async () => {
    const { rpc, dependencies: deps } = dependencies({ data: null, error: null }, { permissions: [] })

    await expect(listEmployeesOverviewPage(request, deps)).rejects.toBeInstanceOf(AuthorizationError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a forged team scope for a user without an active manager role', async () => {
    const { rpc, dependencies: deps } = dependencies({ data: null, error: null }, { activeRoles: [] })

    await expect(listEmployeesOverviewPage({ ...request, scope: 'team' }, deps)).rejects.toBeInstanceOf(AuthorizationError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps database authorization and execution failures to a stable service error', async () => {
    const { dependencies: deps } = dependencies({ data: null, error: { code: '42501' } })

    await expect(listEmployeesOverviewPage(request, deps)).rejects.toMatchObject({
      code: 'EMPLOYEE_OVERVIEW_PAGE_FAILED',
      status: 500,
      databaseCode: '42501',
    })
  })

  it('rejects a malformed empty RPC envelope instead of inventing a total', async () => {
    const { dependencies: deps } = dependencies({ data: [], error: null })

    await expect(listEmployeesOverviewPage(request, deps)).rejects.toMatchObject({
      code: 'EMPLOYEE_OVERVIEW_PAGE_INVALID',
      status: 500,
    })
  })

  it('requires an administration context and rejects an invalid page before the database call', async () => {
    const { rpc, dependencies: deps } = dependencies({ data: null, error: null }, { administrationId: null })

    await expect(listEmployeesOverviewPage(request, deps)).rejects.toMatchObject({
      code: 'ADMINISTRATION_REQUIRED',
      status: 400,
    })
    await expect(listEmployeesOverviewPage({ ...request, page: 1_000_001 }, { ...deps, context: { ...context } })).rejects.toMatchObject({
      code: 'EMPLOYEE_OVERVIEW_PAGE_INVALID',
      status: 400,
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
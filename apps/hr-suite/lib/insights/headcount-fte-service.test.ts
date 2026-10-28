import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { getHeadcountFteReport } from './headcount-fte-service'
import type { HeadcountFteQuery } from './headcount-fte-query'

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

interface QueryResult { data: unknown[]; error: null }
interface QueryBuilder extends PromiseLike<QueryResult> {
  select: (columns: string) => QueryBuilder
  eq: (column: string, value: string) => QueryBuilder
  in: (column: string, values: readonly string[]) => QueryBuilder
  is: (column: string, value: null) => QueryBuilder
  lte: (column: string, value: string) => QueryBuilder
  or: (expression: string) => QueryBuilder
  limit: (value: number) => QueryBuilder
}

function queryBuilder(table: string, source: Record<string, unknown>[]): QueryBuilder {
  const filters: Array<{ column: string; values: readonly string[] }> = []
  const builder: QueryBuilder = {
    select: () => builder,
    eq: (column, value) => { filters.push({ column, values: [value] }); return builder },
    in: (column, values) => { filters.push({ column, values }); return builder },
    is: () => builder,
    lte: () => builder,
    or: () => builder,
    limit: () => builder,
    then: (resolve, reject) => {
      const data = source.filter((row) => filters.every((filter) => {
        if (filter.column !== 'id' && filter.column !== 'employee_id' && filter.column !== 'employment_id' && filter.column !== 'administration_id') return true
        return filter.values.includes(String(row[filter.column] ?? ''))
      }))
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    },
  }
  void table
  return builder
}

const hrContext: AuthContext = {
  tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: 'admin-a', userId: 'user-hr', employeeId: null,
  activeRoles: ['HR_ADMIN'], permissions: ['report-employee-department:read', 'employee:read'],
}

const query: HeadcountFteQuery = {
  report: 'headcount-fte', fromMonth: '2025-01', toMonth: '2025-01', administrationIds: [], departmentIds: [], teamIds: [], sortBy: 'employeeName', sortDirection: 'asc', page: 1,
}

function sourceRows(): Record<string, Record<string, unknown>[]> {
  return {
    employments: [
      { id: 'employment-a', employee_id: 'employee-a', administration_id: 'admin-a', starts_on: '2024-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null, employment_number: 'A-1' },
      { id: 'employment-b', employee_id: 'employee-b', administration_id: 'admin-a', starts_on: '2024-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null, employment_number: 'B-1' },
    ],
    employment_schedules: [
      { id: 'schedule-a', employment_id: 'employment-a', administration_id: 'admin-a', valid_from: '2024-01-01', valid_until: null, part_time_factor: 0.8 },
      { id: 'schedule-b', employment_id: 'employment-b', administration_id: 'admin-a', valid_from: '2024-01-01', valid_until: null, part_time_factor: 1 },
    ],
    employee_organizations: [
      { id: 'org-a', employee_id: 'employee-a', employment_id: 'employment-a', administration_id: 'admin-a', department_id: 'department-a', direct_manager_id: 'manager-a', effective_from: '2024-01-01', effective_to: null },
      { id: 'org-b', employee_id: 'employee-b', employment_id: 'employment-b', administration_id: 'admin-a', department_id: 'department-b', direct_manager_id: 'manager-b', effective_from: '2024-01-01', effective_to: null },
    ],
    employees: [
      { id: 'employee-a', employee_number: 'E-A', first_name: 'Alex', birth_name_prefix: null, birth_name: 'One', deleted_at: null },
      { id: 'employee-b', employee_number: 'E-B', first_name: 'Bailey', birth_name_prefix: null, birth_name: 'Two', deleted_at: null },
      { id: 'manager-a', employee_number: 'M-A', first_name: 'Manager', birth_name_prefix: null, birth_name: 'One', deleted_at: null },
      { id: 'manager-b', employee_number: 'M-B', first_name: 'Manager', birth_name_prefix: null, birth_name: 'Two', deleted_at: null },
    ],
    administrations: [{ id: 'admin-a', code: 'A', name: 'Administration A' }],
    departments: [{ id: 'department-a', name: 'Department A' }, { id: 'department-b', name: 'Department B' }],
  }
}

function configure(actor: AuthContext, employeeIds: string[] = ['employee-a'], sourceTruncated = false): void {
  const rows = sourceRows()
  mocks.from.mockImplementation((table: string) => {
    return queryBuilder(table, rows[table] ?? [])
  })
  mocks.authorization.mockResolvedValue({
    supabase: { from: mocks.from },
    context: actor,
    activeContext: { administrationsInActiveHrGroup: [{ id: 'admin-a', code: 'A', name: 'Administration A' }] },
  })
  mocks.directTeam.mockResolvedValue({ employeeIds, sourceTruncated, members: [] })
  mocks.permission.mockResolvedValue(actor)
  mocks.from.mockClear()
}

describe('Headcount & FTE authorized service', () => {
  beforeEach(() => {
    mocks.authorization.mockReset()
    mocks.permission.mockReset()
    mocks.directTeam.mockReset()
    mocks.from.mockReset()
  })

  it('limits Manager metrics, details and table reads to the authenticated direct team', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], administrationId: 'admin-a', employeeId: 'manager-a' }
    configure(manager, ['employee-a'])
    const report = await getHeadcountFteReport(query)
    expect(report.headcount).toBe(1)
    expect(report.fte).toBe(0.8)
    expect(report.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('employment_salaries')
  })

  it('returns the HR Admin population within the active administration context', async () => {
    configure(hrContext)
    const report = await getHeadcountFteReport(query)
    expect(report.headcount).toBe(2)
    expect(report.activeEmploymentCount).toBe(2)
    expect(report.fte).toBe(1.8)
  })

  it('rejects an HR Admin filter outside the active context allowlist', async () => {
    configure(hrContext)
    await expect(getHeadcountFteReport({ ...query, administrationIds: ['admin-b'] })).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a Manager department filter outside the returned team data', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a' }
    configure(manager, ['employee-a'])
    await expect(getHeadcountFteReport({ ...query, departmentIds: ['department-b'] })).rejects.toMatchObject({ status: 403 })
  })

  it('rejects a Manager team filter outside the authenticated direct-team history', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a' }
    configure(manager, ['employee-a'])
    await expect(getHeadcountFteReport({ ...query, teamIds: ['manager-b'] })).rejects.toMatchObject({ status: 403 })
  })

  it('rejects a Manager administration filter outside the active administration', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a' }
    configure(manager, ['employee-a'])
    await expect(getHeadcountFteReport({ ...query, administrationIds: ['admin-b'] })).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('denies an Employee role before reading any report source', async () => {
    configure({ ...hrContext, activeRoles: ['EMPLOYEE'], employeeId: 'employee-a' })
    await expect(getHeadcountFteReport(query)).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed when the Manager team source is truncated', async () => {
    configure({ ...hrContext, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a' }, ['employee-a'], true)
    await expect(getHeadcountFteReport(query)).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

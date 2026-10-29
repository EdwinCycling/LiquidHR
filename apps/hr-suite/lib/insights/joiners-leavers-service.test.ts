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

class MockSupabaseQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  constructor(private rows: unknown[]) {}

  select(): this { return this }
  eq(): this { return this }
  in(column: string, values: string[]): this {
    // Exercise the PostgREST employee allowlist rather than treating .in() as a no-op.
    if (column === 'employee_id') {
      this.rows = this.rows.filter((row) => typeof row === 'object' && row !== null
        && 'employee_id' in row && values.includes(String(row.employee_id)))
    }
    return this
  }
  lte(): this { return this }
  is(): this { return this }
  limit(): this { return this }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected)
  }
}

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

  it('returns authorized Manager details without disclosing a prior direct manager ID', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'], administrationId: 'admin-a', employeeId: 'manager-a' }
    configure(manager, ['admin-a'])
    let employeeQueryCount = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'employments') return new MockSupabaseQuery([{
        id: 'employment-a', employee_id: 'employee-a', administration_id: 'admin-a', starts_on: '2025-03-03', ends_on: null,
        record_status: 'CONFIRMED', deleted_at: null, employment_number: 'J-1',
      }])
      if (table === 'employment_terminations') return new MockSupabaseQuery([])
      if (table === 'employee_organizations') return new MockSupabaseQuery([{
        employee_id: 'employee-a', employment_id: 'employment-a', administration_id: 'admin-a', department_id: 'department-a',
        direct_manager_id: 'manager-before', effective_from: '2025-02-01', effective_to: null,
      }])
      if (table === 'departments') return new MockSupabaseQuery([{ id: 'department-a', name: 'Department A' }])
      if (table === 'employees') {
        employeeQueryCount += 1
        return new MockSupabaseQuery(employeeQueryCount === 1
          ? [{ id: 'employee-a', employee_number: 'E-1', first_name: 'Alex', birth_name_prefix: null, birth_name: 'Employee' }]
          : [{ id: 'manager-a', employee_number: 'M-1', first_name: 'Morgan', birth_name_prefix: null, birth_name: 'Manager' }])
      }
      return new MockSupabaseQuery([])
    })

    const report = await getJoinersLeaversReport({
      ...defaultJoinersLeaversQuery(new Date('2026-10-29T12:00:00Z')),
      fromMonth: '2025-03', toMonth: '2025-03',
    })

    expect(report.rows[0]).toMatchObject({
      eventType: 'employment-start', employeeId: 'employee-a', departmentName: 'Department A',
      placementStatus: 'ASSIGNED', teamId: null, teamName: null,
    })
    expect(JSON.stringify(report.rows)).not.toContain('manager-before')
    expect(report.teamOptions).toEqual([{ id: 'manager-a', label: 'Morgan Manager' }])
  })

  it('filters both Manager source queries before evaluating mixed-administration records', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'], administrationId: 'admin-a', employeeId: 'manager-a' }
    configure(manager, ['admin-a'])
    let employeeQueryCount = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'employments') return new MockSupabaseQuery([
        { id: 'employment-a', employee_id: 'employee-a', administration_id: 'admin-a', starts_on: '2025-03-03', ends_on: null, record_status: 'CONFIRMED', deleted_at: null, employment_number: 'J-1' },
        { id: 'employment-other', employee_id: 'employee-outside', administration_id: 'admin-a', starts_on: '2025-03-03', ends_on: null, record_status: 'CONFIRMED', deleted_at: null, employment_number: 'J-2' },
      ])
      if (table === 'employment_terminations') return new MockSupabaseQuery([
        { id: 'termination-other', employee_id: 'employee-outside', employment_id: 'employment-other', administration_id: 'admin-a', last_working_day: '2025-03-20', workflow_status: 'CONFIRMED' },
      ])
      if (table === 'employee_organizations' || table === 'departments') return new MockSupabaseQuery([])
      if (table === 'employees') {
        employeeQueryCount += 1
        return new MockSupabaseQuery(employeeQueryCount === 1
          ? [{ id: 'employee-a', employee_number: 'E-1', first_name: 'Alex', birth_name_prefix: null, birth_name: 'Employee' }]
          : [{ id: 'manager-a', employee_number: 'M-1', first_name: 'Morgan', birth_name_prefix: null, birth_name: 'Manager' }])
      }
      return new MockSupabaseQuery([])
    })
    const report = await getJoinersLeaversReport({
      ...defaultJoinersLeaversQuery(new Date('2026-10-29T12:00:00Z')),
      fromMonth: '2025-03', toMonth: '2025-03',
    })
    expect(report.summary.employmentStarts).toBe(1)
    expect(report.summary.terminationWorkflowEvents).toBe(0)
    expect(report.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    expect(JSON.stringify(report)).not.toContain('employee-outside')
  })

  it('fails closed when the direct-team employee scope is truncated', async () => {
    const manager: AuthContext = { ...hrContext, activeRoles: ['DIRECT_MANAGER'], permissions: ['employee:read'], administrationId: 'admin-a', employeeId: 'manager-a' }
    configure(manager, ['admin-a', 'admin-b'], true)
    await expect(getJoinersLeaversReport(defaultJoinersLeaversQuery())).rejects.toMatchObject({ status: 403, code: 'INSIGHTS_SCOPE_LIMIT_REACHED' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { getMyNextApprovedLeave, listMyLeaveRequests, type EmployeeLeaveReadDependencies } from './employee-self-service'

const permissionMocks = vi.hoisted(() => ({
  requirePermissionInContext: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return { ...actual, requirePermissionInContext: permissionMocks.requirePermissionInContext }
})

const context: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
  userId: '10000000-0000-4000-8000-000000000004',
  employeeId: '10000000-0000-4000-8000-000000000005',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:leave:read'],
}

type QueryResult = { data: readonly unknown[]; error: null }

function createQueryClient(results: Readonly<Record<string, QueryResult>>) {
  const traces: Array<{ table: string; filters: Array<readonly unknown[]> }> = []
  const from = vi.fn((table: string) => {
    const trace = { table, filters: [] as Array<readonly unknown[]> }
    traces.push(trace)
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'in', 'gt', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        if (method !== 'select' && method !== 'order' && method !== 'limit') trace.filters.push([method, ...args])
        return builder
      }
    }
    builder.then = (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject)
    return builder
  })
  const client = { from } as unknown as EmployeeLeaveReadDependencies['supabase']
  return { client, from, traces }
}

describe('Employee leave self-service reads', () => {
  beforeEach(() => {
    permissionMocks.requirePermissionInContext.mockReset().mockResolvedValue(undefined)
  })

  it('reads only the next future approved vacation through the supplied bearer/RLS client and actor context', async () => {
    const requestId = '20000000-0000-4000-8000-000000000001'
    const leaveTypeId = '20000000-0000-4000-8000-000000000002'
    const { client, from, traces } = createQueryClient({
      leave_requests: {
        data: [{
          id: requestId,
          leave_type_id: leaveTypeId,
          start_date: '2026-10-22',
          end_date: '2026-10-23',
          requested_minutes: 960,
          status: 'APPROVED',
          time_mode: 'FULL_DAY',
        }],
        error: null,
      },
      leave_request_allocations: {
        data: [{ request_id: requestId, leave_type_id: leaveTypeId, allocated_hours: 16 }],
        error: null,
      },
      leave_types: { data: [{ id: leaveTypeId, name: 'Vakantie' }], error: null },
    })
    const dependencies = { context, supabase: client }
    const result = await getMyNextApprovedLeave(dependencies, new Date('2026-10-09T21:30:00.000Z'))

    expect(result).toEqual({
      asOfDate: '2026-10-09',
      nextLeave: {
        requestId,
        startDate: '2026-10-22',
        endDate: '2026-10-23',
        requestedHours: 16,
        status: 'APPROVED',
        timeMode: 'FULL_DAY',
        leaveTypes: [{ name: 'Vakantie', hours: 16 }],
      },
    })
    expect(permissionMocks.requirePermissionInContext).toHaveBeenCalledWith(
      client, context, 'self:leave:read', context.employeeId,
    )
    expect(from).toHaveBeenCalledTimes(3)
    const requestFilters = traces.find((trace) => trace.table === 'leave_requests')?.filters
    expect(requestFilters).toContainEqual(['eq', 'tenant_id', context.tenantId])
    expect(requestFilters).toContainEqual(['eq', 'hr_group_id', context.hrGroupId])
    expect(requestFilters).toContainEqual(['eq', 'employee_id', context.employeeId])
    expect(requestFilters).toContainEqual(['in', 'status', ['APPROVED']])
    expect(requestFilters).toContainEqual(['gt', 'start_date', '2026-10-09'])
    expect(JSON.stringify(traces)).not.toContain('client-supplied')
  })

  it('limits request status to the existing Employee self-service statuses', async () => {
    const { client, traces } = createQueryClient({
      leave_requests: { data: [], error: null },
    })
    await listMyLeaveRequests(
      { context, supabase: client },
      new Date('2026-10-09T21:30:00.000Z'),
    )

    expect(traces[0]?.filters).toContainEqual([
      'in', 'status', ['PENDING', 'CHANGES_REQUESTED', 'APPROVED'],
    ])
  })

  it('fails closed before querying when the Employee self-read permission is denied', async () => {
    const { client, from } = createQueryClient({ leave_requests: { data: [], error: null } })
    permissionMocks.requirePermissionInContext.mockRejectedValueOnce(new Error('ACCESS_DENIED'))

    await expect(getMyNextApprovedLeave({ context, supabase: client }))
      .rejects.toThrow('ACCESS_DENIED')
    expect(from).not.toHaveBeenCalled()
  })

  it('fails closed when the authenticated context has no own Employee or HR-group binding', async () => {
    const { client, from } = createQueryClient({ leave_requests: { data: [], error: null } })
    const noEmployeeContext = { ...context, employeeId: null }
    const noGroupContext = { ...context, hrGroupId: undefined }

    await expect(getMyNextApprovedLeave({
      context: noEmployeeContext,
      supabase: client,
    })).rejects.toMatchObject({ code: 'LEAVE_EMPLOYMENT_REQUIRED' })
    await expect(getMyNextApprovedLeave({
      context: noGroupContext,
      supabase: client,
    })).rejects.toMatchObject({ code: 'LEAVE_EMPLOYMENT_REQUIRED' })
    expect(from).not.toHaveBeenCalled()
    expect(permissionMocks.requirePermissionInContext).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { normalizeLeaveWorkflowActionResult, startEmployeeSelfLeaveRequestWorkflow, type WorkflowDependencies } from './workflow-service'

const workflowMocks = vi.hoisted(() => ({
  requirePermissionInContext: vi.fn(),
  resolveLeaveEmployment: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return { ...actual, requirePermissionInContext: workflowMocks.requirePermissionInContext }
})
vi.mock('./employment-resolver', () => ({
  resolveLeaveEmployment: workflowMocks.resolveLeaveEmployment,
}))

const context: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
  userId: '10000000-0000-4000-8000-000000000004',
  employeeId: '10000000-0000-4000-8000-000000000005',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:leave:request'],
}

function setupWorkflow() {
  const supabase = {
    rpc: vi.fn().mockResolvedValue({
      data: {
        processInstanceId: '30000000-0000-4000-8000-000000000001',
        requestId: '30000000-0000-4000-8000-000000000002',
        workItemId: '30000000-0000-4000-8000-000000000003',
        status: 'PENDING',
        businessStatus: 'WAITING',
      },
      error: null,
    }),
  } as unknown as WorkflowDependencies['supabase']
  const dependencies: WorkflowDependencies = { context, supabase }
  return { supabase, dependencies }
}

describe('Employee leave request workflow', () => {
  beforeEach(() => {
    workflowMocks.requirePermissionInContext.mockReset().mockResolvedValue(undefined)
    workflowMocks.resolveLeaveEmployment.mockReset().mockResolvedValue({
      employment: {
        id: '40000000-0000-4000-8000-000000000001',
        hr_group_id: context.hrGroupId,
        administration_id: context.administrationId,
      },
      options: [],
    })
  })

  it('binds the canonical leave workflow RPC to the authenticated Employee and idempotency key', async () => {
    const { supabase, dependencies } = setupWorkflow()
    const input = {
      employmentId: '40000000-0000-4000-8000-000000000006',
      mode: 'DIRECT' as const,
      leaveTypeId: '40000000-0000-4000-8000-000000000002',
      startDate: '2026-10-16',
      endDate: '2026-10-16',
      timeMode: 'FULL_DAY' as const,
      idempotencyKey: '40000000-0000-4000-8000-000000000003',
    }

    await startEmployeeSelfLeaveRequestWorkflow(input, dependencies)

    expect(workflowMocks.requirePermissionInContext).toHaveBeenCalledWith(
      supabase, context, 'self:leave:request', context.employeeId,
    )
    expect(workflowMocks.resolveLeaveEmployment).toHaveBeenCalledWith(
      supabase, context, context.employeeId, input.employmentId, input.startDate,
    )
    expect(supabase.rpc).toHaveBeenCalledWith('start_leave_request_workflow', expect.objectContaining({
      requested_tenant_id: context.tenantId,
      requested_hr_group_id: context.hrGroupId,
      requested_administration_id: context.administrationId,
      requested_employee_id: context.employeeId,
      requested_employment_id: '40000000-0000-4000-8000-000000000001',
      requested_leave_type_id: input.leaveTypeId,
      requested_start_date: input.startDate,
      requested_end_date: input.endDate,
      requested_idempotency_key: input.idempotencyKey,
    }))
  })

  it('overwrites a forged employeeId with the authenticated self identity', async () => {
    const { supabase, dependencies } = setupWorkflow()
    const input = {
      mode: 'DIRECT' as const,
      leaveTypeId: '40000000-0000-4000-8000-000000000002',
      startDate: '2026-10-16',
      endDate: '2026-10-16',
      timeMode: 'FULL_DAY' as const,
      idempotencyKey: '40000000-0000-4000-8000-000000000004',
      employeeId: 'attacker-selected',
    }

    await startEmployeeSelfLeaveRequestWorkflow(input, dependencies)

    expect(workflowMocks.resolveLeaveEmployment).toHaveBeenCalledWith(
      supabase, context, context.employeeId, undefined, input.startDate,
    )
    expect(supabase.rpc).toHaveBeenCalledWith('start_leave_request_workflow', expect.objectContaining({
      requested_employee_id: context.employeeId,
    }))
    expect(JSON.stringify(vi.mocked(supabase.rpc).mock.calls)).not.toContain('attacker-selected')
  })

  it('fails closed without own Employee identity or self request permission', async () => {
    const { supabase, dependencies } = setupWorkflow()

    await expect(startEmployeeSelfLeaveRequestWorkflow(
      { mode: 'DIRECT', startDate: '2026-10-16', endDate: '2026-10-16', timeMode: 'FULL_DAY', idempotencyKey: '40000000-0000-4000-8000-000000000005' },
      { ...dependencies, context: { ...context, employeeId: null } },
    )).rejects.toMatchObject({ code: 'LEAVE_REQUEST_PERMISSION_REQUIRED' })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(workflowMocks.resolveLeaveEmployment).not.toHaveBeenCalled()

    workflowMocks.requirePermissionInContext.mockRejectedValueOnce(new Error('ACCESS_DENIED'))
    await expect(startEmployeeSelfLeaveRequestWorkflow(
      { mode: 'DIRECT', startDate: '2026-10-16', endDate: '2026-10-16', timeMode: 'FULL_DAY', idempotencyKey: '40000000-0000-4000-8000-000000000006' },
      dependencies,
    )).rejects.toThrow('ACCESS_DENIED')
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(workflowMocks.resolveLeaveEmployment).not.toHaveBeenCalled()
  })
})

describe('Leave workflow action result', () => {
  it('normalizes the approval adapter result when booking omits leaveRequestId and businessStatus', () => {
    const result = normalizeLeaveWorkflowActionResult({
      processInstanceId: '370febd9-c63d-47a3-b7fc-cba7f19970a9',
      status: 'APPROVED',
      currentStepKey: 'completed',
      instanceVersion: 7,
      correlationId: 'ac6bafb8-1e78-45bc-acfc-d43380d525b3',
      eventId: 'a3f4ead2-c402-41da-b9f9-d1279822d9bc',
      requestId: '9df4d793-3296-4324-855f-8ef458438096',
      allocationCount: 1,
      alreadyBooked: false,
    })

    expect(result.leaveRequestId).toBe(result.requestId)
    expect(result.businessStatus).toBe('COMPLETED')
  })
})

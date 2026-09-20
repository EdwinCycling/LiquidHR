import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireHrGroupId, requirePermission, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireHrGroupId: vi.fn(),
  requirePermission: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requireHrGroupId, requirePermission }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { mutateLeaveLedger } from './ledger-service'

describe('leave ledger failure observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'group-1' })
    requireHrGroupId.mockReturnValue('group-1')
    createClient.mockResolvedValue({ rpc })
  })

  it('logs only safe database metadata while keeping the caller error generic', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "leave_accrual_transactions_source_key"',
        details: 'Key (bucket_id, source_key)=(private-bucket, private-source) already exists.',
        hint: 'Retry the operation.',
      },
    })

    await expect(mutateLeaveLedger({
      action: 'OPENING_BALANCE',
      employeeId: 'employee-1',
      employmentId: 'employment-1',
      leaveTypeId: 'leave-type-1',
      amount: 8,
      startDate: '2026-09-17',
      reason: 'Acceptance fixture opening balance',
      sourceKey: 'acceptance-source-key',
      sourceAccrualYear: 2026,
      expirationDate: '2026-12-31',
    })).rejects.toMatchObject({ code: 'LEAVE_LEDGER_OPERATION_FAILED', status: 409 })

    expect(errorSpy).toHaveBeenCalledWith('[LEAVE_LEDGER] database operation failed', {
      operation: 'OPENING_BALANCE',
      rpcName: 'create_group_leave_opening_balance_cohort',
      postgresCode: '23505',
      domainCode: null,
      constraint: 'leave_accrual_transactions_source_key',
      functionContext: null,
    })
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('private-bucket')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('private-source')
    errorSpy.mockRestore()
  })

  it('extracts a safe function context without exposing the database message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'failure',
        details: 'PL/pgSQL function public.create_group_leave_opening_balance_cohort(uuid) line 42 at SQL statement',
      },
    })

    await expect(mutateLeaveLedger({
      action: 'OPENING_BALANCE',
      employeeId: 'employee-1',
      employmentId: 'employment-1',
      leaveTypeId: 'leave-type-1',
      amount: 8,
      startDate: '2026-09-17',
      reason: 'Acceptance fixture opening balance',
      sourceKey: 'acceptance-source-key',
      sourceAccrualYear: 2026,
      expirationDate: '2026-12-31',
    })).rejects.toMatchObject({ code: 'LEAVE_LEDGER_OPERATION_FAILED', status: 409 })

    expect(errorSpy.mock.calls[0]?.[1]).toMatchObject({
      postgresCode: 'P0001',
      functionContext: 'public.create_group_leave_opening_balance_cohort',
    })
    errorSpy.mockRestore()
  })
})

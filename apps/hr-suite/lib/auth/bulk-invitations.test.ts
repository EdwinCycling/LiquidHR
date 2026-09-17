import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvitationError } from './invitation-rules'

const { createEmployeeInvitationMock, createInvitationMock, requirePermissionMock } = vi.hoisted(() => ({
  createEmployeeInvitationMock: vi.fn(),
  createInvitationMock: vi.fn(),
  requirePermissionMock: vi.fn(),
}))

vi.mock('@/lib/auth/invitations', () => ({ createInvitation: createInvitationMock }))
vi.mock('@/lib/auth/employee-invitations', () => ({ createEmployeeInvitation: createEmployeeInvitationMock }))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission: requirePermissionMock }))

import { createBulkEmployeeInvitations, createBulkInvitations } from './bulk-invitations'

const baseInput = {
  emailKind: 'PRIVATE' as const,
  purpose: 'PREBOARDING_EMPLOYEE' as const,
  employeeId: '11111111-1111-4111-8111-111111111111',
  administrationId: null,
  managementRoleId: '33333333-3333-4333-8333-333333333333',
  scopeType: 'TENANT' as const,
}

describe('createBulkInvitations', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requirePermissionMock.mockResolvedValue({})
  })

  it('returns per-recipient results when delivery partially fails', async () => {
    createInvitationMock
      .mockResolvedValueOnce({ id: 'invitation-1', expiresAt: '2026-09-24T00:00:00.000Z' })
      .mockRejectedValueOnce(new InvitationError('INVITATION_DELIVERY_FAILED', 502))
      .mockResolvedValueOnce({ id: 'invitation-3', expiresAt: '2026-09-24T00:00:00.000Z' })

    const summary = await createBulkInvitations([
      { ...baseInput, email: 'one@example.com' },
      { ...baseInput, email: 'two@example.com' },
      { ...baseInput, email: 'three@example.com' },
    ], 'https://liquidhr.test')

    expect(requirePermissionMock).toHaveBeenCalledWith('user:invite')
    expect(summary).toEqual({
      total: 3,
      succeeded: 2,
      failed: 1,
      results: [
        { email: 'one@example.com', ok: true, invitationId: 'invitation-1', expiresAt: '2026-09-24T00:00:00.000Z' },
        { email: 'two@example.com', ok: false, errorCode: 'INVITATION_DELIVERY_FAILED' },
        { email: 'three@example.com', ok: true, invitationId: 'invitation-3', expiresAt: '2026-09-24T00:00:00.000Z' },
      ],
    })
    expect(createInvitationMock).toHaveBeenCalledTimes(3)
  })

  it('uses the canonical employee primitive for every employee ID', async () => {
    createEmployeeInvitationMock
      .mockResolvedValueOnce({ id: 'invitation-1', expiresAt: '2026-09-24T00:00:00.000Z', email: 'one@example.com', purpose: 'EMPLOYEE_ACTIVATION' })
      .mockRejectedValueOnce(new InvitationError('EMPLOYEE_NOT_FOUND', 404))

    const summary = await createBulkEmployeeInvitations([
      'employee-1',
      'employee-2',
    ], 'https://liquidhr.test')

    expect(createEmployeeInvitationMock).toHaveBeenNthCalledWith(1, 'employee-1', 'https://liquidhr.test')
    expect(createEmployeeInvitationMock).toHaveBeenNthCalledWith(2, 'employee-2', 'https://liquidhr.test')
    expect(createInvitationMock).not.toHaveBeenCalled()
    expect(summary).toMatchObject({ total: 2, succeeded: 1, failed: 1 })
    expect(summary.results[0]).toMatchObject({ employeeId: 'employee-1', email: 'one@example.com', ok: true })
    expect(summary.results[1]).toMatchObject({ employeeId: 'employee-2', email: null, ok: false, errorCode: 'EMPLOYEE_NOT_FOUND' })
  })
})

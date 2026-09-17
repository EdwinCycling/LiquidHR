import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InvitationError } from './invitation-rules'

const { createInvitationMock, requirePermissionMock } = vi.hoisted(() => ({
  createInvitationMock: vi.fn(),
  requirePermissionMock: vi.fn(),
}))

vi.mock('@/lib/auth/invitations', () => ({ createInvitation: createInvitationMock }))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission: requirePermissionMock }))

import { createBulkInvitations } from './bulk-invitations'

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
})

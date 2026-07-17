import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { confirmActionDraft } from './action-drafts'

const context: AuthContext = {
  tenantId: 'tenant-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: [],
  permissions: [],
}

describe('confirmActionDraft', () => {
  it('claimt en voert een geldig concept precies eenmaal uit', async () => {
    const claimDraft = vi.fn()
      .mockResolvedValueOnce({
        id: 'draft-1',
        actionType: 'PERSONAL_REMINDER',
        version: 3,
        expiresAt: '2099-01-01T00:00:00.000Z',
        payload: { title: 'Bel terug' },
      })
      .mockResolvedValueOnce(null)
    const executeAction = vi.fn().mockResolvedValue({ entityId: 'reminder-1' })
    const markSucceeded = vi.fn()

    await expect(confirmActionDraft(context, {
      draftId: 'draft-1', expectedVersion: 3,
    }, { claimDraft, executeAction, markSucceeded, markFailed: vi.fn() }))
      .resolves.toEqual({ entityId: 'reminder-1' })

    await expect(confirmActionDraft(context, {
      draftId: 'draft-1', expectedVersion: 3,
    }, { claimDraft, executeAction, markSucceeded, markFailed: vi.fn() }))
      .rejects.toMatchObject({ code: 'DRAFT_NOT_CONFIRMABLE' })

    expect(executeAction).toHaveBeenCalledTimes(1)
    expect(markSucceeded).toHaveBeenCalledWith(context, 'draft-1')
  })

  it('markeert een mislukte domeinactie zonder succes te claimen', async () => {
    const failure = new Error('DOMAIN_WRITE_FAILED')
    const markFailed = vi.fn()

    await expect(confirmActionDraft(context, {
      draftId: 'draft-1', expectedVersion: 1,
    }, {
      claimDraft: async () => ({
        id: 'draft-1', actionType: 'PERSONAL_REMINDER', version: 1,
        expiresAt: '2099-01-01T00:00:00.000Z', payload: {},
      }),
      executeAction: async () => { throw failure },
      markSucceeded: vi.fn(),
      markFailed,
    })).rejects.toBe(failure)

    expect(markFailed).toHaveBeenCalledWith(context, 'draft-1', 'DOMAIN_WRITE_FAILED')
  })
})

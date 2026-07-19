import { beforeEach, describe, expect, it, vi } from 'vitest'

const { confirmActionDraft, requireHeRaContext } = vi.hoisted(() => ({
  confirmActionDraft: vi.fn(),
  requireHeRaContext: vi.fn(),
}))

vi.mock('@/lib/hera/action-drafts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hera/action-drafts')>('@/lib/hera/action-drafts')
  return { ...actual, confirmActionDraft }
})
vi.mock('@/lib/hera/request-context', () => ({ requireHeRaContext }))

import { POST } from './route'

describe('POST /api/hera/drafts/:draftId/confirm', () => {
  beforeEach(() => {
    confirmActionDraft.mockReset()
    requireHeRaContext.mockReset()
    requireHeRaContext.mockResolvedValue({
      tenantId: 'tenant-1', administrationId: null, userId: 'user-1', employeeId: 'employee-1',
      activeRoles: [], permissions: [],
    })
  })

  it('geeft conceptversie door aan de atomische bevestigingsflow', async () => {
    confirmActionDraft.mockResolvedValue({ entityId: 'reminder-1' })
    const request = new Request('http://localhost/api/hera/drafts/draft-1/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 3 }),
    })

    const response = await POST(request, { params: Promise.resolve({ draftId: 'draft-1' }) })

    expect(response.status).toBe(200)
    expect(confirmActionDraft).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1', userId: 'user-1',
    }), { draftId: 'draft-1', expectedVersion: 3 })
  })
})

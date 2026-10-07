import { beforeEach, describe, expect, it, vi } from 'vitest'

const { confirmActionDraft, requireHeRaContext, findControlledActionDraft, confirmControlledAction } = vi.hoisted(() => ({
  confirmActionDraft: vi.fn(),
  requireHeRaContext: vi.fn(),
  findControlledActionDraft: vi.fn(),
  confirmControlledAction: vi.fn(),
}))

vi.mock('@/lib/hera/action-drafts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hera/action-drafts')>('@/lib/hera/action-drafts')
  return { ...actual, confirmActionDraft }
})
vi.mock('@/lib/hera/request-context', () => ({ requireHeRaContext }))
vi.mock('@/lib/controlled-actions/service', () => ({
  findControlledActionDraft,
  controlledActions: { confirm: confirmControlledAction },
}))

import { POST } from './route'

describe('POST /api/hera/drafts/:draftId/confirm', () => {
  beforeEach(() => {
    confirmActionDraft.mockReset()
    confirmControlledAction.mockReset()
    findControlledActionDraft.mockReset().mockResolvedValue(false)
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

  it('bevestigt een controlled action met de verwachte previewhash', async () => {
    findControlledActionDraft.mockResolvedValue(true)
    confirmControlledAction.mockResolvedValue({ draft: {
      status: 'AWAITING_CONFIRMATION', version: 2, confirmedAt: '2026-10-06T10:00:00.000Z',
      controlPayload: {},
    } })
    const request = new Request('http://localhost/api/hera/drafts/00000000-0000-4000-8000-000000000001/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1, expectedPreviewHash: 'a'.repeat(64) }),
    })

    const response = await POST(request, { params: Promise.resolve({ draftId: '00000000-0000-4000-8000-000000000001' }) })

    expect(response.status).toBe(200)
    expect(confirmControlledAction).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'user-1',
    }), {
      draftId: '00000000-0000-4000-8000-000000000001',
      expectedVersion: 1,
      expectedPreviewHash: 'a'.repeat(64),
    })
  })

  it('weigert controlled-actionbevestiging zonder previewhash', async () => {
    findControlledActionDraft.mockResolvedValue(true)
    const request = new Request('http://localhost/api/hera/drafts/00000000-0000-4000-8000-000000000001/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1 }),
    })

    const response = await POST(request, { params: Promise.resolve({ draftId: '00000000-0000-4000-8000-000000000001' }) })

    expect(response.status).toBe(400)
    expect(confirmControlledAction).not.toHaveBeenCalled()
  })
})

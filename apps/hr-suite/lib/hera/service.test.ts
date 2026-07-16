import { describe, expect, it, vi } from 'vitest'
import { HeRaServiceError, createHeRaService } from './service'

describe('HeRa service', () => {
  it('slaat een mogelijke voorkeur niet op zonder expliciete toestemming', async () => {
    const saveMemoryItem = vi.fn()
    const service = createHeRaService({ saveMemoryItem })

    const result = await service.saveMemory({ tenantId: 'tenant', administrationId: null, userId: 'user', employeeId: null, activeRoles: [], permissions: [] }, {
      content: 'Ik geef de voorkeur aan korte antwoorden.',
      category: 'PREFERENCE',
      explicitConsent: false,
    })

    expect(result).toBeNull()
    expect(saveMemoryItem).not.toHaveBeenCalled()
  })

  it('voert een concept precies eenmaal uit', async () => {
    const getDraft = vi.fn()
      .mockResolvedValueOnce({ id: 'draft', status: 'PENDING', expiresAt: '2099-01-01T00:00:00.000Z', payload: { title: 'Bel terug', remindAt: '2026-07-17T09:00:00.000Z' } })
      .mockResolvedValueOnce({ id: 'draft', status: 'EXECUTED', expiresAt: '2099-01-01T00:00:00.000Z', payload: { title: 'Bel terug', remindAt: '2026-07-17T09:00:00.000Z' } })
    const createPersonalReminder = vi.fn().mockResolvedValue('reminder')
    const service = createHeRaService({ getDraft, createPersonalReminder, markDraftExecuted: vi.fn() })
    const context = { tenantId: 'tenant', administrationId: null, userId: 'user', employeeId: null, activeRoles: [], permissions: [] }

    await expect(service.confirmDraft(context, 'draft')).resolves.toEqual({ reminderId: 'reminder' })
    await expect(service.confirmDraft(context, 'draft')).rejects.toMatchObject({ code: 'DRAFT_NOT_CONFIRMABLE' } satisfies Partial<HeRaServiceError>)
    expect(createPersonalReminder).toHaveBeenCalledTimes(1)
  })
})

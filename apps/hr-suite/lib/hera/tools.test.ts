import { describe, expect, it, vi } from 'vitest'
import { executeHeRaTool } from './tools'

describe('executeHeRaTool', () => {
  it('maakt voor een persoonlijke reminder uitsluitend een concept en voert niets uit', async () => {
    const createPersonalReminder = vi.fn()

    const result = await executeHeRaTool(
      { tenantId: 'tenant', administrationId: null, userId: 'user', employeeId: null, activeRoles: [], permissions: [] },
      { name: 'draft_personal_reminder', args: { title: 'Bel terug', remindAt: '2026-07-17T09:00:00.000Z' } },
      { createPersonalReminder },
    )

    expect(result.kind).toBe('DRAFT')
    expect(createPersonalReminder).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'

const moduleMocks = vi.hoisted(() => ({ requireTenantModule: vi.fn() }))

vi.mock('@/lib/modules/module-service', () => ({
  requireTenantModule: moduleMocks.requireTenantModule,
}))

import { createControlledActionService } from './service'

const context: AuthContext = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000009',
  administrationId: null,
  userId: '10000000-0000-4000-8000-000000000002',
  employeeId: '10000000-0000-4000-8000-000000000003',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:write'],
}

const input = {
  conversationId: '10000000-0000-4000-8000-000000000004',
  actionId: 'talent.development-goal.create' as const,
  payload: { title: 'Klantgesprekken verbeteren', periodStart: '2026-10-01' },
  idempotencyKey: '10000000-0000-4000-8000-000000000005',
  channel: 'HERA' as const,
}

describe('controlled-action module gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    moduleMocks.requireTenantModule.mockResolvedValue(undefined)
  })

  it('fails closed before draft storage when HERA is disabled', async () => {
    moduleMocks.requireTenantModule.mockRejectedValueOnce(new Error('MODULE_INACTIVE'))
    const service = createControlledActionService()

    await expect(service.prepare(context, input)).rejects.toThrow('MODULE_INACTIVE')
    expect(moduleMocks.requireTenantModule).toHaveBeenCalledTimes(1)
    expect(moduleMocks.requireTenantModule).toHaveBeenCalledWith('HERA')
  })

  it('fails closed before draft storage when TALENT is disabled', async () => {
    moduleMocks.requireTenantModule.mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('MODULE_INACTIVE'))
    const service = createControlledActionService()

    await expect(service.prepare(context, input)).rejects.toThrow('MODULE_INACTIVE')
    expect(moduleMocks.requireTenantModule).toHaveBeenNthCalledWith(1, 'HERA')
    expect(moduleMocks.requireTenantModule).toHaveBeenNthCalledWith(2, 'TALENT')
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { loadHeRaUserContext } from './preferences'

const context: AuthContext = {
  tenantId: 'tenant-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['HR_MANAGER'],
  permissions: ['salary:read'],
}

describe('loadHeRaUserContext', () => {
  it('loads only the explicit tenant-owner preference and memory scope', async () => {
    const loadAgentPreference = vi.fn().mockResolvedValue({
      tone: 'DIRECT',
      detailLevel: 'COMPACT',
      seniorityLevel: 'EXPERT',
    })
    const loadMemory = vi.fn().mockResolvedValue([
      { id: 'memory-1', category: 'PREFERENCE', content: 'Antwoord compact' },
    ])

    const result = await loadHeRaUserContext(context, {
      loadInterfaceLocale: async () => 'nl',
      loadAgentPreference,
      loadMemory,
    })

    expect(loadAgentPreference).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-1' })
    expect(loadMemory).toHaveBeenCalledWith({ tenantId: 'tenant-1', userId: 'user-1' })
    expect(result).toEqual({
      locale: 'nl',
      timeZone: 'Europe/Amsterdam',
      tone: 'DIRECT',
      detailLevel: 'COMPACT',
      seniorityLevel: 'EXPERT',
      memory: [{ id: 'memory-1', category: 'PREFERENCE', content: 'Antwoord compact' }],
    })
  })

  it('uses safe defaults when no HeRa preference exists', async () => {
    const result = await loadHeRaUserContext(context, {
      loadInterfaceLocale: async () => 'en',
      loadAgentPreference: async () => null,
      loadMemory: async () => [],
    })

    expect(result).toMatchObject({
      locale: 'en',
      tone: 'BUSINESS',
      detailLevel: 'BALANCED',
      seniorityLevel: 'EXPERIENCED',
    })
  })
})

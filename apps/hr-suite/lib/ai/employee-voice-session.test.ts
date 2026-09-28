import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'

const { from, query } = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return { from: vi.fn(() => query), query }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from }) }))

import { assertActiveEmployeeVoiceSession } from './realtime-voice'

const context: AuthContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'manager-1',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['employee:read', 'ai:use'],
}

const request = {
  context,
  employeeId: 'employee-1',
  sessionId: '00000000-0000-4000-8000-000000000001',
}

beforeEach(() => {
  from.mockClear()
  query.select.mockClear().mockReturnValue(query)
  query.eq.mockClear().mockReturnValue(query)
  query.maybeSingle.mockReset().mockResolvedValue({ data: { id: request.sessionId, finalization_deadline_at: '2099-01-01T00:00:00.000Z' }, error: null })
})

describe('employee voice tool session binding', () => {
  it('requires the current actor, employee, tenant, HR group, and active session to match', async () => {
    await expect(assertActiveEmployeeVoiceSession(request)).resolves.toBeUndefined()

    expect(from).toHaveBeenCalledWith('ai_voice_sessions')
    expect(query.eq.mock.calls).toEqual([
      ['id', request.sessionId],
      ['tenant_id', context.tenantId],
      ['hr_group_id', context.hrGroupId],
      ['actor_user_id', context.userId],
      ['employee_id', request.employeeId],
      ['status', 'ACTIVE'],
    ])
  })

  it('rejects a forged, foreign, ended, or missing session without running a tool', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(assertActiveEmployeeVoiceSession(request)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects an ACTIVE row after its server deadline has passed', async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: request.sessionId, finalization_deadline_at: '2000-01-01T00:00:00.000Z' }, error: null })

    await expect(assertActiveEmployeeVoiceSession(request)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

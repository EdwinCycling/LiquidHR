import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiExecutionError } from './contracts'
import type { AuthContext } from '@/lib/auth/permissions'

const { assertTeamAiVoiceAllowed, getAuthorizedTeamAiSession } = vi.hoisted(() => ({
  assertTeamAiVoiceAllowed: vi.fn(),
  getAuthorizedTeamAiSession: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('./team-scope', () => ({ assertTeamAiVoiceAllowed, getAuthorizedTeamAiSession }))

import { executeTeamAiTool } from './team-ai'

const auth: AuthContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['start-page:read', 'ai:use'],
}

beforeEach(() => {
  assertTeamAiVoiceAllowed.mockReset().mockResolvedValue(undefined)
  getAuthorizedTeamAiSession.mockReset()
})

describe('executeTeamAiTool', () => {
  it('rechecks current voice governance before loading or using a saved session', async () => {
    assertTeamAiVoiceAllowed.mockRejectedValue(new AiExecutionError('FEATURE_UNAVAILABLE'))

    await expect(executeTeamAiTool({
      auth,
      sessionId: '00000000-0000-4000-8000-000000000001',
      callId: 'call_1',
      name: 'team_overview',
      arguments: {},
      locale: 'nl',
    })).rejects.toMatchObject({ code: 'FEATURE_UNAVAILABLE' })

    expect(assertTeamAiVoiceAllowed).toHaveBeenCalledWith(auth)
    expect(getAuthorizedTeamAiSession).not.toHaveBeenCalled()
  })
})

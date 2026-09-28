import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiExecutionError } from './contracts'
import { defaultAiGroupSettings } from './settings-contracts'
import type { AuthContext } from '@/lib/auth/permissions'

const { assertVoiceAllowed, isRealtimeVoiceEnabled, isAiImproveAvailable } = vi.hoisted(() => ({
  assertVoiceAllowed: vi.fn(),
  isRealtimeVoiceEnabled: vi.fn(),
  isAiImproveAvailable: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeIds: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('./voice-credits', () => ({ finalizeAiVoiceSession: vi.fn() }))
vi.mock('./realtime-voice', () => ({ isRealtimeVoiceEnabled, resolveRealtimeVoiceModel: vi.fn() }))
vi.mock('./supabase-governance', () => ({ isAiImproveAvailable }))
vi.mock('./settings-service', () => ({
  evaluateAiSettingsAccess: vi.fn(),
  getAiGroupSettingsForContext: vi.fn(),
  SupabaseAiSettingsPort: class { assertVoiceAllowed = assertVoiceAllowed },
}))

import { assertTeamAiSessionMembersCurrent, assertTeamAiVoiceAllowed, TeamAiScopeError } from './team-scope'

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
  assertVoiceAllowed.mockReset().mockResolvedValue(defaultAiGroupSettings({ tenantId: auth.tenantId, hrGroupId: auth.hrGroupId ?? '' }))
  isRealtimeVoiceEnabled.mockReset().mockReturnValue(true)
  isAiImproveAvailable.mockReset().mockReturnValue(true)
})

describe('Team AI voice tool authorization', () => {
  it('checks the current group voice policy for the current actor', async () => {
    await assertTeamAiVoiceAllowed(auth)

    expect(assertVoiceAllowed).toHaveBeenCalledWith({
      scope: { tenantId: auth.tenantId, hrGroupId: auth.hrGroupId, administrationId: auth.administrationId },
      authContext: auth,
      contextType: 'TEAM',
    })
  })

  it('rejects actors outside the Team AI permission and role boundary before loading settings', async () => {
    await expect(assertTeamAiVoiceAllowed({ ...auth, permissions: ['start-page:read'] })).rejects.toBeInstanceOf(TeamAiScopeError)
    expect(assertVoiceAllowed).not.toHaveBeenCalled()

    await expect(assertTeamAiVoiceAllowed({ ...auth, activeRoles: ['EMPLOYEE'] })).rejects.toMatchObject({ code: 'TEAM_SCOPE_FORBIDDEN' })
    expect(assertVoiceAllowed).not.toHaveBeenCalled()
  })

  it('fails closed when realtime or AI provider execution is unavailable', async () => {
    isRealtimeVoiceEnabled.mockReturnValue(false)
    await expect(assertTeamAiVoiceAllowed(auth)).rejects.toMatchObject({ code: 'FEATURE_UNAVAILABLE' })
    expect(assertVoiceAllowed).not.toHaveBeenCalled()

    isRealtimeVoiceEnabled.mockReturnValue(true)
    isAiImproveAvailable.mockReturnValue(false)
    await expect(assertTeamAiVoiceAllowed(auth)).rejects.toBeInstanceOf(AiExecutionError)
    expect(assertVoiceAllowed).not.toHaveBeenCalled()
  })

  it('propagates the current HR-group AI governance denial', async () => {
    assertVoiceAllowed.mockRejectedValue(new AiExecutionError('FEATURE_UNAVAILABLE'))

    await expect(assertTeamAiVoiceAllowed(auth)).rejects.toMatchObject({ code: 'FEATURE_UNAVAILABLE' })
    expect(assertVoiceAllowed).toHaveBeenCalledTimes(1)
  })

  it('blocks a saved Team session when any saved employee leaves the actor current scope', () => {
    expect(() => assertTeamAiSessionMembersCurrent(['employee-1', 'employee-2'], ['employee-1']))
      .toThrowError(expect.objectContaining({ code: 'TEAM_SCOPE_FORBIDDEN', status: 403 }))
    expect(() => assertTeamAiSessionMembersCurrent([], ['employee-1']))
      .toThrowError(expect.objectContaining({ code: 'TEAM_SCOPE_FORBIDDEN', status: 403 }))
    expect(() => assertTeamAiSessionMembersCurrent(['employee-1'], ['employee-1', 'employee-3'])).not.toThrow()
  })
})

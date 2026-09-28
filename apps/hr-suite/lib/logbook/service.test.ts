import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { defaultAiGroupSettings } from '@/lib/ai/settings-contracts'
import { createAiTeamSummaryLogbookEntry } from './service'

const { getAiGroupSettingsForContext, getAuthorizedTeamAiSession } = vi.hoisted(() => ({
  getAiGroupSettingsForContext: vi.fn(),
  getAuthorizedTeamAiSession: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai/settings-service', () => ({ getAiGroupSettingsForContext }))
vi.mock('@/lib/ai/team-scope', () => ({ getAuthorizedTeamAiSession }))

const auth: AuthContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['logbook:write'],
}

const input = { title: 'Teamgesprek', description: 'Vervolgactie.', sessionId: '00000000-0000-4000-8000-000000000001' }
const settings = defaultAiGroupSettings({ tenantId: auth.tenantId, hrGroupId: auth.hrGroupId ?? '' })

beforeEach(() => {
  getAiGroupSettingsForContext.mockReset().mockResolvedValue({ ...settings, teamLogbookSaveEnabled: false })
  getAuthorizedTeamAiSession.mockReset()
})

describe('AI Team Summary logbook save authorization', () => {
  it('blocks direct AI-summary saves when the current group save switch is disabled', async () => {
    await expect(createAiTeamSummaryLogbookEntry(input, { context: auth, supabase: {} as never }))
      .rejects.toMatchObject({ code: 'LOGBOOK_AI_SAVE_DISABLED', status: 403 })

    expect(getAiGroupSettingsForContext).toHaveBeenCalledWith(auth)
    expect(getAuthorizedTeamAiSession).not.toHaveBeenCalled()
  })

  it('continues to require an owned ended Team session when saves are enabled', async () => {
    getAiGroupSettingsForContext.mockResolvedValue({ ...settings, teamLogbookSaveEnabled: true })
    getAuthorizedTeamAiSession.mockResolvedValue({ id: input.sessionId, status: 'ACTIVE' })

    await expect(createAiTeamSummaryLogbookEntry(input, { context: auth, supabase: {} as never }))
      .rejects.toMatchObject({ code: 'LOGBOOK_SESSION_INVALID', status: 409 })

    expect(getAuthorizedTeamAiSession).toHaveBeenCalledWith(auth, input.sessionId)
  })
})

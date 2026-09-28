import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { defaultAiGroupSettings } from './settings-contracts'

const { rpc, resolveMonth, getSettings } = vi.hoisted(() => ({
  rpc: vi.fn(),
  resolveMonth: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))
vi.mock('./settings-service', () => ({ getAiGroupSettingsForContext: getSettings }))
vi.mock('./timezone', () => ({ resolveHrGroupCalendarMonth: resolveMonth }))

import { classifyFinalizeError, finalizeAiVoiceSession } from './voice-credits'

const context: AuthContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'hr-group-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['DIRECT_MANAGER'],
  permissions: ['ai:use'],
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [{ duration_seconds: 45, billable_voice_units: 1, voice_credits: 1, finalized: true }], error: null })
  resolveMonth.mockReset().mockResolvedValue('2026-09')
  getSettings.mockReset().mockResolvedValue({ ...defaultAiGroupSettings({ tenantId: context.tenantId, hrGroupId: context.hrGroupId ?? '' }), aiEnabled: false, voiceEnabled: false, maxVoiceSessionSeconds: 900 })
})

describe('classifyFinalizeError', () => {
  it('maps known database messages to a safe diagnostic category', () => {
    expect(classifyFinalizeError({ code: 'P0001', message: 'AI_CREDITS_EXHAUSTED' })).toEqual({
      databaseCode: 'P0001',
      category: 'credits-exhausted',
    })
  })

  it('does not return an unknown database error message', () => {
    expect(classifyFinalizeError({ code: 'XX000', message: 'sensitive database detail' })).toEqual({
      databaseCode: 'XX000',
      category: 'unknown',
    })
  })

  it('finalizes an already-authorized voice session after AI and voice have been disabled', async () => {
    await expect(finalizeAiVoiceSession({
      context,
      contextType: 'EMPLOYEE',
      sessionId: '00000000-0000-4000-8000-000000000001',
      status: 'ENDED',
      toolCallCount: 1,
      terminationReason: 'EXPLICIT',
    })).resolves.toMatchObject({ durationSeconds: 45, voiceCredits: 1, finalized: true })

    expect(rpc).toHaveBeenCalledWith('finalize_ai_voice_session', expect.objectContaining({
      requested_tenant_id: context.tenantId,
      requested_hr_group_id: context.hrGroupId,
      requested_actor_user_id: context.userId,
      requested_max_duration_seconds: 900,
    }))
  })
})

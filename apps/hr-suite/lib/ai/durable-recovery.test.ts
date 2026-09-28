import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))

import { reconcileAiLifecycle, reconcileVoiceForContext } from './durable-recovery'

const context: AuthContext = {
  tenantId: 'tenant-a',
  hrGroupId: 'group-a',
  administrationId: null,
  userId: 'user-a',
  employeeId: null,
  activeRoles: [],
  permissions: [],
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [{ processed_count: 1, finalized_count: 1, retryable_count: 0 }], error: null })
})

describe('AI durable recovery service', () => {
  it('uses only authenticated tenant/group scope for voice recovery, without requiring current AI permission', async () => {
    await expect(reconcileVoiceForContext(context)).resolves.toBeUndefined()

    expect(rpc).toHaveBeenCalledWith('reconcile_expired_ai_voice_sessions', {
      requested_tenant_id: 'tenant-a',
      requested_hr_group_id: 'group-a',
      requested_batch_size: 20,
    })
  })

  it('reconciles invocation lifecycle and voice in deterministic bounded calls', async () => {
    await reconcileAiLifecycle({ tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: null })

    expect(rpc.mock.calls).toEqual([
      ['reconcile_ai_invocation_lifecycle', {
        requested_tenant_id: 'tenant-a',
        requested_hr_group_id: 'group-a',
        requested_batch_size: 20,
      }],
      ['reconcile_expired_ai_voice_sessions', {
        requested_tenant_id: 'tenant-a',
        requested_hr_group_id: 'group-a',
        requested_batch_size: 20,
      }],
    ])
  })

  it('does not reveal database errors through the recovery service', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'sensitive row detail' } })

    await expect(reconcileVoiceForContext(context)).rejects.toMatchObject({ code: 'CREDITS_UNAVAILABLE' })
    await expect(reconcileVoiceForContext(context)).resolves.toBeUndefined()
  })
})

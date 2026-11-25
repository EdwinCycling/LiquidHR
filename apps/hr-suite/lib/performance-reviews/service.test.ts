import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from, requirePermission, requireAnyPermission } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), requirePermission: vi.fn(), requireAnyPermission: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ rpc, from, storage: { from: vi.fn() } })) }))
vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireHrGroupId: (context: { hrGroupId?: string }) => context.hrGroupId ?? (() => { throw new Error('HR_GROUP_REQUIRED') })(),
  requirePermission,
  requireAnyPermission,
}))

import { createPerformanceReviewRound, saveManagerResponse, saveSelfReflection, updatePerformanceReviewRound } from './service'

describe('performance review service authorization and RPC contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ tenantId: 'tenant', hrGroupId: 'group', employeeId: 'employee', permissions: [] })
    requireAnyPermission.mockResolvedValue({ tenantId: 'tenant', hrGroupId: 'group', employeeId: 'employee', permissions: [] })
    rpc.mockResolvedValue({ data: { id: 'result' }, error: null })
  })

  it('sends round creation through the permission-gated DB function', async () => {
    await createPerformanceReviewRound({ title: 'Jaarlijks gesprek', introduction: 'Terugblik', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-22', dueDate: null, rating: null })
    expect(requirePermission).toHaveBeenCalledWith('performance-review:manage', undefined)
    expect(rpc).toHaveBeenCalledWith('create_performance_review_round', expect.objectContaining({ requested_hr_group: 'group' }))
  })

  it('updates an existing draft through the permission-gated versioned DB function', async () => {
    await updatePerformanceReviewRound('round', { title: 'Jaarlijks gesprek', introduction: 'Terugblik', roundType: 'DEVELOPMENT', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-30', dueDate: '2026-12-18', rating: null }, 2)
    expect(requirePermission).toHaveBeenCalledWith('performance-review:manage', undefined)
    expect(rpc).toHaveBeenCalledWith('update_performance_review_round', expect.objectContaining({ requested_round: 'round', expected_version: 2, requested_title: 'Jaarlijks gesprek' }))
  })

  it('keeps actor and phase checks in the DB RPC contract', async () => {
    await saveSelfReflection('dossier', 2, 'Mijn reflectie', true)
    expect(rpc).toHaveBeenCalledWith('save_performance_review_self', expect.objectContaining({ requested_dossier: 'dossier', expected_version: 2, submit_now: true }))
    await saveManagerResponse('dossier', { version: 3, body: 'Reactie', meetingDate: null }, true)
    expect(rpc).toHaveBeenCalledWith('save_performance_review_manager', expect.objectContaining({ requested_dossier: 'dossier', expected_version: 3, submit_now: true }))
  })

  it('returns rating validation failures as client errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PERFORMANCE_RATING_REQUIRED' } })
    await expect(saveManagerResponse('dossier', { version: 3, body: 'Reactie zonder volledige beoordeling' }, true))
      .rejects.toMatchObject({ code: 'PERFORMANCE_RATING_REQUIRED', status: 400 })
  })

  it('preserves the canonical authorization failure from permission resolution', async () => {
    requirePermission.mockRejectedValueOnce(new Error('denied'))
    await expect(createPerformanceReviewRound({ title: 'x', introduction: 'y', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-22', rating: null })).rejects.toThrow('denied')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not collapse an unauthenticated response into a 403', async () => {
    requirePermission.mockRejectedValueOnce(Object.assign(new Error('Je bent niet ingelogd.'), { status: 401 }))
    await expect(createPerformanceReviewRound({ title: 'x', introduction: 'y', periodStart: '2026-01-01', periodEnd: '2026-12-31', startDate: '2026-11-22', rating: null })).rejects.toMatchObject({ status: 401 })
    expect(rpc).not.toHaveBeenCalled()
  })
})

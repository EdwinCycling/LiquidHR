import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createAdminRpcClient: vi.fn(), rpc: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminRpcClient: mocks.createAdminRpcClient }))

import { runDuePerformanceReviewActivations } from './scheduled-activation-service'

describe('scheduled performance review activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAdminRpcClient.mockReturnValue({ rpc: mocks.rpc })
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
  })

  it('uses the scheduler-only RPC and returns its activated count', async () => {
    await expect(runDuePerformanceReviewActivations()).resolves.toEqual({ activated: 3 })
    expect(mocks.rpc).toHaveBeenCalledWith('run_due_performance_review_activations')
  })

  it('fails closed when the RPC fails or returns an invalid count', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'PERMISSION_DENIED' } })
    await expect(runDuePerformanceReviewActivations()).rejects.toMatchObject({ code: 'PERFORMANCE_REVIEW_SCHEDULER_FAILED' })
    mocks.rpc.mockResolvedValueOnce({ data: -1, error: null })
    await expect(runDuePerformanceReviewActivations()).rejects.toMatchObject({ code: 'PERFORMANCE_REVIEW_SCHEDULER_FAILED' })
  })
})

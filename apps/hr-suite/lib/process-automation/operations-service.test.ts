import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireAuthContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuthContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext }))
vi.mock('server-only', () => ({}))

import { getProcessOperationsInbox } from './operations-service'

const inbox = {
  summary: { blockedProcesses: 1, overdueTasks: 2, failedAutomations: 3, retryingAutomations: 4 },
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
  items: [{
    problemKey: 'AUTOMATION_RETRY',
    jobType: 'PROCESS_REMINDER',
    sourceId: '00000000-0000-4000-8000-000000000001',
    jobId: '00000000-0000-4000-8000-000000000001',
    processInstanceId: '00000000-0000-4000-8000-000000000002',
    workItemId: '00000000-0000-4000-8000-000000000003',
    processTitle: 'Onboarding',
    stepTitle: 'Beoordelen',
    status: 'RETRY',
    responsibleLabel: 'Jan Beheerder',
    deadlineAt: null,
    occurredAt: '2026-10-23T10:00:00+00:00',
    lastAttemptAt: '2026-10-23T10:00:00+00:00',
    nextRetryAt: '2026-10-23T10:20:00+00:00',
    lastErrorCode: 'PROCESS_REMINDER_TEMPORARY',
    canRecover: false,
  }],
}

describe('process operations service', () => {
  beforeEach(() => {
    createClient.mockReset()
    requireAuthContext.mockReset()
    requireAuthContext.mockResolvedValue({ permissions: ['process-operations:read'] })
  })

  it('uses the scope-filtered operations RPC and preserves its read-only recovery decision', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: inbox, error: null })
    createClient.mockResolvedValue({ rpc })

    const result = await getProcessOperationsInbox({ search: 'Onboarding', filter: 'RETRY', page: 1, pageSize: 25 }, 'nl')

    expect(rpc).toHaveBeenCalledWith('get_process_operations_inbox', {
      requested_search: 'Onboarding',
      requested_filter: 'RETRY',
      requested_page: 1,
      requested_page_size: 25,
      requested_language: 'nl',
    })
    expect(result.items[0].canRecover).toBe(false)
    expect(result.total).toBe(1)
  })

  it('does not invent recovery capability from a global write permission', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: inbox, error: null })
    createClient.mockResolvedValue({ rpc })
    requireAuthContext.mockResolvedValue({ permissions: ['process-operations:read', 'process-operations:write'] })

    const result = await getProcessOperationsInbox({ filter: 'ALL', page: 1, pageSize: 25 }, 'en')

    expect(result.items[0].canRecover).toBe(false)
  })

  it('denies actors without process-operations:read before calling the operations RPC', async () => {
    const rpc = vi.fn()
    createClient.mockResolvedValue({ rpc })
    requireAuthContext.mockResolvedValue({ permissions: ['process-definition:read'] })

    await expect(getProcessOperationsInbox({ filter: 'ALL', page: 1, pageSize: 25 }, 'nl'))
      .rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed when the RPC payload contains unexpected fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...inbox, privateAnswer: 'hidden' }, error: null })
    createClient.mockResolvedValue({ rpc })

    await expect(getProcessOperationsInbox({ filter: 'ALL', page: 1, pageSize: 25 }, 'nl'))
      .rejects.toMatchObject({ code: 'PROCESS_OPERATIONS_READ_FAILED', status: 500 })
  })
})

import { describe, expect, it, vi } from 'vitest'

const { createClient, requireAuthContext } = vi.hoisted(() => ({ createClient: vi.fn(), requireAuthContext: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext }))

import { listProcessWork, listProcessWorkTabCounts, type ProcessWorkDependencies, type ProcessWorkTab } from './work-service'

const context = {
  tenantId: '00000000-0000-4000-8000-000000000010',
  hrGroupId: '00000000-0000-4000-8000-000000000011',
  administrationId: null,
  userId: '00000000-0000-4000-8000-000000000012',
  employeeId: null,
  activeRoles: [],
  permissions: ['process-task:read'],
}

function dependencies(rpc: ReturnType<typeof vi.fn>): ProcessWorkDependencies {
  return { context, supabase: { rpc } as unknown as ProcessWorkDependencies['supabase'] }
}

describe('process work service', () => {
  it('pagineert administratie-filtering na de bestaande wrapper', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [], total: 51, hasMore: false }, error: null })

    const result = await listProcessWork({ language: 'nl', administrationId: '00000000-0000-4000-8000-000000000013', limit: 25, offset: 25 }, dependencies(rpc))

    expect(rpc).toHaveBeenCalledWith('get_process_work_projection_with_administration', expect.objectContaining({ requested_limit: 200, requested_offset: 0 }))
    expect(result).toEqual({ items: [], total: 51, hasMore: true })
  })

  it('levert counts voor alle bestaande tabs vanuit dezelfde projection', async () => {
    const totals: Record<ProcessWorkTab, number> = { TODO: 7, CLAIMED: 1, WAITING: 2, COMPLETED: 2, ALL: 12 }
    const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => ({ data: { items: [], total: totals[args.requested_tab as ProcessWorkTab], hasMore: false }, error: null }))

    const result = await listProcessWorkTabCounts({ language: 'nl' }, dependencies(rpc))

    expect(result).toEqual(totals)
    expect(rpc).toHaveBeenCalledTimes(5)
    expect(rpc.mock.calls.map((call) => (call[1] as Record<string, unknown>).requested_tab).sort()).toEqual(['ALL', 'CLAIMED', 'COMPLETED', 'TODO', 'WAITING'])
  })
})

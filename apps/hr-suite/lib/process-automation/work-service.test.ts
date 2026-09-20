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
  it('geeft administratie-filtering en serverpaginering door aan de uniforme projectie', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [], total: 51, hasMore: true }, error: null })

    const result = await listProcessWork({ language: 'nl', administrationId: '00000000-0000-4000-8000-000000000013', limit: 25, offset: 25 }, dependencies(rpc))

    expect(rpc).toHaveBeenCalledWith('get_unified_process_work_projection', expect.objectContaining({
      requested_administration_id: '00000000-0000-4000-8000-000000000013',
      requested_hr_group_id: context.hrGroupId,
      requested_limit: 25,
      requested_offset: 25,
      requested_view: 'WORK',
    }))
    expect(result).toEqual({ items: [], total: 51, hasMore: true })
  })

  it('accepteert de employment-subjectreferentie van de uniforme projectie', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        items: [{
          workItemId: '00000000-0000-4000-8000-000000000020',
          processInstanceId: '00000000-0000-4000-8000-000000000021',
          stepInstanceId: '00000000-0000-4000-8000-000000000022',
          processDefinitionId: '00000000-0000-4000-8000-000000000023',
          processKey: 'leave-request-v1',
          processTitle: 'Verlofaanvraag',
          subjectEmployeeId: '00000000-0000-4000-8000-000000000024',
          subjectEmploymentId: '00000000-0000-4000-8000-000000000025',
          subjectName: 'Noah Test',
          stepKey: 'manager-approval',
          stepTitle: 'manager-approval',
          participantKey: 'manager',
          assignmentMode: 'EXACTLY_ONE',
          receivedVia: 'DIRECT',
          assignmentExplanation: { source: 'DIRECT_MANAGER_OF_SUBJECT' },
          status: 'OPEN',
          instanceStatus: 'RUNNING',
          currentStepKey: 'manager-approval',
          instanceVersion: 1,
          expectedVersion: 1,
          claimedByUserId: null,
          assigneeEmployeeId: '00000000-0000-4000-8000-000000000026',
          claimedAt: null,
          availableAt: '2026-09-20T00:00:00.000Z',
          deadlineAt: null,
          createdAt: '2026-09-20T00:00:00.000Z',
          updatedAt: '2026-09-20T00:00:00.000Z',
          canAct: true,
          canClaim: true,
          isOverdue: false,
          businessType: 'LEAVE',
          businessCategory: 'LEAVE_REQUEST',
          businessStatus: 'OPEN',
          leaveRequestId: '00000000-0000-4000-8000-000000000027',
        }],
        total: 1,
        hasMore: false,
      },
      error: null,
    })

    await expect(listProcessWork({ language: 'nl' }, dependencies(rpc))).resolves.toMatchObject({ total: 1 })
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

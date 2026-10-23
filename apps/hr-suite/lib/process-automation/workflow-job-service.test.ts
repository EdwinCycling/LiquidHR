import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createAdminRpcClient, requireAuthContext, after } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminRpcClient: vi.fn(),
  requireAuthContext: vi.fn(),
  after: vi.fn((callback: () => Promise<void>) => { void callback() }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminRpcClient }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext }))
vi.mock('next/server', () => ({ after }))
vi.mock('server-only', () => ({}))

import { runScheduledProcessReminderJobs, runWorkflowJobs } from './workflow-job-service'

const job = {
  id: '00000000-0000-4000-8000-000000000001',
  jobType: 'PROCESS_REMINDER' as const,
  tenantId: '00000000-0000-4000-8000-000000000002',
  hrGroupId: '00000000-0000-4000-8000-000000000003',
  administrationId: '00000000-0000-4000-8000-000000000004',
  processInstanceId: '00000000-0000-4000-8000-000000000005',
  stepInstanceId: '00000000-0000-4000-8000-000000000006',
  workItemId: null,
  attempts: 1,
  maxAttempts: 5,
  payload: { processInstanceId: '00000000-0000-4000-8000-000000000005' },
  correlationId: null,
}

function resultFor(data: unknown = null, error: { message: string } | null = null) {
  return { data, error }
}

describe('workflow job runner', () => {
  beforeEach(() => {
    createClient.mockReset()
    createAdminRpcClient.mockReset()
    requireAuthContext.mockReset()
    after.mockClear()
    requireAuthContext.mockResolvedValue({ permissions: ['process-operations:write'] })
  })

  it('laat twee gelijktijdige runners dezelfde job maar eenmaal uitvoeren', async () => {
    let claimed = false
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_workflow_job') {
        if (claimed) return resultFor()
        claimed = true
        return resultFor(job)
      }
      if (name === 'create_process_deadline_reminder') return resultFor({ created: true })
      if (name === 'finish_workflow_job') return resultFor({ status: 'SUCCEEDED' })
      throw new Error(`Unexpected RPC: ${name}`)
    })
    createClient.mockResolvedValue({ rpc })

    const [first, second] = await Promise.all([runWorkflowJobs(1), runWorkflowJobs(1)])

    expect(first.claimed + second.claimed).toBe(1)
    expect(rpc.mock.calls.filter(([name]) => name === 'create_process_deadline_reminder')).toHaveLength(1)
    expect(rpc.mock.calls.filter(([name]) => name === 'finish_workflow_job')).toHaveLength(1)
  })

  it('claimt parallelle schedulerruns zonder gebruikerssessie maximaal eenmaal dezelfde job', async () => {
    let claimed = false
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_process_reminder_job_system') {
        if (claimed) return resultFor()
        claimed = true
        return resultFor(job)
      }
      if (name === 'create_process_deadline_reminder_system') return resultFor({ created: true })
      if (name === 'finish_process_reminder_job_system') return resultFor({ status: 'SUCCEEDED' })
      throw new Error(`Unexpected RPC: ${name}`)
    })
    createAdminRpcClient.mockReturnValue({ rpc })

    const [first, second] = await Promise.all([
      runScheduledProcessReminderJobs(1),
      runScheduledProcessReminderJobs(1),
    ])

    expect(first.claimed + second.claimed).toBe(1)
    expect(rpc.mock.calls.filter(([name]) => name === 'create_process_deadline_reminder_system')).toHaveLength(1)
    expect(rpc.mock.calls.filter(([name]) => name === 'finish_process_reminder_job_system')).toHaveLength(1)
    expect(requireAuthContext).not.toHaveBeenCalled()
  })

  it('maakt een tijdelijke fout herstelbaar met een retry', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_workflow_job') return resultFor(job)
      if (name === 'create_process_deadline_reminder') return resultFor(null, { message: 'PROCESS_REMINDER_TEMPORARY' })
      if (name === 'finish_workflow_job') return resultFor({ status: 'RETRY' })
      throw new Error(`Unexpected RPC: ${name}`)
    })
    createClient.mockResolvedValue({ rpc })

    const result = await runWorkflowJobs(1)

    expect(result).toMatchObject({ claimed: 1, succeeded: 0, retried: 1, deadLettered: 0 })
    expect(rpc).toHaveBeenCalledWith('finish_workflow_job', expect.objectContaining({
      requested_outcome: 'FAILED',
      requested_error_code: 'PROCESS_REMINDER_TEMPORARY',
    }))
  })

  it('rapporteert een verlopen poging die niet meer retrybaar is als dead-letter', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'claim_workflow_job') return resultFor({ ...job, attempts: 5, maxAttempts: 5 })
      if (name === 'create_process_deadline_reminder') return resultFor(null, { message: 'PROCESS_REMINDER_EXPIRED' })
      if (name === 'finish_workflow_job') return resultFor({ status: 'DEAD_LETTER' })
      throw new Error(`Unexpected RPC: ${name}`)
    })
    createClient.mockResolvedValue({ rpc })

    const result = await runWorkflowJobs(1)

    expect(result).toMatchObject({ claimed: 1, succeeded: 0, retried: 0, deadLettered: 1 })
  })
})

import { readFile } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAdminRpcClient: vi.fn(),
  createClient: vi.fn(),
  requireAuthContext: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminRpcClient: mocks.createAdminRpcClient }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext: mocks.requireAuthContext }))
vi.mock('server-only', () => ({}))

import { GET } from './route'

const job = {
  id: '00000000-0000-4000-8000-000000000001',
  jobType: 'PROCESS_REMINDER',
  tenantId: '00000000-0000-4000-8000-000000000002',
  hrGroupId: '00000000-0000-4000-8000-000000000003',
  administrationId: '00000000-0000-4000-8000-000000000004',
  processInstanceId: '00000000-0000-4000-8000-000000000005',
  stepInstanceId: '00000000-0000-4000-8000-000000000006',
  workItemId: '00000000-0000-4000-8000-000000000007',
  attempts: 1,
  maxAttempts: 5,
  payload: { deliveryKind: 'BEFORE_DEADLINE' },
  correlationId: null,
}

const result = (data: unknown = null, error: { message: string } | null = null) => ({ data, error })

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'scheduler-test-secret')
  mocks.rpc.mockReset()
  mocks.createClient.mockReset()
  mocks.requireAuthContext.mockReset()
  mocks.createAdminRpcClient.mockReset().mockReturnValue({ rpc: mocks.rpc })
})

afterEach(() => vi.unstubAllEnvs())

describe('process automation reminder scheduler route', () => {
  it('rejects requests without the configured scheduler bearer', async () => {
    const response = await GET(new Request('https://liquidhr.test/api/cron/process-automation-reminders'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ code: 'CRON_UNAUTHORIZED' })
    const wrongSecretResponse = await GET(new Request('https://liquidhr.test/api/cron/process-automation-reminders', {
      headers: { authorization: 'Bearer incorrect-secret' },
    }))
    expect(wrongSecretResponse.status).toBe(401)
    expect(mocks.createAdminRpcClient).not.toHaveBeenCalled()
  })

  it('uses the actual scheduled worker without a human session and drains the claimed reminder job', async () => {
    let claimed = false
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'claim_process_reminder_job_system') {
        if (claimed) return result()
        claimed = true
        return result(job)
      }
      if (name === 'create_process_deadline_reminder_system') return result({ created: true })
      if (name === 'finish_process_reminder_job_system') return result({ status: 'SUCCEEDED' })
      throw new Error(`Unexpected RPC: ${name}`)
    })

    const response = await GET(new Request('https://liquidhr.test/api/cron/process-automation-reminders', {
      headers: { authorization: 'Bearer scheduler-test-secret' },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: {
      claimed: 1, succeeded: 1, retried: 0, deadLettered: 0, errorCodes: [],
    } })
    expect(mocks.createAdminRpcClient).toHaveBeenCalledTimes(1)
    expect(mocks.requireAuthContext).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_process_reminder_job_system',
      'create_process_deadline_reminder_system',
      'finish_process_reminder_job_system',
      'claim_process_reminder_job_system',
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('create_process_deadline_reminder_system', expect.objectContaining({
      requested_job_id: job.id,
      requested_worker_id: expect.any(String),
      requested_language: 'nl',
    }))
  })

  it('keeps the scheduler route wired to the checked-in periodic Vercel schedule', async () => {
    const config = JSON.parse(await readFile(new URL('../../../../../../vercel.json', import.meta.url), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>
    }
    expect(config.crons).toContainEqual({ path: '/api/cron/process-automation-reminders', schedule: '* * * * *' })
  })
})

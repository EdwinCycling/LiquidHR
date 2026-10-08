import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  previewPlan: vi.fn(),
  readRecovery: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll-import/finalization/decision-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payroll-import/finalization/decision-api')>('@/lib/payroll-import/finalization/decision-api')
  return { ...actual, previewPayrollImportPlan: mocks.previewPlan, getPayrollImportFinalizationRecovery: mocks.readRecovery }
})

import { GET, POST } from './route'

const batchId = '60000000-0000-4000-8000-000000000001'

afterEach(() => {
  vi.clearAllMocks()
  mocks.readRecovery.mockResolvedValue({ canResume: false, planStatus: 'NONE', blockers: [], result: null })
})

describe('payroll import plan route', () => {
  it('reads scoped recovery state without mutating the plan', async () => {
    const recovery = { canResume: true, planStatus: 'FAILED', blockers: [], result: { status: 'READY_FOR_REVIEW' } }
    mocks.readRecovery.mockResolvedValue(recovery)
    const response = await GET(new Request('http://localhost/api/payroll/import/batches/' + batchId + '/plan'), { params: Promise.resolve({ batchId }) })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: recovery })
    expect(mocks.readRecovery).toHaveBeenCalledWith(batchId)
    expect(mocks.previewPlan).not.toHaveBeenCalled()
  })

  it('rejects client-supplied actions and authority fields', async () => {
    const response = await POST(new Request(`http://localhost/api/payroll/import/batches/${batchId}/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actions: [], actorUserId: '10000000-0000-4000-8000-000000000001' }),
    }), { params: Promise.resolve({ batchId }) })
    expect(response.status).toBe(400)
    expect(mocks.previewPlan).not.toHaveBeenCalled()
  })

  it('passes an empty request to the server planner and returns its readback envelope', async () => {
    const plan = { status: 'BLOCKED', canExecute: false, blockers: ['XML_FINALIZATION_DISABLED'], ledgerReadback: [] }
    mocks.previewPlan.mockResolvedValue(plan)
    const response = await POST(new Request(`http://localhost/api/payroll/import/batches/${batchId}/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ batchId }) })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: plan })
    expect(mocks.previewPlan).toHaveBeenCalledWith(batchId)
  })
})

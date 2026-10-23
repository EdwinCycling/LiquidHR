import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
  startProcess: vi.fn(),
  getProcessInstanceProjection: vi.fn(),
  getProcessWorkItemDetail: vi.fn(),
  scheduleWorkflowDrain: vi.fn(),
  getLocale: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return { ...actual, getRequestAuthorizationContext: mocks.getRequestAuthorizationContext }
})
vi.mock('@/lib/process-automation/runtime-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/process-automation/runtime-service')>()
  return { ...actual, startProcess: mocks.startProcess, getProcessInstanceProjection: mocks.getProcessInstanceProjection }
})
vi.mock('@/lib/process-automation/work-service', () => ({ getProcessWorkItemDetail: mocks.getProcessWorkItemDetail }))
vi.mock('@/lib/process-automation/workflow-job-service', () => ({ scheduleWorkflowDrain: mocks.scheduleWorkflowDrain }))
vi.mock('@/lib/i18n/server', () => ({ getLocale: mocks.getLocale }))

import { POST } from './route'
import { ProcessRuntimeError } from '@/lib/process-automation/runtime-service'

const actorEmployeeId = '00000000-0000-4000-8000-000000000001'
const processDefinitionId = '00000000-0000-4000-8000-000000000002'
const processInstanceId = '00000000-0000-4000-8000-000000000003'
const workItemId = '00000000-0000-4000-8000-000000000004'

function request(body: unknown): Request {
  return new Request('http://localhost/api/processes/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('POST /api/processes/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRequestAuthorizationContext.mockResolvedValue({ context: { employeeId: actorEmployeeId } })
    mocks.startProcess.mockResolvedValue({ processInstanceId, status: 'RUNNING', currentStepKey: 'employee-request', instanceVersion: 1, correlationId: null, eventId: null })
    mocks.getProcessInstanceProjection.mockResolvedValue({ processInstanceId, status: 'RUNNING', currentStepKey: 'employee-request', instanceVersion: 1, startedAt: null, completedAt: null, correlationId: null, steps: [], workItems: [{ id: workItemId, stepKey: 'employee-request', activationNumber: 1, status: 'OPEN', expectedVersion: 1, activatedAt: null, completedAt: null, deadlineAt: null }] })
    mocks.getProcessWorkItemDetail.mockResolvedValue({ canAct: true })
    mocks.getLocale.mockResolvedValue('nl')
  })

  it('derives the ESS subject from the authenticated employee and redirects to the existing task detail', async () => {
    const response = await POST(request({ processDefinitionId, idempotencyKey: 'stable-request-key' }))
    const body = await response.json() as { nextHref: string }

    expect(response.status).toBe(200)
    expect(body.nextHref).toBe(`/work/${workItemId}`)
    expect(mocks.startProcess).toHaveBeenCalledWith({ processDefinitionId, subjectEmployeeId: actorEmployeeId, idempotencyKey: 'stable-request-key' })
    expect(mocks.scheduleWorkflowDrain).toHaveBeenCalledOnce()
  })

  it('preserves the existing typed start contract and its response for established starters', async () => {
    const subjectEmployeeId = '00000000-0000-4000-8000-000000000005'
    const response = await POST(request({ processDefinitionId, subjectEmployeeId, employmentId: null, businessEffectiveDate: null, idempotencyKey: 'existing-starter-key', correlationId: null }))
    const body = await response.json() as { data: { processInstanceId: string }; nextHref?: string }

    expect(response.status).toBe(200)
    expect(body.data.processInstanceId).toBe(processInstanceId)
    expect(body.nextHref).toBeUndefined()
    expect(mocks.startProcess).toHaveBeenCalledWith({ processDefinitionId, subjectEmployeeId, employmentId: null, businessEffectiveDate: null, idempotencyKey: 'existing-starter-key', correlationId: null })
  })

  it('keeps a forged legacy subject behind the engine start authorization', async () => {
    const otherEmployeeId = '00000000-0000-4000-8000-000000000006'
    mocks.startProcess.mockRejectedValueOnce(new ProcessRuntimeError('FORBIDDEN', 403))
    const response = await POST(request({ processDefinitionId, subjectEmployeeId: otherEmployeeId, idempotencyKey: 'forged-subject-key' }))

    expect(response.status).toBe(403)
    expect(mocks.startProcess).toHaveBeenCalledWith({ processDefinitionId, subjectEmployeeId: otherEmployeeId, idempotencyKey: 'forged-subject-key' })
  })

  it('rejects caller-supplied tenant and employee fields from the self-start request shape', async () => {
    const response = await POST(request({ processDefinitionId, idempotencyKey: 'injected-scope-key', tenantId: 'other-tenant', employeeId: 'other-employee' }))

    expect(response.status).toBe(400)
    expect(mocks.startProcess).not.toHaveBeenCalled()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  saveDecision: vi.fn(),
  permissionErrorResponse: vi.fn<() => Response | null>(() => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll-import/finalization/decision-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/payroll-import/finalization/decision-api')>('@/lib/payroll-import/finalization/decision-api')
  return {
    ...actual,
    getPayrollImportDecisionSnapshot: mocks.getSnapshot,
    savePayrollImportDecision: mocks.saveDecision,
  }
})

import { GET } from './route'
import { PUT } from './[personId]/route'

const batchId = '60000000-0000-4000-8000-000000000001'
const personId = '70000000-0000-4000-8000-000000000001'
const decision = {
  match: { action: 'CREATE_EMPLOYEE', confirmed: true },
  incomeRelationshipBySourceRef: {},
  employmentByIncomeRelationship: {},
  sourceFieldDecisions: {},
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('payroll import decision routes', () => {
  it('maps an authenticated service response to the bounded GET envelope', async () => {
    mocks.getSnapshot.mockResolvedValue({ batchId, people: [], decisions: [] })
    const response = await GET(new Request(`http://localhost/api/payroll/import/batches/${batchId}/decisions`), { params: Promise.resolve({ batchId }) })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { batchId, people: [], decisions: [] } })
  })

  it('maps permission failures without invoking a write', async () => {
    mocks.saveDecision.mockRejectedValue(new Error('permission denied'))
    mocks.permissionErrorResponse.mockReturnValueOnce(NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }))
    const response = await PUT(new Request(`http://localhost/api/payroll/import/batches/${batchId}/decisions/${personId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, expectedDecisionVersion: 0 }),
    }), { params: Promise.resolve({ batchId, personId }) })
    expect(response.status).toBe(403)
    expect(mocks.saveDecision).toHaveBeenCalledTimes(1)
  })

  it('rejects forged actor, scope, hash, and timestamp fields at the handler boundary', async () => {
    const response = await PUT(new Request(`http://localhost/api/payroll/import/batches/${batchId}/decisions/${personId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision,
        expectedDecisionVersion: 0,
        actorUserId: '10000000-0000-4000-8000-000000000001',
        tenantId: '30000000-0000-4000-8000-000000000001',
        sourceHash: 'a'.repeat(64),
        confirmedAt: '2026-10-05T10:00:00.000Z',
      }),
    }), { params: Promise.resolve({ batchId, personId }) })
    expect(response.status).toBe(400)
    expect(mocks.saveDecision).not.toHaveBeenCalled()
  })

  it('requires an optimistic decision version on every save', async () => {
    const response = await PUT(new Request(`http://localhost/api/payroll/import/batches/${batchId}/decisions/${personId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    }), { params: Promise.resolve({ batchId, personId }) })
    expect(response.status).toBe(400)
    expect(mocks.saveDecision).not.toHaveBeenCalled()
  })

  it('rejects forged batch/person route identifiers before the service boundary', async () => {
    const response = await PUT(new Request('http://localhost/api/payroll/import/batches/not-a-uuid/decisions/not-a-uuid', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, expectedDecisionVersion: 0 }),
    }), { params: Promise.resolve({ batchId: 'not-a-uuid', personId: 'not-a-uuid' }) })
    expect(response.status).toBe(400)
    expect(mocks.saveDecision).not.toHaveBeenCalled()
  })
})

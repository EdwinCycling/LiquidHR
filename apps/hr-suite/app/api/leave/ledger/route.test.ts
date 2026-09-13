import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/leave/ledger', () => {
  it('weigert een lege reden vóór authenticatie of database-mutatie', async () => {
    const response = await POST(new Request('https://example.test/api/leave/ledger', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'MANUAL_ADJUSTMENT',
        employeeId: 'employee-1',
        employmentId: 'employment-1',
        leaveTypeId: 'leave-1',
        effectiveDate: '2026-09-13',
        amount: -8,
        reason: '   ',
        sourceKey: 'hr-correction-1',
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LEAVE_INPUT_INVALID' })
  })

  it('vereist een effectieve datum of legacy jaar voor een correctie', async () => {
    const response = await POST(new Request('https://example.test/api/leave/ledger', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'MANUAL_ADJUSTMENT',
        employeeId: 'employee-1',
        employmentId: 'employment-1',
        leaveTypeId: 'leave-1',
        amount: 8,
        reason: 'Correctie na controle',
        sourceKey: 'hr-correction-1',
      }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LEAVE_INPUT_INVALID' })
  })
})

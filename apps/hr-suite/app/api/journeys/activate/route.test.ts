import { beforeEach, describe, expect, it, vi } from 'vitest'

const { activate } = vi.hoisted(() => ({ activate: vi.fn() }))
vi.mock('@/lib/journeys', () => ({ journeyRuntime: { activate } }))

import { POST } from './route'

const input = {
  templateVersionId: 'b4b241c2-6955-46f9-9ca0-c2c370533ade',
  targetEmployeeId: 'c6b1c7a9-c250-3d19-b1a0-87e317e80b13',
  employmentId: null,
  anchorDate: '2026-08-24',
  manualParticipants: {},
  idempotencyKey: 'R4-JNY-ACT-20260824-01',
}

describe('POST Journey activation', () => {
  beforeEach(() => activate.mockResolvedValue({ id: '30000000-0000-4000-8000-000000000001', version: 1, idempotentReplay: false }))

  it('accepteert database UUIDs en geeft de transactionele activatie door', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(input) }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: { id: '30000000-0000-4000-8000-000000000001', version: 1, idempotentReplay: false } })
    expect(activate).toHaveBeenCalledWith(input)
  })

  it('weigert een ongeldige payload zonder activatiecall', async () => {
    activate.mockClear()
    const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...input, idempotencyKey: 'short' }) }))
    expect(response.status).toBe(400)
    expect(activate).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'

const { improveEmployeeNoteDescription } = vi.hoisted(() => ({ improveEmployeeNoteDescription: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/employees/employee-note-ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/employees/employee-note-ai')>('@/lib/employees/employee-note-ai')
  return { ...actual, improveEmployeeNoteDescription }
})

import { POST } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-7' }) }

describe('employee note AI route', () => {
  it('rejects arbitrary transformations and does not invoke the AI runtime', async () => {
    const response = await POST(new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': 'key-1' },
      body: JSON.stringify({ sourceText: 'Tekst.', transformation: 'summarize', locale: 'nl' }),
    }), context)

    expect(response.status).toBe(400)
    expect(improveEmployeeNoteDescription).not.toHaveBeenCalled()
  })

  it('passes target employee, locale, allowlisted transformation and idempotency key to the canonical runtime', async () => {
    improveEmployeeNoteDescription.mockResolvedValue({ resultType: 'PROPOSAL', proposedText: 'Voorstel.', requiresHumanReview: true })
    const response = await POST(new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': 'key-2' },
      body: JSON.stringify({ sourceText: 'Tekst.', transformation: 'professionalize', locale: 'en' }),
    }), context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { proposedText: 'Voorstel.' } })
    expect(improveEmployeeNoteDescription).toHaveBeenCalledWith({
      employeeId: 'employee-7',
      idempotencyKey: 'key-2',
      request: { sourceText: 'Tekst.', transformation: 'professionalize', locale: 'en' },
    })
  })
})

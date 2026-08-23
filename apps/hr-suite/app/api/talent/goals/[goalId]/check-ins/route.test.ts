import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('talent check-in route boundaries', () => {
  it('returns 400 when a due date is sent for a reflection', async () => {
    const response = await POST(new Request('https://example.test/api/talent/goals/00000000-0000-0000-0000-000000000001/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryType: 'EMPLOYEE_REFLECTION', body: 'Terugblik', followUpDueOn: '2026-09-01' }),
    }), { params: Promise.resolve({ goalId: '00000000-0000-0000-0000-000000000001' }) })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'TALENT_CHECKIN_INPUT_INVALID' })
  })
})

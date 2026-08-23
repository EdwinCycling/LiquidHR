import { describe, expect, it } from 'vitest'
import { GET, PATCH } from './route'

describe('talent goal route boundaries', () => {
  it('returns 400 for an invalid goal id on readback', async () => {
    const response = await GET(new Request('https://example.test/api/talent/goals/not-a-uuid'), { params: Promise.resolve({ goalId: 'not-a-uuid' }) })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'TALENT_GOAL_INPUT_INVALID' })
  })

  it('returns 400 for malformed update input before touching the service', async () => {
    const response = await PATCH(new Request('https://example.test/api/talent/goals/00000000-0000-0000-0000-000000000001', { method: 'PATCH', body: '{' }), { params: Promise.resolve({ goalId: '00000000-0000-0000-0000-000000000001' }) })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'TALENT_GOAL_INPUT_INVALID' })
  })
})

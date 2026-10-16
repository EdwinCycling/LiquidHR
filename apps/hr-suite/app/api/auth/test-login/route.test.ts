import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/auth/test-login', () => {
  it('does not provide anonymous access to a fixture account', async () => {
    const response = await POST()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'LOCAL_PERSONA_SWITCH_REQUIRED' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

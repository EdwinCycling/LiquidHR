import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { POST } from './route'

describe('POST /api/insights/analysis/drill', () => {
  it('returns a stable invalid request for malformed JSON', async () => {
    const response = await POST(new Request('http://localhost/api/insights/analysis/drill', {
      method: 'POST',
      body: '{',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ANALYSIS_DRILL_INVALID_REQUEST' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('rejects unknown client scope fields before authorization', async () => {
    const response = await POST(new Request('http://localhost/api/insights/analysis/drill', {
      method: 'POST',
      body: JSON.stringify({ tenantId: 'tenant-b' }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ANALYSIS_DRILL_INVALID_REQUEST' })
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { POST } from './route'

describe('POST /api/insights/analysis', () => {
  it('validates the spec before attempting authorization or retrieval', async () => {
    const response = await POST(new Request('http://localhost/api/insights/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'employees;drop' }),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ANALYSIS_SPEC_INVALID' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns a stable invalid-spec code for malformed JSON', async () => {
    const response = await POST(new Request('http://localhost/api/insights/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'ANALYSIS_SPEC_INVALID' })
  })
})

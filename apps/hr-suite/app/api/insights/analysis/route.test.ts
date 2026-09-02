import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))
vi.mock('@/lib/insights/analysis-engine', () => ({ executeAnalysisRequest: executeMock }))

import { POST } from './route'

describe('POST /api/insights/analysis', () => {
  it('dispatches a valid V2 snapshot request through the public versioned route', async () => {
    executeMock.mockResolvedValueOnce({ version: 2, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: [], period: { kind: 'snapshot', asOf: '2026-01-01' }, comparison: null, metadata: { complete: true, matchedEmployeeCount: 0, groupCount: 0 }, columns: [{ key: 'headcount', dataType: 'integer' }], rows: [], summary: { headcount: 0 }, presentationHints: { preferred: 'kpi', fallback: 'table' } })
    const response = await POST(new Request('http://localhost/api/insights/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 2, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: [], filters: [], period: { kind: 'snapshot', asOf: '2026-01-01' }, comparison: null, sort: null, limit: 25, presentation: { intent: 'auto' } }),
    }))

    expect(response.status).toBe(200)
    expect((await response.json()).data.version).toBe(2)
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      version: 2,
      period: expect.objectContaining({ kind: 'snapshot', asOf: '2026-01-01' }),
    }))
  })

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

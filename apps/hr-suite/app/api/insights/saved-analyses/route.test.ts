import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/insights/saved-analysis-service', () => ({
  createSavedAnalysis: vi.fn(),
  listMySavedAnalyses: vi.fn(),
}))

import { createSavedAnalysis, listMySavedAnalyses } from '@/lib/insights/saved-analysis-service'
import { validateAnalysisSpec } from '@/lib/insights/analysis-spec'
import { GET, POST } from './route'

const createMock = vi.mocked(createSavedAnalysis)
const listMock = vi.mocked(listMySavedAnalyses)

describe('/api/insights/saved-analyses', () => {
  it('returns only list projections and no-store headers', async () => {
    listMock.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111', name: 'Mijn analyse', createdAt: '2026-08-30T12:00:00.000Z', updatedAt: '2026-08-30T12:00:00.000Z' }])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Mijn analyse', createdAt: '2026-08-30T12:00:00.000Z', updatedAt: '2026-08-30T12:00:00.000Z' }] })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('passes the save payload to the typed service and never accepts malformed JSON', async () => {
    createMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Mijn analyse',
      spec: validateAnalysisSpec({ version: 1, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: [], filters: [], sort: null, limit: 25, presentation: 'auto' }),
      createdAt: '2026-08-30T12:00:00.000Z',
      updatedAt: '2026-08-30T12:00:00.000Z',
    })
    const body = { name: 'Mijn analyse', analysisSpec: { version: 1 } }
    const response = await POST(new Request('http://localhost/api/insights/saved-analyses', { method: 'POST', body: JSON.stringify(body) }))

    expect(response.status).toBe(201)
    expect(createMock).toHaveBeenCalledWith(body)

    const malformed = await POST(new Request('http://localhost/api/insights/saved-analyses', { method: 'POST', body: '{' }))
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ error: 'SAVED_ANALYSIS_INPUT_INVALID' })
  })
})

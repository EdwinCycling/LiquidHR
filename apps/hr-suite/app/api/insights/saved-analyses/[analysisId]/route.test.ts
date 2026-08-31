import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/insights/saved-analysis-service', () => ({
  deleteSavedAnalysis: vi.fn(),
  getSavedAnalysis: vi.fn(),
  updateSavedAnalysis: vi.fn(),
}))

import { deleteSavedAnalysis, getSavedAnalysis, updateSavedAnalysis } from '@/lib/insights/saved-analysis-service'
import { validateAnalysisSpec } from '@/lib/insights/analysis-spec'
import { DELETE, GET, PATCH } from './route'

const getMock = vi.mocked(getSavedAnalysis)
const updateMock = vi.mocked(updateSavedAnalysis)
const deleteMock = vi.mocked(deleteSavedAnalysis)
const analysisId = '11111111-1111-4111-8111-111111111111'
const routeContext = () => ({ params: Promise.resolve({ analysisId }) })

describe('/api/insights/saved-analyses/[analysisId]', () => {
  it('supports get, rename/definition update and explicit delete operations', async () => {
    const definition = { id: analysisId, name: 'Mijn analyse', spec: validateAnalysisSpec({ version: 1, source: 'workforce', entity: 'employees', measures: ['headcount'], dimensions: [], filters: [], sort: null, limit: 25, presentation: 'auto' }), createdAt: '2026-08-30T12:00:00.000Z', updatedAt: '2026-08-30T12:00:00.000Z' }
    getMock.mockResolvedValue(definition)
    updateMock.mockResolvedValue({ ...definition, name: 'Hernoemd' })
    deleteMock.mockResolvedValue(true)

    expect((await GET(new Request('http://localhost'), routeContext())).status).toBe(200)
    const patchResponse = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: 'Hernoemd' }) }), routeContext())
    expect(patchResponse.status).toBe(200)
    expect(getMock).toHaveBeenCalledWith(analysisId)
    expect(updateMock).toHaveBeenCalledWith(analysisId, { name: 'Hernoemd' })

    const deleteResponse = await DELETE(new Request('http://localhost', { method: 'DELETE' }), routeContext())
    expect(deleteResponse.status).toBe(200)
    expect(deleteMock).toHaveBeenCalledWith(analysisId)
  })
})

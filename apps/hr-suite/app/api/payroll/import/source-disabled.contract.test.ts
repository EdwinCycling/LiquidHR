import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  analyzePayrollImport: vi.fn(),
  stagePayrollImport: vi.fn(),
}))

vi.mock('@/lib/payroll-import/service', () => mocks)

import { POST as analyzePost } from './analyze/route'
import { POST as stagePost } from './stage/route'

const validAnalysis = {
  sourceType: 'INTERNAL_REPRESENTATIVE' as const,
  sourceFilename: 'fixture.json',
  sourceHash: 'a'.repeat(64),
  rows: [],
  summary: { total: 0, green: 0, warnings: 0, blocking: 0, incomeRelationships: 0, ambiguousMatches: 0 },
}

function makeRequest(sourceType: string): Request {
  const form = new FormData()
  form.set('file', new File(['{}'], 'fixture.json', { type: 'application/json' }))
  form.set('sourceType', sourceType)
  form.set('taxYear', '2026')
  form.set('administrationId', '00000000-0000-4000-8000-000000000001')
  return new Request('http://localhost/api/payroll/import', { method: 'POST', body: form })
}

beforeEach(() => {
  mocks.analyzePayrollImport.mockReset().mockResolvedValue(validAnalysis)
  mocks.stagePayrollImport.mockReset().mockResolvedValue({ batchId: '00000000-0000-4000-8000-000000000002' })
})

describe('payroll import source routes', () => {
  it('rejects official XML before analyze or stage service calls', async () => {
    const [analyzeResponse, stageResponse] = await Promise.all([
      analyzePost(makeRequest('LOONAANGIFTE_XML')),
      stagePost(makeRequest('LOONAANGIFTE_XML')),
    ])

    expect(analyzeResponse.status).toBe(400)
    expect(await analyzeResponse.json()).toEqual({ error: 'IMPORT_REQUEST_INVALID' })
    expect(stageResponse.status).toBe(400)
    expect(await stageResponse.json()).toEqual({ error: 'IMPORT_REQUEST_INVALID' })
    expect(mocks.analyzePayrollImport).not.toHaveBeenCalled()
    expect(mocks.stagePayrollImport).not.toHaveBeenCalled()
  })

  it('keeps the internal representative JSON source available', async () => {
    const [analyzeResponse, stageResponse] = await Promise.all([
      analyzePost(makeRequest('INTERNAL_REPRESENTATIVE')),
      stagePost(makeRequest('INTERNAL_REPRESENTATIVE')),
    ])

    expect(analyzeResponse.status).toBe(200)
    expect(stageResponse.status).toBe(200)
    expect(mocks.analyzePayrollImport).toHaveBeenCalledTimes(2)
    expect(mocks.stagePayrollImport).toHaveBeenCalledTimes(1)
  })
})

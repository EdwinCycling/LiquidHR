import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  analyzePayrollImport: vi.fn(),
  stagePayrollImport: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll-import/service', () => ({
  analyzePayrollImport: mocks.analyzePayrollImport,
  stagePayrollImport: mocks.stagePayrollImport,
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('payroll import staging route', () => {
  it('analyzes and stages validated XML without returning protected source fields', async () => {
    const analysis = {
      sourceType: 'LOONAANGIFTE_XML',
      sourceFilename: 'synthetic-import.xml',
      sourceHash: 'a'.repeat(64),
      rows: [{
        sourceRowNumber: 1,
        bsnFingerprint: 'fingerprint-marker',
        sourceMetadata: { secret: 'source-metadata-marker' },
        externalEmployeeNumber: 'external-number-marker',
        match: { status: 'NEW', employeeId: 'employee-id-marker' },
        initials: 'S',
        incomeRelationships: [],
      }],
    }
    mocks.analyzePayrollImport.mockResolvedValue(analysis as never)
    mocks.stagePayrollImport.mockResolvedValue({ batchId: 'batch-test' } as never)

    const form = new FormData()
    form.set('sourceType', 'LOONAANGIFTE_XML')
    form.set('taxYear', '2026')
    form.set('administrationId', '8483abc9-f275-c80b-5a23-fedc54ce9f0a')
    form.set('periodStart', '2026-01-01')
    form.set('periodEnd', '2026-12-31')
    form.set('file', new File(['synthetic XML bytes'], 'synthetic-import.xml', { type: 'application/xml' }))
    const response = await POST(new Request('http://localhost/api/payroll/import/stage', { method: 'POST', body: form }))
    const payload = await response.json() as { data: { batchId: string; analysis: unknown } }

    expect(response.status).toBe(200)
    expect(payload.data.batchId).toBe('batch-test')
    expect(mocks.analyzePayrollImport).toHaveBeenCalledWith(expect.objectContaining({ sourceType: 'LOONAANGIFTE_XML', taxYear: 2026, administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a' }))
    expect(mocks.stagePayrollImport).toHaveBeenCalledWith(expect.objectContaining({ analysis, taxYear: 2026, administrationId: '8483abc9-f275-c80b-5a23-fedc54ce9f0a' }))
    const serializedPayload = JSON.stringify(payload)
    for (const marker of ['synthetic-import.xml', 'a'.repeat(64), 'fingerprint-marker', 'source-metadata-marker', 'external-number-marker', 'employee-id-marker']) {
      expect(serializedPayload).not.toContain(marker)
    }
  })
})
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  analyzePayrollImport: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll-import/service', () => ({ analyzePayrollImport: mocks.analyzePayrollImport }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('payroll import analysis route', () => {
  it('accepts a PostgreSQL UUID whose version and variant bits are not RFC-standard', async () => {
    mocks.analyzePayrollImport.mockResolvedValue({
      sourceType: 'LOONAANGIFTE_XML',
      sourceFilename: 'loonaangifte.xml',
      sourceHash: 'private-file-hash',
      rows: [],
      summary: { total: 0, green: 0, warnings: 0, blocking: 0, incomeRelationships: 0, ambiguousMatches: 0 },
    })

    const administrationId = '8483abc9-f275-c80b-5a23-fedc54ce9f0a'
    const form = new FormData()
    form.set('sourceType', 'LOONAANGIFTE_XML')
    form.set('taxYear', '2026')
    form.set('administrationId', administrationId)
    form.set('file', new File(['<Loonaangifte />'], 'source.xml', { type: 'application/xml' }))
    const response = await POST(new Request('http://localhost/api/payroll/import/analyze', { method: 'POST', body: form }))

    expect(response.status).toBe(200)
    expect(mocks.analyzePayrollImport).toHaveBeenCalledWith(expect.objectContaining({ administrationId }))
  })

  it('does not return source hashes, fingerprints, source metadata, employee numbers, or employee ids', async () => {
    mocks.analyzePayrollImport.mockResolvedValue({
      sourceType: 'LOONAANGIFTE_XML',
      sourceFilename: 'private-source.xml',
      sourceHash: 'private-file-hash',
      sourceContext: { status: 'SUPPORTED_READ_ONLY', reportingPeriods: [], diagnostics: [] },
      readiness: { status: 'WARNING', isReady: false, payrollTaxNumber: null, checks: [] },
      rows: [{
        sourceRowNumber: 1,
        bsnFingerprint: 'private-fingerprint',
        sourceMetadata: { internalMarker: 'private-metadata' },
        externalEmployeeNumber: 'private-employee-number',
        significantSurnamePart: 'Voorbeeld',
        nationalityCode: 999,
        genderCode: 1,
        incomeRelationships: [],
        status: 'BLOCKING',
        match: { status: 'EXACT', employeeId: 'private-employee-id' },
        issues: [],
      }],
      summary: { total: 1, green: 0, warnings: 0, blocking: 1, incomeRelationships: 0, ambiguousMatches: 0 },
    })

    const form = new FormData()
    form.set('sourceType', 'LOONAANGIFTE_XML')
    form.set('taxYear', '2026')
    form.set('administrationId', '00000000-0000-4000-8000-000000000001')
    form.set('file', new File(['<Loonaangifte />'], 'source.xml', { type: 'application/xml' }))
    const response = await POST(new Request('http://localhost/api/payroll/import/analyze', { method: 'POST', body: form }))
    const body = await response.json() as { data: Record<string, unknown> }
    const serialized = JSON.stringify(body)
    const data = body.data as { rows: Array<Record<string, unknown>> }
    const row = data.rows[0]

    expect(response.status).toBe(200)
    for (const secretMarker of ['private-source.xml', 'private-file-hash', 'private-fingerprint', 'private-metadata', 'private-employee-number', 'private-employee-id']) {
      expect(serialized).not.toContain(secretMarker)
    }
    expect(body.data).not.toHaveProperty('sourceFilename')
    expect(body.data).not.toHaveProperty('sourceHash')
    expect(row).toMatchObject({ significantSurnamePart: 'Voorbeeld', nationalityCode: 999, genderCode: 1 })
    expect(row.match).not.toHaveProperty('employeeId')
  })
})

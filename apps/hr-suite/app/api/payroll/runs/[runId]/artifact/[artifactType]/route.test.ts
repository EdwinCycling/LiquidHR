import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireComponentLibraryAccess: vi.fn(),
  getPayrun01TechnicalJsonArtifactForRun: vi.fn(),
  createPayrollProfessionalPayslipPdfArtifactForRun: vi.fn(),
  getPayrollProfessionalPayslipPdfArtifactForRun: vi.fn(),
  permissionErrorResponse: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: mocks.requireComponentLibraryAccess }))
vi.mock('@/lib/payroll/payrun01-service', () => ({ getPayrun01TechnicalJsonArtifactForRun: mocks.getPayrun01TechnicalJsonArtifactForRun }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({
  createPayrollProfessionalPayslipPdfArtifactForRun: mocks.createPayrollProfessionalPayslipPdfArtifactForRun,
  getPayrollProfessionalPayslipPdfArtifactForRun: mocks.getPayrollProfessionalPayslipPdfArtifactForRun,
}))

import { GET, POST } from './route'
import { SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'

const runId = '10000000-0000-4000-8000-000000000001'
const bytes = Buffer.from('%PDF-1.7\nLiquidHR Standard')
const artifact = {
  id: '20000000-0000-4000-8000-000000000001',
  calculation_run_id: runId,
  artifact_type: 'PAYSLIP_PDF',
  file_name: 'liquidhr-loonstrook-2026-10.pdf',
  content_type: 'application/pdf',
  artifact_bytes: bytes,
  artifact_hash: 'a'.repeat(64),
  provenance_json: { schemaVersion: 'PAYFULL02_GENERIC_PAYSLIP_PDF_V1' },
  created_at: '2026-10-16T10:00:00.000Z',
}

function context(run = runId, type = 'PAYSLIP_PDF') {
  return { params: Promise.resolve({ runId: run, artifactType: type }) }
}

describe('payroll payslip artifact route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissionErrorResponse.mockImplementation((error: unknown) =>
      error instanceof Error && error.message === 'AUTH_REQUIRED'
        ? NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
        : null)
    mocks.requireComponentLibraryAccess.mockResolvedValue({
      scope: { tenantId: '30000000-0000-4000-8000-000000000001', hrGroupId: '40000000-0000-4000-8000-000000000001', administrationId: '50000000-0000-4000-8000-000000000001' },
      administration: { id: '60000000-0000-4000-8000-000000000001' },
      actorUserId: '70000000-0000-4000-8000-000000000001',
    })
    mocks.getPayrollProfessionalPayslipPdfArtifactForRun.mockResolvedValue(artifact)
    mocks.createPayrollProfessionalPayslipPdfArtifactForRun.mockResolvedValue(artifact)
  })

  it('returns the persisted PDF with its readback hash and no-store headers', async () => {
    const response = await GET(new Request('https://local.test'), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-length')).toBe(String(bytes.byteLength))
    expect(response.headers.get('x-artifact-sha256')).toBe('a'.repeat(64))
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="liquidhr-loonstrook-2026-10.pdf"')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    expect(mocks.createPayrollProfessionalPayslipPdfArtifactForRun).not.toHaveBeenCalled()
  })

  it('creates only a payslip artifact through the HR payroll write gate', async () => {
    const response = await POST(new Request('https://local.test', { method: 'POST' }), context())

    expect(response.status).toBe(200)
    expect(mocks.requireComponentLibraryAccess).toHaveBeenCalledWith(true)
    expect(mocks.createPayrollProfessionalPayslipPdfArtifactForRun).toHaveBeenCalledWith(expect.objectContaining({ runId }))
    const body = await response.json()
    expect(body).toMatchObject({
      id: artifact.id,
      runId,
      artifactType: 'PAYSLIP_PDF',
      sizeBytes: bytes.byteLength,
      sha256: 'a'.repeat(64),
    })
    expect(JSON.stringify(body)).not.toContain(bytes.toString('base64'))
  })

  it('rejects concept or unavailable artifacts without returning bytes', async () => {
    mocks.getPayrollProfessionalPayslipPdfArtifactForRun.mockResolvedValue(null)
    const response = await GET(new Request('https://local.test'), context())
    expect(response.status).toBe(404)
  })

  it('rejects anonymous artifact creation before rendering or persistence', async () => {
    mocks.requireComponentLibraryAccess.mockRejectedValue(new Error('AUTH_REQUIRED'))
    const response = await POST(new Request('https://local.test', { method: 'POST' }), context())
    expect(response.status).toBe(401)
    expect(mocks.createPayrollProfessionalPayslipPdfArtifactForRun).not.toHaveBeenCalled()
  })

  it('rejects technical JSON creation and malformed run ids before resolving access', async () => {
    const technical = await POST(new Request('https://local.test', { method: 'POST' }), context(runId, 'TECHNICAL_JSON'))
    const malformed = await POST(new Request('https://local.test', { method: 'POST' }), context('invalid'))
    expect(technical.status).toBe(400)
    expect(malformed.status).toBe(400)
    expect(mocks.requireComponentLibraryAccess).not.toHaveBeenCalled()
  })

  it('maps an invalid run to not found', async () => {
    mocks.createPayrollProfessionalPayslipPdfArtifactForRun.mockRejectedValue(new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', runId))
    const response = await POST(new Request('https://local.test', { method: 'POST' }), context())
    expect(response.status).toBe(404)
  })
})

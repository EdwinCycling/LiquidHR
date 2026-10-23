import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireComponentLibraryAccess: vi.fn(),
  renderPayrollProfessionalPayslipConceptPreviewForRun: vi.fn(),
  permissionErrorResponse: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: mocks.requireComponentLibraryAccess }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({ renderPayrollProfessionalPayslipConceptPreviewForRun: mocks.renderPayrollProfessionalPayslipConceptPreviewForRun }))

import { GET } from './route'
import { SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'

const runId = '10000000-0000-4000-8000-000000000001'
const bytes = Buffer.from('%PDF-1.7\nCONCEPT — NIET DEFINITIEF')

describe('HR-only concept payslip preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissionErrorResponse.mockImplementation((error: unknown) =>
      error instanceof Error && error.message === 'AUTH_REQUIRED'
        ? NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
        : null)
    mocks.requireComponentLibraryAccess.mockResolvedValue({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      administration: { id: '50000000-0000-4000-8000-000000000001' },
      actorUserId: '60000000-0000-4000-8000-000000000001',
    })
    mocks.renderPayrollProfessionalPayslipConceptPreviewForRun.mockResolvedValue({
      artifact_bytes: bytes,
      content_type: 'application/pdf',
      file_name: 'liquidhr-concept-loonstrook-2026-10.pdf',
      source_hash: 'a'.repeat(64),
      input_hash: 'b'.repeat(64),
      result_hash: 'c'.repeat(64),
      document_hash: 'd'.repeat(64),
    })
  })

  it('validates the run ID before requesting HR payroll access', async () => {
    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId: 'bad' }) })

    expect(response.status).toBe(400)
    expect(mocks.requireComponentLibraryAccess).not.toHaveBeenCalled()
    expect(mocks.renderPayrollProfessionalPayslipConceptPreviewForRun).not.toHaveBeenCalled()
  })

  it('serves only the current in-memory HR concept PDF and its hash binding', async () => {
    const inline = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })

    expect(inline.status).toBe(200)
    expect(inline.headers.get('content-type')).toBe('application/pdf')
    expect(inline.headers.get('content-disposition')).toBe('inline; filename="liquidhr-concept-loonstrook-2026-10.pdf"')
    expect(inline.headers.get('cache-control')).toBe('no-store')
    expect(inline.headers.get('referrer-policy')).toBe('no-referrer')
    expect(inline.headers.get('x-payroll-source-sha256')).toBe('a'.repeat(64))
    expect(inline.headers.get('x-payroll-input-sha256')).toBe('b'.repeat(64))
    expect(inline.headers.get('x-payroll-result-sha256')).toBe('c'.repeat(64))
    expect(inline.headers.get('x-payroll-document-sha256')).toBe('d'.repeat(64))
    expect(Buffer.from(await inline.arrayBuffer()).toString('latin1')).toContain('%PDF-1.7')

    const download = await GET(new Request('https://local.test?download=1'), { params: Promise.resolve({ runId }) })
    expect(download.headers.get('content-disposition')).toBe('attachment; filename="liquidhr-concept-loonstrook-2026-10.pdf"')
    expect(mocks.requireComponentLibraryAccess).toHaveBeenCalledWith(true)
    expect(mocks.renderPayrollProfessionalPayslipConceptPreviewForRun).toHaveBeenCalledWith(expect.objectContaining({ runId }))
  })

  it('rejects anonymous callers and keeps a changed source from producing a concept PDF', async () => {
    mocks.requireComponentLibraryAccess.mockRejectedValueOnce(new Error('AUTH_REQUIRED'))
    const anonymous = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })
    expect(anonymous.status).toBe(401)
    expect(mocks.renderPayrollProfessionalPayslipConceptPreviewForRun).not.toHaveBeenCalled()

    mocks.renderPayrollProfessionalPayslipConceptPreviewForRun.mockRejectedValueOnce(
      new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', runId, 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED'),
    )
    const stale = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED' })
  })

  it('does not reveal runs that are absent from the authorized administration', async () => {
    mocks.renderPayrollProfessionalPayslipConceptPreviewForRun.mockResolvedValue(null)

    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })

    expect(response.status).toBe(404)
  })
})

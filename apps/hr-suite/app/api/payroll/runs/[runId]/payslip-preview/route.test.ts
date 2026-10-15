import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireComponentLibraryAccess: vi.fn(),
  renderPayrollProfessionalPayslipPreviewForRun: vi.fn(),
  permissionErrorResponse: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mocks.permissionErrorResponse }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: mocks.requireComponentLibraryAccess }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({ renderPayrollProfessionalPayslipPreviewForRun: mocks.renderPayrollProfessionalPayslipPreviewForRun }))

import { GET } from './route'
import { SyntheticPayrollServiceError } from '@/lib/payroll/synthetic-calculation-service'

const runId = '10000000-0000-4000-8000-000000000001'
const bytes = Buffer.from('%PDF-1.7\nLiquidHR Standard')

describe('PAYRUN01 standard payslip preview route', () => {
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
    mocks.renderPayrollProfessionalPayslipPreviewForRun.mockResolvedValue({
      artifact_bytes: bytes,
      content_type: 'application/pdf',
      file_name: `liquidhr-loonstrook-2026-10.pdf`,
    })
  })

  it('validates the run ID before resolving payroll access', async () => {
    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId: 'bad' }) })

    expect(response.status).toBe(400)
    expect(mocks.requireComponentLibraryAccess).not.toHaveBeenCalled()
    expect(mocks.renderPayrollProfessionalPayslipPreviewForRun).not.toHaveBeenCalled()
  })

  it('serves the authorized finalized payslip inline or as a download with no-store headers', async () => {
    const inline = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })
    expect(inline.status).toBe(200)
    expect(inline.headers.get('content-type')).toBe('application/pdf')
    expect(inline.headers.get('content-disposition')).toBe('inline; filename="liquidhr-loonstrook-2026-10.pdf"')
    expect(inline.headers.get('cache-control')).toBe('no-store')
    expect(inline.headers.get('referrer-policy')).toBe('no-referrer')
    expect(inline.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await inline.arrayBuffer()).toString('latin1')).toContain('%PDF-1.7')

    const download = await GET(new Request('https://local.test?download=1'), { params: Promise.resolve({ runId }) })
    expect(download.headers.get('content-disposition')).toBe('attachment; filename="liquidhr-loonstrook-2026-10.pdf"')
    expect(mocks.renderPayrollProfessionalPayslipPreviewForRun).toHaveBeenCalledWith(expect.objectContaining({ runId }))
  })

  it('rejects anonymous callers before rendering', async () => {
    mocks.requireComponentLibraryAccess.mockRejectedValue(new Error('AUTH_REQUIRED'))

    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.renderPayrollProfessionalPayslipPreviewForRun).not.toHaveBeenCalled()
  })

  it('returns not found for a run outside the caller payroll scope', async () => {
    mocks.renderPayrollProfessionalPayslipPreviewForRun.mockRejectedValue(new SyntheticPayrollServiceError('PAYROLL_INPUT_INVALID', runId))

    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })

    expect(response.status).toBe(404)
  })

  it('returns not found when the selected run does not exist in the authorized scope', async () => {
    mocks.renderPayrollProfessionalPayslipPreviewForRun.mockResolvedValue(null)

    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId }) })

    expect(response.status).toBe(404)
  })
})

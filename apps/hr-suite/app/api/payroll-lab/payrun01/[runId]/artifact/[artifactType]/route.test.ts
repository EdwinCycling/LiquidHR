import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireComponentLibraryAccess, getPayrun01TechnicalJsonArtifactForRun, getPayrun01PayslipPdfArtifactForRun } = vi.hoisted(() => ({
  requireComponentLibraryAccess: vi.fn(),
  getPayrun01TechnicalJsonArtifactForRun: vi.fn(),
  getPayrun01PayslipPdfArtifactForRun: vi.fn(),
}))

vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess }))
vi.mock('@/lib/payroll/payrun01-service', () => ({ getPayrun01TechnicalJsonArtifactForRun, getPayrun01PayslipPdfArtifactForRun }))

import { GET } from './route'

const runId = '10000000-0000-4000-8000-000000000001'
const bytes = Buffer.from('{"resultHash":"abc"}', 'utf8')

describe('PAYRUN01 technical JSON artifact route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireComponentLibraryAccess.mockResolvedValue({
      scope: { tenantId: '20000000-0000-4000-8000-000000000001', hrGroupId: '30000000-0000-4000-8000-000000000001', administrationId: '40000000-0000-4000-8000-000000000001' },
      administration: { id: '50000000-0000-4000-8000-000000000001' },
      actorUserId: '60000000-0000-4000-8000-000000000001',
    })
    getPayrun01TechnicalJsonArtifactForRun.mockResolvedValue({
      artifact_bytes: bytes,
      content_type: 'application/json; charset=utf-8',
      file_name: `payrun01-2026-10-lisa-${runId}.json`,
    })
    getPayrun01PayslipPdfArtifactForRun.mockResolvedValue({
      artifact_bytes: Buffer.from('%PDF-1.7\nTEST'),
      content_type: 'application/pdf',
      file_name: `payrun01-2026-10-lisa-${runId}.pdf`,
    })
  })

  it('rejects invalid run IDs and artifact types before resolving access', async () => {
    const invalidId = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId: 'bad', artifactType: 'TECHNICAL_JSON' }) })
    const invalidType = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId, artifactType: 'PUBLIC_CSV' }) })

    expect(invalidId.status).toBe(400)
    expect(invalidType.status).toBe(400)
    expect(requireComponentLibraryAccess).not.toHaveBeenCalled()
  })

  it('serves only the authorized stored artifact with download security headers', async () => {
    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId, artifactType: 'TECHNICAL_JSON' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="payrun01-2026-10-lisa-${runId}.json"`)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await response.arrayBuffer()).toString('utf8')).toBe(bytes.toString('utf8'))
    expect(getPayrun01TechnicalJsonArtifactForRun).toHaveBeenCalledWith(expect.objectContaining({ runId }))
  })

  it('returns not found if a finalized run has no persisted JSON artifact', async () => {
    getPayrun01TechnicalJsonArtifactForRun.mockResolvedValue(null)
    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId, artifactType: 'TECHNICAL_JSON' }) })

    expect(response.status).toBe(404)
  })

  it('serves only the authorized persisted TEST payslip PDF', async () => {
    const response = await GET(new Request('https://local.test'), { params: Promise.resolve({ runId, artifactType: 'PAYSLIP_PDF' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="payrun01-2026-10-lisa-${runId}.pdf"`)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await response.arrayBuffer()).toString('latin1')).toContain('%PDF-1.7')
    expect(getPayrun01PayslipPdfArtifactForRun).toHaveBeenCalledWith(expect.objectContaining({ runId }))
  })
})

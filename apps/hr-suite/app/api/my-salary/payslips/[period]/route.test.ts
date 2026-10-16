import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMySalaryPayslipPdfArtifact } = vi.hoisted(() => ({ getMySalaryPayslipPdfArtifact: vi.fn() }))

vi.mock('@/lib/payroll/payroll-professional-service', () => ({ getMySalaryPayslipPdfArtifact }))

import { GET } from './route'

describe('GET /api/my-salary/payslips/[period]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the persisted artifact bytes and their repository identity', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55])
    getMySalaryPayslipPdfArtifact.mockResolvedValue({
      id: '91000000-0000-4000-8000-000000000001',
      artifact_hash: 'a'.repeat(64),
      artifact_bytes: bytes,
      content_type: 'application/pdf',
    })

    const context = {
      params: Promise.resolve({ period: '2026-10' }),
    }
    const inlineResponse = await GET(new Request('https://liquidhr.test/api/my-salary/payslips/2026-10'), context)
    const downloadResponse = await GET(new Request('https://liquidhr.test/api/my-salary/payslips/2026-10?download=1'), context)

    expect(getMySalaryPayslipPdfArtifact).toHaveBeenCalledTimes(2)
    expect(getMySalaryPayslipPdfArtifact).toHaveBeenCalledWith(2026, 10)
    expect(inlineResponse.status).toBe(200)
    expect(inlineResponse.headers.get('content-type')).toBe('application/pdf')
    expect(inlineResponse.headers.get('content-disposition')).toContain('inline;')
    expect(inlineResponse.headers.get('x-artifact-id')).toBe('91000000-0000-4000-8000-000000000001')
    expect(inlineResponse.headers.get('x-artifact-sha256')).toBe('a'.repeat(64))
    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers.get('content-disposition')).toContain('attachment;')
    expect(new Uint8Array(await inlineResponse.arrayBuffer())).toEqual(bytes)
    expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(bytes)
  })
})

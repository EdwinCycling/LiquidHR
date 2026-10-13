import { describe, expect, it, vi } from 'vitest'
import { servePayrollPayslip } from './payroll-payslip-response'

describe('employee Payroll payslip response', () => {
  it('rejects malformed period identifiers without loading a document', async () => {
    const loadPdf = vi.fn()
    const response = await servePayrollPayslip(new Request('http://localhost/api/my-salary/payslips/not-a-period'), 'not-a-period', loadPdf)
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(loadPdf).not.toHaveBeenCalled()
  })

  it('serves only the period-derived PDF with private no-store headers and safe content disposition', async () => {
    const bytes = Uint8Array.from([37, 80, 68, 70])
    const response = await servePayrollPayslip(
      new Request('http://localhost/api/my-salary/payslips/2026-10'),
      '2026-10',
      async (year, month) => {
        expect([year, month]).toEqual([2026, 10])
        return { artifact_bytes: bytes, content_type: 'application/pdf' }
      },
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toBe('inline; filename="liquidhr-loonstrook-2026-10.pdf"')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it('uses attachment disposition for downloads and returns not-found for an unavailable period', async () => {
    const download = await servePayrollPayslip(
      new Request('http://localhost/api/my-salary/payslips/2026-10?download=1'),
      '2026-10',
      async () => ({ artifact_bytes: new Uint8Array([1]), content_type: 'application/pdf' }),
    )
    expect(download.headers.get('content-disposition')).toContain('attachment;')

    const missing = await servePayrollPayslip(new Request('http://localhost/api/my-salary/payslips/2026-09'), '2026-09', async () => null)
    expect(missing.status).toBe(404)
    expect(missing.headers.get('cache-control')).toContain('no-store')
  })
})

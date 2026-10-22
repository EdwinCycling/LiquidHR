// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayrollStoredPayslipViewer } from './payroll-stored-payslip-viewer'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const runId = '48f47ffd-191c-5cbb-a22a-9061a2b7e5c3'
const artifactHref = `/api/payroll/runs/${runId}/artifact/PAYSLIP_PDF`
const labels = {
  close: 'Sluiten',
  download: 'Downloaden',
  previewLoading: 'Voorbeeld laden…',
  previewRetry: 'Opnieuw proberen',
  previewUnavailable: 'Voorbeeld niet beschikbaar.',
  unsupported: 'Open via downloaden.',
  view: 'Bekijken',
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PayrollStoredPayslipViewer', () => {
  it('views the existing artifact through the authorized same-origin GET and offers its download', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.7\nD0')
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer as ArrayBuffer)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'X-Artifact-SHA256': '0'.repeat(64) }),
      arrayBuffer: async () => pdfBytes.buffer as ArrayBuffer,
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stored-payslip')

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    try {
      act(() => root.render(<PayrollStoredPayslipViewer
        filename="liquidhr-loonstrook-2026-10.pdf"
        labels={labels}
        period="2026-10"
        runId={runId}
      />))

      expect(fetchMock).not.toHaveBeenCalled()
      act(() => host.querySelector('button')?.click())
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(fetchMock).toHaveBeenCalledOnce()
      expect(fetchMock).toHaveBeenCalledWith(artifactHref, expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
      }))
      expect(host.querySelector('iframe')?.getAttribute('src')).toBe('blob:stored-payslip')
      expect(host.querySelector('a[download]')?.getAttribute('href')).toBe(artifactHref)
      expect(host.querySelector('a[download]')?.getAttribute('download')).toBe('liquidhr-loonstrook-2026-10.pdf')
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})

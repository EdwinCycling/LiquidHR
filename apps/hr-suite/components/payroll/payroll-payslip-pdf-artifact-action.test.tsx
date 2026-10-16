// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayrollPayslipPdfArtifactAction } from './payroll-payslip-pdf-artifact-action'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const runId = '48f47ffd-191c-5cbb-a22a-9061a2b7e5c3'
const labels = {
  downloadPdf: 'Opgeslagen PDF downloaden',
  payslipPdfUnavailable: 'De loonstrook-PDF kon niet worden opgeslagen.',
  savePayslipPdf: 'Loonstrook-PDF opslaan',
  savingPayslipPdf: 'PDF wordt opgeslagen…',
  storedPayslipPdf: 'Loonstrook-PDF is opgeslagen voor deze definitieve run.',
}

function mountAction(props: {
  readonly canCreate: boolean
  readonly hasArtifact: boolean
}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(<PayrollPayslipPdfArtifactAction {...props} labels={labels} runId={runId} />))
  return {
    host,
    unmount: () => {
      act(() => root.unmount())
      host.remove()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Payroll payslip PDF artifact action', () => {
  it('creates the persisted PDF through the guarded route and exposes the stored readback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        runId,
        artifactType: 'PAYSLIP_PDF',
        contentType: 'application/pdf',
        fileName: 'liquidhr-loonstrook-2026-10.pdf',
        sizeBytes: 1234,
        sha256: 'a'.repeat(64),
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = mountAction({ canCreate: true, hasArtifact: false })

    try {
      await act(async () => {
        view.host.querySelector('button')?.click()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(fetchMock).toHaveBeenCalledWith(`/api/payroll/runs/${runId}/artifact/PAYSLIP_PDF`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      expect(view.host.querySelector('[role="status"]')?.textContent).toBe(labels.storedPayslipPdf)
      expect(view.host.querySelector('a')?.getAttribute('href')).toBe(`/api/payroll/runs/${runId}/artifact/PAYSLIP_PDF`)
    } finally {
      view.unmount()
    }
  })

  it('does not offer PDF creation to a read-only payroll user', () => {
    const view = mountAction({ canCreate: false, hasArtifact: false })
    try {
      expect(view.host.querySelector('button')).toBeNull()
      expect(view.host.querySelector('a')).toBeNull()
    } finally {
      view.unmount()
    }
  })

  it('offers read-only download of an existing artifact without a create action', () => {
    const view = mountAction({ canCreate: false, hasArtifact: true })
    try {
      expect(view.host.querySelector('button')).toBeNull()
      expect(view.host.querySelector('[role="status"]')?.textContent).toBe(labels.storedPayslipPdf)
      expect(view.host.querySelector('a')?.getAttribute('href')).toBe(`/api/payroll/runs/${runId}/artifact/PAYSLIP_PDF`)
    } finally {
      view.unmount()
    }
  })

  it('shows a generic failure and does not expose response details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'PRIVATE_DETAIL' }) }))
    const view = mountAction({ canCreate: true, hasArtifact: false })

    try {
      await act(async () => {
        view.host.querySelector('button')?.click()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(view.host.querySelector('[role="alert"]')?.textContent).toBe(labels.payslipPdfUnavailable)
      expect(view.host.textContent).not.toContain('PRIVATE_DETAIL')
    } finally {
      view.unmount()
    }
  })
})

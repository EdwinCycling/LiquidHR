// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmployeePayslips } from './employee-payslips'

vi.mock('./document-viewer', () => ({
  DocumentViewer: ({
    labels,
    useBlobPreview,
  }: {
    readonly labels: { readonly previewLoading?: string; readonly previewUnavailable?: string }
    readonly useBlobPreview?: boolean
  }) => (
    <div
      data-testid="document-viewer"
      data-preview-loading={labels.previewLoading}
      data-preview-unavailable={labels.previewUnavailable}
      data-use-blob-preview={String(useBlobPreview === true)}
    />
  ),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels = {
  title: 'Payslips',
  subtitle: 'Available payslips',
  empty: 'No payslips',
  view: 'View',
  download: 'Download',
  close: 'Close',
  unsupported: 'Unsupported',
  previewLoading: 'Loading payslip preview…',
  previewUnavailable: 'Payslip preview unavailable; download the file.',
  imported: 'Imported',
  payroll: 'Payroll',
  unspecifiedPeriod: 'Period not specified',
  document: 'Payslip',
}

describe('employee payslip viewer', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads private payroll previews through a same-origin blob URL', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)

    try {
      act(() => root.render(<EmployeePayslips
        documents={[{
          id: 'run-2026-10',
          periodYear: 2026,
          periodMonth: 10,
          source: 'PAYROLL',
          contentType: 'application/pdf',
          viewHref: '/api/my-salary/payslips/2026-10',
          downloadHref: '/api/my-salary/payslips/2026-10?download=1',
        }]}
        labels={labels}
        locale="en-GB"
      />))
      act(() => host.querySelector('button')?.click())

      const viewer = host.querySelector('[data-testid="document-viewer"]')
      expect(viewer?.getAttribute('data-use-blob-preview')).toBe('true')
      expect(viewer?.getAttribute('data-preview-loading')).toBe(labels.previewLoading)
      expect(viewer?.getAttribute('data-preview-unavailable')).toBe(labels.previewUnavailable)
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})

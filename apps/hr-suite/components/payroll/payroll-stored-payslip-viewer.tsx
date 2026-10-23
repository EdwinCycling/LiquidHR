'use client'

import { Eye } from 'lucide-react'
import { useState } from 'react'
import { DocumentViewer } from '@/components/documents/document-viewer'
import { Button } from '@/components/ui/button'

interface StoredPayslipViewerLabels {
  readonly close: string
  readonly download: string
  readonly previewLoading: string
  readonly previewRetry: string
  readonly previewUnavailable: string
  readonly unsupported: string
  readonly view: string
}

export function PayrollStoredPayslipViewer({
  filename,
  labels,
  period,
  runId,
}: {
  readonly filename: string
  readonly labels: StoredPayslipViewerLabels
  readonly period: string
  readonly runId: string
}) {
  const [open, setOpen] = useState(false)
  const artifactHref = `/api/payroll/runs/${encodeURIComponent(runId)}/artifact/PAYSLIP_PDF`

  return <>
    <Button onClick={() => setOpen(true)} type="button" variant="secondary">
      <Eye aria-hidden="true" />
      {labels.view}
    </Button>
    {open ? <DocumentViewer
      contentType="application/pdf"
      downloadHref={artifactHref}
      filename={filename}
      labels={labels}
      onClose={() => setOpen(false)}
      previewHref={artifactHref}
      title={`${labels.view} · ${period}`}
      useBlobPreview
    /> : null}
  </>
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

type PayslipPdfLabels = {
  readonly downloadPdf: string
  readonly payslipPdfUnavailable: string
  readonly savePayslipPdf: string
  readonly savingPayslipPdf: string
  readonly storedPayslipPdf: string
}

function isPayslipPdfArtifactResponse(value: unknown, runId: string): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const response = value as Record<string, unknown>
  return response.runId === runId
    && response.artifactType === 'PAYSLIP_PDF'
    && response.contentType === 'application/pdf'
    && typeof response.fileName === 'string'
    && response.fileName.length > 0
    && typeof response.sizeBytes === 'number'
    && Number.isInteger(response.sizeBytes)
    && response.sizeBytes > 0
    && typeof response.sha256 === 'string'
    && /^[0-9a-f]{64}$/.test(response.sha256)
}

export function PayrollPayslipPdfArtifactAction({
  canCreate,
  hasArtifact,
  labels,
  runId,
}: {
  readonly canCreate: boolean
  readonly hasArtifact: boolean
  readonly labels: PayslipPdfLabels
  readonly runId: string
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'stored' | 'failed'>('idle')
  const artifactUrl = `/api/payroll/runs/${encodeURIComponent(runId)}/artifact/PAYSLIP_PDF`
  const stored = hasArtifact || status === 'stored'

  async function savePayslipPdf(): Promise<void> {
    setStatus('saving')
    try {
      const response = await fetch(artifactUrl, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok || !isPayslipPdfArtifactResponse(await response.json() as unknown, runId)) {
        throw new Error('PAYROLL_ARTIFACT_UNAVAILABLE')
      }
      setStatus('stored')
    } catch {
      setStatus('failed')
    }
  }

  if (!canCreate && !stored) return null

  return <div className="flex flex-wrap items-center gap-3">
    {!stored && canCreate ? <Button disabled={status === 'saving'} onClick={() => { void savePayslipPdf() }} type="button">
      {status === 'saving' ? labels.savingPayslipPdf : labels.savePayslipPdf}
    </Button> : null}
    {stored ? <>
      <p className="text-sm text-muted-foreground" role="status">{labels.storedPayslipPdf}</p>
      <Link className="rounded-md border border-border-subtle px-3 py-2 text-sm font-medium text-primary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={artifactUrl}>{labels.downloadPdf}</Link>
    </> : null}
    {status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.payslipPdfUnavailable}</p> : null}
  </div>
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

type PayslipPdfLabels = {
  readonly downloadPdf: string
  readonly payslipPdfUnavailable: string
  readonly payslipPdfMetadata: string
  readonly verifyPayslipPdf: string
  readonly savePayslipPdf: string
  readonly savingPayslipPdf: string
  readonly storedPayslipPdf: string
}

type PayslipPdfArtifactResponse = {
  readonly id: string
  readonly runId: string
  readonly artifactType: 'PAYSLIP_PDF'
  readonly fileName: string
  readonly contentType: 'application/pdf'
  readonly sizeBytes: number
  readonly sha256: string
}

function isPayslipPdfArtifactResponse(value: unknown, runId: string): value is PayslipPdfArtifactResponse {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const response = value as Record<string, unknown>
  return typeof response.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.id)
    && response.runId === runId
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

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
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
  const [artifact, setArtifact] = useState<PayslipPdfArtifactResponse | null>(null)
  const artifactUrl = `/api/payroll/runs/${encodeURIComponent(runId)}/artifact/PAYSLIP_PDF`
  const stored = hasArtifact || status === 'stored'

  async function savePayslipPdf(): Promise<void> {
    setStatus('saving')
    try {
      let payload: unknown
      if (stored) {
        const response = await fetch(artifactUrl, {
          method: 'GET',
          headers: { Accept: 'application/pdf' },
        })
        if (!response.ok || response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/pdf') {
          throw new Error('PAYROLL_ARTIFACT_UNAVAILABLE')
        }
        const body = await response.arrayBuffer()
        const contentLength = Number(response.headers.get('content-length'))
        const contentDisposition = response.headers.get('content-disposition') ?? ''
        const fileName = /filename="([^"]+)"/i.exec(contentDisposition)?.[1] ?? ''
        payload = {
          id: response.headers.get('x-artifact-id') ?? '',
          runId,
          artifactType: 'PAYSLIP_PDF',
          contentType: 'application/pdf',
          fileName,
          sizeBytes: body.byteLength,
          sha256: response.headers.get('x-artifact-sha256') ?? '',
        }
        if (contentLength !== body.byteLength || await sha256(body) !== (payload as PayslipPdfArtifactResponse).sha256) {
          throw new Error('PAYROLL_ARTIFACT_HASH_MISMATCH')
        }
      } else {
        const response = await fetch(artifactUrl, {
          method: 'POST',
          headers: { Accept: 'application/json' },
        })
        payload = response.ok ? await response.json() as unknown : null
      }
      if (!isPayslipPdfArtifactResponse(payload, runId)) {
        throw new Error('PAYROLL_ARTIFACT_UNAVAILABLE')
      }
      setArtifact(payload)
      setStatus('stored')
    } catch {
      setStatus('failed')
    }
  }

  if (!canCreate && !stored) return null

  return <div className="flex flex-wrap items-center gap-3">
    {canCreate ? <Button disabled={status === 'saving'} onClick={() => { void savePayslipPdf() }} type="button">
      {status === 'saving' ? labels.savingPayslipPdf : stored ? labels.verifyPayslipPdf : labels.savePayslipPdf}
    </Button> : null}
    {stored ? <>
      <p className="text-sm text-muted-foreground" role="status">{labels.storedPayslipPdf}</p>
      {artifact ? <details className="basis-full rounded-md border border-border-subtle px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">{labels.payslipPdfMetadata}</summary>
        <p className="mt-2 break-all">Artifact-ID: {artifact.id}</p>
        <p className="break-all">SHA-256: {artifact.sha256}</p>
        <p>{artifact.sizeBytes} bytes · {artifact.fileName}</p>
      </details> : null}
      <Link className="rounded-md border border-border-subtle px-3 py-2 text-sm font-medium text-primary hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-focus" href={artifactUrl}>{labels.downloadPdf}</Link>
    </> : null}
    {status === 'failed' ? <p className="text-sm text-destructive" role="alert">{labels.payslipPdfUnavailable}</p> : null}
  </div>
}

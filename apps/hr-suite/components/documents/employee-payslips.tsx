'use client'

import { Download, Eye, FileText } from 'lucide-react'
import { useState } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DocumentViewer } from './document-viewer'

interface Payslip {
  id: string
  employment_id: string
  period_label: string
  calendar_year: number
  original_filename: string
  content_type: string
  file_size: number
  import_source: string
  imported_at: string
}

export function EmployeePayslips({
  employeeId,
  payslips,
  labels,
}: {
  employeeId: string
  payslips: Payslip[]
  labels: {
    title: string
    subtitle: string
    empty: string
    view: string
    download: string
    close: string
    unsupported: string
    source: string
    imported: string
  }
}) {
  const [preview, setPreview] = useState<Payslip | null>(null)

  return (
    <Surface className="mt-8 p-5 sm:p-6">
      <SectionHeader description={labels.subtitle} title={labels.title} />

      <div className="mt-6">
        {payslips.length === 0 ? (
          <EmptyState description={labels.subtitle} icon={<FileText />} title={labels.empty} />
        ) : (
          <div className="divide-y border-y border-subtle">
            {payslips.map((payslip) => (
              <article className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={payslip.id}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-[var(--radius-control)] bg-muted p-2 text-muted-foreground">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">{payslip.period_label}</p>
                      <Badge tone="info">{payslip.calendar_year}</Badge>
                    </div>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {payslip.original_filename} · {formatFileSize(payslip.file_size)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{labels.source}: {payslip.import_source}</span>
                      <span>{labels.imported}: {payslip.imported_at.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                  <Button onClick={() => setPreview(payslip)} type="button" variant="secondary">
                    <Eye />
                    {labels.view}
                  </Button>
                  <a className={buttonClasses({ variant: 'secondary' })} href={`/api/employees/${employeeId}/payslips/${payslip.id}/download`}>
                    <Download />
                    {labels.download}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {preview ? <DocumentViewer contentType={preview.content_type} filename={preview.original_filename} labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported }} onClose={() => setPreview(null)} previewHref={`/api/employees/${employeeId}/payslips/${preview.id}/download`} title={`${preview.period_label} · ${preview.calendar_year}`} /> : null}
    </Surface>
  )
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

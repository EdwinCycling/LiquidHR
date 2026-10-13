'use client'

import { Download, Eye, FileText } from 'lucide-react'
import { useState } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DocumentViewer } from './document-viewer'
import { groupEmployeePayslips, type EmployeePayslipDocument, type EmployeePayslipMonthGroup } from './payslip-periods'

type PayslipYearGroup = { readonly year: number; readonly months: EmployeePayslipMonthGroup[] }

export function EmployeePayslips({
  documents,
  locale,
  labels,
}: {
  documents: readonly EmployeePayslipDocument[]
  locale: string
  labels: {
    title: string
    subtitle: string
    empty: string
    view: string
    download: string
    close: string
    unsupported: string
    imported: string
    payroll: string
    unspecifiedPeriod: string
    document: string
  }
}) {
  const [preview, setPreview] = useState<{ document: EmployeePayslipDocument; title: string; filename: string } | null>(null)
  const groups = groupEmployeePayslips(documents, locale, labels.unspecifiedPeriod)

  return (
    <Surface className="mt-8 p-5 sm:p-6">
      <SectionHeader description={labels.subtitle} title={labels.title} />

      <div className="mt-6">
        {groups.length === 0 ? (
          <EmptyState description={labels.subtitle} icon={<FileText />} title={labels.empty} />
        ) : (
          <div className="space-y-7">
            {groups.reduce<PayslipYearGroup[]>((years, group) => {
              const existing = years.find((year) => year.year === group.year)
              if (existing) existing.months.push(group)
              else years.push({ year: group.year, months: [group] })
              return years
            }, []).map((year) => (
              <section aria-labelledby={`payslips-year-${year.year}`} className="min-w-0" key={year.year}>
                <h2 className="mb-3 text-sm font-semibold tabular-nums" id={`payslips-year-${year.year}`}>{year.year}</h2>
                <div className="divide-y divide-border-subtle border-y border-border-subtle">
                  {year.months.map((group) => {
                    const groupTitle = `${group.label} ${group.month === null ? year.year : ''}`.trim()
                    return (
                      <section className="py-4 first:pt-3 last:pb-3" key={`${group.year}-${group.month ?? 'unknown'}`}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                        <div className="divide-y divide-border-subtle">
                          {group.documents.map((document) => {
                            const filename = `liquidhr-loonstrook-${group.year}${group.month === null ? '' : `-${String(group.month).padStart(2, '0')}`}.pdf`
                            const sourceLabel = document.source === 'PAYROLL' ? labels.payroll : labels.imported
                            return (
                              <article className="flex flex-col gap-4 py-4 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:justify-between" key={document.id}>
                                <div className="flex min-w-0 items-start gap-3">
                                  <span className="rounded-[var(--radius-control)] bg-muted p-2 text-muted-foreground">
                                    <FileText aria-hidden="true" className="size-5" />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold">{labels.document}</p>
                                      <Badge tone="info">{sourceLabel}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{groupTitle}</p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                                  <Button onClick={() => setPreview({ document, title: `${labels.document} · ${groupTitle}`, filename })} type="button" variant="secondary">
                                    <Eye aria-hidden="true" />
                                    {labels.view}
                                  </Button>
                                  <a className={buttonClasses({ variant: 'secondary' })} href={document.downloadHref}>
                                    <Download aria-hidden="true" />
                                    {labels.download}
                                  </a>
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {preview ? <DocumentViewer
        contentType={preview.document.contentType}
        filename={preview.filename}
        labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported }}
        onClose={() => setPreview(null)}
        downloadHref={preview.document.downloadHref}
        previewHref={preview.document.viewHref}
        title={preview.title}
      /> : null}
    </Surface>
  )
}

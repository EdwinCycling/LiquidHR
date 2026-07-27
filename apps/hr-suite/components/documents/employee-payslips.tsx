'use client'

import { Download, Eye, FileText } from 'lucide-react'
import { useState } from 'react'
import { DocumentViewer } from './document-viewer'

interface Payslip { id: string; employment_id: string; period_label: string; calendar_year: number; original_filename: string; content_type: string; file_size: number; import_source: string; imported_at: string }

export function EmployeePayslips({ employeeId, payslips, labels }: { employeeId: string; payslips: Payslip[]; labels: { title: string; subtitle: string; empty: string; view: string; download: string; close: string; unsupported: string; source: string; imported: string } }) {
  const [preview, setPreview] = useState<Payslip | null>(null)
  return <section className="mt-8 rounded-2xl border bg-surface p-5 shadow-sm sm:p-6"><header><h2 className="text-xl font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></header><div className="mt-5 grid gap-3">{payslips.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : payslips.map((payslip) => <article className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" key={payslip.id}><div className="flex min-w-0 items-start gap-3"><span className="rounded-lg bg-muted p-2"><FileText size={18} /></span><div className="min-w-0"><p className="font-semibold">{payslip.period_label} · {payslip.calendar_year}</p><p className="truncate text-xs text-muted-foreground">{payslip.original_filename} · {formatFileSize(payslip.file_size)}</p><p className="mt-1 text-xs text-muted-foreground">{labels.source}: {payslip.import_source} · {labels.imported}: {payslip.imported_at.slice(0, 10)}</p></div></div><div className="flex flex-wrap gap-2"><button className="button-secondary" onClick={() => setPreview(payslip)} type="button"><Eye size={15} />{labels.view}</button><a className="button-secondary" href={`/api/employees/${employeeId}/payslips/${payslip.id}/download`}><Download size={15} />{labels.download}</a></div></article>)}</div>{preview ? <DocumentViewer contentType={preview.content_type} filename={preview.original_filename} labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported }} onClose={() => setPreview(null)} previewHref={`/api/employees/${employeeId}/payslips/${preview.id}/download`} title={`${preview.period_label} · ${preview.calendar_year}`} /> : null}</section>
}

function formatFileSize(size: number): string { return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB` }

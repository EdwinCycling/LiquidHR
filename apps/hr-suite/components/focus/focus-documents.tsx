'use client'

import type { Json } from '@scope/db'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { DocumentViewer } from '@/components/documents/document-viewer'

export interface FocusDocumentItem {
  id: string
  employeeId: string
  title: string
  description: string | null
  tags: string[]
  categoryName: string | null
  requiresSalaryPermission: boolean
  expiresOn: string | null
  createdAt: string
  originalFilename: string
  contentType: string
  customFields: Json
  customFieldLabelsNl: Json
  customFieldLabelsEn: Json
}

export interface FocusDocumentGroup {
  employeeId: string
  employeeName: string
  documents: readonly FocusDocumentItem[]
}

interface FocusDocumentLabels {
  readonly added: string
  readonly expires: string
  readonly open: string
  readonly download: string
  readonly close: string
  readonly unsupported: string
  readonly previewLoading: string
  readonly previewUnavailable: string
  readonly category: string
  readonly salarySensitive: string
  readonly tags: string
}

export function FocusDocuments({ groups, labels, locale }: { groups: readonly FocusDocumentGroup[]; labels: FocusDocumentLabels; locale: string }) {
  const [previewDocument, setPreviewDocument] = useState<FocusDocumentItem | null>(null)

  return <div className="space-y-6">{groups.map((group) => <section aria-label={group.employeeName || undefined} className="space-y-3" key={group.employeeId}>
    {group.employeeName ? <h2 className="text-lg font-semibold">{group.employeeName}</h2> : null}
    {group.documents.map((document) => {
      const downloadHref = `/api/employees/${document.employeeId}/documents/${document.id}/download`
      const fields = visibleCustomFields(document, locale)
      return <Surface className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]" key={document.id}>
        <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{document.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{document.expiresOn ? `${labels.expires}: ${document.expiresOn}` : `${labels.added}: ${document.createdAt.slice(0, 10)}`}</p>
          {document.categoryName ? <p className="mt-1 text-sm text-muted-foreground">{labels.category}: {document.categoryName}{document.requiresSalaryPermission ? ` · ${labels.salarySensitive}` : ''}</p> : null}
          {document.description ? <p className="mt-2 text-sm text-muted-foreground">{document.description}</p> : null}
          {document.tags.length ? <ul aria-label={labels.tags} className="mt-2 flex flex-wrap gap-1">{document.tags.map((tag) => <li className="rounded-[var(--radius-control)] bg-muted px-2 py-1 text-xs" key={tag}>{tag}</li>)}</ul> : null}
          {fields.length ? <dl className="mt-3 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 text-xs">{fields.map(([key, label, value]) => <div className="contents" key={key}><dt className="font-medium text-muted-foreground">{label}</dt><dd>{displayCustomFieldValue(value)}</dd></div>)}</dl> : null}
        </div>
        <div className="col-start-2 flex flex-wrap gap-2 sm:col-start-auto sm:row-start-1">
          <Button onClick={() => setPreviewDocument(document)} size="sm" type="button" variant="secondary">{labels.open}</Button>
          <a className="ui-button ui-button-secondary inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium" download={document.originalFilename} href={downloadHref}>{labels.download}</a>
        </div>
      </Surface>
    })}
  </section>)}{previewDocument ? <DocumentViewer contentType={previewDocument.contentType} downloadHref={`/api/employees/${previewDocument.employeeId}/documents/${previewDocument.id}/download`} filename={previewDocument.originalFilename} labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported, previewLoading: labels.previewLoading, previewUnavailable: labels.previewUnavailable }} onClose={() => setPreviewDocument(null)} previewHref={`/api/employees/${previewDocument.employeeId}/documents/${previewDocument.id}/preview`} title={previewDocument.title} useBlobPreview /> : null}</div>
}

function visibleCustomFields(document: FocusDocumentItem, locale: string): Array<[string, string, Json]> {
  if (!isJsonObject(document.customFields)) return []
  const labels = locale === 'en' ? document.customFieldLabelsEn : document.customFieldLabelsNl
  if (!isJsonObject(labels)) return []
  return Object.entries(document.customFields).flatMap(([key, value]) => typeof labels[key] === 'string' ? [[key, labels[key] as string, value]] : [])
}

function isJsonObject(value: Json): value is { [key: string]: Json } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function displayCustomFieldValue(value: Json): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '—'
  if (value === null) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

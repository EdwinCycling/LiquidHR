'use client'

import { FileText } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { DocumentViewer } from '@/components/documents/document-viewer'

export interface FocusDocumentItem {
  id: string
  title: string
  expiresOn: string | null
  createdAt: string
  originalFilename: string
  contentType: string
}

interface FocusDocumentLabels {
  readonly added: string
  readonly expires: string
  readonly open: string
  readonly download: string
  readonly close: string
  readonly unsupported: string
}

export function FocusDocuments({ employeeId, documents, labels }: { employeeId: string; documents: readonly FocusDocumentItem[]; labels: FocusDocumentLabels }) {
  const [previewDocument, setPreviewDocument] = useState<FocusDocumentItem | null>(null)

  return <section className="space-y-3">{documents.map((document) => {
    const downloadHref = `/api/employees/${employeeId}/documents/${document.id}/download`
    return <Surface className="flex flex-wrap items-center gap-3 p-4" key={document.id}>
      <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{document.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{document.expiresOn ? `${labels.expires}: ${document.expiresOn}` : `${labels.added}: ${document.createdAt.slice(0, 10)}`}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPreviewDocument(document)} size="sm" type="button" variant="secondary">{labels.open}</Button>
        <a className="ui-button ui-button-secondary inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium" download={document.originalFilename} href={downloadHref}>{labels.download}</a>
      </div>
    </Surface>
  })}{previewDocument ? <DocumentViewer contentType={previewDocument.contentType} filename={previewDocument.originalFilename} labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported }} onClose={() => setPreviewDocument(null)} previewHref={`/api/employees/${employeeId}/documents/${previewDocument.id}/download`} title={previewDocument.title} /> : null}</section>
}

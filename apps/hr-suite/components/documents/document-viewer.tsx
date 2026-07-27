/* eslint-disable @next/next/no-img-element -- signed private URLs are intentionally not passed through Next Image's remote loader. */
'use client'

import { Download, ExternalLink, X } from 'lucide-react'

interface DocumentViewerLabels {
  close: string
  download: string
  unsupported: string
}

export function DocumentViewer({
  title,
  filename,
  contentType,
  previewHref,
  labels,
  onClose,
}: {
  title: string
  filename: string
  contentType: string
  previewHref: string
  labels: DocumentViewerLabels
  onClose: () => void
}) {
  const isImage = contentType.startsWith('image/')
  const isInline = contentType === 'application/pdf' || contentType.startsWith('text/')

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-sidebar/75 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="document-viewer-title" aria-modal="true" className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-surface shadow-2xl sm:max-h-[calc(100vh-3rem)]" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0"><h2 className="truncate text-base font-semibold" id="document-viewer-title">{title}</h2><p className="truncate text-xs text-muted-foreground">{filename}</p></div>
          <button aria-label={labels.close} className="button-secondary shrink-0 p-2" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-5">
          {isImage ? <div className="flex min-h-96 items-center justify-center"><img alt={title} className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-sm" src={previewHref} /></div> : isInline ? <iframe className="h-[min(70vh,48rem)] w-full rounded-xl border bg-background" src={previewHref} title={title} /> : <div className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center rounded-xl border bg-surface p-6 text-center"><ExternalLink className="text-muted-foreground" size={30} /><p className="mt-4 text-sm text-muted-foreground">{labels.unsupported}</p></div>}
        </div>
        <footer className="flex justify-end border-t px-4 py-3 sm:px-5"><a className="button-primary inline-flex items-center gap-2" href={previewHref} download={filename}><Download size={16} />{labels.download}</a></footer>
      </section>
    </div>
  )
}

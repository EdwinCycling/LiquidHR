/* eslint-disable @next/next/no-img-element -- signed private URLs are intentionally not passed through Next Image's remote loader. */
'use client'

import { Download, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isInlineDocumentPreviewContentType } from '@/lib/documents/file-rules'

const PREVIEW_REQUEST_TIMEOUT_MS = 15_000

type PreviewResult = {
  readonly href: string
  readonly attempt: number
  readonly status: 'ready' | 'failed'
  readonly url?: string
  readonly frameLoaded?: boolean
}

interface DocumentViewerLabels {
  close: string
  download: string
  unsupported: string
  previewLoading?: string
  previewUnavailable?: string
  previewRetry?: string
}

export function DocumentViewer({
  title,
  filename,
  contentType,
  previewHref,
  downloadHref,
  useBlobPreview = false,
  labels,
  onClose,
}: {
  title: string
  filename: string
  contentType: string
  previewHref: string
  downloadHref?: string
  useBlobPreview?: boolean
  labels: DocumentViewerLabels
  onClose: () => void
}) {
  const normalizedContentType = contentType.split(';', 1)[0]?.trim().toLocaleLowerCase('en-US') ?? ''
  const isImage = ['image/bmp', 'image/jpeg', 'image/png', 'image/webp'].includes(normalizedContentType)
  const isInline = isInlineDocumentPreviewContentType(normalizedContentType)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const currentPreview = previewResult?.href === previewHref && previewResult.attempt === previewAttempt
    ? previewResult
    : null

  useEffect(() => {
    if (!useBlobPreview || !isInline) return

    const controller = new AbortController()
    let objectUrl: string | null = null
    const attempt = previewAttempt
    const timeoutId = window.setTimeout(() => {
      controller.abort()
      setPreviewResult({ href: previewHref, attempt, status: 'failed' })
    }, PREVIEW_REQUEST_TIMEOUT_MS)

    void fetch(previewHref, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Preview request failed')
        const body = await response.arrayBuffer()
        if (controller.signal.aborted) return
        const expectedHash = response.headers.get('X-Artifact-SHA256')
        if (expectedHash) {
          if (!/^[0-9a-f]{64}$/i.test(expectedHash)) throw new Error('Preview artifact hash is invalid')
          const digest = await crypto.subtle.digest('SHA-256', body)
          const actualHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
          if (actualHash !== expectedHash.toLowerCase()) throw new Error('Preview artifact hash does not match')
        }
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(new Blob([body], { type: normalizedContentType }))
        window.clearTimeout(timeoutId)
        setPreviewResult({ href: previewHref, attempt, status: 'ready', url: objectUrl })
      })
      .catch(() => {
        window.clearTimeout(timeoutId)
        if (!controller.signal.aborted) setPreviewResult({ href: previewHref, attempt, status: 'failed' })
      })

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isInline, normalizedContentType, previewAttempt, previewHref, useBlobPreview])

  useEffect(() => {
    if (!useBlobPreview || currentPreview?.status !== 'ready' || currentPreview.frameLoaded) return
    const timeoutId = window.setTimeout(() => {
      setPreviewResult({ href: previewHref, attempt: previewAttempt, status: 'failed' })
    }, PREVIEW_REQUEST_TIMEOUT_MS)
    return () => window.clearTimeout(timeoutId)
  }, [currentPreview?.frameLoaded, currentPreview?.status, previewAttempt, previewHref, useBlobPreview])

  const previewSource = useBlobPreview ? currentPreview?.status === 'ready' ? currentPreview.url : undefined : previewHref
  const markPreviewFrameLoaded = () => setPreviewResult((current) =>
    current?.href === previewHref && current.attempt === previewAttempt && current.status === 'ready'
      ? { ...current, frameLoaded: true }
      : current)
  const markPreviewFrameFailed = () => setPreviewResult((current) =>
    current?.href === previewHref && current.attempt === previewAttempt
      ? { href: previewHref, attempt: previewAttempt, status: 'failed' }
      : current)
  const isPreviewLoading = useBlobPreview && (!currentPreview || currentPreview.status === 'ready' && !currentPreview.frameLoaded)

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-sidebar/75 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="document-viewer-title" aria-modal="true" className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-surface shadow-2xl sm:max-h-[calc(100vh-3rem)]" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0"><h2 className="truncate text-base font-semibold" id="document-viewer-title">{title}</h2><p className="truncate text-xs text-muted-foreground">{filename}</p></div>
          <button aria-label={labels.close} className="button-secondary shrink-0 p-2" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-5">
          {isInline
            ? useBlobPreview && currentPreview?.status === 'failed'
              ? <div aria-live="polite" className="flex min-h-64 flex-col items-center justify-center gap-4 text-center" role="alert">
                <p className="text-sm text-destructive">{labels.previewUnavailable ?? labels.unsupported}</p>
                <button className="button-secondary" onClick={() => setPreviewAttempt((attempt) => attempt + 1)} type="button">
                  {labels.previewRetry ?? labels.download}
                </button>
              </div>
              : isPreviewLoading
                ? <div className="relative flex min-h-64 items-center justify-center">
                  {previewSource ? isImage
                    ? <img alt={title} className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-sm" onError={markPreviewFrameFailed} onLoad={markPreviewFrameLoaded} src={previewSource} />
                    : <iframe className="h-[min(70vh,48rem)] w-full rounded-xl border bg-background" onError={markPreviewFrameFailed} onLoad={markPreviewFrameLoaded} src={previewSource} title={title} />
                    : null}
                  <p aria-live="polite" className="absolute inset-x-3 bottom-3 rounded-lg bg-surface/95 px-3 py-2 text-center text-sm text-muted-foreground shadow">{labels.previewLoading ?? labels.unsupported}</p>
                </div>
              : isImage
                ? <div className="flex min-h-96 items-center justify-center"><img alt={title} className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-sm" onError={useBlobPreview ? markPreviewFrameFailed : undefined} onLoad={useBlobPreview ? markPreviewFrameLoaded : undefined} src={previewSource ?? previewHref} /></div>
                : <iframe className="h-[min(70vh,48rem)] w-full rounded-xl border bg-background" onError={useBlobPreview ? markPreviewFrameFailed : undefined} onLoad={useBlobPreview ? markPreviewFrameLoaded : undefined} src={previewSource ?? previewHref} title={title} />
            : <div className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center rounded-xl border bg-surface p-6 text-center"><ExternalLink className="text-muted-foreground" size={30} /><p className="mt-4 text-sm text-muted-foreground">{labels.unsupported}</p></div>}
        </div>
        <footer className="flex justify-end border-t px-4 py-3 sm:px-5"><a className="button-primary inline-flex items-center gap-2" href={downloadHref ?? previewHref} download={filename}><Download size={16} />{labels.download}</a></footer>
      </section>
    </div>
  )
}

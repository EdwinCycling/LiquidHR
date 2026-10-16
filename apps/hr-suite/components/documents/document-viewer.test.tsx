// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocumentViewer } from './document-viewer'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labels = {
  close: 'Sluiten',
  download: 'Downloaden',
  unsupported: 'Open via downloaden.',
  previewLoading: 'Voorbeeld laden…',
  previewUnavailable: 'Voorbeeld niet beschikbaar.',
  previewRetry: 'Opnieuw proberen',
}

function renderViewer() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(<DocumentViewer
    contentType="application/pdf"
    downloadHref="/api/my-salary/payslips/2026-10?download=1"
    filename="liquidhr-loonstrook-2026-10.pdf"
    labels={labels}
    onClose={() => undefined}
    previewHref="/api/my-salary/payslips/2026-10"
    title="Loonstrook · oktober 2026"
    useBlobPreview
  />))
  return { host, root }
}

function pdfResponse(body: string, artifactHash?: string) {
  const bytes = new TextEncoder().encode(body)
  return {
    ok: true,
    headers: new Headers(artifactHash ? { 'X-Artifact-SHA256': artifactHash } : {}),
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  }
}

async function flushFetch(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('document viewer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not embed the protected response URL directly in the browser frame', () => {
    const markup = renderToStaticMarkup(<DocumentViewer
      contentType="text/plain"
      downloadHref="/api/employees/employee-1/documents/document-1/download"
      filename="D01-notitie.txt"
      labels={labels}
      onClose={() => undefined}
      previewHref="/api/employees/employee-1/documents/document-1/preview"
      title="D01 notitie"
      useBlobPreview
    />)

    expect(markup).not.toContain('<iframe')
    expect(markup).not.toContain('src="/api/employees/employee-1/documents/document-1/preview"')
    expect(markup).toContain('Voorbeeld laden')
    expect(markup).toContain('href="/api/employees/employee-1/documents/document-1/download"')
  })

  it('keeps active HTML on the download fallback path', () => {
    const markup = renderToStaticMarkup(<DocumentViewer
      contentType="text/html"
      filename="untrusted.html"
      labels={labels}
      onClose={() => undefined}
      previewHref="/api/employees/employee-1/documents/document-1/download"
      title="Untrusted document"
    />)

    expect(markup).not.toContain('<iframe')
    expect(markup).not.toContain('<img')
    expect(markup).toContain('Open via downloaden.')
  })

  it('shows a successful private PDF as a blob-backed iframe and revokes it on close', async () => {
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer as ArrayBuffer)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse('%PDF-test', '0'.repeat(64))))
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:payfull-test')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const { host, root } = renderViewer()

    try {
      await flushFetch()
      const iframe = host.querySelector('iframe')
      expect(iframe?.getAttribute('src')).toBe('blob:payfull-test')
      expect(host.textContent).toContain(labels.previewLoading)
      act(() => iframe?.dispatchEvent(new Event('load')))
      expect(host.textContent).not.toContain(labels.previewLoading)
    } finally {
      act(() => root.unmount())
      host.remove()
    }

    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:payfull-test')
  })

  it('shows an error and retries a failed preview request', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(pdfResponse('%PDF-retry'))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:payfull-retry')
    const { host, root } = renderViewer()

    try {
      await flushFetch()
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(labels.previewUnavailable)
      const retryButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.previewRetry)
      expect(retryButton).toBeTruthy()
      act(() => retryButton?.click())
      await flushFetch()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const iframe = host.querySelector('iframe')
      expect(iframe?.getAttribute('src')).toBe('blob:payfull-retry')
      act(() => iframe?.dispatchEvent(new Event('load')))
      expect(host.querySelector('[role="alert"]')).toBeNull()
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })

  it('turns a request that never settles into a visible retryable error', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    const { host, root } = renderViewer()

    try {
      expect(host.textContent).toContain(labels.previewLoading)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(labels.previewUnavailable)
      expect(Array.from(host.querySelectorAll('button')).some((button) => button.textContent === labels.previewRetry)).toBe(true)
      expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }))
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })

  it('turns a PDF frame that never becomes visible into a retryable error', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse('%PDF-never-renders')))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:payfull-never-renders')
    const { host, root } = renderViewer()

    try {
      await flushFetch()
      expect(host.querySelector('iframe')?.getAttribute('src')).toBe('blob:payfull-never-renders')
      expect(host.textContent).toContain(labels.previewLoading)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(labels.previewUnavailable)
      expect(Array.from(host.querySelectorAll('button')).some((button) => button.textContent === labels.previewRetry)).toBe(true)
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })

  it('rejects PDF bytes that do not match the persisted artifact hash', async () => {
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer as ArrayBuffer)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pdfResponse('%PDF-hash-mismatch', 'f'.repeat(64))))
    const { host, root } = renderViewer()

    try {
      await flushFetch()
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(labels.previewUnavailable)
      expect(host.querySelector('iframe')).toBeNull()
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})

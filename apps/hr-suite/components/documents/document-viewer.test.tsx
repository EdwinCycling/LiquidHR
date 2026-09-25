// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DocumentViewer } from './document-viewer'

const labels = { close: 'Sluiten', download: 'Downloaden', unsupported: 'Open via downloaden.', previewLoading: 'Voorbeeld laden…', previewUnavailable: 'Voorbeeld niet beschikbaar.' }

describe('document viewer', () => {
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
})

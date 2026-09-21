// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FocusDocuments, type FocusDocumentItem } from './focus-documents'

const document: FocusDocumentItem = {
  id: 'document-1',
  title: 'Arbeidsovereenkomst',
  expiresOn: null,
  createdAt: '2026-09-21T08:00:00.000Z',
  originalFilename: 'arbeidsovereenkomst.pdf',
  contentType: 'application/pdf',
}

describe('Focus documents', () => {
  it('keeps the employee list scoped while exposing the existing viewer and download path', () => {
    const markup = renderToStaticMarkup(<FocusDocuments employeeId="employee-1" documents={[document]} labels={{ added: 'Toegevoegd op', expires: 'Geldig tot', open: 'Bekijken', download: 'Downloaden', close: 'Sluiten', unsupported: 'Download dit bestand.' }} />)

    expect(markup).toContain('Arbeidsovereenkomst')
    expect(markup).toContain('href="/api/employees/employee-1/documents/document-1/download"')
    expect(markup).toContain('Downloaden')
    expect(markup).toContain('Bekijken')
    expect(markup).not.toContain('Document Studio')
  })
})

// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FocusDocuments, type FocusDocumentItem } from './focus-documents'

vi.mock('@/components/documents/document-viewer', () => ({
  DocumentViewer: ({ previewHref, downloadHref }: { previewHref: string; downloadHref?: string }) => <div data-download-href={downloadHref} data-preview-href={previewHref} />,
}))

const dossierDocument: FocusDocumentItem = {
  id: 'document-1',
  employeeId: 'employee-1',
  title: 'Arbeidsovereenkomst',
  description: 'D01 omschrijving',
  tags: ['D01'],
  categoryName: 'D01 Algemeen',
  requiresSalaryPermission: false,
  expiresOn: null,
  createdAt: '2026-09-21T08:00:00.000Z',
  originalFilename: 'arbeidsovereenkomst.pdf',
  contentType: 'application/pdf',
  customFields: { reference: 'D01-REF-001', hidden: 'NO-LEAK' },
  customFieldLabelsNl: { reference: 'D01 referentie' },
  customFieldLabelsEn: { reference: 'D01 reference' },
}

describe('Focus documents', () => {
  it('keeps the employee list scoped while exposing the existing viewer and download path', () => {
    const markup = renderToStaticMarkup(<FocusDocuments groups={[{ employeeId: 'employee-1', employeeName: '', documents: [dossierDocument] }]} locale="nl" labels={{ added: 'Toegevoegd op', expires: 'Geldig tot', open: 'Bekijken', download: 'Downloaden', close: 'Sluiten', unsupported: 'Download dit bestand.', previewLoading: 'Voorbeeld laden', previewUnavailable: 'Voorbeeld niet beschikbaar', category: 'Categorie', salarySensitive: 'Salarisgevoelig', tags: 'Tags' }} />)

    expect(markup).toContain('Arbeidsovereenkomst')
    expect(markup).toContain('href="/api/employees/employee-1/documents/document-1/download"')
    expect(markup).toContain('D01 omschrijving')
    expect(markup).toContain('D01 referentie')
    expect(markup).toContain('grid-cols-[auto_minmax(0,1fr)]')
    expect(markup).toContain('sm:grid-cols-[auto_minmax(0,1fr)_auto]')
    expect(markup).toContain('col-start-2')
    expect(markup).not.toContain('NO-LEAK')
    expect(markup).toContain('Downloaden')
    expect(markup).toContain('Bekijken')
    expect(markup).not.toContain('Document Studio')
  })

  it('opens dossier documents through the same-origin preview route', () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<FocusDocuments groups={[{ employeeId: 'employee-1', employeeName: '', documents: [dossierDocument] }]} locale="nl" labels={{ added: 'Toegevoegd op', expires: 'Geldig tot', open: 'Bekijken', download: 'Downloaden', close: 'Sluiten', unsupported: 'Download dit bestand.', previewLoading: 'Voorbeeld laden', previewUnavailable: 'Voorbeeld niet beschikbaar', category: 'Categorie', salarySensitive: 'Salarisgevoelig', tags: 'Tags' }} />))

    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Bekijken'))?.click())

    expect(host.querySelector('[data-preview-href]')?.getAttribute('data-preview-href')).toBe('/api/employees/employee-1/documents/document-1/preview')
    expect(host.querySelector('[data-preview-href]')?.getAttribute('data-download-href')).toBe('/api/employees/employee-1/documents/document-1/download')
    act(() => root.unmount())
    host.remove()
  })
})

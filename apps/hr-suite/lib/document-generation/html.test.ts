import { describe, expect, it } from 'vitest'
import { emptyCanonicalDocument, type CanonicalRegion } from '@/lib/document-studio/canonical-document'
import { resolveGenerationSnapshot, type GenerationContext } from './domain'
import { renderResolvedSnapshotToHtml } from './html'

const imageRef = '00000000-0000-4000-8000-000000000000'
const context = {
  tenantId: 'tenant',
  hrGroupId: 'group',
  employeeId: 'employee',
  templateId: 'template',
  templateName: 'Template',
  templateVersionId: 'version',
  templateVersion: 1,
  documentCategory: 'GENERAL',
  defaultDossier: false,
  rendererVersion: 'dg1-html-css-chromium-a4-work-sans-1',
  generatedAt: '2026-09-04T10:00:00.000Z',
  knownValues: {},
  temporalValues: {},
  freeValues: {},
  documentProfile: {},
  organization: {},
  componentVersions: [],
  assets: [{ assetRef: imageRef, normalizedMime: 'image/png', width: 320, height: 180, storageRef: imageRef, sha256: 'a'.repeat(64) }],
} satisfies GenerationContext

function region(content: CanonicalRegion['content']): CanonicalRegion {
  return { type: 'region', content }
}

describe('DG1 controlled HTML renderer', () => {
  it('renders the supported document model without trusting authored HTML', () => {
    const document = emptyCanonicalDocument('DOCUMENT')
    const snapshot = resolveGenerationSnapshot({
      ...document,
      regions: {
        cover: region([{ type: 'heading', attrs: { level: 1, align: 'CENTER' }, content: [{ type: 'text', text: 'Cover' }] }]),
        header: region([{ type: 'paragraph', attrs: { align: 'RIGHT' }, content: [{ type: 'text', text: 'Header' }] }]),
        body: region([
          { type: 'heading', attrs: { level: 2, align: 'LEFT' }, content: [{ type: 'text', text: '<Body>' }] },
          { type: 'paragraph', attrs: { align: 'JUSTIFY' }, content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }, { type: 'text', text: ' italic', marks: [{ type: 'italic' }] }, { type: 'text', text: ' underline', marks: [{ type: 'underline' }] }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [{ type: 'text', text: 'Bullet' }] }] }] },
          { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [{ type: 'text', text: 'Ordered' }] }] }] },
          { type: 'horizontalRule' },
          { type: 'table', attrs: { columnWidths: [50, 50] }, content: [{ type: 'tableRow', content: [{ type: 'tableHeader', attrs: { align: 'LEFT' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [{ type: 'text', text: 'Name' }] }] }, { type: 'tableCell', attrs: { align: 'RIGHT' }, content: [{ type: 'paragraph', attrs: { align: 'RIGHT' }, content: [{ type: 'text', text: 'Value' }] }] }] }] },
          { type: 'twoColumnBlock', attrs: { ratio: '50_50' }, content: [{ type: 'column', attrs: { side: 'left' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [{ type: 'text', text: 'Left' }] }] }, { type: 'column', attrs: { side: 'right' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [{ type: 'text', text: 'Right' }] }] }] },
          { type: 'pageBreak' },
          { type: 'blockImage', attrs: { assetRef: imageRef, altText: 'Logo', width: 50, align: 'CENTER' } },
        ]),
        appendix: region([{ type: 'heading', attrs: { level: 3, align: 'LEFT' }, content: [{ type: 'text', text: 'Appendix' }] }]),
        footer: region([{ type: 'paragraph', attrs: { align: 'CENTER' }, content: [{ type: 'text', text: 'Footer' }] }]),
      },
    }, context)

    const html = renderResolvedSnapshotToHtml(snapshot, { assetUrls: { [imageRef]: 'data:image/png;base64,AA==' }, fontFaceCss: '@font-face{font-family:Work Sans}' })

    expect(html).toContain('dg1-cover')
    expect(html).toContain('dg1-body dg1-break-before')
    expect(html).toContain('dg1-appendix dg1-break-before')
    expect(html).toContain('<h2 style="text-align:left">&lt;Body&gt;</h2>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<em> italic</em>')
    expect(html).toContain('<u> underline</u>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<ol>')
    expect(html).toContain('<th style="text-align:left;width:50%">')
    expect(html).toContain('data-ratio="50_50"')
    expect(html).toContain('dg1-page-break')
    expect(html).toContain('src="data:image/png;base64,AA=="')
    expect(html).toContain('counter(page)')
    expect(html).not.toContain('<script')
  })
})

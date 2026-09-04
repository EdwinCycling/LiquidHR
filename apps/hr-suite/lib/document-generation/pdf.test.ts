import { describe, expect, it } from 'vitest'
import { emptyCanonicalDocument } from '@/lib/document-studio/canonical-document'
import { resolveGenerationSnapshot, type GenerationContext } from './domain'
import { pdfHash, renderResolvedSnapshotToPdf } from './pdf'

describe('DG1 PDF renderer contract', () => {
  it('renders the controlled HTML document as a multipage Work Sans A4 PDF', async () => {
    const context = { tenantId: 't', hrGroupId: 'g', employeeId: 'e', templateId: 't', templateName: 'Template', templateVersionId: 'v', templateVersion: 1, documentCategory: 'GENERAL', defaultDossier: false, rendererVersion: 'dg1-a4-work-sans-pdf-1', generatedAt: '2026-09-04T10:00:00.000Z', knownValues: {}, temporalValues: {}, freeValues: {}, documentProfile: {}, organization: {}, componentVersions: [], assets: [] } satisfies GenerationContext
    const document = emptyCanonicalDocument('DOCUMENT')
    const body = document.regions.body!
    const snapshot = resolveGenerationSnapshot({ ...document, regions: { ...document.regions, body: { ...body, content: Array.from({ length: 80 }, (_, index) => ({ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'text' as const, text: `Regel ${index + 1}` }] })) } } }, context)
    const first = await renderResolvedSnapshotToPdf(snapshot)
    const second = await renderResolvedSnapshotToPdf(snapshot)
    expect(new TextDecoder().decode(first)).toContain('%PDF-1.4')
    expect(new TextDecoder().decode(first)).toMatch(/\/MediaBox \[0 0 594\.\d+ 841\.\d+\]/)
    expect(new TextDecoder().decode(first)).toMatch(/WorkSans|Work-Sans/i)
    expect((new TextDecoder().decode(first).match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
    expect(pdfHash(first)).toMatch(/^[0-9a-f]{64}$/)
    expect(pdfHash(first)).toBe(pdfHash(second))
  })
})

import { describe, expect, it } from 'vitest'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { emptyCanonicalDocument } from '@/lib/document-studio/canonical-document'
import { resolveGenerationSnapshot, type GenerationContext } from './domain'
import { pdfHash, renderResolvedSnapshotToPdf } from './pdf'

function embeddedWorkSansFaces(document: PDFDocument): Set<string> {
  const embeddedFaces = new Set<string>()
  for (const page of document.getPages()) {
    const resources = page.node.Resources()
    const fonts = resources?.lookup(PDFName.of('Font'), PDFDict)
    if (!fonts) continue

    for (const [, fontReference] of fonts.entries()) {
      const font = document.context.lookup(fontReference, PDFDict)
      const baseFont = font.lookup(PDFName.of('BaseFont'), PDFName).asString()
      const descendants = font.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray)
      const fontDictionaries = descendants
        ? descendants.asArray().map((reference) => document.context.lookup(reference, PDFDict))
        : [font]
      const isEmbedded = fontDictionaries.some((fontDictionary) => {
        const descriptor = fontDictionary.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict)
        if (!descriptor) return false
        return [PDFName.of('FontFile'), PDFName.of('FontFile2'), PDFName.of('FontFile3')].some((key) => {
          const fontFileReference = descriptor.get(key)
          if (!fontFileReference) return false
          const stream = document.context.lookup(fontFileReference)
          return stream instanceof PDFRawStream && stream.contents.length > 0
        })
      })
      if (isEmbedded) embeddedFaces.add(baseFont)
    }
  }
  return embeddedFaces
}

describe('DG1 PDF renderer contract', () => {
  it('renders the controlled HTML document as a multipage Work Sans A4 PDF', async () => {
    const context = { tenantId: 't', hrGroupId: 'g', employeeId: 'e', templateId: 't', templateName: 'Template', templateVersionId: 'v', templateVersion: 1, documentCategory: 'GENERAL', defaultDossier: false, rendererVersion: 'dg1-a4-work-sans-pdf-1', generatedAt: '2026-09-04T10:00:00.000Z', knownValues: {}, temporalValues: {}, freeValues: {}, documentProfile: {}, organization: {}, componentVersions: [], assets: [] } satisfies GenerationContext
    const document = emptyCanonicalDocument('DOCUMENT')
    const body = document.regions.body!
    const snapshot = resolveGenerationSnapshot({ ...document, regions: { ...document.regions, body: { ...body, content: [
      { type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'text' as const, text: 'Normaal 400' }] },
      { type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'text' as const, text: 'Vet 700', marks: [{ type: 'bold' as const }] }] },
      { type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'text' as const, text: 'Cursief 400', marks: [{ type: 'italic' as const }] }] },
      ...Array.from({ length: 80 }, (_, index) => ({ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'text' as const, text: `Regel ${index + 1}` }] })),
    ] } } }, context)
    const first = await renderResolvedSnapshotToPdf(snapshot)
    const second = await renderResolvedSnapshotToPdf(snapshot)

    const parsedPdf = await getDocument({ data: new Uint8Array(first) }).promise
    expect(parsedPdf.numPages).toBeGreaterThan(1)
    let extractedText = ''
    for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
      const page = await parsedPdf.getPage(pageNumber)
      const [left, bottom, right, top] = page.view
      expect(right - left).toBeCloseTo(595.28, 0)
      expect(top - bottom).toBeCloseTo(841.89, 0)
      const text = await page.getTextContent()
      const positionedText = text.items.filter((item) => 'str' in item && item.str.trim().length > 0)
      expect(positionedText.length).toBeGreaterThan(0)
      expect(positionedText.every((item) => 'str' in item
        && item.width > 0
        && item.height > 0
        && item.transform[4] >= left - 1
        && item.transform[4] + item.width <= right + 1
        && item.transform[5] >= bottom - 1
        && item.transform[5] <= top + 1)).toBe(true)
      extractedText += text.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
    }
    expect(extractedText).toContain('Normaal 400')
    expect(extractedText).toContain('Vet 700')
    expect(extractedText).toContain('Cursief 400')
    expect(extractedText).toContain('Regel 80')

    const parsedWithPdfLib = await PDFDocument.load(first, { updateMetadata: false })
    const embeddedFaces = [...embeddedWorkSansFaces(parsedWithPdfLib)]
    expect(embeddedFaces.some((name) => /WorkSans-Regular/.test(name))).toBe(true)
    expect(embeddedFaces.some((name) => /WorkSans-Bold/.test(name))).toBe(true)
    expect(embeddedFaces.some((name) => /WorkSans-Italic/.test(name))).toBe(true)
    expect(pdfHash(first)).toMatch(/^[0-9a-f]{64}$/)
    expect(pdfHash(first)).toBe(pdfHash(second))
    await parsedPdf.destroy()
  })
})

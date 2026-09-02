import { describe, expect, it } from 'vitest'
import { DOCUMENT_SCHEMA_ID, emptyCanonicalDocument, normalizeCanonicalDocument, parseCanonicalDocument, validateCanonicalDocument } from './canonical-document'
import { sha256CanonicalJson } from './canonical-hash'

describe('Document Studio canonical document', () => {
  it('accepts the required region for each template kind and rejects forbidden regions', () => {
    expect(parseCanonicalDocument(emptyCanonicalDocument('DOCUMENT')).kind).toBe('DOCUMENT')
    expect(parseCanonicalDocument(emptyCanonicalDocument('COVER')).kind).toBe('COVER')
    expect(parseCanonicalDocument(emptyCanonicalDocument('APPENDIX')).kind).toBe('APPENDIX')
    const invalid = emptyCanonicalDocument('COVER')
    expect(validateCanonicalDocument({ ...invalid, regions: { ...invalid.regions, body: { type: 'region', content: [] } } }).valid).toBe(false)
  })

  it('round-trips the allowed placeholder, mark, table, image and column shapes', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = {
      ...base,
      regions: {
        ...base.regions,
        body: {
          type: 'region' as const,
          content: [
            { type: 'heading' as const, attrs: { level: 2 as const, align: 'LEFT' as const }, content: [{ type: 'text' as const, text: 'Offer ', marks: [{ type: 'bold' as const }] }, { type: 'knownPlaceholder' as const, attrs: { field: 'employee.first_name' } }] },
            { type: 'table' as const, attrs: { columnWidths: [50, 50] }, content: [{ type: 'tableRow' as const, content: [{ type: 'tableHeader' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [] }] }, { type: 'tableCell' as const, attrs: { align: 'RIGHT' as const }, content: [{ type: 'paragraph' as const, attrs: { align: 'RIGHT' as const }, content: [{ type: 'temporalPlaceholder' as const, attrs: { field: 'employment.start_date', temporal: 'wordt' as const } }] }] }] }] },
            { type: 'blockImage' as const, attrs: { assetRef: '123e4567-e89b-12d3-a456-426614174000', altText: 'Logo', width: 50 as const, align: 'CENTER' as const } },
            { type: 'twoColumnBlock' as const, attrs: { ratio: '50_50' as const }, content: [{ type: 'column' as const, attrs: { side: 'left' as const }, content: [{ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [] }] }, { type: 'column' as const, attrs: { side: 'right' as const }, content: [{ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [] }] }] },
          ],
        },
      },
    }
    const normalized = normalizeCanonicalDocument(document)
    expect(normalized.document.schema.id).toBe(DOCUMENT_SCHEMA_ID)
    expect(normalized.assetRefs).toEqual(['123e4567-e89b-12d3-a456-426614174000'])
    expect(parseCanonicalDocument(normalized.document)).toEqual(normalized.document)
  })

  it('rejects unknown attributes and malformed placeholders', () => {
    const document = emptyCanonicalDocument('DOCUMENT')
    const paragraph = { type: 'paragraph', attrs: { align: 'LEFT', color: 'red' }, content: [] }
    expect(validateCanonicalDocument({ ...document, regions: { ...document.regions, body: { type: 'region', content: [paragraph] } } }).valid).toBe(false)
    const malformed = { type: 'knownPlaceholder', attrs: { field: 'Employee.Name' } }
    expect(validateCanonicalDocument({ ...document, regions: { ...document.regions, body: { type: 'region', content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [malformed] }] } } }).valid).toBe(false)
  })

  it('normalizes deterministically and enforces text limits', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const first = normalizeCanonicalDocument(base)
    const second = normalizeCanonicalDocument({ regions: base.regions, page: base.page, kind: base.kind, schema: base.schema })
    expect(first.canonicalJson).toBe(second.canonicalJson)
    expect(sha256CanonicalJson(first.canonicalJson)).toBe(sha256CanonicalJson(second.canonicalJson))
    const oversized = { ...base, regions: { ...base.regions, body: { type: 'region' as const, content: [{ type: 'paragraph' as const, attrs: { align: 'LEFT' as const }, content: [{ type: 'text' as const, text: 'x'.repeat(10_001) }] }] } } }
    expect(validateCanonicalDocument(oversized).valid).toBe(false)
  })
})

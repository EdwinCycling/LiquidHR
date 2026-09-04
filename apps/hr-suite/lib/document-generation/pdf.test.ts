import { describe, expect, it } from 'vitest'
import { emptyCanonicalDocument } from '@/lib/document-studio/canonical-document'
import { resolveGenerationSnapshot, type GenerationContext } from './domain'
import { pdfHash, renderResolvedSnapshotToPdf } from './pdf'

describe('DG1 PDF renderer contract', () => {
  it('renders the resolved snapshot to deterministic A4 PDF bytes', () => {
    const context = { tenantId: 't', hrGroupId: 'g', employeeId: 'e', templateId: 't', templateVersionId: 'v', templateVersion: 1, rendererVersion: 'dg1-a4-work-sans-pdf-1', generatedAt: '2026-09-04T10:00:00.000Z', knownValues: {}, temporalValues: {}, freeValues: {}, documentProfile: {}, organization: {}, componentVersions: [] } satisfies GenerationContext
    const snapshot = resolveGenerationSnapshot(emptyCanonicalDocument('DOCUMENT'), context)
    const first = renderResolvedSnapshotToPdf(snapshot)
    const second = renderResolvedSnapshotToPdf(snapshot)
    expect(new TextDecoder().decode(first)).toContain('%PDF-1.4')
    expect(pdfHash(first)).toBe(pdfHash(second))
  })
})

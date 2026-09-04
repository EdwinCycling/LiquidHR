import type { CanonicalDocument } from '@/lib/document-studio/canonical-document'
import { parseCanonicalDocument } from '@/lib/document-studio/canonical-document'

/**
 * A generated document may contain the resolved cover and appendices that are
 * stored separately as native component templates. Authored DOCUMENT
 * templates intentionally cannot contain those regions.
 */
export type GenerationDocument = Omit<CanonicalDocument, 'kind'> & { readonly kind: 'DOCUMENT' }

export class ResolvedGenerationDocumentError extends Error {
  constructor() {
    super('DOCUMENT_GENERATION_RESOLVED_DOCUMENT_INVALID')
    this.name = 'ResolvedGenerationDocumentError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function composedRegion(
  input: Record<string, unknown>,
  regions: Record<string, unknown>,
  kind: 'COVER' | 'APPENDIX',
  regionName: 'cover' | 'appendix',
): GenerationDocument['regions'][typeof regionName] {
  const rawRegion = regions[regionName]
  if (rawRegion === null) return null
  const parsed = parseCanonicalDocument({
    schema: input.schema,
    kind,
    page: input.page,
    regions: {
      cover: kind === 'COVER' ? rawRegion : null,
      header: null,
      body: null,
      appendix: kind === 'APPENDIX' ? rawRegion : null,
      footer: null,
    },
  })
  return parsed.regions[regionName]
}

/** Parse the generated, composed form without widening authored templates. */
export function parseGenerationDocument(input: unknown): GenerationDocument {
  if (!isRecord(input) || input.kind !== 'DOCUMENT' || !isRecord(input.regions)) throw new ResolvedGenerationDocumentError()
  const regions = input.regions
  const main = parseCanonicalDocument({
    schema: input.schema,
    kind: 'DOCUMENT',
    page: input.page,
    regions: {
      cover: null,
      header: regions.header ?? null,
      body: regions.body,
      appendix: null,
      footer: regions.footer ?? null,
    },
  })
  return {
    ...main,
    kind: 'DOCUMENT',
    regions: {
      cover: composedRegion(input, regions, 'COVER', 'cover'),
      header: main.regions.header,
      body: main.regions.body,
      appendix: composedRegion(input, regions, 'APPENDIX', 'appendix'),
      footer: main.regions.footer,
    },
  }
}

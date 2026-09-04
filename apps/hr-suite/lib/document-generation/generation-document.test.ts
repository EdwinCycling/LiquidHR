import { describe, expect, it } from 'vitest'
import { emptyCanonicalDocument } from '@/lib/document-studio/canonical-document'
import { parseGenerationDocument } from './generation-document'

describe('DG1 composed generation document', () => {
  it('keeps the DOCUMENT root while accepting persisted cover and appendix regions', () => {
    const document = emptyCanonicalDocument('DOCUMENT')
    const cover = emptyCanonicalDocument('COVER')
    const appendix = emptyCanonicalDocument('APPENDIX')
    const parsed = parseGenerationDocument({
      ...document,
      regions: {
        ...document.regions,
        cover: cover.regions.cover,
        appendix: appendix.regions.appendix,
      },
    })

    expect(parsed.kind).toBe('DOCUMENT')
    expect(parsed.regions.cover).not.toBeNull()
    expect(parsed.regions.body).not.toBeNull()
    expect(parsed.regions.appendix).not.toBeNull()
    expect(parsed.regions.header).toBeNull()
    expect(parsed.regions.footer).toBeNull()
  })
})

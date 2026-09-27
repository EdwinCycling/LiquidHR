import { describe, expect, it } from 'vitest'
import { emptyCanonicalDocument, parseCanonicalDocument, validateDocumentBodyForActivation, type CanonicalBlock, type CanonicalInline, type CanonicalRegion } from '@/lib/document-studio/canonical-document'
import { createNormalizedDocumentV1 } from '@/lib/document-studio/normalized-document'
import { parseGenerationDocument } from './generation-document'
import { renderResolvedSnapshotToHtml } from './html'
import { resolveGenerationSnapshot, type GenerationContext } from './domain'
import { GenerationResolutionError, resolveRequiredGenerationValues } from './resolver'

const renderContext = {
  tenantId: 'tenant-doc02',
  hrGroupId: 'group-doc02',
  employeeId: 'employee-doc02',
  templateId: 'template-doc02',
  templateName: 'DOC02 Rendering Fixture',
  templateVersionId: 'template-doc02-v1',
  templateVersion: 1,
  documentCategory: 'GENERAL',
  defaultDossier: false,
  rendererVersion: 'doc02-test-renderer',
  generatedAt: '2026-09-27T09:00:00.000Z',
  knownValues: {},
  temporalValues: {},
  freeValues: {},
  documentProfile: { name: 'Synthetic administration' },
  organization: { name: 'Synthetic organization' },
  componentVersions: [],
  assets: [],
} satisfies GenerationContext

function textRegion(value: string): CanonicalRegion {
  return {
    type: 'region',
    content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [{ type: 'text', text: value }] }],
  }
}

function paragraph(content: readonly CanonicalInline[]): CanonicalBlock {
  return { type: 'paragraph', attrs: { align: 'LEFT' }, content }
}

function syntheticStressDocument() {
  const base = emptyCanonicalDocument('DOCUMENT')
  const longText = 'DOC02 long synthetic text. '.repeat(18).trim()
  const document = parseCanonicalDocument({
    ...base,
    regions: {
      ...base.regions,
      cover: null,
      header: textRegion('DOC02 · CONFIDENTIAL'),
      body: {
        type: 'region',
        content: [
          paragraph([
            { type: 'text', text: 'Employee: ' },
            { type: 'knownPlaceholder', attrs: { field: 'employee.first_name' } },
            { type: 'text', text: ' ' },
            { type: 'knownPlaceholder', attrs: { field: 'employee.last_name' } },
            { type: 'text', text: ' · repeat=' },
            { type: 'knownPlaceholder', attrs: { field: 'employee.first_name' } },
          ]),
          paragraph([
            { type: 'text', text: 'Employee no.: ' },
            { type: 'knownPlaceholder', attrs: { field: 'employee.employee_number' } },
            { type: 'text', text: ' · Employment start: ' },
            { type: 'knownPlaceholder', attrs: { field: 'employment.start_date' } },
            { type: 'text', text: ' · status: ' },
            { type: 'temporalPlaceholder', attrs: { field: 'employment.start_date', temporal: 'is' } },
          ]),
          paragraph([
            { type: 'text', text: 'Salary: ' },
            { type: 'freePlaceholder', attrs: { key: 'Salary' } },
            { type: 'text', text: ' · workload: ' },
            { type: 'freePlaceholder', attrs: { key: 'Workload' } },
          ]),
          paragraph([
            { type: 'text', text: 'Custom text: ' },
            { type: 'freePlaceholder', attrs: { key: 'SpecialText' } },
            { type: 'text', text: ' · optional: [' },
            { type: 'freePlaceholder', attrs: { key: 'OptionalNote', optional: true } },
            { type: 'text', text: ']' },
          ]),
          paragraph([{ type: 'text', text: longText }]),
        ],
      },
      appendix: null,
      footer: textRegion('DOC02 Footer · page'),
    },
  })
  const normalized = createNormalizedDocumentV1({
    templateId: 'doc02-template',
    templateVersionId: 'doc02-template-v1',
    templateVersion: 4,
    document,
    composition: [
      { kind: 'COVER', templateId: 'doc02-cover', versionId: 'doc02-cover-v2', version: 2, sortOrder: 0 },
      { kind: 'APPENDIX', templateId: 'doc02-appendix-a', versionId: 'doc02-appendix-a-v3', version: 3, sortOrder: 1 },
      { kind: 'APPENDIX', templateId: 'doc02-appendix-b', versionId: 'doc02-appendix-b-v1', version: 1, sortOrder: 2 },
    ],
    assets: [],
  })
  const values = resolveRequiredGenerationValues(normalized.placeholderManifest, {
    'employee.first_name': 'Zoë <HR & Ops>',
    'employee.last_name': "O’Connor",
    'employee.employee_number': 'DOC02-001',
    'employment.start_date': '2024-03-01',
  }, {
    'employment.start_date[is]': '01-03-2024',
  }, {
    Salary: '€ 98.765,43',
    Workload: '0,75%',
    SpecialText: 'Line 1\nLine 2 <&> café — Ελληνικά — 日本語',
    UnknownInput: 'MUST_NOT_RENDER',
  })
  const generated = parseGenerationDocument({
    ...document,
    regions: {
      ...document.regions,
      cover: textRegion('DOC02 Cover — offer for Zoë'),
      appendix: {
        type: 'region',
        content: [
          ...textRegion('DOC02 Appendix A').content,
          { type: 'pageBreak' },
          ...textRegion('DOC02 Appendix B').content,
        ],
      },
    },
  })
  const context = {
    ...renderContext,
    templateVersion: normalized.templateVersion,
    knownValues: values.known,
    temporalValues: values.temporal,
    freeValues: values.free,
    componentVersions: normalized.composition.map((item) => ({ kind: item.kind, templateVersionId: item.versionId, version: item.version })),
  } satisfies GenerationContext

  return { document: generated, context, longText, normalized, values }
}

function optionalPlaceholderDocument() {
  const base = emptyCanonicalDocument('DOCUMENT')
  return {
    ...base,
    regions: {
      ...base.regions,
      body: {
        type: 'region' as const,
        content: [{
          type: 'paragraph' as const,
          attrs: { align: 'LEFT' as const },
          content: [{ type: 'freePlaceholder' as const, attrs: { key: 'OptionalNote', optional: true } }],
        }],
      },
    },
  }
}

describe('DOC02 template rendering acceptance contract', () => {
  it('preserves optional placeholder intent in the native template and manifest', () => {
    const document = parseCanonicalDocument(optionalPlaceholderDocument())
    const normalized = createNormalizedDocumentV1({
      templateId: 'doc02-template',
      templateVersionId: 'doc02-template-v1',
      templateVersion: 1,
      document,
      composition: [],
      assets: [],
    })

    expect(document.regions.body?.content[0]).toMatchObject({
      content: [{ type: 'freePlaceholder', attrs: { key: 'OptionalNote', optional: true } }],
    })
    expect(normalized.placeholderManifest).toEqual([
      { type: 'FREE', key: 'OptionalNote', locations: ['/regions/body/content/0/content/0'], optional: true },
    ])
  })

  it('leaves an absent optional value blank while still resolving required values', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = parseCanonicalDocument({
      ...base,
      regions: {
        ...base.regions,
        body: {
          type: 'region',
          content: [{
            type: 'paragraph',
            attrs: { align: 'LEFT' },
            content: [
              { type: 'knownPlaceholder', attrs: { field: 'employee.first_name' } },
              { type: 'knownPlaceholder', attrs: { field: 'employee.last_name', optional: true } },
              { type: 'temporalPlaceholder', attrs: { field: 'employment.start_date', temporal: 'was', optional: true } },
              { type: 'freePlaceholder', attrs: { key: 'OptionalNote', optional: true } },
            ],
          }],
        },
      },
    })
    const normalized = createNormalizedDocumentV1({
      templateId: 'doc02-template',
      templateVersionId: 'doc02-template-v1',
      templateVersion: 1,
      document,
      composition: [],
      assets: [],
    })

    const resolved = resolveRequiredGenerationValues(normalized.placeholderManifest, { 'employee.first_name': 'Zoë' }, {}, {})

    expect(resolved.known).toEqual({ 'employee.first_name': 'Zoë', 'employee.last_name': '' })
    expect(resolved.temporal).toEqual({ 'employment.start_date[was]': '' })
    expect(resolved.free).toEqual({ OptionalNote: '' })

    const nullOptionalValues = resolveRequiredGenerationValues(normalized.placeholderManifest, {
      'employee.first_name': 'Zoë',
      'employee.last_name': null,
    } as unknown as Record<string, string>, {
      'employment.start_date[was]': null,
    } as unknown as Record<string, string>, {
      OptionalNote: null,
    } as unknown as Record<string, string>)
    expect(nullOptionalValues.known['employee.last_name']).toBe('')
    expect(nullOptionalValues.temporal['employment.start_date[was]']).toBe('')
    expect(nullOptionalValues.free.OptionalNote).toBe('')
  })

  it('keeps a placeholder key required when any duplicate occurrence is required', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = parseCanonicalDocument({
      ...base,
      regions: {
        ...base.regions,
        body: {
          type: 'region',
          content: [paragraph([
            { type: 'freePlaceholder', attrs: { key: 'SharedNote', optional: true } },
            { type: 'freePlaceholder', attrs: { key: 'SharedNote' } },
          ])],
        },
      },
    })
    const normalized = createNormalizedDocumentV1({
      templateId: 'doc02-template', templateVersionId: 'doc02-template-v1', templateVersion: 1,
      document, composition: [], assets: [],
    })

    expect(normalized.placeholderManifest).toEqual([
      { type: 'FREE', key: 'SharedNote', locations: ['/regions/body/content/0/content/0', '/regions/body/content/0/content/1'] },
    ])
    expect(() => resolveRequiredGenerationValues(normalized.placeholderManifest, {}, {}, {})).toThrowError(GenerationResolutionError)
  })

  it('renders the synthetic known, free, temporal, Unicode, date, amount and percentage values exactly and reproducibly', () => {
    const fixture = syntheticStressDocument()
    const first = resolveGenerationSnapshot(fixture.document, fixture.context)
    const second = resolveGenerationSnapshot(fixture.document, fixture.context)
    const html = renderResolvedSnapshotToHtml(first)

    expect(first.resolvedDocumentHash).toBe(second.resolvedDocumentHash)
    expect(first.resolvedDocumentJson).toBe(second.resolvedDocumentJson)
    expect(first.componentVersions).toEqual([
      { kind: 'COVER', templateVersionId: 'doc02-cover-v2', version: 2 },
      { kind: 'APPENDIX', templateVersionId: 'doc02-appendix-a-v3', version: 3 },
      { kind: 'APPENDIX', templateVersionId: 'doc02-appendix-b-v1', version: 1 },
    ])
    expect(html).toContain('Employee: Zoë &lt;HR &amp; Ops&gt; O’Connor · repeat=Zoë &lt;HR &amp; Ops&gt;')
    expect(html).toContain('Employee no.: DOC02-001 · Employment start: 2024-03-01 · status: 01-03-2024')
    expect(html).toContain('Salary: € 98.765,43 · workload: 0,75%')
    expect(html).toContain('Custom text: Line 1\nLine 2 &lt;&amp;&gt; café — Ελληνικά — 日本語 · optional: []')
    expect(html).toContain(fixture.longText)
    expect(html).not.toContain('OptionalNote')
    expect(html).not.toContain('MUST_NOT_RENDER')
  })

  it('blocks a missing required value with its placeholder key and ignores unknown input keys', () => {
    const document = parseCanonicalDocument({
      ...emptyCanonicalDocument('DOCUMENT'),
      regions: {
        ...emptyCanonicalDocument('DOCUMENT').regions,
        body: {
          type: 'region',
          content: [paragraph([
            { type: 'knownPlaceholder', attrs: { field: 'employee.first_name' } },
            { type: 'freePlaceholder', attrs: { key: 'RequiredNote' } },
          ])],
        },
      },
    })
    const normalized = createNormalizedDocumentV1({
      templateId: 'doc02-template', templateVersionId: 'doc02-template-v1', templateVersion: 1,
      document, composition: [], assets: [],
    })

    let error: unknown
    try {
      resolveRequiredGenerationValues(normalized.placeholderManifest, {}, {}, { UnknownInput: 'ignore me' })
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(GenerationResolutionError)
    expect(error).toMatchObject({ missingKeys: ['employee.first_name', 'RequiredNote'] })
    const resolved = resolveRequiredGenerationValues(normalized.placeholderManifest, { 'employee.first_name': 'Ada' }, {}, { RequiredNote: 'Present', UnknownInput: 'ignore me' })
    expect(resolved.free).toEqual({ RequiredNote: 'Present' })
  })

  it('rejects unknown known-fields and malformed optional placeholder definitions', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const withInline = (node: unknown) => ({
      ...base,
      regions: { ...base.regions, body: { type: 'region', content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [node] }] } },
    })

    expect(() => parseCanonicalDocument(withInline({ type: 'knownPlaceholder', attrs: { field: 'employee.unknown' } })))
      .toThrow('DOCUMENT_KNOWN_FIELD_UNKNOWN')
    expect(() => parseCanonicalDocument(withInline({ type: 'freePlaceholder', attrs: { key: 'OptionalNote', optional: 'yes' } })))
      .toThrow('DOCUMENT_PLACEHOLDER_OPTIONAL_INVALID')
    expect(() => parseCanonicalDocument(withInline({ type: 'freePlaceholder', attrs: { key: 'bad-key' } })))
      .toThrow('DOCUMENT_FREE_FIELD_INVALID')
  })

  it('renders cover, header, body, appendices in order, then footer', () => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = parseGenerationDocument({
      ...base,
      regions: {
        ...base.regions,
        cover: textRegion('DOC02 Cover'),
        header: textRegion('DOC02 Header'),
        body: textRegion('DOC02 Body'),
        appendix: {
          type: 'region',
          content: [
            ...textRegion('DOC02 Appendix A').content,
            ...textRegion('DOC02 Appendix B').content,
          ] as CanonicalBlock[],
        },
        footer: textRegion('DOC02 Footer'),
      },
    })
    const html = renderResolvedSnapshotToHtml(resolveGenerationSnapshot(document, renderContext))
    const sectionOffsets = ['DOC02 Cover', 'DOC02 Header', 'DOC02 Body', 'DOC02 Appendix A', 'DOC02 Appendix B', 'DOC02 Footer'].map((value) => html.indexOf(value))

    expect(sectionOffsets.every((offset) => offset >= 0)).toBe(true)
    expect(sectionOffsets).toEqual([...sectionOffsets].sort((left, right) => left - right))
  })

  it.each([
    { name: 'body only', includeCover: false, includeHeader: false, includeAppendix: false, includeFooter: false },
    { name: 'cover and body', includeCover: true, includeHeader: false, includeAppendix: false, includeFooter: false },
    { name: 'header and body', includeCover: false, includeHeader: true, includeAppendix: false, includeFooter: false },
    { name: 'body and appendix', includeCover: false, includeHeader: false, includeAppendix: true, includeFooter: false },
    { name: 'body and footer', includeCover: false, includeHeader: false, includeAppendix: false, includeFooter: true },
    { name: 'full composition', includeCover: true, includeHeader: true, includeAppendix: true, includeFooter: true },
  ])('renders the native document model for $name', ({ includeCover, includeHeader, includeAppendix, includeFooter }) => {
    const base = emptyCanonicalDocument('DOCUMENT')
    const document = parseGenerationDocument({
      ...base,
      regions: {
        ...base.regions,
        cover: includeCover ? textRegion('DOC02 Optional Cover') : null,
        header: includeHeader ? textRegion('DOC02 Optional Header') : null,
        appendix: includeAppendix ? textRegion('DOC02 Optional Appendix') : null,
        footer: includeFooter ? textRegion('DOC02 Optional Footer') : null,
        body: textRegion('DOC02 Required Body'),
      },
    })
    const html = renderResolvedSnapshotToHtml(resolveGenerationSnapshot(document, renderContext))

    expect(html).toContain('DOC02 Required Body')
    expect(html.includes('DOC02 Optional Cover')).toBe(includeCover)
    expect(html.includes('DOC02 Optional Header')).toBe(includeHeader)
    expect(html.includes('DOC02 Optional Appendix')).toBe(includeAppendix)
    expect(html.includes('DOC02 Optional Footer')).toBe(includeFooter)
  })

  it('rejects an empty required body at activation while allowing a blank draft shape', () => {
    const blankDraft = emptyCanonicalDocument('DOCUMENT')

    expect(parseCanonicalDocument(blankDraft).regions.body?.content).toHaveLength(1)
    expect(validateDocumentBodyForActivation(blankDraft)).toEqual([
      {
        code: 'DOCUMENT_BODY_EMPTY',
        path: ['regions', 'body', 'content'],
        messageKey: 'documentStudio.validation.bodyEmpty',
      },
    ])
    const whitespaceBody = { ...blankDraft, regions: { ...blankDraft.regions, body: textRegion(' \n ') } }
    expect(validateDocumentBodyForActivation(parseCanonicalDocument(whitespaceBody))).toHaveLength(1)
    const pageBreakOnly = { ...blankDraft, regions: { ...blankDraft.regions, body: { type: 'region' as const, content: [{ type: 'pageBreak' as const }] } } }
    expect(validateDocumentBodyForActivation(parseCanonicalDocument(pageBreakOnly))).toHaveLength(1)
  })
})

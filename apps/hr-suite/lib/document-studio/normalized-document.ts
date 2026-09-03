import type {
  CanonicalBlock,
  CanonicalDocument,
  CanonicalInline,
  CanonicalRegions,
  CanonicalText,
  TemplateKind,
} from './canonical-document'

export interface NormalizedDocumentV1 {
  readonly schemaId: 'liquid-hr.document-studio.native.v1'
  readonly schemaVersion: 1
  readonly templateId: string
  readonly templateVersionId: string
  readonly templateVersion: number
  readonly kind: TemplateKind
  readonly page: CanonicalDocument['page']
  readonly regions: CanonicalRegions
  readonly composition: readonly {
    readonly kind: 'COVER' | 'APPENDIX'
    readonly templateId: string
    readonly versionId: string
    readonly version: number
    readonly sortOrder: number
  }[]
  readonly assets: readonly {
    readonly assetRef: string
    readonly normalizedMime: 'image/png' | 'image/jpeg'
    readonly width: number
    readonly height: number
    readonly storageRef: string
  }[]
  readonly placeholderManifest: readonly {
    readonly type: 'KNOWN' | 'TEMPORAL' | 'FREE'
    readonly key: string
    readonly locations: readonly string[]
  }[]
}

export interface NormalizedDocumentCompositionInput {
  readonly kind: 'COVER' | 'APPENDIX'
  readonly templateId: string
  readonly versionId: string
  readonly version: number
  readonly sortOrder: number
}

export interface NormalizedDocumentAssetInput {
  readonly assetRef: string
  readonly normalizedMime: 'image/png' | 'image/jpeg'
  readonly width: number
  readonly height: number
  readonly storageRef: string
}

export interface NormalizedDocumentV1Input {
  readonly templateId: string
  readonly templateVersionId: string
  readonly templateVersion: number
  readonly document: CanonicalDocument
  readonly composition: readonly NormalizedDocumentCompositionInput[]
  readonly assets: readonly NormalizedDocumentAssetInput[]
}

type ManifestEntry = { type: 'KNOWN' | 'TEMPORAL' | 'FREE'; key: string; locations: string[] }

function isText(node: CanonicalInline): node is CanonicalText {
  return node.type === 'text'
}

function collectInline(inline: readonly CanonicalInline[], path: string, entries: Map<string, ManifestEntry>): void {
  inline.forEach((node, index) => {
    const location = `${path}/content/${index}`
    if (isText(node)) return
    const type = node.type === 'knownPlaceholder' ? 'KNOWN' : node.type === 'temporalPlaceholder' ? 'TEMPORAL' : 'FREE'
    const key = node.type === 'knownPlaceholder'
      ? node.attrs.field
      : node.type === 'temporalPlaceholder'
        ? `${node.attrs.field}[${node.attrs.temporal}]`
        : node.attrs.key
    const mapKey = `${type}:${key}`
    const entry = entries.get(mapKey) ?? { type, key, locations: [] }
    entry.locations.push(location)
    entries.set(mapKey, entry)
  })
}

function collectBlocks(blocks: readonly CanonicalBlock[], path: string, entries: Map<string, ManifestEntry>): void {
  blocks.forEach((block, index) => {
    const location = `${path}/content/${index}`
    if (block.type === 'paragraph' || block.type === 'heading') {
      collectInline(block.content, location, entries)
      return
    }
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      block.content.forEach((item, itemIndex) => item.content.forEach((paragraph, paragraphIndex) => collectInline(paragraph.content, `${location}/content/${itemIndex}/content/${paragraphIndex}`, entries)))
      return
    }
    if (block.type === 'table') {
      block.content.forEach((row, rowIndex) => row.content.forEach((cell, cellIndex) => cell.content.forEach((paragraph, paragraphIndex) => collectInline(paragraph.content, `${location}/content/${rowIndex}/content/${cellIndex}/content/${paragraphIndex}`, entries))))
      return
    }
    if (block.type === 'twoColumnBlock') {
      block.content.forEach((column, columnIndex) => collectBlocks(column.content, `${location}/content/${columnIndex}`, entries))
    }
  })
}

function collectManifest(regions: CanonicalRegions): NormalizedDocumentV1['placeholderManifest'] {
  const entries = new Map<string, ManifestEntry>()
  for (const [regionName, region] of Object.entries(regions)) {
    if (region) collectBlocks(region.content, `/regions/${regionName}`, entries)
  }
  return [...entries.values()]
    .map((entry) => ({ ...entry, locations: [...entry.locations].sort() }))
    .sort((left, right) => `${left.type}:${left.key}`.localeCompare(`${right.type}:${right.key}`))
}

export function createNormalizedDocumentV1(input: NormalizedDocumentV1Input): NormalizedDocumentV1 {
  return {
    schemaId: 'liquid-hr.document-studio.native.v1',
    schemaVersion: 1,
    templateId: input.templateId,
    templateVersionId: input.templateVersionId,
    templateVersion: input.templateVersion,
    kind: input.document.kind,
    page: input.document.page,
    regions: input.document.regions,
    composition: input.composition.map((item) => ({ ...item })),
    assets: input.assets.map((asset) => ({ ...asset })),
    placeholderManifest: collectManifest(input.document.regions),
  }
}

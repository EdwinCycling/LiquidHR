import { z } from 'zod'

export const DOCUMENT_SCHEMA_ID = 'liquid-hr.document-studio.native.v1' as const
export const DOCUMENT_SCHEMA_VERSION = 1 as const

export const TEMPLATE_KINDS = ['DOCUMENT', 'COVER', 'APPENDIX'] as const
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]
export const TEMPLATE_LANGUAGES = ['NL', 'EN'] as const
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number]
export const CATEGORY_CODES = [
  'EMPLOYMENT',
  'COMPENSATION',
  'ABSENCE_LEAVE',
  'PERFORMANCE_DEVELOPMENT',
  'ONBOARDING',
  'OFFBOARDING',
  'POLICY_COMPLIANCE',
  'GENERAL',
] as const
export type DocumentCategory = (typeof CATEGORY_CODES)[number]
export const KNOWN_FIELD_KEYS = ['employee.first_name', 'employee.last_name', 'employee.employee_number', 'employment.start_date'] as const
export const DOCUMENT_TYPE_CODES = ['PERMANENT', 'YEARS'] as const
export type RetentionKind = (typeof DOCUMENT_TYPE_CODES)[number]
export const ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFY'] as const
export type Alignment = (typeof ALIGNMENTS)[number]
export const FONT_SIZES = [10, 11, 12, 14, 16, 18, 24, 32] as const
export type FontSize = (typeof FONT_SIZES)[number]
export const TWO_COLUMN_RATIOS = ['25_75', '33_67', '50_50', '67_33', '75_25'] as const
export type TwoColumnRatio = (typeof TWO_COLUMN_RATIOS)[number]
export const IMAGE_WIDTHS = [25, 50, 75, 100] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]
export const IMAGE_ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT'] as const
export type ImageAlignment = (typeof IMAGE_ALIGNMENTS)[number]

export type DocumentPathPart = string | number

export interface DocumentValidationIssue {
  readonly code: string
  readonly path: readonly DocumentPathPart[]
  readonly messageKey: string
}

export class CanonicalDocumentError extends Error {
  constructor(readonly issues: readonly DocumentValidationIssue[]) {
    super(issues[0]?.code ?? 'DOCUMENT_SCHEMA_INVALID')
    this.name = 'CanonicalDocumentError'
  }
}

export interface CanonicalMark {
  readonly type: 'bold' | 'italic' | 'underline' | 'fontSize'
  readonly attrs?: Readonly<{ size: FontSize }>
}

export interface CanonicalText {
  readonly type: 'text'
  readonly text: string
  readonly marks?: readonly CanonicalMark[]
}

export interface KnownPlaceholder {
  readonly type: 'knownPlaceholder'
  readonly attrs: Readonly<{ field: string }>
}

export interface TemporalPlaceholder {
  readonly type: 'temporalPlaceholder'
  readonly attrs: Readonly<{ field: string; temporal: 'was' | 'is' | 'wordt' }>
}

export interface FreePlaceholder {
  readonly type: 'freePlaceholder'
  readonly attrs: Readonly<{ key: string }>
}

export type CanonicalInline = CanonicalText | KnownPlaceholder | TemporalPlaceholder | FreePlaceholder

export interface CanonicalParagraph {
  readonly type: 'paragraph'
  readonly attrs: Readonly<{ align: Alignment }>
  readonly content: readonly CanonicalInline[]
}

export interface CanonicalHeading {
  readonly type: 'heading'
  readonly attrs: Readonly<{ level: 1 | 2 | 3; align: Alignment }>
  readonly content: readonly CanonicalInline[]
}

export interface CanonicalListItem {
  readonly type: 'listItem'
  readonly content: readonly CanonicalParagraph[]
}

export interface CanonicalList {
  readonly type: 'bulletList' | 'orderedList'
  readonly content: readonly CanonicalListItem[]
}

export interface CanonicalHorizontalRule {
  readonly type: 'horizontalRule'
}

export interface CanonicalPageBreak {
  readonly type: 'pageBreak'
}

export interface CanonicalBlockImage {
  readonly type: 'blockImage'
  readonly attrs: Readonly<{
    assetRef: string
    altText: string
    width: ImageWidth
    align: ImageAlignment
  }>
}

export interface CanonicalTableCell {
  readonly type: 'tableCell' | 'tableHeader'
  readonly attrs: Readonly<{ align: Alignment }>
  readonly content: readonly CanonicalParagraph[]
}

export interface CanonicalTableRow {
  readonly type: 'tableRow'
  readonly content: readonly CanonicalTableCell[]
}

export interface CanonicalTable {
  readonly type: 'table'
  readonly attrs: Readonly<{ columnWidths?: readonly number[] }>
  readonly content: readonly CanonicalTableRow[]
}

export interface CanonicalColumn {
  readonly type: 'column'
  readonly attrs: Readonly<{ side: 'left' | 'right' }>
  readonly content: readonly CanonicalBlock[]
}

export interface CanonicalTwoColumnBlock {
  readonly type: 'twoColumnBlock'
  readonly attrs: Readonly<{ ratio: TwoColumnRatio }>
  readonly content: readonly [CanonicalColumn, CanonicalColumn]
}

export type CanonicalBlock =
  | CanonicalParagraph
  | CanonicalHeading
  | CanonicalList
  | CanonicalHorizontalRule
  | CanonicalPageBreak
  | CanonicalBlockImage
  | CanonicalTable
  | CanonicalTwoColumnBlock

export interface CanonicalRegion {
  readonly type: 'region'
  readonly content: readonly CanonicalBlock[]
}

export interface CanonicalPage {
  readonly size: 'A4'
  readonly marginPreset: 'NARROW' | 'NORMAL' | 'WIDE'
  readonly fontFamily: 'WORK_SANS'
}

export interface CanonicalRegions {
  readonly cover: CanonicalRegion | null
  readonly header: CanonicalRegion | null
  readonly body: CanonicalRegion | null
  readonly appendix: CanonicalRegion | null
  readonly footer: CanonicalRegion | null
}

export interface CanonicalDocument {
  readonly schema: Readonly<{ id: typeof DOCUMENT_SCHEMA_ID; version: 1 }>
  readonly kind: TemplateKind
  readonly page: CanonicalPage
  readonly regions: CanonicalRegions
}

export interface NormalizedCanonicalDocument {
  readonly document: CanonicalDocument
  readonly canonicalJson: string
  readonly assetRefs: readonly string[]
}

const categoryCodeSchema = z.enum(CATEGORY_CODES)
export const documentTypeSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/),
  retentionKind: z.enum(['PERMANENT', 'YEARS']),
  retentionYears: z.number().int().min(1).max(100).nullable(),
}).superRefine((value, context) => {
  if (value.retentionKind === 'PERMANENT' && value.retentionYears !== null) {
    context.addIssue({ code: 'custom', path: ['retentionYears'], message: 'Permanent retention cannot have years.' })
  }
  if (value.retentionKind === 'YEARS' && value.retentionYears === null) {
    context.addIssue({ code: 'custom', path: ['retentionYears'], message: 'Year retention requires years.' })
  }
})

export { categoryCodeSchema }

const MAX_JSON_BYTES = 1024 * 1024
const MAX_TEXT_CODE_POINTS = 250_000
const MAX_NODES = 10_000
const MAX_TEXT_NODE = 10_000
const MAX_DEPTH = 32
export const MAX_TABLE_COLUMNS = 8
export const MAX_TABLE_ROWS = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(code: string, path: readonly DocumentPathPart[], messageKey = 'documentStudio.validation.schemaInvalid'): CanonicalDocumentError {
  return new CanonicalDocumentError([{ code, path, messageKey }])
}

function requireRecord(value: unknown, path: readonly DocumentPathPart[]): Record<string, unknown> {
  if (!isRecord(value)) throw issue('DOCUMENT_SCHEMA_OBJECT_REQUIRED', path)
  return value
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], path: readonly DocumentPathPart[]): void {
  const allowed = new Set(keys)
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw issue('DOCUMENT_SCHEMA_UNKNOWN_ATTRIBUTE', [...path, key])
  }
}

function requireString(value: unknown, path: readonly DocumentPathPart[]): string {
  if (typeof value !== 'string') throw issue('DOCUMENT_SCHEMA_STRING_REQUIRED', path)
  return value
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], path: readonly DocumentPathPart[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw issue('DOCUMENT_SCHEMA_ENUM_INVALID', path)
  return value as T
}

function requireInteger(value: unknown, path: readonly DocumentPathPart[]): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw issue('DOCUMENT_SCHEMA_INTEGER_REQUIRED', path)
  return value
}

function requireArray(value: unknown, path: readonly DocumentPathPart[]): readonly unknown[] {
  if (!Array.isArray(value)) throw issue('DOCUMENT_SCHEMA_ARRAY_REQUIRED', path)
  return value
}

function noAttrs(value: Record<string, unknown>, path: readonly DocumentPathPart[]): void {
  requireExactKeys(value, ['type'], path)
}

function parseMarks(value: unknown, path: readonly DocumentPathPart[]): readonly CanonicalMark[] | undefined {
  if (value === undefined) return undefined
  const marks = requireArray(value, path)
  return marks.map((candidate, index) => {
    const mark = requireRecord(candidate, [...path, index])
    const type = requireEnum(mark.type, ['bold', 'italic', 'underline', 'fontSize'] as const, [...path, index, 'type'])
    if (type !== 'fontSize') {
      requireExactKeys(mark, ['type'], [...path, index])
      return { type } as CanonicalMark
    }
    requireExactKeys(mark, ['type', 'attrs'], [...path, index])
    const attrs = requireRecord(mark.attrs, [...path, index, 'attrs'])
    requireExactKeys(attrs, ['size'], [...path, index, 'attrs'])
    const size = requireInteger(attrs.size, [...path, index, 'attrs', 'size'])
    if (!FONT_SIZES.includes(size as FontSize)) throw issue('DOCUMENT_FONT_SIZE_INVALID', [...path, index, 'attrs', 'size'])
    return { type, attrs: { size: size as FontSize } }
  })
}

function parseInline(value: unknown, path: readonly DocumentPathPart[]): CanonicalInline {
  const candidate = requireRecord(value, path)
  const type = requireString(candidate.type, [...path, 'type'])
  if (type === 'text') {
    requireExactKeys(candidate, ['type', 'text', 'marks'], path)
    const text = requireString(candidate.text, [...path, 'text'])
    if (text.length > MAX_TEXT_NODE) throw issue('DOCUMENT_TEXT_NODE_TOO_LARGE', [...path, 'text'])
    return { type, text, marks: parseMarks(candidate.marks, [...path, 'marks']) }
  }
  if (type === 'knownPlaceholder') {
    requireExactKeys(candidate, ['type', 'attrs'], path)
    const attrs = requireRecord(candidate.attrs, [...path, 'attrs'])
    requireExactKeys(attrs, ['field'], [...path, 'attrs'])
    const field = requireString(attrs.field, [...path, 'attrs', 'field'])
    if (!KNOWN_FIELD_KEYS.includes(field as (typeof KNOWN_FIELD_KEYS)[number])) throw issue('DOCUMENT_KNOWN_FIELD_UNKNOWN', [...path, 'attrs', 'field'])
    return { type, attrs: { field } }
  }
  if (type === 'temporalPlaceholder') {
    requireExactKeys(candidate, ['type', 'attrs'], path)
    const attrs = requireRecord(candidate.attrs, [...path, 'attrs'])
    requireExactKeys(attrs, ['field', 'temporal'], [...path, 'attrs'])
    const field = requireString(attrs.field, [...path, 'attrs', 'field'])
    const temporal = requireEnum(attrs.temporal, ['was', 'is', 'wordt'] as const, [...path, 'attrs', 'temporal'])
    if (!/^[a-z][a-z0-9]*(?:[._][a-z][a-z0-9]*)*$/.test(field)) throw issue('DOCUMENT_TEMPORAL_FIELD_INVALID', [...path, 'attrs', 'field'])
    return { type, attrs: { field, temporal } }
  }
  if (type === 'freePlaceholder') {
    requireExactKeys(candidate, ['type', 'attrs'], path)
    const attrs = requireRecord(candidate.attrs, [...path, 'attrs'])
    requireExactKeys(attrs, ['key'], [...path, 'attrs'])
    const key = requireString(attrs.key, [...path, 'attrs', 'key'])
    if (!/^[A-Z][A-Za-z0-9]{0,79}$/.test(key)) throw issue('DOCUMENT_FREE_FIELD_INVALID', [...path, 'attrs', 'key'])
    return { type, attrs: { key } }
  }
  throw issue('DOCUMENT_INLINE_NODE_UNSUPPORTED', [...path, 'type'])
}

function parseInlineContent(value: unknown, path: readonly DocumentPathPart[]): readonly CanonicalInline[] {
  return requireArray(value, path).map((candidate, index) => parseInline(candidate, [...path, index]))
}

function parseParagraph(value: Record<string, unknown>, path: readonly DocumentPathPart[]): CanonicalParagraph {
  requireExactKeys(value, ['type', 'attrs', 'content'], path)
  const attrs = requireRecord(value.attrs, [...path, 'attrs'])
  requireExactKeys(attrs, ['align'], [...path, 'attrs'])
  const align = requireEnum(attrs.align, ALIGNMENTS, [...path, 'attrs', 'align'])
  return { type: 'paragraph', attrs: { align }, content: parseInlineContent(value.content, [...path, 'content']) }
}

function parseHeading(value: Record<string, unknown>, path: readonly DocumentPathPart[]): CanonicalHeading {
  requireExactKeys(value, ['type', 'attrs', 'content'], path)
  const attrs = requireRecord(value.attrs, [...path, 'attrs'])
  requireExactKeys(attrs, ['level', 'align'], [...path, 'attrs'])
  const level = requireInteger(attrs.level, [...path, 'attrs', 'level'])
  const align = requireEnum(attrs.align, ALIGNMENTS, [...path, 'attrs', 'align'])
  if (![1, 2, 3].includes(level)) throw issue('DOCUMENT_HEADING_LEVEL_INVALID', [...path, 'attrs', 'level'])
  return { type: 'heading', attrs: { level: level as 1 | 2 | 3, align }, content: parseInlineContent(value.content, [...path, 'content']) }
}

function parseListItem(value: unknown, path: readonly DocumentPathPart[]): CanonicalListItem {
  const candidate = requireRecord(value, path)
  requireExactKeys(candidate, ['type', 'content'], path)
  if (candidate.type !== 'listItem') throw issue('DOCUMENT_LIST_ITEM_INVALID', [...path, 'type'])
  const content = requireArray(candidate.content, [...path, 'content']).map((item, index) => {
    const paragraph = requireRecord(item, [...path, 'content', index])
    if (paragraph.type !== 'paragraph') throw issue('DOCUMENT_LIST_CONTENT_INVALID', [...path, 'content', index])
    return parseParagraph(paragraph, [...path, 'content', index])
  })
  return { type: 'listItem', content }
}

function parseList(value: Record<string, unknown>, path: readonly DocumentPathPart[]): CanonicalList {
  requireExactKeys(value, ['type', 'content'], path)
  const type = requireEnum(value.type, ['bulletList', 'orderedList'] as const, [...path, 'type'])
  return { type, content: requireArray(value.content, [...path, 'content']).map((item, index) => parseListItem(item, [...path, 'content', index])) }
}

function parseTableCell(value: unknown, path: readonly DocumentPathPart[]): CanonicalTableCell {
  const candidate = requireRecord(value, path)
  const type = requireEnum(candidate.type, ['tableCell', 'tableHeader'] as const, [...path, 'type'])
  requireExactKeys(candidate, ['type', 'attrs', 'content'], path)
  const attrs = requireRecord(candidate.attrs, [...path, 'attrs'])
  requireExactKeys(attrs, ['align'], [...path, 'attrs'])
  const align = requireEnum(attrs.align, ALIGNMENTS, [...path, 'attrs', 'align'])
  const content = requireArray(candidate.content, [...path, 'content']).map((item, index) => {
    const paragraph = requireRecord(item, [...path, 'content', index])
    if (paragraph.type !== 'paragraph') throw issue('DOCUMENT_TABLE_CELL_CONTENT_INVALID', [...path, 'content', index])
    return parseParagraph(paragraph, [...path, 'content', index])
  })
  return { type, attrs: { align }, content }
}

function parseTable(value: Record<string, unknown>, path: readonly DocumentPathPart[]): CanonicalTable {
  requireExactKeys(value, ['type', 'attrs', 'content'], path)
  const attrs = requireRecord(value.attrs, [...path, 'attrs'])
  requireExactKeys(attrs, ['columnWidths'], [...path, 'attrs'])
  let columnWidths: readonly number[] | undefined
  if (attrs.columnWidths !== undefined) {
    const widths = requireArray(attrs.columnWidths, [...path, 'attrs', 'columnWidths']).map((width, index) => {
      const parsed = requireInteger(width, [...path, 'attrs', 'columnWidths', index])
      if (parsed < 10 || parsed > 100 || parsed % 5 !== 0) throw issue('DOCUMENT_TABLE_WIDTH_INVALID', [...path, 'attrs', 'columnWidths', index])
      return parsed
    })
    if (widths.reduce((sum, width) => sum + width, 0) !== 100) throw issue('DOCUMENT_TABLE_WIDTH_TOTAL_INVALID', [...path, 'attrs', 'columnWidths'])
    columnWidths = widths
  }
  const rows = requireArray(value.content, [...path, 'content']).map((row, index) => {
    const rowRecord = requireRecord(row, [...path, 'content', index])
    requireExactKeys(rowRecord, ['type', 'content'], [...path, 'content', index])
    if (rowRecord.type !== 'tableRow') throw issue('DOCUMENT_TABLE_ROW_INVALID', [...path, 'content', index])
    return {
      type: 'tableRow' as const,
      content: requireArray(rowRecord.content, [...path, 'content', index, 'content']).map((cell, cellIndex) => parseTableCell(cell, [...path, 'content', index, 'content', cellIndex])),
    }
  })
  const columns = rows[0]?.content.length ?? 0
  if (columns < 1 || columns > MAX_TABLE_COLUMNS) throw issue('DOCUMENT_TABLE_COLUMN_LIMIT', [...path, 'content'])
  if (rows.length < 1 || rows.length > MAX_TABLE_ROWS) throw issue('DOCUMENT_TABLE_ROW_LIMIT', [...path, 'content'])
  if (rows.some((row) => row.content.length !== columns)) throw issue('DOCUMENT_TABLE_RECTANGULAR_INVALID', [...path, 'content'])
  if (columnWidths && columnWidths.length !== columns) throw issue('DOCUMENT_TABLE_WIDTH_COUNT_INVALID', [...path, 'attrs', 'columnWidths'])
  return { type: 'table', attrs: columnWidths ? { columnWidths } : {}, content: rows }
}

function parseBlock(value: unknown, path: readonly DocumentPathPart[], depth: number): CanonicalBlock {
  if (depth > MAX_DEPTH) throw issue('DOCUMENT_DEPTH_LIMIT', path)
  const candidate = requireRecord(value, path)
  const type = requireString(candidate.type, [...path, 'type'])
  if (type === 'paragraph') return parseParagraph(candidate, path)
  if (type === 'heading') return parseHeading(candidate, path)
  if (type === 'bulletList' || type === 'orderedList') return parseList(candidate, path)
  if (type === 'table') return parseTable(candidate, path)
  if (type === 'horizontalRule' || type === 'pageBreak') {
    noAttrs(candidate, path)
    return { type }
  }
  if (type === 'blockImage') {
    requireExactKeys(candidate, ['type', 'attrs'], path)
    const attrs = requireRecord(candidate.attrs, [...path, 'attrs'])
    requireExactKeys(attrs, ['assetRef', 'altText', 'width', 'align'], [...path, 'attrs'])
    const assetRef = requireString(attrs.assetRef, [...path, 'attrs', 'assetRef'])
    const altText = requireString(attrs.altText, [...path, 'attrs', 'altText'])
    if (!/^[0-9a-f-]{36}$/.test(assetRef)) throw issue('DOCUMENT_ASSET_REF_INVALID', [...path, 'attrs', 'assetRef'])
    if (altText.length < 1 || altText.length > 240) throw issue('DOCUMENT_IMAGE_ALT_INVALID', [...path, 'attrs', 'altText'])
    const width = requireInteger(attrs.width, [...path, 'attrs', 'width'])
    if (!IMAGE_WIDTHS.includes(width as ImageWidth)) throw issue('DOCUMENT_IMAGE_WIDTH_INVALID', [...path, 'attrs', 'width'])
    const align = requireEnum(attrs.align, IMAGE_ALIGNMENTS, [...path, 'attrs', 'align'])
    return { type, attrs: { assetRef, altText, width: width as ImageWidth, align } }
  }
  if (type === 'twoColumnBlock') {
    requireExactKeys(candidate, ['type', 'attrs', 'content'], path)
    const attrs = requireRecord(candidate.attrs, [...path, 'attrs'])
    requireExactKeys(attrs, ['ratio'], [...path, 'attrs'])
    const ratio = requireEnum(attrs.ratio, TWO_COLUMN_RATIOS, [...path, 'attrs', 'ratio'])
    const columns = requireArray(candidate.content, [...path, 'content'])
    if (columns.length !== 2) throw issue('DOCUMENT_COLUMN_COUNT_INVALID', [...path, 'content'])
    const parsed = columns.map((column, index) => {
      const columnRecord = requireRecord(column, [...path, 'content', index])
      requireExactKeys(columnRecord, ['type', 'attrs', 'content'], [...path, 'content', index])
      if (columnRecord.type !== 'column') throw issue('DOCUMENT_COLUMN_INVALID', [...path, 'content', index])
      const columnAttrs = requireRecord(columnRecord.attrs, [...path, 'content', index, 'attrs'])
      requireExactKeys(columnAttrs, ['side'], [...path, 'content', index, 'attrs'])
      const side = requireEnum(columnAttrs.side, ['left', 'right'] as const, [...path, 'content', index, 'attrs', 'side'])
      return { type: 'column' as const, attrs: { side }, content: requireArray(columnRecord.content, [...path, 'content', index, 'content']).map((item, itemIndex) => parseBlock(item, [...path, 'content', index, 'content', itemIndex], depth + 1)) }
    })
    if (parsed[0]?.attrs.side !== 'left' || parsed[1]?.attrs.side !== 'right') throw issue('DOCUMENT_COLUMN_ORDER_INVALID', [...path, 'content'])
    return { type, attrs: { ratio }, content: [parsed[0], parsed[1]] }
  }
  throw issue('DOCUMENT_BLOCK_NODE_UNSUPPORTED', [...path, 'type'])
}

function parseRegion(value: unknown, path: readonly DocumentPathPart[]): CanonicalRegion {
  const region = requireRecord(value, path)
  requireExactKeys(region, ['type', 'content'], path)
  if (region.type !== 'region') throw issue('DOCUMENT_REGION_INVALID', [...path, 'type'])
  return { type: 'region', content: requireArray(region.content, [...path, 'content']).map((item, index) => parseBlock(item, [...path, 'content', index], 0)) }
}

export function parseCanonicalDocument(input: unknown): CanonicalDocument {
  const root = requireRecord(input, [])
  requireExactKeys(root, ['schema', 'kind', 'page', 'regions'], [])
  const schema = requireRecord(root.schema, ['schema'])
  requireExactKeys(schema, ['id', 'version'], ['schema'])
  if (schema.id !== DOCUMENT_SCHEMA_ID || schema.version !== DOCUMENT_SCHEMA_VERSION) throw issue('DOCUMENT_SCHEMA_VERSION_UNSUPPORTED', ['schema'])
  const kind = requireEnum(root.kind, TEMPLATE_KINDS, ['kind'])
  const page = requireRecord(root.page, ['page'])
  requireExactKeys(page, ['size', 'marginPreset', 'fontFamily'], ['page'])
  if (page.size !== 'A4' || page.fontFamily !== 'WORK_SANS') throw issue('DOCUMENT_PAGE_SETTING_UNSUPPORTED', ['page'])
  const marginPreset = requireEnum(page.marginPreset, ['NARROW', 'NORMAL', 'WIDE'] as const, ['page', 'marginPreset'])
  const regions = requireRecord(root.regions, ['regions'])
  requireExactKeys(regions, ['cover', 'header', 'body', 'appendix', 'footer'], ['regions'])
  const parseOptionalRegion = (value: unknown, path: readonly DocumentPathPart[]) => value === null ? null : parseRegion(value, path)
  const document: CanonicalDocument = {
    schema: { id: DOCUMENT_SCHEMA_ID, version: DOCUMENT_SCHEMA_VERSION },
    kind,
    page: { size: 'A4', marginPreset, fontFamily: 'WORK_SANS' },
    regions: {
      cover: parseOptionalRegion(regions.cover, ['regions', 'cover']),
      header: parseOptionalRegion(regions.header, ['regions', 'header']),
      body: parseOptionalRegion(regions.body, ['regions', 'body']),
      appendix: parseOptionalRegion(regions.appendix, ['regions', 'appendix']),
      footer: parseOptionalRegion(regions.footer, ['regions', 'footer']),
    },
  }
  const required = kind === 'DOCUMENT' ? 'body' : kind === 'COVER' ? 'cover' : 'appendix'
  if (!document.regions[required]) throw issue('DOCUMENT_REQUIRED_REGION_MISSING', ['regions', required])
  const forbidden = kind === 'DOCUMENT' ? ['cover', 'appendix'] : kind === 'COVER' ? ['header', 'body', 'appendix', 'footer'] : ['cover', 'header', 'body', 'footer']
  for (const key of forbidden) {
    if (document.regions[key as keyof CanonicalRegions] !== null) throw issue('DOCUMENT_REGION_KIND_MISMATCH', ['regions', key])
  }
  return document
}

function countDocument(value: unknown): { nodes: number; codePoints: number } {
  let nodes = 0
  let codePoints = 0
  const visit = (candidate: unknown): void => {
    if (!isRecord(candidate)) return
    if (typeof candidate.type === 'string') nodes += 1
    if (candidate.type === 'text' && typeof candidate.text === 'string') codePoints += [...candidate.text].length
    for (const child of Object.values(candidate)) {
      if (Array.isArray(child)) child.forEach(visit)
      else if (isRecord(child)) visit(child)
    }
  }
  visit(value)
  return { nodes, codePoints }
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue)
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedValue(value[key])]))
  }
  return value
}

function assetRefs(document: CanonicalDocument): readonly string[] {
  const refs = new Set<string>()
  const visit = (blocks: readonly CanonicalBlock[]): void => {
    for (const block of blocks) {
      if (block.type === 'blockImage') refs.add(block.attrs.assetRef)
      if (block.type === 'twoColumnBlock') block.content.forEach((column) => visit(column.content))
    }
  }
  const regions = document.regions
  for (const region of [regions.cover, regions.header, regions.body, regions.appendix, regions.footer]) {
    if (region) visit(region.content)
  }
  return [...refs].sort()
}

export function normalizeCanonicalDocument(input: unknown): NormalizedCanonicalDocument {
  const document = parseCanonicalDocument(input)
  const counts = countDocument(document)
  if (counts.nodes > MAX_NODES) throw issue('DOCUMENT_NODE_LIMIT', [])
  if (counts.codePoints > MAX_TEXT_CODE_POINTS) throw issue('DOCUMENT_TEXT_LIMIT', [])
  const canonicalJson = JSON.stringify(sortedValue(document))
  if (new TextEncoder().encode(canonicalJson).byteLength > MAX_JSON_BYTES) throw issue('DOCUMENT_JSON_LIMIT', [])
  return { document, canonicalJson, assetRefs: assetRefs(document) }
}

export function validateCanonicalDocument(input: unknown): { readonly valid: boolean; readonly issues: readonly DocumentValidationIssue[] } {
  try {
    normalizeCanonicalDocument(input)
    return { valid: true, issues: [] }
  } catch (error) {
    if (error instanceof CanonicalDocumentError) return { valid: false, issues: error.issues }
    throw error
  }
}

export function emptyCanonicalDocument(kind: 'DOCUMENT'): Omit<CanonicalDocument, 'kind'> & { readonly kind: 'DOCUMENT' }
export function emptyCanonicalDocument(kind: TemplateKind): CanonicalDocument
export function emptyCanonicalDocument(kind: TemplateKind): CanonicalDocument {
  const region = (): CanonicalRegion => ({ type: 'region', content: [{ type: 'paragraph', attrs: { align: 'LEFT' }, content: [] }] })
  return {
    schema: { id: DOCUMENT_SCHEMA_ID, version: DOCUMENT_SCHEMA_VERSION },
    kind,
    page: { size: 'A4', marginPreset: 'NORMAL', fontFamily: 'WORK_SANS' },
    regions: {
      cover: kind === 'COVER' ? region() : null,
      header: kind === 'DOCUMENT' ? null : null,
      body: kind === 'DOCUMENT' ? region() : null,
      appendix: kind === 'APPENDIX' ? region() : null,
      footer: kind === 'DOCUMENT' ? null : null,
    },
  }
}

export const documentStudioCategorySchema = categoryCodeSchema

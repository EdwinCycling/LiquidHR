import { createHash } from 'node:crypto'
import type { XmlParserLimits } from './contracts'
import { DEFAULT_XML_PARSER_LIMITS } from './contracts'

const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?$/
const XML_NAMESPACE_NAME = 'http://www.w3.org/2000/xmlns/'
const XML_NAMESPACE_URI = 'http://www.w3.org/XML/1998/namespace'

export type SecureXmlDiagnosticCode =
  | 'XML_MALFORMED'
  | 'XML_UNSAFE_DOCTYPE'
  | 'XML_UNSAFE_ENTITY'
  | 'XML_TOO_LARGE'
  | 'XML_TOO_DEEP'
  | 'XML_TOO_MANY_NODES'
  | 'XML_NAMESPACE_UNBOUND'

export class SecureXmlError extends Error {
  constructor(
    readonly code: SecureXmlDiagnosticCode,
    message: string,
    readonly path?: string,
  ) {
    super(message)
    this.name = 'SecureXmlError'
  }
}
export interface XmlAttribute {
  readonly qualifiedName: string
  readonly localName: string
  readonly prefix: string | null
  readonly namespaceUri: string | null
  readonly value: string
}

export interface XmlElement {
  readonly qualifiedName: string
  readonly localName: string
  readonly prefix: string | null
  readonly namespaceUri: string | null
  readonly attributes: readonly XmlAttribute[]
  readonly children: readonly XmlElement[]
  readonly text: string
  readonly sourcePath: string
}

export interface XmlDocumentEnvelope {
  readonly sourceHash: string
  readonly root: XmlElement
  readonly encoding: string | null
}

interface MutableElement {
  qualifiedName: string
  localName: string
  prefix: string | null
  namespaceUri: string | null
  attributes: XmlAttribute[]
  children: MutableElement[]
  textParts: string[]
  textLength: number
  sourcePath: string
  namespaces: Map<string, string>
}

interface ParsedName {
  qualifiedName: string
  localName: string
  prefix: string | null
}

function fail(code: SecureXmlDiagnosticCode, message: string, path?: string): never {
  throw new SecureXmlError(code, message, path)
}

function splitName(value: string, path?: string): ParsedName {
  const name = value.trim()
  if (!XML_NAME_PATTERN.test(name)) fail('XML_MALFORMED', `Ongeldige XML-naam: ${name}`, path)
  const separator = name.indexOf(':')
  if (separator === -1) return { qualifiedName: name, localName: name, prefix: null }
  return {
    qualifiedName: name,
    localName: name.slice(separator + 1),
    prefix: name.slice(0, separator),
  }
}

function decodeXmlValue(value: string, path?: string): string {
  if (!value.includes('&')) return value
  const unresolved = value.replace(/&([^;\s]{1,32});/g, '')
  if (unresolved.includes('&')) fail('XML_UNSAFE_ENTITY', `Niet-ondersteunde XML-entiteit op ${path ?? 'document'}`, path)
  const isXml10Character = (codePoint: number): boolean => codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd
    || (codePoint >= 0x20 && codePoint <= 0xd7ff)
    || (codePoint >= 0xe000 && codePoint <= 0xfffd)
    || (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  return value.replace(/&([^;\s]{1,32});/g, (whole, entity: string) => {
    if (entity === 'amp') return '&'
    if (entity === 'lt') return '<'
    if (entity === 'gt') return '>'
    if (entity === 'quot') return '"'
    if (entity === 'apos') return "'"
    if (entity.startsWith('#x')) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      if (Number.isInteger(codePoint) && isXml10Character(codePoint)) {
        return String.fromCodePoint(codePoint)
      }
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      if (Number.isInteger(codePoint) && isXml10Character(codePoint)) {
        return String.fromCodePoint(codePoint)
      }
    }
    fail('XML_UNSAFE_ENTITY', `Niet-ondersteunde XML-entiteit op ${path ?? 'document'}`, path)
  })
}

function findTagEnd(xml: string, start: number, path?: string): number {
  let quote: '"' | "'" | null = null
  for (let index = start; index < xml.length; index += 1) {
    const character = xml[index]
    if (quote) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
    } else if (character === '>') {
      return index
    }
  }
  fail('XML_MALFORMED', 'XML-tag heeft geen sluitende >', path)
}

function readAttributes(body: string, path?: string): { name: ParsedName; attributes: Array<{ name: ParsedName; value: string }> } {
  let cursor = 0
  while (/\s/u.test(body[cursor] ?? '')) cursor += 1
  const nameEnd = body.search(/\s/u)
  const rawName = (nameEnd === -1 ? body : body.slice(0, nameEnd)).trim()
  if (!rawName) fail('XML_MALFORMED', 'Ontbrekende XML-elementnaam', path)
  const name = splitName(rawName, path)
  cursor = nameEnd === -1 ? body.length : nameEnd
  const attributes: Array<{ name: ParsedName; value: string }> = []
  const seen = new Set<string>()
  while (cursor < body.length) {
    while (/\s/u.test(body[cursor] ?? '')) cursor += 1
    if (cursor >= body.length) break
    const attributeStart = cursor
    while (cursor < body.length && !/\s|=/u.test(body[cursor] ?? '')) cursor += 1
    const rawAttributeName = body.slice(attributeStart, cursor)
    const attributeName = splitName(rawAttributeName, path)
    if (seen.has(attributeName.qualifiedName)) fail('XML_MALFORMED', `Dubbel XML-attribuut: ${rawAttributeName}`, path)
    seen.add(attributeName.qualifiedName)
    while (/\s/u.test(body[cursor] ?? '')) cursor += 1
    if (body[cursor] !== '=') fail('XML_MALFORMED', `XML-attribuut zonder =: ${rawAttributeName}`, path)
    cursor += 1
    while (/\s/u.test(body[cursor] ?? '')) cursor += 1
    const quote = body[cursor]
    if (quote !== '"' && quote !== "'") fail('XML_MALFORMED', `XML-attribuut zonder aanhalingstekens: ${rawAttributeName}`, path)
    cursor += 1
    const valueStart = cursor
    while (cursor < body.length && body[cursor] !== quote) cursor += 1
    if (cursor >= body.length) fail('XML_MALFORMED', `XML-attribuut zonder afsluitende quote: ${rawAttributeName}`, path)
    const value = decodeXmlValue(body.slice(valueStart, cursor), path)
    cursor += 1
    attributes.push({ name: attributeName, value })
  }
  return { name, attributes }
}

function namespaceUriFor(name: ParsedName, namespaces: ReadonlyMap<string, string>, path?: string): string | null {
  if (!name.prefix) return namespaces.get('') ?? null
  const uri = namespaces.get(name.prefix)
  if (!uri) fail('XML_NAMESPACE_UNBOUND', `Ongebonden XML-prefix: ${name.prefix}`, path)
  return uri
}

function asReadOnlyElement(node: MutableElement): XmlElement {
  return {
    qualifiedName: node.qualifiedName,
    localName: node.localName,
    prefix: node.prefix,
    namespaceUri: node.namespaceUri,
    attributes: node.attributes,
    children: node.children.map(asReadOnlyElement),
    text: node.textParts.join(''),
    sourcePath: node.sourcePath,
  }
}

function parseXmlDeclaration(value: string): string | null {
  if (!value.startsWith('<?xml')) return null
  const match = /^<\?xml\s+version\s*=\s*(['"])1\.0\1(?:\s+encoding\s*=\s*(['"])([A-Za-z][A-Za-z0-9._-]*)\2)?(?:\s+standalone\s*=\s*(['"])(?:yes|no)\4)?\s*\?>$/u.exec(value)
  if (!match) fail('XML_MALFORMED', 'Ongeldige XML-declaratie')
  return match[3]?.toUpperCase() ?? null
}

export function parseSecureXml(input: Uint8Array, limits: XmlParserLimits = DEFAULT_XML_PARSER_LIMITS): XmlDocumentEnvelope {
  if (input.byteLength > limits.maxBytes) fail('XML_TOO_LARGE', `XML is groter dan ${limits.maxBytes} bytes`)
  let xml: string
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(input)
  } catch {
    fail('XML_MALFORMED', 'XML is geen geldige UTF-8')
  }
  if (xml.startsWith('\uFEFF')) xml = xml.slice(1)
  if (xml.includes('\u0000')) fail('XML_MALFORMED', 'XML bevat een nulbyte')

  const sourceHash = createHash('sha256').update(input).digest('hex')
  const stack: MutableElement[] = []
  let root: MutableElement | null = null
  let cursor = 0
  let nodes = 0
  let encoding: string | null = null
  let declarationSeen = false
  let documentTokenSeen = false

  const appendText = (value: string, path?: string) => {
    if (!value) return
    if (!stack.length) {
      if (value.trim()) fail('XML_MALFORMED', 'Tekst buiten het documentelement', path)
      return
    }
    const parent = stack[stack.length - 1]
    const decoded = decodeXmlValue(value, path)
    if (parent.textLength + decoded.length > limits.maxTextLength) fail('XML_TOO_LARGE', `Elementtekst is groter dan ${limits.maxTextLength} tekens`, path)
    parent.textParts.push(decoded)
    parent.textLength += decoded.length
  }

  while (cursor < xml.length) {
    const tagStart = xml.indexOf('<', cursor)
    if (tagStart === -1) {
      appendText(xml.slice(cursor), stack[stack.length - 1]?.sourcePath)
      cursor = xml.length
      break
    }
    appendText(xml.slice(cursor, tagStart), stack[stack.length - 1]?.sourcePath)
    if (xml.startsWith('<!--', tagStart)) {
      const commentEnd = xml.indexOf('-->', tagStart + 4)
      if (commentEnd === -1) fail('XML_MALFORMED', 'XML-comment heeft geen einde')
      cursor = commentEnd + 3
      continue
    }
    const tagEnd = findTagEnd(xml, tagStart, stack[stack.length - 1]?.sourcePath)
    const rawTag = xml.slice(tagStart, tagEnd + 1)
    if (rawTag.startsWith('<?')) {
      if (tagStart !== 0 || declarationSeen || documentTokenSeen) fail('XML_MALFORMED', 'XML-declaratie staat niet aan het begin')
      encoding = parseXmlDeclaration(rawTag)
      if (encoding && encoding !== 'UTF-8' && encoding !== 'US-ASCII') fail('XML_MALFORMED', 'Alleen UTF-8 XML is toegestaan')
      declarationSeen = true
      documentTokenSeen = true
      cursor = tagEnd + 1
      continue
    }
    if (/^<!DOCTYPE\b/iu.test(rawTag) || /^<!ENTITY\b/iu.test(rawTag) || /\[\s*(?:DOCTYPE|ENTITY)\b/iu.test(rawTag)) {
      fail('XML_UNSAFE_DOCTYPE', 'DTD en externe entiteiten zijn niet toegestaan')
    }
    if (rawTag.startsWith('<!')) fail('XML_UNSAFE_DOCTYPE', 'XML-declaraties buiten de veilige subset zijn niet toegestaan')
    if (rawTag.startsWith('</')) {
      if (!stack.length) fail('XML_MALFORMED', 'Onverwacht sluitend XML-element')
      const closeName = rawTag.slice(2, -1).trim()
      const parsedClose = splitName(closeName, stack[stack.length - 1]?.sourcePath)
      const current = stack[stack.length - 1]
      if (!current || parsedClose.qualifiedName !== current.qualifiedName) fail('XML_MALFORMED', `XML-element sluit niet correct: ${closeName}`, current?.sourcePath)
      stack.pop()
      cursor = tagEnd + 1
      continue
    }

    let body = rawTag.slice(1, -1)
    const selfClosing = /\/\s*$/u.test(body)
    if (selfClosing) body = body.replace(/\/\s*$/u, '')
    const parent = stack[stack.length - 1]
    const parentNamespaces = parent?.namespaces ?? new Map<string, string>([['xml', XML_NAMESPACE_URI]])
    const namespaces = new Map(parentNamespaces)
    const path = `${parent?.sourcePath ?? ''}/${body.trim().split(/\s/u, 1)[0] ?? 'root'}` || '/root'
    const parsed = readAttributes(body, path)
    for (const attribute of parsed.attributes) {
      if (attribute.name.qualifiedName === 'xmlns') {
        namespaces.set('', attribute.value)
      } else if (attribute.name.prefix === 'xmlns') {
        if (!attribute.value) fail('XML_MALFORMED', `Lege XML-namespace voor ${attribute.name.localName}`, path)
        namespaces.set(attribute.name.localName, attribute.value)
      }
    }
    const namespaceUri = namespaceUriFor(parsed.name, namespaces, path)
    const attributes: XmlAttribute[] = parsed.attributes.map((attribute) => {
      const isDefaultNamespace = attribute.name.qualifiedName === 'xmlns'
      const attributeNamespace = isDefaultNamespace
        ? XML_NAMESPACE_NAME
        : attribute.name.prefix === 'xmlns'
          ? XML_NAMESPACE_NAME
          : attribute.name.prefix ? namespaceUriFor(attribute.name, namespaces, path) : null
      return {
        qualifiedName: attribute.name.qualifiedName,
        localName: attribute.name.localName,
        prefix: attribute.name.prefix,
        namespaceUri: attributeNamespace,
        value: attribute.value,
      }
    })
    nodes += 1
    if (nodes > limits.maxNodes) fail('XML_TOO_MANY_NODES', `XML bevat meer dan ${limits.maxNodes} elementen`)
    if (stack.length + 1 > limits.maxDepth) fail('XML_TOO_DEEP', `XML-nesting is dieper dan ${limits.maxDepth}`, path)
    const node: MutableElement = {
      qualifiedName: parsed.name.qualifiedName,
      localName: parsed.name.localName,
      prefix: parsed.name.prefix,
      namespaceUri,
      attributes,
      children: [],
      textParts: [],
      textLength: 0,
      sourcePath: path,
      namespaces,
    }
    if (parent) parent.children.push(node)
    else if (root) fail('XML_MALFORMED', 'Meerdere XML-documentelementen')
    else root = node
    documentTokenSeen = true
    if (!selfClosing) stack.push(node)
    cursor = tagEnd + 1
  }

  if (stack.length) fail('XML_MALFORMED', `Niet-afgesloten XML-element: ${stack[stack.length - 1]?.qualifiedName}`)
  if (!root) fail('XML_MALFORMED', 'XML bevat geen documentelement')
  return { sourceHash, root: asReadOnlyElement(root), encoding }
}

export function getXmlAttribute(element: XmlElement, localName: string, namespaceUri?: string | null): string | undefined {
  return element.attributes.find((attribute) => attribute.localName === localName && (namespaceUri === undefined || attribute.namespaceUri === namespaceUri))?.value
}

export function getChild(element: XmlElement, localName: string): XmlElement | undefined {
  return element.children.find((child) => child.localName === localName)
}

export function getChildren(element: XmlElement, localName: string): readonly XmlElement[] {
  return element.children.filter((child) => child.localName === localName)
}

export function getDescendants(element: XmlElement, localName: string): readonly XmlElement[] {
  const matches: XmlElement[] = []
  const visit = (node: XmlElement) => {
    for (const child of node.children) {
      if (child.localName === localName) matches.push(child)
      visit(child)
    }
  }
  visit(element)
  return matches
}

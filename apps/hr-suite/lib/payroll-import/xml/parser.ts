import type {
  XmlDiagnostic,
  XmlParseContext,
  XmlParseResult,
  XmlParseSourceMetadata,
  XmlSourceProfile,
  XmlParserLimits,
} from './contracts'
import { DEFAULT_XML_PARSER_LIMITS } from './contracts'
import { findLoonaangifteProfile, LOONAANGIFTE_SOURCE_REGISTRY, yearFromLoonaangifteNamespace } from './registry'
import { parseSecureXml, SecureXmlError, getXmlAttribute } from './secure-xml'
import { XmlProfileError } from './values'
import { validateOfficialLoonaangifte2026 } from './xsd-validator'

function diagnostic(code: XmlDiagnostic['code'], message: string, path?: string): XmlDiagnostic {
  return { code, severity: 'BLOCKING', message, ...(path ? { path } : {}) }
}
function secureErrorCode(error: SecureXmlError): XmlDiagnostic['code'] {
  switch (error.code) {
    case 'XML_UNSAFE_DOCTYPE': return 'XML_UNSAFE_DOCTYPE'
    case 'XML_UNSAFE_ENTITY': return 'XML_UNSAFE_ENTITY'
    case 'XML_TOO_LARGE': return 'XML_TOO_LARGE'
    case 'XML_TOO_DEEP': return 'XML_TOO_DEEP'
    case 'XML_TOO_MANY_NODES': return 'XML_TOO_MANY_NODES'
    case 'XML_NAMESPACE_UNBOUND': return 'XML_NAMESPACE_UNBOUND'
    case 'XML_MALFORMED': return 'XML_MALFORMED'
  }
}

function unsupportedProfileDiagnostic(input: {
  year: number | null
  namespaceUri: string | null
  rootLocalName: string
  schemaVersion: string | undefined
  registry: readonly XmlSourceProfile[]
}): XmlDiagnostic {
  if (!input.namespaceUri) return diagnostic('UNSUPPORTED_NAMESPACE', 'XML-documentelement heeft geen namespace')
  if (input.year === null) return diagnostic('UNSUPPORTED_YEAR', 'XML-namespace bevat geen aantoonbaar aangiftejaar')
  const sameYear = input.registry.some((profile) => profile.taxYear === input.year)
  if (!sameYear) return diagnostic('UNSUPPORTED_YEAR', `Aangiftejaar ${input.year} staat niet in de actieve bronregistry`)
  const sameNamespace = input.registry.some((profile) => profile.taxYear === input.year && profile.namespaceUri === input.namespaceUri)
  if (!sameNamespace) return diagnostic('UNSUPPORTED_NAMESPACE', 'XML-namespace is niet geregistreerd voor dit aangiftejaar')
  const sameVersion = input.registry.some((profile) => profile.taxYear === input.year && profile.namespaceUri === input.namespaceUri && profile.schemaVersion === input.schemaVersion)
  if (!sameVersion) return diagnostic('UNSUPPORTED_SCHEMA_VERSION', 'XML-schema-versie is niet geregistreerd')
  return diagnostic('SOURCE_CONTRACT_UNSUPPORTED', 'XML-broncontract is niet geregistreerd')
}

function safeSourceMetadata(input: {
  namespaceUri: string | null
  schemaVersion: string | undefined
}): XmlParseSourceMetadata {
  const taxYear = yearFromLoonaangifteNamespace(input.namespaceUri)
  return {
    ...(taxYear === null ? {} : { taxYear }),
    ...(input.schemaVersion && input.schemaVersion.length <= 32 ? { schemaVersion: input.schemaVersion } : {}),
    ...(input.namespaceUri && input.namespaceUri.length <= 256 ? { namespaceUri: input.namespaceUri } : {}),
  }
}

export function parseLoonaangifteXml(input: {
  bytes: Uint8Array
  context: XmlParseContext
  limits?: XmlParserLimits
  registry?: readonly XmlSourceProfile[]
}): XmlParseResult {
  const registry = input.registry ?? LOONAANGIFTE_SOURCE_REGISTRY
  let envelope
  try {
    envelope = parseSecureXml(input.bytes, input.limits ?? DEFAULT_XML_PARSER_LIMITS)
  } catch (error) {
    if (error instanceof SecureXmlError) {
      return {
        status: 'REJECTED',
        diagnostics: [diagnostic(secureErrorCode(error), error.message, error.path)],
      }
    }
    return { status: 'REJECTED', diagnostics: [diagnostic('XML_MALFORMED', 'XML kon niet veilig worden gelezen')] }
  }

  const root = envelope.root
  const namespaceUri = root.namespaceUri
  const schemaVersion = getXmlAttribute(root, 'version')
  const sourceMetadata = safeSourceMetadata({ namespaceUri, schemaVersion })
  if (root.localName !== 'Loonaangifte') {
    return { status: 'SOURCE_GAP', sourceMetadata, diagnostics: [diagnostic('UNSUPPORTED_ROOT', 'XML-documentelement is geen Loonaangifte')] }
  }
  const year = yearFromLoonaangifteNamespace(namespaceUri)
  const profile = findLoonaangifteProfile({
    taxYear: year,
    namespaceUri: namespaceUri ?? '',
    rootLocalName: root.localName,
    schemaVersion,
    registry,
  })
  if (!profile) {
    return {
      status: 'SOURCE_GAP',
      sourceMetadata,
      diagnostics: [unsupportedProfileDiagnostic({ year, namespaceUri, rootLocalName: root.localName, schemaVersion, registry })],
    }
  }

  try {
    const document = profile.parse({ root, envelope, context: input.context })
    const xsdValidation = validateOfficialLoonaangifte2026(input.bytes)
    if (xsdValidation === 'INVALID') {
      return { status: 'REJECTED', sourceMetadata, diagnostics: [diagnostic('XML_XSD_INVALID', 'XML voldoet niet aan het officiële Loonaangifte 2026 v2.0-schema')] }
    }
    if (xsdValidation === 'UNAVAILABLE') {
      return { status: 'REJECTED', sourceMetadata, diagnostics: [diagnostic('XSD_UNAVAILABLE', 'De officiële Loonaangifte 2026 v2.0-schema-validatie is niet beschikbaar')] }
    }
    return {
      status: 'SUPPORTED_READ_ONLY',
      profile: profile.evidence,
      document,
      xsdValidation,
      diagnostics: [],
    }
  } catch (error) {
    if (error instanceof XmlProfileError) {
      return { status: 'REJECTED', sourceMetadata, diagnostics: [diagnostic(error.code, error.message, error.path)] }
    }
    return { status: 'REJECTED', sourceMetadata, diagnostics: [diagnostic('SOURCE_CONTRACT_UNSUPPORTED', 'XML-broncontract kon niet veilig worden genormaliseerd')] }
  }
}

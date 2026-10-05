import type { XmlElement, XmlDocumentEnvelope } from './secure-xml'

export const LOONAANGIFTE_XML_SOURCE_TYPE = 'LOONAANGIFTE_XML' as const

export type XmlParseStatus = 'SUPPORTED_READ_ONLY' | 'SOURCE_GAP' | 'REJECTED'

export type XmlDiagnosticCode =
  | 'XML_MALFORMED'
  | 'XML_UNSAFE_DOCTYPE'
  | 'XML_UNSAFE_ENTITY'
  | 'XML_TOO_LARGE'
  | 'XML_TOO_DEEP'
  | 'XML_TOO_MANY_NODES'
  | 'XML_NAMESPACE_UNBOUND'
  | 'UNSUPPORTED_YEAR'
  | 'UNSUPPORTED_NAMESPACE'
  | 'UNSUPPORTED_ROOT'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'XSD_UNAVAILABLE'
  | 'XML_XSD_INVALID'
  | 'SOURCE_CONTRACT_UNSUPPORTED'
  | 'MALFORMED_VALUE'
  | 'IDENTIFIER_PROTECTION_REQUIRED'

export interface XmlDiagnostic {
  code: XmlDiagnosticCode
  severity: 'BLOCKING' | 'WARNING'
  message: string
  path?: string
}

export interface XmlSourceEvidence {
  taxYear: number
  schemaVersion: string
  namespaceUri: string
  releasePageUrl: string
  sourceArchiveUrl: string
  sourceArchiveSha256: string
  xsdFileName: string
  xsdSha256: string
  evidenceStatus: 'VERIFIED'
}

export interface XmlParserLimits {
  maxBytes: number
  maxDepth: number
  maxNodes: number
  maxTextLength: number
}

export const DEFAULT_XML_PARSER_LIMITS: Readonly<XmlParserLimits> = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  maxDepth: 64,
  maxNodes: 100_000,
  maxTextLength: 1 * 1024 * 1024,
})

export interface XmlIdentityProtection {
  /**
   * Converts a source BSN into the server-owned protected identifier. The raw
   * source value must not cross the parser result boundary.
   */
  protectBsn: (bsn: string) => string
}

export interface XmlParseContext {
  identity: XmlIdentityProtection
}

export interface XmlFieldProvenance {
  sourcePath: string
  field: string
  taxYear: number
  namespaceUri: string
}

export interface XmlCanonicalIncomePeriod {
  startsOn: string
  incomeCode: string
  employmentRelationCode?: number
  caoCode?: number
  sourcePath: string
}

export interface XmlCanonicalIncomeRelationship {
  payrollTaxNumber: string
  ikvNumber: number
  startsOn: string
  endsOn?: string
  personnelNumber?: string
  periods: readonly XmlCanonicalIncomePeriod[]
  provenance: readonly XmlFieldProvenance[]
}

export interface XmlCanonicalPerson {
  sourceRowNumber: number
  externalEmployeeNumber?: string
  bsnFingerprint?: string
  initials?: string
  significantSurnamePart?: string
  birthDate?: string
  nationalityCode?: number
  genderCode?: number
  incomeRelationships: readonly XmlCanonicalIncomeRelationship[]
  provenance: readonly XmlFieldProvenance[]
  conflicts: readonly {
    field: string
    values: readonly string[]
    sourcePaths: readonly string[]
  }[]
}

export interface XmlCanonicalDocument {
  taxYear: number
  schemaVersion: string
  namespaceUri: string
  sourceHash: string
  payrollTaxNumber: string
  reportingPeriods: readonly { startsOn: string; endsOn: string; sourcePath: string }[]
  persons: readonly XmlCanonicalPerson[]
}

export interface XmlSourceProfile {
  readonly taxYear: number
  readonly schemaVersion: string
  readonly namespaceUri: string
  readonly rootLocalName: string
  readonly evidence: XmlSourceEvidence
  readonly parse: (input: {
    root: XmlElement
    envelope: XmlDocumentEnvelope
    context: XmlParseContext
  }) => XmlCanonicalDocument
}

export interface XmlParseSuccess {
  status: 'SUPPORTED_READ_ONLY'
  profile: XmlSourceEvidence
  document: XmlCanonicalDocument
  /** The source was validated against the exact, hash-pinned official XSD. */
  xsdValidation: 'VALIDATED'
  diagnostics: readonly XmlDiagnostic[]
}

export interface XmlParseSourceMetadata {
  taxYear?: number
  schemaVersion?: string
  namespaceUri?: string
}

export interface XmlParseFailure {
  status: 'SOURCE_GAP' | 'REJECTED'
  sourceMetadata?: XmlParseSourceMetadata
  diagnostics: readonly XmlDiagnostic[]
}

export type XmlParseResult = XmlParseSuccess | XmlParseFailure

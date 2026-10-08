import type { XmlSourceProfile } from './contracts'
import { LOONAANGIFTE_2026_NAMESPACE, LOONAANGIFTE_2026_SCHEMA_VERSION, parseLoonaangifte2026 } from './loonaangifte-2026'
import { LOONAANGIFTE_2026_XSD_SHA256 } from './xsd-constants'

const LH2026V09_ARCHIVE_URL = 'https://odb.belastingdienst.nl/wp-content/uploads/2026/01/LH2026v09.zip'
const LH2026V09_ARCHIVE_SHA256 = '134cf1464ccce87acff81c8c624c0ad31878a43e541babb46514926912b1836e'

export const LOONAANGIFTE_2026_PROFILE: XmlSourceProfile = Object.freeze({
  taxYear: 2026,
  schemaVersion: LOONAANGIFTE_2026_SCHEMA_VERSION,
  namespaceUri: LOONAANGIFTE_2026_NAMESPACE,
  rootLocalName: 'Loonaangifte',
  evidence: Object.freeze({
    taxYear: 2026,
    schemaVersion: LOONAANGIFTE_2026_SCHEMA_VERSION,
    namespaceUri: LOONAANGIFTE_2026_NAMESPACE,
    releasePageUrl: 'https://odb.belastingdienst.nl/documentatie/loonheffingen-aangifte-2026v09/',
    sourceArchiveUrl: LH2026V09_ARCHIVE_URL,
    sourceArchiveSha256: LH2026V09_ARCHIVE_SHA256,
    xsdFileName: 'Loonaangifte2026v2.0.xsd',
    xsdSha256: LOONAANGIFTE_2026_XSD_SHA256,
    evidenceStatus: 'VERIFIED',
  }),
  parse: parseLoonaangifte2026,
})

/**
 * Only profiles with an inspected official release artifact belong here.
 * 2027 is deliberately absent: a 2027 artifact must not validate 2026 input.
 */
export const LOONAANGIFTE_SOURCE_REGISTRY: readonly XmlSourceProfile[] = Object.freeze([
  LOONAANGIFTE_2026_PROFILE,
])

export function findLoonaangifteProfile(input: {
  taxYear: number | null
  namespaceUri: string
  rootLocalName: string
  schemaVersion: string | undefined
  registry?: readonly XmlSourceProfile[]
}): XmlSourceProfile | undefined {
  const registry = input.registry ?? LOONAANGIFTE_SOURCE_REGISTRY
  return registry.find((profile) => profile.taxYear === input.taxYear
    && profile.namespaceUri === input.namespaceUri
    && profile.rootLocalName === input.rootLocalName
    && profile.schemaVersion === input.schemaVersion)
}
export function yearFromLoonaangifteNamespace(namespaceUri: string | null): number | null {
  if (!namespaceUri) return null
  const match = /\/Loonaangifte\/(20\d{2})\/\d+$/u.exec(namespaceUri)
  return match?.[1] ? Number(match[1]) : null
}

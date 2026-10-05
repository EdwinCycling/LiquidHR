import type {
  XmlCanonicalDocument,
  XmlCanonicalIncomePeriod,
  XmlCanonicalIncomeRelationship,
  XmlCanonicalPerson,
  XmlFieldProvenance,
  XmlParseContext,
} from './contracts'
import { getChildren, getDescendants, getXmlAttribute, type XmlDocumentEnvelope, type XmlElement } from './secure-xml'
import {
  dateValue,
  integerValue,
  optionalChild,
  optionalDate,
  optionalInteger,
  optionalText,
  protectedBsnValue,
  requireChild,
  requiredLoonaangifteTaxNumber,
  textValue,
  XmlProfileError,
} from './values'

export const LOONAANGIFTE_2026_NAMESPACE = 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01'
export const LOONAANGIFTE_2026_SCHEMA_VERSION = '2.0'

interface ParsedIncomeRelationship extends XmlCanonicalIncomeRelationship {
  readonly personKey: string
  readonly sourceRowNumber: number
  readonly initials?: string
  readonly significantSurnamePart?: string
  readonly birthDate?: string
  readonly nationalityCode?: number
  readonly genderCode?: number
  readonly bsnFingerprint?: string
}
interface PersonAccumulator {
  personKey: string
  sourceRowNumber: number
  externalEmployeeNumber?: string
  bsnFingerprint?: string
  initials?: string
  significantSurnamePart?: string
  birthDate?: string
  nationalityCode?: number
  genderCode?: number
  incomeRelationships: ParsedIncomeRelationship[]
  provenance: XmlFieldProvenance[]
  conflicts: Map<string, { values: Set<string>; sourcePaths: Set<string> }>
}

function provenance(field: string, element: XmlElement): XmlFieldProvenance {
  return {
    sourcePath: element.sourcePath,
    field,
    taxYear: 2026,
    namespaceUri: LOONAANGIFTE_2026_NAMESPACE,
  }
}

function assertNamespace(element: XmlElement): void {
  if (element.namespaceUri !== LOONAANGIFTE_2026_NAMESPACE) {
    throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', 'Element valt buiten de geregistreerde 2026-namespace', element.sourcePath)
  }
}

function requiredChild(element: XmlElement, localName: string): XmlElement {
  const child = requireChild(element, localName, LOONAANGIFTE_2026_NAMESPACE)
  assertNamespace(child)
  return child
}

function optionalNamespaceChild(element: XmlElement, localName: string): XmlElement | undefined {
  const child = optionalChild(element, localName, LOONAANGIFTE_2026_NAMESPACE)
  if (child) assertNamespace(child)
  return child
}

function requiredPeriodContainer(element: XmlElement): { startsOn: string; endsOn: string; sourcePath: string } {
  return {
    startsOn: dateValue(requiredChild(element, 'DatAanvTv'), 'DatAanvTv'),
    endsOn: dateValue(requiredChild(element, 'DatEindTv'), 'DatEindTv'),
    sourcePath: element.sourcePath,
  }
}

function parseIncomePeriod(element: XmlElement): XmlCanonicalIncomePeriod {
  const startsOn = dateValue(requiredChild(element, 'DatAanv'), 'Inkomstenperiode.DatAanv')
  const incomeCode = textValue(requiredChild(element, 'SrtIV'), 'Inkomstenperiode.SrtIV', { maxLength: 2 })
  if (!/^\d{1,2}$/u.test(incomeCode)) throw new XmlProfileError('MALFORMED_VALUE', 'Ongeldige SrtIV-code', element.sourcePath)
  return {
    startsOn,
    incomeCode,
    employmentRelationCode: optionalInteger(optionalNamespaceChild(element, 'CdAard'), 'CdAard', 0, 99),
    caoCode: optionalInteger(optionalNamespaceChild(element, 'CAO'), 'CAO', 0, 9999),
    sourcePath: element.sourcePath,
  }
}

function mergeField(accumulator: PersonAccumulator, field: string, value: string | undefined, sourcePath: string): void {
  if (value === undefined) return
  const current = accumulator[field as keyof Pick<PersonAccumulator, 'externalEmployeeNumber' | 'initials' | 'significantSurnamePart' | 'birthDate'>]
  if (typeof current === 'string' && current !== value) {
    const conflict = accumulator.conflicts.get(field) ?? { values: new Set<string>(), sourcePaths: new Set<string>() }
    conflict.values.add(current)
    conflict.values.add(value)
    conflict.sourcePaths.add(sourcePath)
    accumulator.conflicts.set(field, conflict)
    return
  }
  if (current === undefined) {
    ;(accumulator as unknown as Record<string, unknown>)[field] = value
  }
}

function mergeNumberField(accumulator: PersonAccumulator, field: 'nationalityCode' | 'genderCode', value: number | undefined, sourcePath: string): void {
  if (value === undefined) return
  const current = accumulator[field]
  if (typeof current === 'number' && current !== value) {
    const conflict = accumulator.conflicts.get(field) ?? { values: new Set<string>(), sourcePaths: new Set<string>() }
    conflict.values.add(String(current))
    conflict.values.add(String(value))
    conflict.sourcePaths.add(sourcePath)
    accumulator.conflicts.set(field, conflict)
    return
  }
  if (current === undefined) accumulator[field] = value
}

function parseIncomeRelationship(
  element: XmlElement,
  payrollTaxNumber: string,
  sourceRowNumber: number,
  context: XmlParseContext,
): ParsedIncomeRelationship {
  const ikvNumber = integerValue(requiredChild(element, 'NumIV'), 'NumIV', 0, 9999)
  const startsOn = dateValue(requiredChild(element, 'DatAanv'), 'Inkomstenverhouding.DatAanv')
  const endsOn = optionalDate(optionalNamespaceChild(element, 'DatEind'), 'Inkomstenverhouding.DatEind')
  const personnelNumber = optionalText(optionalNamespaceChild(element, 'PersNr'), 'PersNr', 35)
  const person = requiredChild(element, 'NatuurlijkPersoon')
  const bsnFingerprint = protectedBsnValue(optionalNamespaceChild(person, 'SofiNr'), context.identity.protectBsn)
  const initials = optionalText(optionalNamespaceChild(person, 'Voorl'), 'Voorl', 6)
  const significantSurnamePart = optionalText(optionalNamespaceChild(person, 'SignNm'), 'SignNm', 200)
  const birthDate = optionalDate(optionalNamespaceChild(person, 'Gebdat'), 'Gebdat')
  const nationalityCode = optionalInteger(optionalNamespaceChild(person, 'Nat'), 'Nat', 0, 9999)
  const genderCode = optionalInteger(optionalNamespaceChild(person, 'Gesl'), 'Gesl', 0, 9)
  const periods = getChildren(element, 'Inkomstenperiode').map((period) => {
    assertNamespace(period)
    return parseIncomePeriod(period)
  })
  if (periods.length === 0) throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', 'Inkomstenverhouding bevat geen Inkomstenperiode', element.sourcePath)
  const personKey = bsnFingerprint ? `bsn:${bsnFingerprint}` : personnelNumber ? `pers:${personnelNumber}` : `row:${sourceRowNumber}`
  const relationshipProvenance = [
    provenance('NumIV', requiredChild(element, 'NumIV')),
    provenance('DatAanv', requiredChild(element, 'DatAanv')),
    ...periods.map((period) => ({
      sourcePath: period.sourcePath,
      field: 'Inkomstenperiode',
      taxYear: 2026,
      namespaceUri: LOONAANGIFTE_2026_NAMESPACE,
    })),
  ]
  return {
    personKey,
    sourceRowNumber,
    payrollTaxNumber,
    ikvNumber,
    startsOn,
    endsOn,
    personnelNumber,
    periods,
    bsnFingerprint,
    initials,
    significantSurnamePart,
    birthDate,
    nationalityCode,
    genderCode,
    provenance: relationshipProvenance,
  }
}

function toPerson(accumulator: PersonAccumulator): XmlCanonicalPerson {
  const conflicts = [...accumulator.conflicts.entries()].map(([field, conflict]) => ({
    field,
    values: [...conflict.values],
    sourcePaths: [...conflict.sourcePaths],
  }))
  return {
    sourceRowNumber: accumulator.sourceRowNumber,
    externalEmployeeNumber: accumulator.externalEmployeeNumber,
    bsnFingerprint: accumulator.bsnFingerprint,
    initials: accumulator.initials,
    significantSurnamePart: accumulator.significantSurnamePart,
    birthDate: accumulator.birthDate,
    nationalityCode: accumulator.nationalityCode,
    genderCode: accumulator.genderCode,
    incomeRelationships: accumulator.incomeRelationships.map((relationship) => ({
      payrollTaxNumber: relationship.payrollTaxNumber,
      ikvNumber: relationship.ikvNumber,
      startsOn: relationship.startsOn,
      endsOn: relationship.endsOn,
      personnelNumber: relationship.personnelNumber,
      periods: relationship.periods,
      provenance: relationship.provenance,
    })),
    provenance: accumulator.provenance,
    conflicts,
  }
}

export function parseLoonaangifte2026(input: {
  root: XmlElement
  envelope: XmlDocumentEnvelope
  context: XmlParseContext
}): XmlCanonicalDocument {
  const { root, envelope, context } = input
  if (root.localName !== 'Loonaangifte' || root.namespaceUri !== LOONAANGIFTE_2026_NAMESPACE) {
    throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', 'Onverwacht 2026-documentelement', root.sourcePath)
  }
  const version = getXmlAttribute(root, 'version')
  if (version !== LOONAANGIFTE_2026_SCHEMA_VERSION) throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', 'Onverwachte 2026-schema-versie', root.sourcePath)
  const administration = requiredChild(root, 'AdministratieveEenheid')
  const taxNumberElement = requiredChild(administration, 'LhNr')
  const payrollTaxNumber = requiredLoonaangifteTaxNumber(taxNumberElement)
  const periodContainers = [
    ...getChildren(administration, 'TijdvakAangifte'),
    ...getChildren(administration, 'TijdvakCorrectie'),
  ]
  if (periodContainers.length === 0) throw new XmlProfileError('SOURCE_CONTRACT_UNSUPPORTED', 'Geen aangiftetijdvak gevonden', administration.sourcePath)
  for (const period of periodContainers) assertNamespace(period)
  const reportingPeriods = periodContainers.map(requiredPeriodContainer)
  const incomeNodes = getDescendants(administration, 'InkomstenverhoudingInitieel')
  const accumulators = new Map<string, PersonAccumulator>()
  for (const [index, incomeNode] of incomeNodes.entries()) {
    assertNamespace(incomeNode)
    const relationship = parseIncomeRelationship(incomeNode, payrollTaxNumber, index + 1, context)
    const existing = accumulators.get(relationship.personKey)
    if (!existing) {
      accumulators.set(relationship.personKey, {
        personKey: relationship.personKey,
        sourceRowNumber: relationship.sourceRowNumber,
        externalEmployeeNumber: relationship.personnelNumber,
        bsnFingerprint: relationship.bsnFingerprint,
        initials: relationship.initials,
        significantSurnamePart: relationship.significantSurnamePart,
        birthDate: relationship.birthDate,
        nationalityCode: relationship.nationalityCode,
        genderCode: relationship.genderCode,
        incomeRelationships: [relationship],
        provenance: [...relationship.provenance],
        conflicts: new Map(),
      })
      continue
    }
    mergeField(existing, 'externalEmployeeNumber', relationship.personnelNumber, incomeNode.sourcePath)
    mergeField(existing, 'initials', relationship.initials, incomeNode.sourcePath)
    mergeField(existing, 'significantSurnamePart', relationship.significantSurnamePart, incomeNode.sourcePath)
    mergeField(existing, 'birthDate', relationship.birthDate, incomeNode.sourcePath)
    mergeNumberField(existing, 'nationalityCode', relationship.nationalityCode, incomeNode.sourcePath)
    mergeNumberField(existing, 'genderCode', relationship.genderCode, incomeNode.sourcePath)
    existing.incomeRelationships.push(relationship)
    existing.provenance.push(...relationship.provenance)
  }
  return {
    taxYear: 2026,
    schemaVersion: LOONAANGIFTE_2026_SCHEMA_VERSION,
    namespaceUri: LOONAANGIFTE_2026_NAMESPACE,
    sourceHash: envelope.sourceHash,
    payrollTaxNumber,
    reportingPeriods,
    persons: [...accumulators.values()].map(toPerson),
  }
}

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_XML_PARSER_LIMITS } from './contracts'
import { parseLoonaangifteXml } from './parser'

const fixture = readFileSync(new URL('./fixtures/loonaangifte-2026-v2.0.synthetic.xml', import.meta.url))
const identity = {
  protectBsn: (bsn: string): string => createHash('sha256').update(`test-only:${bsn}`).digest('hex'),
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function xmlWith(overrides: { namespace?: string; version?: string; body?: string } = {}): Uint8Array {
  return bytes(`<?xml version="1.0" encoding="UTF-8"?><Loonaangifte xmlns="${overrides.namespace ?? 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01'}" version="${overrides.version ?? '2.0'}">${overrides.body ?? '<AdministratieveEenheid />'}</Loonaangifte>`)
}

describe('CONTROL02 officiële XML-bronparser', () => {
  it('normaliseert de geregistreerde 2026-bron zonder raw BSN in de output', () => {
    const result = parseLoonaangifteXml({ bytes: fixture, context: { identity } })

    expect(result.status).toBe('SUPPORTED_READ_ONLY')
    if (result.status !== 'SUPPORTED_READ_ONLY') return
    expect(result.xsdValidation).toBe('VALIDATED')
    expect(result.profile.taxYear).toBe(2026)
    expect(result.profile.namespaceUri).toBe('http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01')
    expect(result.document.payrollTaxNumber).toBe('123456789L01')
    expect(result.document.persons).toHaveLength(2)
    expect(result.document.persons[0]?.incomeRelationships).toHaveLength(2)
    expect(result.document.persons[0]?.bsnFingerprint).toHaveLength(64)
    expect(result.document.persons[1]?.bsnFingerprint).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('123456782')
    expect(result.document.sourceHash).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('maakt een conflict expliciet wanneer dezelfde bronpersoon tegenstrijdige velden heeft', () => {
    const altered = new TextDecoder().decode(fixture).replace('<SignNm>Voorbeeld</SignNm>\n            <Gebdat>', '<SignNm>Anders</SignNm>\n            <Gebdat>')
    const result = parseLoonaangifteXml({ bytes: bytes(altered), context: { identity } })

    expect(result.status).toBe('SUPPORTED_READ_ONLY')
    if (result.status !== 'SUPPORTED_READ_ONLY') return
    expect(result.document.persons[0]?.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'significantSurnamePart', values: expect.arrayContaining(['Voorbeeld', 'Anders']) }),
    ]))
  })

  it('weigert een semantisch parsebare bron die de officiële XSD-structuur schendt', () => {
    const invalid = bytes(new TextDecoder().decode(fixture).replace('<TotLnLbPh>0</TotLnLbPh>', ''))
    const result = parseLoonaangifteXml({ bytes: invalid, context: { identity } })

    expect(result.status).toBe('REJECTED')
    expect(result.diagnostics[0]).toMatchObject({ code: 'XML_XSD_INVALID', severity: 'BLOCKING' })
    expect(result.diagnostics[0]?.message).not.toContain('123456782')
    expect(JSON.stringify(result)).not.toContain('123456782')
  })

  it('weigert 2027 omdat alleen de aantoonbaar ondersteunde 2026-registry actief is', () => {
    const result = parseLoonaangifteXml({
      bytes: xmlWith({ namespace: 'http://xml.belastingdienst.nl/schemas/Loonaangifte/2027/01' }),
      context: { identity },
    })

    expect(result.status).toBe('SOURCE_GAP')
    expect(result.diagnostics[0]).toMatchObject({ code: 'UNSUPPORTED_YEAR' })
  })

  it('maakt een onbekende namespace en schema-versie afzonderlijk zichtbaar', () => {
    const namespaceResult = parseLoonaangifteXml({
      bytes: xmlWith({ namespace: 'https://example.invalid/Loonaangifte/2026/99' }),
      context: { identity },
    })
    const versionResult = parseLoonaangifteXml({ bytes: xmlWith({ version: '1.0' }), context: { identity } })

    expect(namespaceResult.status).toBe('SOURCE_GAP')
    expect(namespaceResult.diagnostics[0]).toMatchObject({ code: 'UNSUPPORTED_NAMESPACE' })
    expect(versionResult.status).toBe('SOURCE_GAP')
    expect(versionResult.diagnostics[0]).toMatchObject({ code: 'UNSUPPORTED_SCHEMA_VERSION' })
  })

  it('weigert DTD, externe entiteiten en malformed XML vóór normalisatie', () => {
    const dtd = parseLoonaangifteXml({
      bytes: bytes('<!DOCTYPE Loonaangifte [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><Loonaangifte />'),
      context: { identity },
    })
    const malformed = parseLoonaangifteXml({ bytes: bytes('<Loonaangifte>'), context: { identity } })
    const controlCharacter = parseLoonaangifteXml({ bytes: bytes('<Loonaangifte>&#x0;</Loonaangifte>'), context: { identity } })

    expect(dtd.status).toBe('REJECTED')
    expect(dtd.diagnostics[0]).toMatchObject({ code: 'XML_UNSAFE_DOCTYPE' })
    expect(malformed.status).toBe('REJECTED')
    expect(malformed.diagnostics[0]).toMatchObject({ code: 'XML_MALFORMED' })
    expect(controlCharacter.status).toBe('REJECTED')
    expect(controlCharacter.diagnostics[0]).toMatchObject({ code: 'XML_UNSAFE_ENTITY' })
  })

  it('handhaaft byte-, diepte- en node-limieten', () => {
    const tooLarge = parseLoonaangifteXml({
      bytes: fixture,
      context: { identity },
      limits: { ...DEFAULT_XML_PARSER_LIMITS, maxBytes: 32 },
    })
    const deepBody = `${'<n>'.repeat(5)}x${'</n>'.repeat(5)}`
    const tooDeep = parseLoonaangifteXml({
      bytes: bytes(`<Loonaangifte xmlns="http://xml.belastingdienst.nl/schemas/Loonaangifte/2026/01" version="2.0">${deepBody}</Loonaangifte>`),
      context: { identity },
      limits: { ...DEFAULT_XML_PARSER_LIMITS, maxDepth: 3 },
    })
    const tooMany = parseLoonaangifteXml({
      bytes: bytes('<Loonaangifte><a/><b/></Loonaangifte>'),
      context: { identity },
      limits: { ...DEFAULT_XML_PARSER_LIMITS, maxNodes: 2 },
    })

    expect(tooLarge.diagnostics[0]).toMatchObject({ code: 'XML_TOO_LARGE' })
    expect(tooDeep.diagnostics[0]).toMatchObject({ code: 'XML_TOO_DEEP' })
    expect(tooMany.diagnostics[0]).toMatchObject({ code: 'XML_TOO_MANY_NODES' })
  })

  it('geeft malformed waarden door als blocking contractfout en vraagt beschermde identiteit', () => {
    const malformedDate = new TextDecoder().decode(fixture).replace('<DatAanv>2026-01-01</DatAanv>\n          <PersNr>', '<DatAanv>2026-02-30</DatAanv>\n          <PersNr>')
    const malformedResult = parseLoonaangifteXml({ bytes: bytes(malformedDate), context: { identity } })
    const unsafeIdentity = parseLoonaangifteXml({ bytes: fixture, context: { identity: { protectBsn: () => 'not-a-fingerprint' } } })

    expect(malformedResult.status).toBe('REJECTED')
    expect(malformedResult.diagnostics[0]).toMatchObject({ code: 'MALFORMED_VALUE' })
    expect(unsafeIdentity.status).toBe('REJECTED')
    expect(unsafeIdentity.diagnostics[0]).toMatchObject({ code: 'IDENTIFIER_PROTECTION_REQUIRED' })
  })
})

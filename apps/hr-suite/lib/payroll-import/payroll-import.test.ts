import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PayrollImportError,
  isValidIsoDate,
  isValidPayrollIkvNumber,
  isValidLoonaangifteLhNr,
  payrollImportEmploymentLinkId,
  toSafeDatabaseDate,
  type CanonicalPayrollPerson,
  type ExistingPayrollEmployeeCandidate,
} from './model'
import { matchPayrollPerson } from './matching'
import { toEmployeeCreateInput } from './mapping'
import { adaptPayrollSource } from './source-adapter'
import { validatePayrollPersons } from './validation'

const income = {
  payrollTaxNumber: '123456789L01',
  ikvNumber: 1,
  flags: {},
  startsOn: '2026-01-01',
}

function person(overrides: Partial<CanonicalPayrollPerson> = {}): CanonicalPayrollPerson {
  return {
    sourceRowNumber: 1,
    firstName: 'Anna',
    birthName: 'Jansen',
    birthDate: '1990-01-01',
    incomeRelationships: [income],
    sourceMetadata: {},
    ...overrides,
  }
}

describe('payroll import contract', () => {
  it('koppelt een DRAFT niet automatisch aan een IKV zonder contractmapping', () => {
    expect(payrollImportEmploymentLinkId({ employmentId: 'employment-1', recordStatus: 'DRAFT' })).toBeNull()
    expect(payrollImportEmploymentLinkId({ employmentId: 'employment-1', recordStatus: 'ACTIVE' })).toBe('employment-1')
  })

  it('accepteert alleen IKV-nummers van 1 tot en met 99', () => {
    expect(isValidPayrollIkvNumber(1)).toBe(true)
    expect(isValidPayrollIkvNumber(99)).toBe(true)
    expect(isValidPayrollIkvNumber(0)).toBe(false)
    expect(isValidPayrollIkvNumber(100)).toBe(false)
    expect(isValidPayrollIkvNumber(91001)).toBe(false)
    expect(isValidPayrollIkvNumber(1.5)).toBe(false)
  })

  it('valideert het 12-karakter LhNr-formaat', () => {
    expect(isValidLoonaangifteLhNr('123456789L01')).toBe(true)
    expect(isValidLoonaangifteLhNr('12345678L01')).toBe(false)
    expect(isValidLoonaangifteLhNr('123456789l01')).toBe(false)
    expect(isValidLoonaangifteLhNr('123456789L00')).toBe(false)
  })

  it('blokkeert een geldig maar administratievreemd LhNr', () => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'f'.repeat(64),
      persons: [person({ incomeRelationships: [{ ...income, payrollTaxNumber: '987654321L02' }] })],
      candidates: [],
      expectedPayrollTaxNumber: '123456789L01',
    })
    expect(result.rows[0]?.status).toBe('BLOCKING')
    expect(result.rows[0]?.issues.map((item) => item.code)).toContain('LHNR_SCOPE_MISMATCH')
  })

  it('valideert echte kalenderdata en maakt ongeldige data blokkerend', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true)
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'c'.repeat(64),
      persons: [person({
        birthDate: '1990-02-30',
        incomeRelationships: [{ ...income, endsOn: '2026-02-30' }],
      })],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows[0]?.status).toBe('BLOCKING')
    expect(result.rows[0]?.issues.map((item) => item.code)).toEqual(expect.arrayContaining(['BIRTH_DATE_INVALID', 'INCOME_END_DATE_INVALID']))
  })

  it('zet ongeldige kalenderdatums niet door naar date-kolommen in staging', () => {
    expect(toSafeDatabaseDate('2000-02-29')).toBe('2000-02-29')
    expect(toSafeDatabaseDate('2000-02-30')).toBeNull()
    expect(toSafeDatabaseDate(undefined)).toBeNull()
  })

  it('normaliseert geregistreerde XML alleen met servercontext en beschermt BSN binnen de adapter', () => {
    const previousKey = process.env.BSN_HASH_KEY
    process.env.BSN_HASH_KEY = 'control02-test-key-that-is-not-production-0001'
    try {
      const bytes = readFileSync(new URL('./xml/fixtures/loonaangifte-2026-v2.0.synthetic.xml', import.meta.url))
      const result = adaptPayrollSource({ sourceType: 'LOONAANGIFTE_XML', bytes, tenantId: 'tenant-test' })

      expect(result.sourceContext).toMatchObject({
        status: 'SUPPORTED_READ_ONLY',
        taxYear: 2026,
        schemaVersion: '2.0',
        xsdValidation: 'VALIDATED',
      })
      expect(result.persons).toHaveLength(2)
      expect(result.persons[0]?.bsnFingerprint).toMatch(/^[0-9a-f]{64}$/u)
      expect(result.persons[0]?.firstName).toBeUndefined()
      expect(result.persons[0]?.birthName).toBeUndefined()
      expect(result.persons[0]?.incomeRelationships[0]?.sourcePeriods?.length).toBeGreaterThan(0)
      expect(JSON.stringify(result)).not.toContain('123456782')
    } finally {
      if (previousKey === undefined) delete process.env.BSN_HASH_KEY
      else process.env.BSN_HASH_KEY = previousKey
    }
  })

  it('weigert XML-normalisatie zonder tenantcontext of server-BSN-sleutel', () => {
    const bytes = new TextEncoder().encode('<Loonaangifte />')
    expect(() => adaptPayrollSource({ sourceType: 'LOONAANGIFTE_XML', bytes }))
      .toThrowError(expect.objectContaining<Partial<PayrollImportError>>({ code: 'IMPORT_TENANT_CONTEXT_REQUIRED', status: 409 }))
    const previousKey = process.env.BSN_HASH_KEY
    delete process.env.BSN_HASH_KEY
    try {
      expect(() => adaptPayrollSource({ sourceType: 'LOONAANGIFTE_XML', bytes, tenantId: 'tenant-test' }))
        .toThrowError(expect.objectContaining<Partial<PayrollImportError>>({ code: 'BSN_HASH_KEY_MISSING', status: 500 }))
    } finally {
      if (previousKey !== undefined) process.env.BSN_HASH_KEY = previousKey
    }
  })

  it('accepteert alleen de synthetische interne representatieve fixture', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      persons: [{ ...person(), bsnFingerprint: 'a'.repeat(64) }],
    }))
    const result = adaptPayrollSource({ sourceType: 'INTERNAL_REPRESENTATIVE', bytes })
    expect(result.persons).toHaveLength(1)
    expect(result.persons[0]?.bsnFingerprint).toHaveLength(64)
  })

  it('maakt een ontbrekende voornaam blokkerend, ook als initialen aanwezig zijn', () => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'a'.repeat(64),
      persons: [person({ firstName: undefined, initials: 'AJ' })],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows[0]?.status).toBe('BLOCKING')
    expect(result.rows[0]?.issues.map((item) => item.code)).toContain('FIRST_NAME_REQUIRED')
  })

  it('maakt bronconflicten blokkerend zonder conflicterende bronwaarden te tonen', () => {
    const result = validatePayrollPersons({
      sourceType: 'LOONAANGIFTE_XML',
      sourceFilename: 'source.xml',
      sourceHash: 'f'.repeat(64),
      persons: [person({ firstName: undefined, birthName: undefined })],
      candidates: [],
      sourceIssuesByRow: [{ sourceRowNumber: 1, code: 'XML_PERSON_FIELD_CONFLICT', field: 'significantSurnamePart' }],
    })

    expect(result.rows[0]?.issues).toContainEqual({ code: 'XML_PERSON_FIELD_CONFLICT', severity: 'BLOCKING', field: 'significantSurnamePart' })
    expect(JSON.stringify(result)).not.toContain('Voorbeeld')
  })

  it('doet voor XML geen employee-matching en lekt de gevonden kandidaat niet', () => {
    const result = validatePayrollPersons({
      sourceType: 'LOONAANGIFTE_XML',
      sourceFilename: 'source.xml',
      sourceHash: 'e'.repeat(64),
      persons: [person({ bsnFingerprint: 'a'.repeat(64) })],
      candidates: [{
        id: 'internal-employee-id',
        externalEmployeeNumber: null,
        bsnFingerprint: 'a'.repeat(64),
        firstName: 'Anna',
        birthName: 'Jansen',
        birthDate: '1990-01-01',
      }],
    })

    expect(result.rows[0]?.match).toEqual({ status: 'UNMATCHED' })
    expect(JSON.stringify(result)).not.toContain('internal-employee-id')
  })

  it('blokkeert dezelfde IKV meer dan één keer binnen de batch', () => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'b'.repeat(64),
      persons: [
        person({ bsnFingerprint: 'a'.repeat(64) }),
        person({ sourceRowNumber: 2, bsnFingerprint: 'a'.repeat(64) }),
      ],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows.every((row) => row.issues.some((item) => item.code === 'DUPLICATE_IKV'))).toBe(true)
  })

  it('laat hetzelfde LhNr/IKV-paar toe voor twee verschillende werknemers', () => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'c'.repeat(64),
      persons: [
        person({ bsnFingerprint: 'a'.repeat(64) }),
        person({ sourceRowNumber: 2, bsnFingerprint: 'b'.repeat(64), birthName: 'De Vries' }),
      ],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows.every((row) => row.issues.every((item) => item.code !== 'DUPLICATE_IKV'))).toBe(true)
  })

  it('zet een ambigue match op handmatige controle', () => {
    const candidates: ExistingPayrollEmployeeCandidate[] = [
      { id: 'employee-1', externalEmployeeNumber: null, bsnFingerprint: null, firstName: 'Anna', birthName: 'Jansen', birthDate: '1990-01-01' },
      { id: 'employee-2', externalEmployeeNumber: null, bsnFingerprint: null, firstName: 'Anne', birthName: 'Jansen', birthDate: '1990-01-01' },
    ]
    expect(matchPayrollPerson(person(), candidates)).toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it('zet BSN en personeelsnummer die naar verschillende werknemers wijzen op handmatige controle', () => {
    const candidates: ExistingPayrollEmployeeCandidate[] = [
      { id: 'employee-bsn', externalEmployeeNumber: 'EMP-1', bsnFingerprint: 'a'.repeat(64), firstName: 'Anna', birthName: 'Jansen', birthDate: '1990-01-01' },
      { id: 'employee-number', externalEmployeeNumber: 'EMP-2', bsnFingerprint: null, firstName: 'Anne', birthName: 'Vries', birthDate: '1991-01-01' },
    ]
    const sourcePerson = person({ bsnFingerprint: 'a'.repeat(64), externalEmployeeNumber: 'EMP-2' })

    expect(matchPayrollPerson(sourcePerson, candidates)).toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it('zet een personeelsnummer-match op handmatige controle als het opgegeven BSN nergens matcht', () => {
    const candidates: ExistingPayrollEmployeeCandidate[] = [
      { id: 'employee-number', externalEmployeeNumber: 'EMP-2', bsnFingerprint: null, firstName: 'Anne', birthName: 'Vries', birthDate: '1991-01-01' },
    ]

    expect(matchPayrollPerson(person({ bsnFingerprint: 'a'.repeat(64), externalEmployeeNumber: 'EMP-2' }), candidates))
      .toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it.each([0, 100, 91001])('blokkeert IKV-nummers buiten de ondersteunde reeks: %i', (ikvNumber) => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'd'.repeat(64),
      persons: [person({ incomeRelationships: [{ ...income, ikvNumber }] })],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows[0]?.status).toBe('BLOCKING')
    expect(result.rows[0]?.issues.map((item) => item.code)).toContain('INCOME_IKV_NUMBER_INVALID')
  })

  it('blokkeert een inkomensrelatie zonder startdatum vóór definitieve verwerking', () => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'e'.repeat(64),
      persons: [person({ incomeRelationships: [{ ...income, startsOn: undefined }] })],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows[0]?.status).toBe('BLOCKING')
    expect(result.rows[0]?.issues.map((item) => item.code)).toContain('INCOME_START_DATE_REQUIRED')
  })

  it('gebruikt nooit initialen als voornaam bij de canonical employee mapping', () => {
    const mapped = toEmployeeCreateInput(person({ firstName: 'Anna', initials: 'AJ' }), 'E-1001')
    expect(mapped?.firstName).toBe('Anna')
    expect(mapped?.initials).toBe('AJ')
    expect(toEmployeeCreateInput(person({ firstName: undefined, initials: 'AJ' }), 'E-1002')).toBeNull()
  })
})

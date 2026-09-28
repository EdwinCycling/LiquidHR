import { describe, expect, it } from 'vitest'
import {
  PayrollImportError,
  isValidIsoDate,
  isValidLoonaangifteLhNr,
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
  it('valideert het 12-karakter LhNr-formaat', () => {
    expect(isValidLoonaangifteLhNr('123456789L01')).toBe(true)
    expect(isValidLoonaangifteLhNr('12345678L01')).toBe(false)
    expect(isValidLoonaangifteLhNr('123456789l01')).toBe(false)
    expect(isValidLoonaangifteLhNr('123456789L00')).toBe(false)
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

  it('weigert echte XML zolang de officiële adapter niet beschikbaar is', () => {
    expect(() => adaptPayrollSource({ sourceType: 'LOONAANGIFTE_XML', bytes: new TextEncoder().encode('<xml />') })).toThrowError(
      expect.objectContaining<Partial<PayrollImportError>>({ code: 'REAL_XML_PENDING', status: 409 }),
    )
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

  it('blokkeert dezelfde IKV meer dan één keer binnen de batch', () => {
    const result = validatePayrollPersons({
      sourceType: 'INTERNAL_REPRESENTATIVE',
      sourceFilename: 'fixture.json',
      sourceHash: 'b'.repeat(64),
      persons: [person(), person({ sourceRowNumber: 2, birthName: 'De Vries' })],
      candidates: [],
      expectedPayrollTaxNumber: income.payrollTaxNumber,
    })
    expect(result.rows.every((row) => row.issues.some((item) => item.code === 'DUPLICATE_IKV'))).toBe(true)
  })

  it('zet een ambigue match op handmatige controle', () => {
    const candidates: ExistingPayrollEmployeeCandidate[] = [
      { id: 'employee-1', externalEmployeeNumber: null, bsnFingerprint: null, firstName: 'Anna', birthName: 'Jansen', birthDate: '1990-01-01' },
      { id: 'employee-2', externalEmployeeNumber: null, bsnFingerprint: null, firstName: 'Anne', birthName: 'Jansen', birthDate: '1990-01-01' },
    ]
    expect(matchPayrollPerson(person(), candidates)).toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it('gebruikt nooit initialen als voornaam bij de canonical employee mapping', () => {
    const mapped = toEmployeeCreateInput(person({ firstName: 'Anna', initials: 'AJ' }), 'E-1001')
    expect(mapped?.firstName).toBe('Anna')
    expect(mapped?.initials).toBe('AJ')
    expect(toEmployeeCreateInput(person({ firstName: undefined, initials: 'AJ' }), 'E-1002')).toBeNull()
  })
})

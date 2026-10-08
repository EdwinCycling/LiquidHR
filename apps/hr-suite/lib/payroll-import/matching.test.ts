import { describe, expect, it } from 'vitest'
import type { CanonicalPayrollPerson, ExistingPayrollEmployeeCandidate } from './model'
import { matchPayrollPerson } from './matching'

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

function candidate(overrides: Partial<ExistingPayrollEmployeeCandidate> = {}): ExistingPayrollEmployeeCandidate {
  return {
    id: 'employee-1',
    externalEmployeeNumber: null,
    bsnFingerprint: null,
    firstName: 'Anna',
    birthName: 'Jansen',
    birthDate: '1990-01-01',
    ...overrides,
  }
}

describe('payroll import match decision', () => {
  it('accepts one exact BSN match when the supplied strong identifiers agree', () => {
    expect(matchPayrollPerson(
      person({ bsnFingerprint: 'a'.repeat(64), externalEmployeeNumber: ' EMP-1 ' }),
      [candidate({ bsnFingerprint: 'a'.repeat(64), externalEmployeeNumber: 'emp-1' })],
    )).toEqual({ status: 'EXACT', employeeId: 'employee-1', reason: 'BSN_EXACT' })
  })

  it('blocks strong identifiers that resolve to different employees', () => {
    expect(matchPayrollPerson(
      person({ bsnFingerprint: 'a'.repeat(64), externalEmployeeNumber: 'EMP-2' }),
      [
        candidate({ id: 'employee-bsn', bsnFingerprint: 'a'.repeat(64), externalEmployeeNumber: 'EMP-1' }),
        candidate({ id: 'employee-number', externalEmployeeNumber: 'EMP-2' }),
      ],
    )).toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it('blocks a weak name/date fallback when a supplied strong identity does not match', () => {
    expect(matchPayrollPerson(
      person({ bsnFingerprint: 'a'.repeat(64) }),
      [candidate()],
    )).toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it('returns an explicit proposal for a unique name/date match without strong identity', () => {
    expect(matchPayrollPerson(person(), [candidate()])).toEqual({
      status: 'PROPOSED',
      employeeId: 'employee-1',
      reason: 'NAME_BIRTH_DATE',
    })
  })

  it('blocks duplicate weak candidates instead of selecting the first one', () => {
    expect(matchPayrollPerson(person(), [
      candidate({ id: 'employee-1' }),
      candidate({ id: 'employee-2' }),
    ])).toEqual({ status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' })
  })

  it('returns NEW only when no candidate can be established', () => {
    expect(matchPayrollPerson(
      person({
        birthName: 'Vries',
        birthDate: '1991-02-02',
        bsnFingerprint: 'b'.repeat(64),
        externalEmployeeNumber: 'EMP-2',
      }),
      [candidate()],
    )).toEqual({ status: 'NEW', reason: 'NO_CANDIDATE' })
  })
})

import {
  normalizeIdentityPart,
  type CanonicalPayrollPerson,
  type ExistingPayrollEmployeeCandidate,
  type PayrollImportMatch,
} from './model'

function exactCandidates(
  persons: readonly ExistingPayrollEmployeeCandidate[],
  predicate: (candidate: ExistingPayrollEmployeeCandidate) => boolean,
): ExistingPayrollEmployeeCandidate[] {
  return persons.filter(predicate)
}

export function matchPayrollPerson(
  person: CanonicalPayrollPerson,
  candidates: readonly ExistingPayrollEmployeeCandidate[],
): PayrollImportMatch {
  if (person.bsnFingerprint) {
    const matches = exactCandidates(candidates, (candidate) => candidate.bsnFingerprint === person.bsnFingerprint)
    if (matches.length === 1) return { status: 'EXACT', employeeId: matches[0].id, reason: 'BSN_EXACT' }
    if (matches.length > 1) return { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
  }

  if (person.externalEmployeeNumber) {
    const matches = exactCandidates(candidates, (candidate) => candidate.externalEmployeeNumber === person.externalEmployeeNumber)
    if (matches.length === 1) return { status: 'EXACT', employeeId: matches[0].id, reason: 'EXTERNAL_EMPLOYEE_NUMBER' }
    if (matches.length > 1) return { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
  }

  if (person.birthName && person.birthDate) {
    const birthName = normalizeIdentityPart(person.birthName)
    const matches = exactCandidates(candidates, (candidate) => normalizeIdentityPart(candidate.birthName) === birthName && candidate.birthDate === person.birthDate)
    if (matches.length === 1) return { status: 'PROPOSED', employeeId: matches[0].id, reason: 'NAME_BIRTH_DATE' }
    if (matches.length > 1) return { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
  }

  return { status: 'NEW', reason: 'NO_CANDIDATE' }
}

export function payrollIncomeRelationshipKey(person: CanonicalPayrollPerson, payrollTaxNumber: string, ikvNumber: number): string {
  return `${payrollTaxNumber}:${ikvNumber}`
}

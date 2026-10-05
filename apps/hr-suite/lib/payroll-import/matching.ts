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
  const bsnFingerprint = person.bsnFingerprint?.trim()
  const bsnMatches = bsnFingerprint
    ? exactCandidates(candidates, (candidate) => candidate.bsnFingerprint === bsnFingerprint)
    : []
  const employeeNumber = normalizeIdentityPart(person.externalEmployeeNumber)
  const employeeNumberMatches = employeeNumber
    ? exactCandidates(candidates, (candidate) => normalizeIdentityPart(candidate.externalEmployeeNumber) === employeeNumber)
    : []

  if (bsnMatches.length > 1 || employeeNumberMatches.length > 1) {
    return { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
  }
  const bsnMatch = bsnMatches[0]
  const employeeNumberMatch = employeeNumberMatches[0]
  const hasBsn = Boolean(bsnFingerprint)
  const hasEmployeeNumber = Boolean(employeeNumber)
  const hasConflictingStrongIdentifiers = hasBsn && hasEmployeeNumber
    && (Boolean(bsnMatch) || Boolean(employeeNumberMatch))
    && (!bsnMatch || !employeeNumberMatch || bsnMatch.id !== employeeNumberMatch.id)
  if (hasConflictingStrongIdentifiers) {
    return { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
  }
  if (bsnMatch) return { status: 'EXACT', employeeId: bsnMatch.id, reason: 'BSN_EXACT' }
  if (employeeNumberMatch) {
    return { status: 'EXACT', employeeId: employeeNumberMatch.id, reason: 'EXTERNAL_EMPLOYEE_NUMBER' }
  }

  if (person.birthName && person.birthDate) {
    const birthName = normalizeIdentityPart(person.birthName)
    const matches = exactCandidates(candidates, (candidate) => normalizeIdentityPart(candidate.birthName) === birthName && candidate.birthDate === person.birthDate)
    if (matches.length === 1) {
      return hasBsn || hasEmployeeNumber
        ? { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
        : { status: 'PROPOSED', employeeId: matches[0].id, reason: 'NAME_BIRTH_DATE' }
    }
    if (matches.length > 1) return { status: 'MANUAL_REVIEW', reason: 'AMBIGUOUS' }
  }

  return { status: 'NEW', reason: 'NO_CANDIDATE' }
}

export function payrollIncomeRelationshipKey(person: CanonicalPayrollPerson, payrollTaxNumber: string, ikvNumber: number): string {
  const personKey = person.bsnFingerprint
    ? ['bsn', person.bsnFingerprint]
    : person.externalEmployeeNumber
      ? ['employee-number', normalizeIdentityPart(person.externalEmployeeNumber)]
      : ['source-row', String(person.sourceRowNumber)]
  return JSON.stringify([personKey, payrollTaxNumber.trim().toUpperCase(), ikvNumber])
}

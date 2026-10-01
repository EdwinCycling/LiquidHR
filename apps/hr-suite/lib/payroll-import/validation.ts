import {
  isValidIsoDate,
  isValidLoonaangifteLhNr,
  isValidPayrollIkvNumber,
  type CanonicalPayrollPerson,
  type ExistingPayrollEmployeeCandidate,
  type PayrollImportAnalysis,
  type PayrollImportIssue,
  type ValidatedPayrollPerson,
} from './model'
import { matchPayrollPerson, payrollIncomeRelationshipKey } from './matching'

function issue(code: string, severity: PayrollImportIssue['severity'], field?: string): PayrollImportIssue {
  return { code, severity, field }
}

function duplicateValues(values: readonly string[]): Set<string> {
  const counts = new Map<string, number>()
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1)
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value))
}

export function validatePayrollPersons(input: {
  sourceType: PayrollImportAnalysis['sourceType']
  sourceFilename: string
  sourceHash: string
  persons: readonly CanonicalPayrollPerson[]
  candidates: readonly ExistingPayrollEmployeeCandidate[]
  expectedPayrollTaxNumber?: string
}): PayrollImportAnalysis {
  const duplicateExternalNumbers = duplicateValues(input.persons.map((person) => person.externalEmployeeNumber ?? ''))
  const incomeKeys = input.persons.flatMap((person) => person.incomeRelationships.map((income) => payrollIncomeRelationshipKey(person, income.payrollTaxNumber, income.ikvNumber)))
  const duplicateIncomeKeys = duplicateValues(incomeKeys)

  const rows: ValidatedPayrollPerson[] = input.persons.map((person) => {
    const issues: PayrollImportIssue[] = []
    const firstName = person.firstName?.trim()
    const birthName = person.birthName?.trim()
    if (!firstName) issues.push(issue('FIRST_NAME_REQUIRED', 'BLOCKING', 'firstName'))
    if (!birthName) issues.push(issue('BIRTH_NAME_REQUIRED', 'BLOCKING', 'birthName'))
    if (person.birthDate && !isValidIsoDate(person.birthDate)) issues.push(issue('BIRTH_DATE_INVALID', 'BLOCKING', 'birthDate'))
    if (person.externalEmployeeNumber && duplicateExternalNumbers.has(person.externalEmployeeNumber)) {
      issues.push(issue('DUPLICATE_EXTERNAL_EMPLOYEE_NUMBER', 'BLOCKING', 'externalEmployeeNumber'))
    }
    for (const income of person.incomeRelationships) {
      if (!isValidLoonaangifteLhNr(income.payrollTaxNumber)) issues.push(issue('LHNR_INVALID', 'BLOCKING', 'payrollTaxNumber'))
      if (input.expectedPayrollTaxNumber && income.payrollTaxNumber !== input.expectedPayrollTaxNumber) issues.push(issue('LHNR_SCOPE_MISMATCH', 'BLOCKING', 'payrollTaxNumber'))
      if (!isValidPayrollIkvNumber(income.ikvNumber)) {
        issues.push(issue('INCOME_IKV_NUMBER_INVALID', 'BLOCKING', 'ikvNumber'))
      }
      if (duplicateIncomeKeys.has(payrollIncomeRelationshipKey(person, income.payrollTaxNumber, income.ikvNumber))) issues.push(issue('DUPLICATE_IKV', 'BLOCKING', 'ikvNumber'))
      if (!income.startsOn) issues.push(issue('INCOME_START_DATE_REQUIRED', 'BLOCKING', 'startsOn'))
      const startsOnValid = !income.startsOn || isValidIsoDate(income.startsOn)
      const endsOnValid = !income.endsOn || isValidIsoDate(income.endsOn)
      if (income.startsOn && !startsOnValid) issues.push(issue('INCOME_START_DATE_INVALID', 'BLOCKING', 'startsOn'))
      if (income.endsOn && !endsOnValid) issues.push(issue('INCOME_END_DATE_INVALID', 'BLOCKING', 'endsOn'))
      if (startsOnValid && endsOnValid && income.startsOn && income.endsOn && income.endsOn < income.startsOn) issues.push(issue('INCOME_DATE_RANGE_INVALID', 'BLOCKING', 'endsOn'))
    }

    const match = matchPayrollPerson(person, input.candidates)
    if (match.status === 'MANUAL_REVIEW') issues.push(issue('AMBIGUOUS_EMPLOYEE_MATCH', 'BLOCKING'))
    if (match.status === 'PROPOSED') issues.push(issue('EMPLOYEE_MATCH_REQUIRES_CONFIRMATION', 'WARNING'))
    if (match.status === 'NEW' && !firstName) issues.push(issue('NEW_EMPLOYEE_INCOMPLETE', 'BLOCKING'))

    const status = issues.some((item) => item.severity === 'BLOCKING')
      ? 'BLOCKING'
      : issues.length > 0 ? 'WARNING' : 'GREEN'
    return { ...person, status, match, issues }
  })

  return {
    sourceType: input.sourceType,
    sourceFilename: input.sourceFilename,
    sourceHash: input.sourceHash,
    rows,
    summary: {
      total: rows.length,
      green: rows.filter((row) => row.status === 'GREEN').length,
      warnings: rows.filter((row) => row.status === 'WARNING').length,
      blocking: rows.filter((row) => row.status === 'BLOCKING').length,
      incomeRelationships: rows.reduce((count, row) => count + row.incomeRelationships.length, 0),
      ambiguousMatches: rows.filter((row) => row.match.status === 'MANUAL_REVIEW').length,
    },
  }
}

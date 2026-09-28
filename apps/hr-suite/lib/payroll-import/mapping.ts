import type { EmployeeCreateInput } from '@/lib/employees/schemas'
import type { CanonicalPayrollPerson, ValidatedPayrollPerson } from './model'

export function toEmployeeCreateInput(person: CanonicalPayrollPerson, employeeNumber?: string): EmployeeCreateInput | null {
  const firstName = person.firstName?.trim()
  const birthName = person.birthName?.trim()
  if (!firstName || !birthName) return null
  return {
    ...(employeeNumber ? { employeeNumber } : {}),
    initials: person.initials?.trim() || undefined,
    firstName,
    birthNamePrefix: person.prefix?.trim() || undefined,
    birthName,
    nameUsage: 'BIRTH_NAME',
    gender: person.gender ?? 'PREFER_NOT_TO_SAY',
    birthDate: person.birthDate,
    nationality: person.nationality,
    preferredLanguage: 'nl-NL',
    originalHireDate: person.incomeRelationships[0]?.startsOn,
  }
}

export function isFinalizablePerson(row: ValidatedPayrollPerson, selected: boolean): boolean {
  return selected && row.status !== 'BLOCKING' && row.match.status !== 'MANUAL_REVIEW'
}

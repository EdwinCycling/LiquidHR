export const MIN_NEW_EMPLOYEE_AGE = 10
export const MAX_NEW_EMPLOYEE_AGE = 90

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day }
}

export function ageOnDate(birthDate: string, referenceDate: string): number | null {
  const birth = parseDateOnly(birthDate)
  const reference = parseDateOnly(referenceDate)
  if (!birth || !reference) return null
  if (birthDate > referenceDate) return null
  return reference.year - birth.year - (
    reference.month < birth.month || (reference.month === birth.month && reference.day < birth.day) ? 1 : 0
  )
}

export function isNewEmployeeBirthDateValid(birthDate: string, referenceDate = new Date().toISOString().slice(0, 10)): boolean {
  const age = ageOnDate(birthDate, referenceDate)
  return age !== null && age >= MIN_NEW_EMPLOYEE_AGE && age <= MAX_NEW_EMPLOYEE_AGE
}

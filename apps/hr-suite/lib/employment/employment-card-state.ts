export type EmploymentCardStatus = 'ACTIVE' | 'FUTURE' | 'ENDED'

export function getEmploymentCardStatus(input: {
  startsOn: string
  endsOn: string | null
  recordStatus: string
}, today: string): EmploymentCardStatus {
  if (input.recordStatus === 'CANCELLED' || (input.endsOn !== null && input.endsOn < today)) {
    return 'ENDED'
  }

  if (input.startsOn > today) return 'FUTURE'
  return 'ACTIVE'
}

export function hasActiveEmployment(
  employments: ReadonlyArray<{ startsOn: string; endsOn: string | null; recordStatus: string }>,
  today: string,
): boolean {
  return employments.some((employment) => getEmploymentCardStatus(employment, today) === 'ACTIVE')
}

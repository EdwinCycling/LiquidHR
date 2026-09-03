export type ContractDurationType = 'INDEFINITE' | 'DEFINITE' | 'TEMPORARY_NO_END'

export interface ProbationRuleInput {
  durationType: ContractDurationType
  startsOn: string
  endsOn?: string | null
  caoAllowsTwoMonths?: boolean
}

export interface ProbationRule {
  allowed: boolean
  maximumMonths: 0 | 1 | 2
  reason: 'INDEFINITE' | 'SHORT_FIXED_TERM' | 'MEDIUM_FIXED_TERM' | 'LONG_FIXED_TERM' | 'TEMPORARY_WITHOUT_END'
}

export function addCalendarMonths(value: string, months: number): string {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.toISOString().slice(0, 10)
}

export function addContractPeriodEnd(value: string, months: number): string {
  const boundary = addCalendarMonths(value, months)
  if (!boundary) return ''
  const [year, month, day] = boundary.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day - 1))
  return date.toISOString().slice(0, 10)
}

export function getProbationRule(input: ProbationRuleInput): ProbationRule {
  if (input.durationType === 'INDEFINITE') {
    return { allowed: true, maximumMonths: 2, reason: 'INDEFINITE' }
  }

  if (input.durationType === 'TEMPORARY_NO_END' || !input.endsOn) {
    return { allowed: true, maximumMonths: 1, reason: 'TEMPORARY_WITHOUT_END' }
  }

  if (input.endsOn <= addContractPeriodEnd(input.startsOn, 6)) {
    return { allowed: false, maximumMonths: 0, reason: 'SHORT_FIXED_TERM' }
  }

  if (input.endsOn < addContractPeriodEnd(input.startsOn, 24)) {
    return {
      allowed: true,
      maximumMonths: input.caoAllowsTwoMonths === true ? 2 : 1,
      reason: 'MEDIUM_FIXED_TERM',
    }
  }

  return { allowed: true, maximumMonths: 2, reason: 'LONG_FIXED_TERM' }
}

export type ProbationValidationCode =
  | 'PROBATION_DATE_INVALID'
  | 'PROBATION_DATE_NOT_ALLOWED'
  | 'PROBATION_NOT_ALLOWED'
  | 'PROBATION_MAXIMUM_EXCEEDED'
  | 'PROBATION_DATE_OUTSIDE_CONTRACT'

export function validateProbation(input: ProbationRuleInput & {
  probationApplies: boolean
  probationEndsOn?: string | null
}): ProbationValidationCode | null {
  if (!input.probationApplies) {
    return input.probationEndsOn ? 'PROBATION_DATE_NOT_ALLOWED' : null
  }

  if (!input.probationEndsOn || input.probationEndsOn < input.startsOn) {
    return 'PROBATION_DATE_INVALID'
  }

  if (input.endsOn && input.probationEndsOn > input.endsOn) {
    return 'PROBATION_DATE_OUTSIDE_CONTRACT'
  }

  const rule = getProbationRule(input)
  if (!rule.allowed) return 'PROBATION_NOT_ALLOWED'
  if (input.probationEndsOn > addContractPeriodEnd(input.startsOn, rule.maximumMonths)) {
    return 'PROBATION_MAXIMUM_EXCEEDED'
  }
  return null
}

export function isBlockingProbationValidation(code: ProbationValidationCode | null): code is 'PROBATION_DATE_INVALID' | 'PROBATION_DATE_NOT_ALLOWED' | 'PROBATION_DATE_OUTSIDE_CONTRACT' {
  return code === 'PROBATION_DATE_INVALID'
    || code === 'PROBATION_DATE_NOT_ALLOWED'
    || code === 'PROBATION_DATE_OUTSIDE_CONTRACT'
}

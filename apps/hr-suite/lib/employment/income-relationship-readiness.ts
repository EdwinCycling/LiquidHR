export type IncomeRelationshipReadinessBlocker =
  | 'employee_identifier_missing'
  | 'income_relationship_number_invalid'
  | 'employer_tax_number_missing'
  | 'employer_tax_subnumber_invalid'
  | 'employer_tax_number_period_gap'
  | 'employer_tax_number_mismatch'
  | 'income_relationship_type_invalid'
  | 'income_relationship_dates_invalid'
  | 'income_relationship_link_missing'
  | 'income_relationship_link_period_invalid'
  | 'employment_not_confirmed'
  | 'employment_period_invalid'
  | 'employment_contract_missing'
  | 'payroll_source_access_unavailable'

export type IncomeRelationshipReadinessInput = {
  readonly reportingStatus: 'DRAFT' | 'READY' | 'REPORTED' | 'CLOSED'
  readonly ikvNumber: number
  readonly relationshipType: string
  readonly startsOn: string
  readonly endsOn: string | null
  readonly payrollTaxSubnumber: string
  readonly payrollTaxNumber: string | null
  readonly payrollTaxBindingId: string | null
  readonly payrollTaxBindingHrGroupId: string | null
  readonly administrationId: string
  readonly hrGroupId: string
  readonly hasVerifiedBsn: boolean
  readonly links: readonly {
    readonly validFrom: string
    readonly validUntil: string | null
    readonly employment: {
      readonly startsOn: string
      readonly endsOn: string | null
      readonly recordStatus: string
      readonly contracts: readonly { readonly startsOn: string; readonly endsOn: string | null }[]
    } | null
  }[]
  readonly payrollTaxNumbers: readonly {
    readonly id: string
    readonly hrGroupId: string
    readonly administrationId: string
    readonly payrollTaxNumber: string
    readonly validFrom: string
    readonly validUntil: string | null
  }[]
  readonly payrollTaxNumberSourceAvailable: boolean
}

export type IncomeRelationshipReadiness = {
  readonly blockers: readonly IncomeRelationshipReadinessBlocker[]
  readonly canMarkReady: boolean
}

function addOneDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function coversInclusivePeriod(
  sourceFrom: string,
  sourceUntil: string | null,
  requiredFrom: string,
  requiredUntil: string | null,
): boolean {
  if (sourceFrom > requiredFrom) return false
  if (requiredUntil === null) return sourceUntil === null
  return sourceUntil === null || sourceUntil >= requiredUntil
}

function payrollTaxNumberMatches(
  input: IncomeRelationshipReadinessInput,
): 'match' | 'missing' | 'period_gap' | 'mismatch' {
  if (!input.payrollTaxNumberSourceAvailable) return 'missing'
  if (!input.payrollTaxBindingId || !input.payrollTaxBindingHrGroupId || !input.payrollTaxNumber) return 'missing'

  const boundNumbers = input.payrollTaxNumbers.filter((registration) => registration.id === input.payrollTaxBindingId)
  if (boundNumbers.length === 0) return 'missing'
  if (boundNumbers.length !== 1) return 'mismatch'

  const registration = boundNumbers[0]
  const registeredSubnumber = registration.payrollTaxNumber.slice(-3)
  if (input.payrollTaxBindingHrGroupId !== input.hrGroupId
    || registration.hrGroupId !== input.hrGroupId
    || registration.administrationId !== input.administrationId
    || registration.payrollTaxNumber !== input.payrollTaxNumber
    || !/^[0-9]{9}L(?:0[1-9]|[1-9][0-9])$/.test(registration.payrollTaxNumber)
    || input.payrollTaxSubnumber !== registeredSubnumber) return 'mismatch'

  const coveringNumbers = boundNumbers.filter((number) => coversInclusivePeriod(
    number.validFrom,
    number.validUntil,
    input.startsOn,
    input.endsOn,
  ))
  if (coveringNumbers.length === 0) return 'period_gap'
  return coveringNumbers.length === 1 ? 'match' : 'mismatch'
}

function hasValidEmploymentAndContractLink(
  link: IncomeRelationshipReadinessInput['links'][number],
): IncomeRelationshipReadinessBlocker | null {
  const employment = link.employment
  if (!employment) return 'income_relationship_link_period_invalid'
  if (employment.recordStatus !== 'CONFIRMED') return 'employment_not_confirmed'

  const employmentEndExclusive = employment.endsOn === null ? null : addOneDay(employment.endsOn)
  if (link.validFrom < employment.startsOn
    || (employmentEndExclusive !== null && (link.validUntil === null || link.validUntil > employmentEndExclusive))) {
    return 'employment_period_invalid'
  }

  const orderedContracts = [...employment.contracts].sort((left, right) => left.startsOn.localeCompare(right.startsOn))
  let contractsCoverUntil: string | null = link.validFrom
  for (const contract of orderedContracts) {
    if (contractsCoverUntil === null) break
    if (contract.startsOn > contractsCoverUntil) break
    const contractEndExclusive = contract.endsOn === null ? null : addOneDay(contract.endsOn)
    if (contractEndExclusive === null) {
      contractsCoverUntil = null
      break
    }
    if (contractEndExclusive > contractsCoverUntil) contractsCoverUntil = contractEndExclusive
    if (link.validUntil !== null && contractsCoverUntil >= link.validUntil) break
  }
  if ((link.validUntil === null && contractsCoverUntil !== null)
    || (link.validUntil !== null && contractsCoverUntil !== null && contractsCoverUntil < link.validUntil)) {
    return 'employment_contract_missing'
  }
  return null
}

function linksCoverRelationship(input: IncomeRelationshipReadinessInput): boolean {
  const orderedLinks = [...input.links].sort((left, right) => left.validFrom.localeCompare(right.validFrom))
  if (orderedLinks.length === 0) return false

  const requiredEndExclusive = input.endsOn === null ? null : addOneDay(input.endsOn)
  let coveredUntil = input.startsOn
  for (const link of orderedLinks) {
    if (link.validFrom > coveredUntil) return false
    if (link.validUntil === null) return true
    if (link.validUntil > coveredUntil) coveredUntil = link.validUntil
    if (requiredEndExclusive !== null && coveredUntil >= requiredEndExclusive) return true
  }

  return requiredEndExclusive !== null && coveredUntil >= requiredEndExclusive
}

export function evaluateIncomeRelationshipReadiness(
  input: IncomeRelationshipReadinessInput,
): IncomeRelationshipReadiness {
  const blockers = new Set<IncomeRelationshipReadinessBlocker>()

  if (!input.hasVerifiedBsn) blockers.add('employee_identifier_missing')
  if (!Number.isInteger(input.ikvNumber) || input.ikvNumber < 1 || input.ikvNumber > 99) {
    blockers.add('income_relationship_number_invalid')
  }
  if (input.relationshipType !== 'EMPLOYMENT') blockers.add('income_relationship_type_invalid')
  if (input.endsOn !== null && input.endsOn < input.startsOn) blockers.add('income_relationship_dates_invalid')
  if (!/^L(?:0[1-9]|[1-9][0-9])$/.test(input.payrollTaxSubnumber)) blockers.add('employer_tax_subnumber_invalid')

  const taxNumberResult = payrollTaxNumberMatches(input)
  if (taxNumberResult === 'missing') {
    blockers.add(input.payrollTaxNumberSourceAvailable
      ? 'employer_tax_number_missing'
      : 'payroll_source_access_unavailable')
  } else if (taxNumberResult === 'period_gap') {
    blockers.add('employer_tax_number_period_gap')
  } else if (taxNumberResult === 'mismatch') {
    blockers.add('employer_tax_number_mismatch')
  }

  if (input.links.length === 0) blockers.add('income_relationship_link_missing')
  else if (!linksCoverRelationship(input)) blockers.add('income_relationship_link_period_invalid')
  for (const link of input.links) {
    const relationshipEndExclusive = input.endsOn === null ? null : addOneDay(input.endsOn)
    if (link.validFrom < input.startsOn
      || (relationshipEndExclusive !== null && (link.validUntil === null || link.validUntil > relationshipEndExclusive))) {
      blockers.add('income_relationship_link_period_invalid')
      continue
    }
    const linkBlocker = hasValidEmploymentAndContractLink(link)
    if (linkBlocker) blockers.add(linkBlocker)
  }

  const blockerList = [...blockers]
  return {
    blockers: blockerList,
    canMarkReady: input.reportingStatus === 'DRAFT' && blockerList.length === 0,
  }
}

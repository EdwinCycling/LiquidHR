import type { PensionArrangementInput } from '@liquid-hr/payroll-rules-nl-2026'

export type CorePensionEligibilityRuleMapping = Readonly<{
  mode: 'CORE_ARRANGEMENT_EFFECTIVE_FROM'
  sourceField: 'arrangement.effective_from'
  derivedBoundary: string
}>

export function mapCorePensionEligibilityRule(input: {
  readonly arrangementType: PensionArrangementInput['arrangementType']
  readonly effectiveFrom: string
  readonly eligibilityRule: Readonly<Record<string, unknown>>
}): {
  readonly eligibilityRule: Readonly<Record<string, unknown>>
  readonly mapping: CorePensionEligibilityRuleMapping | null
} {
  const participantGroup = input.eligibilityRule.participantGroup
  const explicitBoundary = input.eligibilityRule.employmentOrParticipationStartOnOrAfter
  const effectiveFromIsDate = /^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)
    && Number.isFinite(Date.parse(`${input.effectiveFrom}T00:00:00.000Z`))

  if (input.arrangementType !== 'FLAT_PREMIUM'
    || participantGroup !== 'NEW_ENTRANT'
    || explicitBoundary !== undefined
    || !effectiveFromIsDate) {
    return { eligibilityRule: input.eligibilityRule, mapping: null }
  }

  const mapping: CorePensionEligibilityRuleMapping = {
    mode: 'CORE_ARRANGEMENT_EFFECTIVE_FROM',
    sourceField: 'arrangement.effective_from',
    derivedBoundary: input.effectiveFrom,
  }
  return {
    eligibilityRule: {
      ...input.eligibilityRule,
      employmentOrParticipationStartOnOrAfter: input.effectiveFrom,
    },
    mapping,
  }
}

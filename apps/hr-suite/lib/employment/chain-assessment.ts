export type ChainOutcome = 'CLEAR' | 'ATTENTION' | 'LIKELY_INDEFINITE' | 'INSUFFICIENT_DATA'
export type ChainRuleVersion = 'NL_CHAIN_2020' | 'NL_CHAIN_2028'

interface TemporaryContractPeriod {
  startsOn: string
  endsOn: string | null
}

interface ProposedContract extends TemporaryContractPeriod {
  contractType: 'INDEFINITE' | 'DEFINITE' | 'ON_CALL' | 'TEMPORARY_AGENCY' | 'EXTERNAL'
}

export interface ChainAssessmentInput {
  proposed: ProposedContract
  history: TemporaryContractPeriod[]
  historyComplete: boolean
  exceptionCode?: string | null
}

export interface ChainAssessment {
  outcome: ChainOutcome
  ruleVersion: ChainRuleVersion
  chainContractCount: number
  chainStartsOn: string
  reasons: string[]
}

function addMonths(value: string, months: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.toISOString().slice(0, 10)
}

function addYears(value: string, years: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return date.toISOString().slice(0, 10)
}

export function assessEmploymentChain(input: ChainAssessmentInput): ChainAssessment {
  const ruleVersion: ChainRuleVersion =
    input.proposed.startsOn >= '2028-01-01' ? 'NL_CHAIN_2028' : 'NL_CHAIN_2020'
  if (input.proposed.contractType === 'INDEFINITE') {
    return {
      outcome: 'CLEAR',
      ruleVersion,
      chainContractCount: 0,
      chainStartsOn: input.proposed.startsOn,
      reasons: ['CONTRACT_ALREADY_INDEFINITE'],
    }
  }
  if (!input.historyComplete) {
    return {
      outcome: 'INSUFFICIENT_DATA',
      ruleVersion,
      chainContractCount: input.history.length + 1,
      chainStartsOn: input.history[0]?.startsOn ?? input.proposed.startsOn,
      reasons: ['CHAIN_HISTORY_INCOMPLETE'],
    }
  }

  const ordered = [...input.history, input.proposed].sort((left, right) =>
    left.startsOn.localeCompare(right.startsOn),
  )
  const resetMonths = ruleVersion === 'NL_CHAIN_2028' ? 36 : 6
  let chain: TemporaryContractPeriod[] = []
  for (const contract of ordered) {
    const previous = chain.at(-1)
    if (previous?.endsOn && contract.startsOn > addMonths(previous.endsOn, resetMonths)) {
      chain = []
    }
    chain.push(contract)
  }

  const chainStartsOn = chain[0]?.startsOn ?? input.proposed.startsOn
  const exceedsCount = chain.length > 3
  const exceedsDuration =
    input.proposed.endsOn !== null && input.proposed.endsOn > addYears(chainStartsOn, 3)
  const reasons: string[] = []
  if (exceedsCount) reasons.push('CHAIN_CONTRACT_COUNT_EXCEEDED')
  if (exceedsDuration) reasons.push('CHAIN_DURATION_EXCEEDED')
  if (input.exceptionCode) reasons.push('CHAIN_EXCEPTION_REQUIRES_REVIEW')
  if (chain.length === 3 && !exceedsDuration) reasons.push('CHAIN_FINAL_TEMPORARY_CONTRACT')

  return {
    outcome:
      exceedsCount || exceedsDuration
        ? 'LIKELY_INDEFINITE'
        : input.exceptionCode || chain.length === 3
          ? 'ATTENTION'
          : 'CLEAR',
    ruleVersion,
    chainContractCount: chain.length,
    chainStartsOn,
    reasons,
  }
}


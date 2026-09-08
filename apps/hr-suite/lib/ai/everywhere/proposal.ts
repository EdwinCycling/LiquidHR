import { AiExecutionError, type AiResultValidator } from '@/lib/ai/contracts'

export interface AiTextProposal {
  resultType: 'PROPOSAL'
  proposedText: string
  requiresHumanReview: true
}

export function createAiTextProposalValidator(maxCharacters = 12_000): AiResultValidator<AiTextProposal> {
  return {
    validate(output: unknown): AiTextProposal {
      if (typeof output !== 'object' || output === null || Array.isArray(output)) throw new AiExecutionError('INVALID_RESULT')
      const record = output as Record<string, unknown>
      const keys = Object.keys(record).sort().join(',')
      if (keys !== 'proposedText,requiresHumanReview,resultType') throw new AiExecutionError('INVALID_RESULT')
      if (record.resultType !== 'PROPOSAL' || record.requiresHumanReview !== true || typeof record.proposedText !== 'string') throw new AiExecutionError('INVALID_RESULT')
      const proposedText = record.proposedText.trim()
      if (!proposedText || proposedText.length > maxCharacters) throw new AiExecutionError('INVALID_RESULT')
      return { resultType: 'PROPOSAL', proposedText, requiresHumanReview: true }
    },
  }
}

export function createSafeTextProposalValidator(options: { maxCharacters?: number; forbidden?: RegExp } = {}): AiResultValidator<AiTextProposal> {
  const base = createAiTextProposalValidator(options.maxCharacters)
  return {
    validate(output: unknown): AiTextProposal {
      const proposal = base.validate(output)
      if (options.forbidden?.test(proposal.proposedText)) throw new AiExecutionError('INVALID_RESULT')
      return proposal
    },
  }
}

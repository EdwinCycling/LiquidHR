import { z } from 'zod'
import { recruitmentGuidSchema } from './domain'

export const assessmentInputSchema = z.object({
  interviewId: recruitmentGuidSchema,
  scores: z.array(z.object({ characteristicId: recruitmentGuidSchema, score: z.number().int().min(1).max(5), note: z.string().max(2_000).nullable().default(null) }).strict()).max(100),
}).strict()

export function canSeeAssessment(assessment: { readonly status: 'DRAFT' | 'SUBMITTED' | 'CORRECTED'; readonly reviewerEmployeeId: string }, viewerEmployeeId: string): boolean {
  return assessment.reviewerEmployeeId === viewerEmployeeId || assessment.status !== 'DRAFT'
}

export function computeCharacteristicAverages(scores: readonly { readonly characteristicId: string; readonly score: number; readonly status: 'DRAFT' | 'SUBMITTED' | 'CORRECTED' }[]): Array<{ readonly characteristicId: string; readonly average: number; readonly count: number }> {
  const grouped = new Map<string, number[]>()
  for (const score of scores) {
    if (score.status === 'DRAFT') continue
    const current = grouped.get(score.characteristicId) ?? []
    current.push(score.score)
    grouped.set(score.characteristicId, current)
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([characteristicId, values]) => ({ characteristicId, average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10, count: values.length }))
}

export function correctionRevision(current: { readonly id: string; readonly revision: number; readonly status: 'SUBMITTED' | 'CORRECTED' }, reason: string): { readonly correctedFromAssessmentId: string; readonly revision: number; readonly correctionReason: string; readonly status: 'CORRECTED' } {
  if (current.status !== 'SUBMITTED' && current.status !== 'CORRECTED') throw new Error('RECRUITMENT_ASSESSMENT_NOT_SUBMITTED')
  return { correctedFromAssessmentId: current.id, revision: current.revision + 1, correctionReason: reason.trim(), status: 'CORRECTED' }
}

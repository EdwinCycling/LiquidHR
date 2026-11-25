export type RatingInput = { score?: number; ratingExplanation?: string }

/** Valideert uitsluitend de score; bevoegdheid en status vereisen databasecontrole. */
export function validateManagerRating(snapshot: readonly number[] | null, input: RatingInput): string | null {
  if (snapshot === null) return input.score !== undefined || input.ratingExplanation !== undefined ? 'RATING_NOT_ALLOWED' : null
  if (input.score === undefined) return 'RATING_REQUIRED'
  if (!snapshot.includes(input.score)) return 'RATING_INVALID'
  if (!input.ratingExplanation?.trim()) return 'RATING_EXPLANATION_REQUIRED'
  return null
}

export type ReviewPhase = 'WAITING_EMPLOYEE' | 'WAITING_MANAGER' | 'WAITING_ACKNOWLEDGEMENT' | 'COMPLETED_AGREED' | 'COMPLETED_DISAGREED'
export type ReviewAction = 'SUBMIT_SELF' | 'SUBMIT_MANAGER' | 'AGREE' | 'DISAGREE'
export type ReviewActor = 'EMPLOYEE' | 'MANAGER'

/** Aanvullende domeincontrole; de database moet dezelfde overgang atomair afdwingen. */
export function nextPhase(phase: ReviewPhase, actor: ReviewActor, action: ReviewAction): ReviewPhase {
  if (phase === 'WAITING_EMPLOYEE' && actor === 'EMPLOYEE' && action === 'SUBMIT_SELF') return 'WAITING_MANAGER'
  if (phase === 'WAITING_MANAGER' && actor === 'MANAGER' && action === 'SUBMIT_MANAGER') return 'WAITING_ACKNOWLEDGEMENT'
  if (phase === 'WAITING_ACKNOWLEDGEMENT' && actor === 'EMPLOYEE' && action === 'AGREE') return 'COMPLETED_AGREED'
  if (phase === 'WAITING_ACKNOWLEDGEMENT' && actor === 'EMPLOYEE' && action === 'DISAGREE') return 'COMPLETED_DISAGREED'
  throw new Error('TRANSITION_FORBIDDEN')
}

export function publicSubmissionVisible(submitted: boolean, relationship: 'author' | 'other-authorized' | 'unauthorized'): boolean {
  return relationship === 'author' || (relationship === 'other-authorized' && submitted)
}

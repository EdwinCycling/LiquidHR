export type RatingInput = { score?: number; ratingExplanation?: string }

/** Valideert uitsluitend de score; bevoegdheid en status vereisen databasecontrole. */
export function validateManagerRating(snapshot: readonly number[] | null, input: RatingInput): string | null {
  if (snapshot === null) return input.score !== undefined || input.ratingExplanation !== undefined ? 'RATING_NOT_ALLOWED' : null
  if (input.score === undefined) return 'RATING_REQUIRED'
  if (!snapshot.includes(input.score)) return 'RATING_INVALID'
  if (!input.ratingExplanation?.trim()) return 'RATING_EXPLANATION_REQUIRED'
  return null
}

export type ReviewPhase = 'WAITING_EMPLOYEE' | 'WAITING_ADDITIONAL_REVIEWER' | 'WAITING_MANAGER' | 'WAITING_ACKNOWLEDGEMENT' | 'WAITING_REVIEWER_CLOSE' | 'COMPLETED_AGREED' | 'COMPLETED_DISAGREED'
export type ReviewAction = 'SUBMIT_SELF' | 'SUBMIT_ADDITIONAL_REVIEWER' | 'SUBMIT_MANAGER' | 'AGREE' | 'DISAGREE' | 'CLOSE_AGREED' | 'CLOSE_DISAGREED'
export type ReviewActor = 'EMPLOYEE' | 'ADDITIONAL_REVIEWER' | 'MANAGER'

const openReviewPhases: readonly ReviewPhase[] = ['WAITING_EMPLOYEE', 'WAITING_ADDITIONAL_REVIEWER', 'WAITING_MANAGER', 'WAITING_ACKNOWLEDGEMENT', 'WAITING_REVIEWER_CLOSE']

/** Een zachte streefdatum markeert alleen een actieve, nog openstaande actie als te laat. */
export function isSoftDeadlineOverdue(input: { dueDate?: string | null; phase: string; roundStatus?: string | null; today?: string | null }): boolean {
  return Boolean(input.today && input.dueDate && input.dueDate < input.today && input.roundStatus === 'ACTIVE' && openReviewPhases.includes(input.phase as ReviewPhase))
}

/** Aanvullende domeincontrole; de database moet dezelfde overgang atomair afdwingen. */
export function nextPhase(phase: ReviewPhase, actor: ReviewActor, action: ReviewAction, hasAdditionalReviewer = false): ReviewPhase {
  if (phase === 'WAITING_EMPLOYEE' && actor === 'EMPLOYEE' && action === 'SUBMIT_SELF') return hasAdditionalReviewer ? 'WAITING_ADDITIONAL_REVIEWER' : 'WAITING_MANAGER'
  if (phase === 'WAITING_ADDITIONAL_REVIEWER' && actor === 'ADDITIONAL_REVIEWER' && action === 'SUBMIT_ADDITIONAL_REVIEWER') return 'WAITING_MANAGER'
  if (phase === 'WAITING_MANAGER' && actor === 'MANAGER' && action === 'SUBMIT_MANAGER') return 'WAITING_ACKNOWLEDGEMENT'
  if (phase === 'WAITING_ACKNOWLEDGEMENT' && actor === 'EMPLOYEE' && action === 'AGREE') return hasAdditionalReviewer ? 'WAITING_REVIEWER_CLOSE' : 'COMPLETED_AGREED'
  if (phase === 'WAITING_ACKNOWLEDGEMENT' && actor === 'EMPLOYEE' && action === 'DISAGREE') return hasAdditionalReviewer ? 'WAITING_REVIEWER_CLOSE' : 'COMPLETED_DISAGREED'
  if (phase === 'WAITING_REVIEWER_CLOSE' && actor === 'MANAGER' && action === 'CLOSE_AGREED') return 'COMPLETED_AGREED'
  if (phase === 'WAITING_REVIEWER_CLOSE' && actor === 'MANAGER' && action === 'CLOSE_DISAGREED') return 'COMPLETED_DISAGREED'
  throw new Error('TRANSITION_FORBIDDEN')
}

export type ReviewRoleFlipBlock = 'MISSING_ADDITIONAL_REVIEWER' | 'REVIEWER_SUBMITTED' | 'ROUND_CLOSED' | 'INVALID_ASSIGNMENT'

export function reviewRoleFlipBlock(input: {
  additionalReviewerEmployeeId: string | null
  additionalReviewerSubmittedAt: string | null
  managerSubmittedAt: string | null
  roundStatus: string
  employeeId: string
  reviewerEmployeeId: string
}): ReviewRoleFlipBlock | null {
  if (input.roundStatus === 'CLOSED' || input.roundStatus === 'CANCELLED') return 'ROUND_CLOSED'
  if (input.additionalReviewerSubmittedAt || input.managerSubmittedAt) return 'REVIEWER_SUBMITTED'
  if (!input.additionalReviewerEmployeeId) return 'MISSING_ADDITIONAL_REVIEWER'
  if (input.additionalReviewerEmployeeId === input.employeeId || input.reviewerEmployeeId === input.employeeId || input.additionalReviewerEmployeeId === input.reviewerEmployeeId) return 'INVALID_ASSIGNMENT'
  return null
}

export function publicSubmissionVisible(submitted: boolean, relationship: 'author' | 'other-authorized' | 'unauthorized'): boolean {
  return relationship === 'author' || (relationship === 'other-authorized' && submitted)
}

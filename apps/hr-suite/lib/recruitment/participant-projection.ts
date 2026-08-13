interface ProjectionInput {
  readonly status: 'ASSIGNED' | 'ACTIVE' | 'REVOKED'
  readonly applicationState: 'ACTIVE' | 'TERMINAL'
  readonly candidateName: string
  readonly vacancyTitle: string
  readonly ownAssessment: { readonly status: 'DRAFT' | 'SUBMITTED' | 'CORRECTED'; readonly scores: readonly unknown[] } | null
  readonly peerAssessments: readonly { readonly status: 'DRAFT' | 'SUBMITTED' | 'CORRECTED'; readonly scores: readonly unknown[] }[]
}

export function projectParticipantApplication(input: ProjectionInput): { readonly candidateName: string; readonly vacancyTitle: string; readonly ownAssessment: ProjectionInput['ownAssessment']; readonly peerAssessments: ProjectionInput['peerAssessments'] } | null {
  if (input.status === 'REVOKED' || input.applicationState === 'TERMINAL') return null
  const ownSubmitted = input.ownAssessment?.status !== 'DRAFT'
  return {
    candidateName: input.candidateName,
    vacancyTitle: input.vacancyTitle,
    ownAssessment: input.ownAssessment,
    peerAssessments: ownSubmitted ? input.peerAssessments.filter((assessment) => assessment.status !== 'DRAFT') : [],
  }
}

import type {
  ApplicationProjection,
  ParticipantProjection,
  RecruitmentActorContext,
} from './domain'

function sameScope(actor: RecruitmentActorContext, application: ApplicationProjection): boolean {
  return actor.tenantId === application.tenantId && actor.hrGroupId === application.hrGroupId
}

function activeParticipation(
  actor: RecruitmentActorContext,
  application: ApplicationProjection,
  capability: ParticipantProjection['capabilities'][number],
): boolean {
  if (application.state.kind === 'TERMINAL' || !actor.employeeId) return false
  return application.participations.some((participation) =>
    participation.employeeId === actor.employeeId
      && (participation.status === 'ASSIGNED' || participation.status === 'ACTIVE')
      && participation.capabilities.includes(capability),
  )
}

export function canReadApplication(actor: RecruitmentActorContext, application: ApplicationProjection): boolean {
  if (!sameScope(actor, application)) return false
  if (actor.permissions.includes('recruitment-candidate:read')) return true
  return actor.permissions.includes('recruitment-participation:read') && activeParticipation(actor, application, 'APPLICATION_READ')
}

export function canWriteAssessment(actor: RecruitmentActorContext, application: ApplicationProjection): boolean {
  if (!sameScope(actor, application)) return false
  if (actor.permissions.includes('recruitment-assessment:write')) return true
  return actor.permissions.includes('recruitment-participation:write') && activeParticipation(actor, application, 'ASSESSMENT_WRITE')
}

export function revokeParticipationsForTerminalTransition(
  participations: readonly ParticipantProjection[],
): readonly ParticipantProjection[] {
  return participations.map((participation) => ({ ...participation, status: 'REVOKED' as const }))
}

import type { RecruitmentActorContext } from './domain'
import { RecruitmentError } from './errors'
import type { ParticipantApplicationProjection } from './projection-domain'

export interface RecruitmentProjectionRepository {
  participantApplication(actor: RecruitmentActorContext, applicationId: string): Promise<ParticipantApplicationProjection | null>
}

export function createRecruitmentProjectionService(repository: RecruitmentProjectionRepository) {
  return {
    async participantApplication(actor: RecruitmentActorContext, applicationId: string) {
      if (!actor.permissions.includes('recruitment-participation:read')) throw new RecruitmentError('RECRUITMENT_FORBIDDEN', 403)
      const projection = await repository.participantApplication(actor, applicationId)
      if (!projection) throw new RecruitmentError('RECRUITMENT_APPLICATION_NOT_FOUND', 404)
      return projection
    },
  }
}

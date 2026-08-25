import type { JourneyProjection, JourneyTopicOutcomeResult } from './projection-domain'
import { getJourneyProjection, recordJourneyTopicOutcome } from './projection-service'
import type { JourneyRuntimeDetail } from './runtime-service'

export type JourneyParticipantAssignment = JourneyRuntimeDetail['participants'][number]
export type JourneyParticipantProgressInput = Parameters<typeof recordJourneyTopicOutcome>[0]

export interface JourneyParticipantServiceDependencies {
  readProjection: (journeyId: string) => Promise<JourneyProjection>
  recordProgress: (input: JourneyParticipantProgressInput) => Promise<JourneyTopicOutcomeResult>
}

export function createJourneyParticipantService(dependencies: JourneyParticipantServiceDependencies) {
  return {
    getDetail: dependencies.readProjection,
    recordProgress: dependencies.recordProgress,
  }
}

export function listJourneyParticipantAssignments(
  participants: readonly JourneyParticipantAssignment[],
): readonly JourneyParticipantAssignment[] {
  return participants.filter((participant) => participant.status === 'ASSIGNED' || participant.status === 'ACTIVE')
}

export function findJourneyParticipantAssignment(
  participants: readonly JourneyParticipantAssignment[],
  participantId: string,
): JourneyParticipantAssignment | null {
  return listJourneyParticipantAssignments(participants).find((participant) => participant.id === participantId) ?? null
}

const journeyParticipantService = createJourneyParticipantService({ readProjection: getJourneyProjection, recordProgress: recordJourneyTopicOutcome })

export const getJourneyParticipantDetail = journeyParticipantService.getDetail
export const recordJourneyParticipantProgress = journeyParticipantService.recordProgress

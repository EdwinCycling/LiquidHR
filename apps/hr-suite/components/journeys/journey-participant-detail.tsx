import type { Locale } from '@/lib/i18n/config'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyProjection } from '@/lib/journeys/projection-domain'
import type { JourneyParticipantAssignment } from '@/lib/journeys/participant-service'
import { ParticipantDetailClient } from './participant-detail-client'

export type { JourneyParticipantAssignment } from '@/lib/journeys/participant-service'

export type JourneyParticipantDetailLabels = Pick<JourneyLabels,
  'back' | 'participantTitle' | 'participantSubtitle' | 'participantDetailTitle' | 'participantDetailSubtitle' | 'progress' | 'nextAction' | 'available' | 'upcomingTopic' | 'completeTopic' | 'skipTopic' | 'topicDetails' | 'openTopicAction' | 'outcomeSaved' | 'topicActionFailed' | 'timeline' | 'participantsLabel' | 'participantActive' | 'participantAssigned' | 'participantReplaced' | 'participantRemoved' | 'active' | 'planned' | 'paused' | 'completed' | 'cancelled' | 'topicPending' | 'topicCompleted' | 'topicSkipped' | 'topicTypes' | 'statusLabel' | 'hrView' | 'selfView' | 'participantView' | 'noTopics' | 'noParticipants' | 'unknownParticipant'
>

export interface JourneyParticipantDetailProps {
  projection: JourneyProjection
  locale: Locale
  labels: JourneyParticipantDetailLabels
  backHref?: string
  participantAssignments?: readonly JourneyParticipantAssignment[]
  selectedAssignment?: JourneyParticipantAssignment | null
  selectedParticipantId?: string
}

export function JourneyParticipantDetail({ backHref = '/dashboard/start', labels, locale, participantAssignments, projection, selectedAssignment, selectedParticipantId }: JourneyParticipantDetailProps) {
  return <ParticipantDetailClient backHref={backHref} labels={labels} locale={locale} participantAssignments={participantAssignments} projection={projection} selectedAssignment={selectedAssignment} selectedParticipantId={selectedParticipantId} />
}

'use client'

import type { Locale } from '@/lib/i18n/config'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyProjection } from '@/lib/journeys/projection-domain'
import { JourneySteps, type JourneyStepsLabels } from './journey-steps'
import type { JourneyParticipantAssignment } from '@/lib/journeys/participant-service'
import { ParticipantDetailClient } from './participant-detail-client'

export type { JourneyParticipantAssignment } from '@/lib/journeys/participant-service'

export type JourneyParticipantDetailLabels = Pick<JourneyLabels,
  'back' | 'participantTitle' | 'participantSubtitle' | 'participantDetailTitle' | 'participantDetailSubtitle' | 'progress' | 'nextAction' | 'available' | 'upcomingTopic' | 'completeTopic' | 'skipTopic' | 'topicDetails' | 'openTopicAction' | 'outcomeSaved' | 'topicActionFailed' | 'timeline' | 'participantsLabel' | 'participantActive' | 'participantAssigned' | 'participantReplaced' | 'participantRemoved' | 'active' | 'planned' | 'paused' | 'completed' | 'cancelled' | 'topicPending' | 'topicCompleted' | 'topicSkipped' | 'topicTypes' | 'statusLabel' | 'hrView' | 'selfView' | 'participantView' | 'noTopics' | 'noParticipants' | 'unknownParticipant'
>

export type JourneyParticipantStepsProps = {
  projection: JourneyProjection
  locale: Locale
  labels: Pick<JourneyLabels, 'back' | 'participantTitle' | 'participantSubtitle' | 'progress' | 'nextAction' | 'available' | 'upcomingTopic' | 'completeTopic' | 'skipTopic' | 'topicDetails' | 'openTopicAction' | 'outcomeSaved' | 'topicActionFailed' | 'timeline' | 'participantsLabel' | 'active' | 'planned' | 'paused' | 'completed' | 'cancelled' | 'topicPending' | 'topicCompleted' | 'topicSkipped' | 'topicTypes' | 'required' | 'optional' | 'targetEmployee' | 'anchorDate' | 'emptySteps' | 'skipConfirmTitle' | 'skipConfirmDescription' | 'skipConfirm' | 'cancel'>
  backHref?: string
}

export interface JourneyParticipantDetailProps {
  projection: JourneyProjection
  locale: Locale
  labels: JourneyParticipantDetailLabels
  backHref?: string
  participantAssignments?: readonly JourneyParticipantAssignment[]
  selectedAssignment?: JourneyParticipantAssignment | null
  selectedParticipantId?: string
}

export function JourneyParticipantDetail(props: JourneyParticipantDetailProps | JourneyParticipantStepsProps) {
  if ('participantDetailTitle' in props.labels) {
    return <ParticipantDetailClient backHref={props.backHref ?? '/dashboard/start'} labels={props.labels} locale={props.locale} participantAssignments={props.participantAssignments} projection={props.projection} selectedAssignment={props.selectedAssignment} selectedParticipantId={props.selectedParticipantId} />
  }

  const stepLabels: JourneyStepsLabels = {
    ...props.labels,
    title: props.labels.participantTitle,
    subtitle: props.labels.participantSubtitle,
  }
  return <JourneySteps backHref={props.backHref ?? '/dashboard/start'} labels={stepLabels} locale={props.locale} mode="participant" projection={props.projection} />
}

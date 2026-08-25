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
    const detailProps = props as JourneyParticipantDetailProps
    return <ParticipantDetailClient backHref={detailProps.backHref ?? '/dashboard/start'} labels={detailProps.labels} locale={detailProps.locale} participantAssignments={detailProps.participantAssignments} projection={detailProps.projection} selectedAssignment={detailProps.selectedAssignment} selectedParticipantId={detailProps.selectedParticipantId} />
  }

  const stepsProps = props as JourneyParticipantStepsProps
  const stepLabels: JourneyStepsLabels = {
    ...stepsProps.labels,
    title: stepsProps.labels.participantTitle,
    subtitle: stepsProps.labels.participantSubtitle,
  }
  return <JourneySteps backHref={stepsProps.backHref ?? '/dashboard/start'} labels={stepLabels} locale={stepsProps.locale} mode="participant" projection={stepsProps.projection} />
}

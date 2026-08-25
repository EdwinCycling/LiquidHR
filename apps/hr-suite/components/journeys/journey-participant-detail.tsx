'use client'

import type { Locale } from '@/lib/i18n/config'
import type { JourneyLabels } from '@/lib/journeys/labels'
import type { JourneyProjection } from '@/lib/journeys/projection-domain'
import { JourneySteps, type JourneyStepsLabels } from './journey-steps'

interface JourneyParticipantDetailProps {
  projection: JourneyProjection
  locale: Locale
  labels: Pick<JourneyLabels, 'back' | 'participantTitle' | 'participantSubtitle' | 'progress' | 'nextAction' | 'available' | 'upcomingTopic' | 'completeTopic' | 'skipTopic' | 'topicDetails' | 'openTopicAction' | 'outcomeSaved' | 'topicActionFailed' | 'timeline' | 'participantsLabel' | 'active' | 'planned' | 'paused' | 'completed' | 'cancelled' | 'topicPending' | 'topicCompleted' | 'topicSkipped' | 'topicTypes' | 'required' | 'optional' | 'targetEmployee' | 'anchorDate' | 'emptySteps' | 'skipConfirmTitle' | 'skipConfirmDescription' | 'skipConfirm' | 'cancel'>
}

export function JourneyParticipantDetail({ projection, locale, labels }: JourneyParticipantDetailProps) {
  const stepLabels: JourneyStepsLabels = {
    ...labels,
    title: labels.participantTitle,
    subtitle: labels.participantSubtitle,
  }
  return <JourneySteps backHref="/dashboard/start" labels={stepLabels} locale={locale} mode="participant" projection={projection} />
}

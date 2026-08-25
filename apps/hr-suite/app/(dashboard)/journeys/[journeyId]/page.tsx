import { notFound, redirect } from 'next/navigation'
import { JourneyParticipantDetail } from '@/components/journeys/journey-participant-detail'
import { getJourneyProjection, JourneyProjectionServiceError } from '@/lib/journeys'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { AuthorizationError, getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function JourneyDetailPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const journeyId = (await params).journeyId
  const requestContext = await getRequestAuthorizationContext()
  const [labels, locale] = await Promise.all([getJourneyLabels(), getLocale()])
  if (requestContext.context.permissions.includes('journey:read')) redirect(`/journeys/${journeyId}/overview`)

  let projection: Awaited<ReturnType<typeof getJourneyProjection>> | null = null
  try {
    projection = await getJourneyProjection(journeyId)
  } catch (error) {
    if (error instanceof JourneyProjectionServiceError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) notFound()
    throw error
  }
  if (!projection) notFound()

  return <JourneyParticipantDetail locale={locale} projection={projection} labels={{ back: labels.back, participantTitle: labels.participantTitle, participantSubtitle: labels.participantSubtitle, progress: labels.progress, nextAction: labels.nextAction, available: labels.available, upcomingTopic: labels.upcomingTopic, completeTopic: labels.completeTopic, skipTopic: labels.skipTopic, topicDetails: labels.topicDetails, openTopicAction: labels.openTopicAction, outcomeSaved: labels.outcomeSaved, topicActionFailed: labels.topicActionFailed, timeline: labels.timeline, participantsLabel: labels.participantsLabel, active: labels.active, planned: labels.planned, paused: labels.paused, completed: labels.completed, cancelled: labels.cancelled, topicPending: labels.topicPending, topicCompleted: labels.topicCompleted, topicSkipped: labels.topicSkipped, topicTypes: labels.topicTypes, required: labels.required, optional: labels.optional, targetEmployee: labels.targetEmployee, anchorDate: labels.anchorDate, emptySteps: labels.emptySteps, skipConfirmTitle: labels.skipConfirmTitle, skipConfirmDescription: labels.skipConfirmDescription, skipConfirm: labels.skipConfirm, cancel: labels.cancel }} />
}

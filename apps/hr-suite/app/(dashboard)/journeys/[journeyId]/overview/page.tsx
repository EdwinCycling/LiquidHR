import { notFound } from 'next/navigation'
import { JourneyManagementOverview } from '@/components/journeys/journey-management-overview'
import { JourneyParticipantDetail } from '@/components/journeys/journey-participant-detail'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { getRequestUserPreferences } from '@/lib/preferences/server'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'
import { getJourneyProjection, journeyRuntime, JourneyProjectionServiceError, JourneyRuntimeServiceError } from '@/lib/journeys'
import { journeyIdSchema } from '@/lib/journeys/api'

export default async function JourneyManagementOverviewPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const journeyId = (await params).journeyId
  if (!journeyIdSchema.safeParse(journeyId).success) notFound()

  const requestContext = await getRequestAuthorizationContext()
  const [labels, locale, preferences] = await Promise.all([getJourneyLabels(), getLocale(), getRequestUserPreferences()])

  if (!requestContext.context.permissions.includes('journey:read')) {
    let projection: Awaited<ReturnType<typeof getJourneyProjection>> | null = null
    try {
      projection = await getJourneyProjection(journeyId)
    } catch (error) {
      if (error instanceof JourneyProjectionServiceError && error.status === 404) notFound()
      throw error
    }
    if (!projection) notFound()
    return <JourneyParticipantDetail locale={locale} projection={projection} labels={{ back: labels.back, participantTitle: labels.participantTitle, participantSubtitle: labels.participantSubtitle, progress: labels.progress, nextAction: labels.nextAction, available: labels.available, upcomingTopic: labels.upcomingTopic, completeTopic: labels.completeTopic, skipTopic: labels.skipTopic, topicDetails: labels.topicDetails, openTopicAction: labels.openTopicAction, outcomeSaved: labels.outcomeSaved, topicActionFailed: labels.topicActionFailed, timeline: labels.timeline, participantsLabel: labels.participantsLabel, active: labels.active, planned: labels.planned, paused: labels.paused, completed: labels.completed, cancelled: labels.cancelled, topicPending: labels.topicPending, topicCompleted: labels.topicCompleted, topicSkipped: labels.topicSkipped, topicTypes: labels.topicTypes, required: labels.required, optional: labels.optional, targetEmployee: labels.targetEmployee, anchorDate: labels.anchorDate, emptySteps: labels.emptySteps, skipConfirmTitle: labels.skipConfirmTitle, skipConfirmDescription: labels.skipConfirmDescription, skipConfirm: labels.skipConfirm, cancel: labels.cancel }} />
  }

  let detail
  try {
    detail = await journeyRuntime.get(journeyId)
  } catch (error) {
    if (error instanceof JourneyRuntimeServiceError && error.status === 404) notFound()
    throw error
  }
  const options = await requirePermission('journey:write').then(() => journeyRuntime.startOptions()).catch((error: unknown) => {
    if (error instanceof AuthorizationError) return null
    throw error
  })

  return <JourneyManagementOverview canWrite={options !== null} dateFormat={preferences.dateFormat} detail={detail} labels={labels} locale={locale} options={options} />
}

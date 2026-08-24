import { notFound } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { JourneyParticipantDetail } from '@/components/journeys/journey-participant-detail'
import { JourneyProjectionServiceError, JourneyRuntimeServiceError, journeyRuntime } from '@/lib/journeys'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { getJourneyParticipantDetail, findJourneyParticipantAssignment, listJourneyParticipantAssignments } from '@/lib/journeys/participant-service'
import { getLocale } from '@/lib/i18n/server'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'

interface JourneyParticipantsPageProps {
  params: Promise<{ journeyId: string }>
  searchParams: Promise<{ participantId?: string }>
}

function participantLabels(labels: Awaited<ReturnType<typeof getJourneyLabels>>) {
  return {
    back: labels.back,
    participantTitle: labels.participantTitle,
    participantSubtitle: labels.participantSubtitle,
    participantDetailTitle: labels.participantDetailTitle,
    participantDetailSubtitle: labels.participantDetailSubtitle,
    progress: labels.progress,
    nextAction: labels.nextAction,
    available: labels.available,
    upcomingTopic: labels.upcomingTopic,
    completeTopic: labels.completeTopic,
    skipTopic: labels.skipTopic,
    topicDetails: labels.topicDetails,
    openTopicAction: labels.openTopicAction,
    outcomeSaved: labels.outcomeSaved,
    topicActionFailed: labels.topicActionFailed,
    timeline: labels.timeline,
    participantsLabel: labels.participantsLabel,
    participantActive: labels.participantActive,
    participantAssigned: labels.participantAssigned,
    participantReplaced: labels.participantReplaced,
    participantRemoved: labels.participantRemoved,
    active: labels.active,
    planned: labels.planned,
    paused: labels.paused,
    completed: labels.completed,
    cancelled: labels.cancelled,
    topicPending: labels.topicPending,
    topicCompleted: labels.topicCompleted,
    topicSkipped: labels.topicSkipped,
    topicTypes: labels.topicTypes,
    statusLabel: labels.status,
    hrView: labels.hrView,
    selfView: labels.selfView,
    participantView: labels.participantView,
    noTopics: labels.noTopics,
    noParticipants: labels.noParticipants,
    unknownParticipant: labels.unknownParticipant,
  }
}

export default async function JourneyParticipantsPage({ params, searchParams }: JourneyParticipantsPageProps) {
  const { journeyId } = await params
  const query = await searchParams
  const [{ context }, labels, locale] = await Promise.all([getRequestAuthorizationContext(), getJourneyLabels(), getLocale()])
  const projection = await getJourneyParticipantDetail(journeyId).catch((error: unknown) => {
    if (error instanceof JourneyProjectionServiceError && error.status === 404) notFound()
    throw error
  })

  if (!context.permissions.includes('journey:read')) {
    return <PageShell width="standard" className="py-7 lg:py-10"><JourneyParticipantDetail labels={participantLabels(labels)} locale={locale} projection={projection} /></PageShell>
  }

  const detail = await journeyRuntime.get(journeyId).catch((error: unknown) => {
    if (error instanceof JourneyRuntimeServiceError && error.status === 404) notFound()
    throw error
  })
  const assignments = listJourneyParticipantAssignments(detail.participants)
  const selectedAssignment = query.participantId ? findJourneyParticipantAssignment(assignments, query.participantId) : assignments[0] ?? null
  return <PageShell width="standard" className="py-7 lg:py-10"><JourneyParticipantDetail backHref={`/journeys/${journeyId}`} labels={participantLabels(labels)} locale={locale} participantAssignments={assignments} projection={projection} selectedAssignment={selectedAssignment} selectedParticipantId={selectedAssignment?.id} /></PageShell>
}

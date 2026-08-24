import { notFound } from 'next/navigation'
import { JourneySteps, type JourneyStepsLabels } from '@/components/journeys/journey-steps'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { getJourneyProjection, journeyRuntime, JourneyProjectionServiceError, JourneyRuntimeServiceError } from '@/lib/journeys'
import { journeyIdSchema } from '@/lib/journeys/api'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocale } from '@/lib/i18n/server'

export default async function JourneyStepsPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const parsedId = journeyIdSchema.safeParse((await params).journeyId)
  if (!parsedId.success) notFound()
  const journeyId = parsedId.data
  const [labels, locale, requestContext] = await Promise.all([getJourneyLabels(), getLocale(), getRequestAuthorizationContext()])
  const stepLabels: JourneyStepsLabels = { ...labels, title: labels.stepsTitle, subtitle: labels.stepsSubtitle }

  if (requestContext.context.permissions.includes('journey:read')) {
    let detail: Awaited<ReturnType<typeof journeyRuntime.get>>
    try {
      detail = await journeyRuntime.get(journeyId)
    } catch (error) {
      if (error instanceof JourneyRuntimeServiceError && error.status === 404) notFound()
      throw error
    }
    return <JourneySteps backHref={`/journeys/${journeyId}`} detail={detail} labels={stepLabels} locale={locale} mode="management" />
  }

  let projection: Awaited<ReturnType<typeof getJourneyProjection>>
  try {
    projection = await getJourneyProjection(journeyId)
  } catch (error) {
    if (error instanceof JourneyProjectionServiceError && error.status === 404) notFound()
    throw error
  }
  return <JourneySteps backHref="/dashboard/start" labels={stepLabels} locale={locale} mode="participant" projection={projection} />
}

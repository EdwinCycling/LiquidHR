import { JourneyLiveOverview } from '@/components/journeys/journey-live-overview'
import { journeyRuntime, listJourneyProjections } from '@/lib/journeys'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getJourneyLabels } from '@/lib/journeys/labels'
import { getLocale } from '@/lib/i18n/server'

export default async function JourneyLivePage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const requestContext = await getRequestAuthorizationContext()
  const query = await searchParams

  if (!requestContext.context.permissions.includes('journey:read')) {
    const [projections, labels, locale] = await Promise.all([listJourneyProjections(), getJourneyLabels(), getLocale()])
    return <JourneyLiveOverview items={projections} labels={labels} locale={locale} mode="projection" query={query} />
  }
  const [items, labels, locale, canWrite] = await Promise.all([
    journeyRuntime.list(),
    getJourneyLabels(),
    getLocale(),
    requirePermission('journey:write').then(() => true).catch((error: unknown) => {
      if (error instanceof AuthorizationError) return false
      throw error
    }),
  ])

  return <JourneyLiveOverview canWrite={canWrite} items={items} labels={labels} locale={locale} mode="management" query={query} />
}

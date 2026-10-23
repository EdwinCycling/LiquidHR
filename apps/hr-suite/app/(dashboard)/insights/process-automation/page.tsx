import { ProcessAutomationInsightsReport } from '@/components/insights/process-automation-insights-report'
import { AuthorizationError } from '@/lib/auth/permissions'
import { getProcessInsightsReport, parseProcessInsightsQuery, type ProcessInsightsReport } from '@/lib/insights/process-automation-insights'
import { getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

function toSearchParams(values: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry))
    else if (value) params.set(key, value)
  }
  return params
}

export default async function ProcessAutomationInsightsPage({ searchParams }: Props) {
  const [t, rawParams, preferences] = await Promise.all([
    getTranslator('insights'),
    searchParams,
    getUserPreferences(),
  ])
  const query = parseProcessInsightsQuery(toSearchParams(rawParams))
  let report: ProcessInsightsReport | null = null
  let state: 'ready' | 'denied' | 'error' | 'invalid' = query ? 'ready' : 'invalid'
  if (query) {
    try {
      report = await getProcessInsightsReport(query, preferences.locale)
    } catch (error) {
      state = error instanceof AuthorizationError ? 'denied' : 'error'
    }
  }
  const labels = {
    eyebrow: t('processAutomationEyebrow'),
    title: t('processAutomationTitle'),
    description: t('processAutomationDescription'),
    back: t('processAutomationBack'),
    from: t('processAutomationFrom'),
    to: t('processAutomationTo'),
    allProcesses: t('processAutomationAllProcesses'),
    apply: t('processAutomationApply'),
    summary: t('processAutomationSummary'),
    started: t('processAutomationStarted'),
    completed: t('processAutomationCompleted'),
    runningNow: t('processAutomationRunningNow'),
    leadTime: t('processAutomationLeadTime'),
    average: t('processAutomationAverage'),
    median: t('processAutomationMedian'),
    slaPerformance: t('processAutomationSlaPerformance'),
    withinSla: t('processAutomationWithinSla'),
    outsideSla: t('processAutomationOutsideSla'),
    rejected: t('processAutomationRejected'),
    cancelled: t('processAutomationCancelled'),
    comparison: t('processAutomationComparison'),
    process: t('processAutomationProcess'),
    version: t('processAutomationVersion'),
    step: t('processAutomationStep'),
    viewDetails: t('processAutomationViewDetails'),
    bottlenecks: t('processAutomationBottlenecks'),
    waitForFirstClaim: t('processAutomationWaitForFirstClaim'),
    waitSamples: t('processAutomationWaitSamples'),
    awaitingFirstClaim: t('processAutomationAwaitingFirstClaim'),
    repeatedSlaOverrun: t('processAutomationRepeatedSlaOverrun'),
    noSlaData: t('processAutomationNoSlaData'),
    noDurationData: t('processAutomationNoDurationData'),
    noRows: t('processAutomationNoRows'),
    noProcesses: t('processAutomationNoProcesses'),
    emptyTitle: t('processAutomationEmptyTitle'),
    emptyDescription: t('processAutomationEmptyDescription'),
    deniedTitle: t('processAutomationDeniedTitle'),
    deniedDescription: t('processAutomationDeniedDescription'),
    errorTitle: t('processAutomationErrorTitle'),
    errorDescription: t('processAutomationErrorDescription'),
    invalidFilters: t('processAutomationInvalidFilters'),
    pagination: t('processAutomationPagination'),
    previous: t('processAutomationPrevious'),
    next: t('processAutomationNext'),
    pageOf: t('processAutomationPageOf'),
    calculations: t('processAutomationCalculations'),
    periodRule: t('processAutomationPeriodRule'),
    leadRule: t('processAutomationLeadRule'),
    waitRule: t('processAutomationWaitRule'),
    slaRule: t('processAutomationSlaRule'),
    versionRule: t('processAutomationVersionRule'),
    cancelledRejectedRule: t('processAutomationCancelledRejectedRule'),
    durationDays: t('processAutomationDurationDays'),
    durationHours: t('processAutomationDurationHours'),
    durationMinutes: t('processAutomationDurationMinutes'),
    noSampleDetails: t('processAutomationNoSampleDetails'),
  }
  return <ProcessAutomationInsightsReport labels={labels} locale={preferences.locale === 'nl' ? 'nl-NL' : 'en-US'} query={query} report={report} state={state} />
}

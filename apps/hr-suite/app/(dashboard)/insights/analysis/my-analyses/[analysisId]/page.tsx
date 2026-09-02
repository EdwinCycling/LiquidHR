import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/patterns/page-header'
import { PageShell } from '@/components/layout/page-shell'
import { AnalysisExploration } from '@/components/insights/analysis-exploration'
import { AnalysisV2Canvas } from '@/components/insights/analysis-v2-canvas'
import { getTranslator } from '@/lib/i18n/server'
import { requireAnalysisPageAccess } from '@/lib/insights/analysis-page-access'
import { AnalysisEngineError } from '@/lib/insights/analysis-errors'
import { executeSavedAnalysis } from '@/lib/insights/saved-analysis-runtime'
import { SavedAnalysisError } from '@/lib/insights/saved-analysis-errors'

type PageContext = { params: Promise<{ analysisId: string }> }

export default async function SavedAnalysisPage(context: PageContext) {
  await requireAnalysisPageAccess()
  const t = await getTranslator('insights')
  const { analysisId } = await context.params

  let opened: Awaited<ReturnType<typeof executeSavedAnalysis>>
  try {
    opened = await executeSavedAnalysis(analysisId)
  } catch (error) {
    if (error instanceof SavedAnalysisError && error.code === 'SAVED_ANALYSIS_NOT_FOUND') notFound()
    if (error instanceof SavedAnalysisError || error instanceof AnalysisEngineError) {
      return <UnavailableSavedAnalysis t={t} />
    }
    throw error
  }
  const { definition, result } = opened

  if (definition.spec.version === 2) {
    if (result.version !== 2) return <UnavailableSavedAnalysis t={t} />
    return (
      <PageShell className="py-8 lg:py-10">
        <PageHeader
          actions={<Link className="text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/insights/analysis/my-analyses">{t('analysisMyAnalysesBack')}</Link>}
          description={t('analysisSavedDefinitionDescription')}
          title={definition.name}
        />
        <div className="mt-8">
          <AnalysisV2Canvas labels={{
            comparisonHeadcount: t('analysisV2CanvasComparisonHeadcount'),
            department: t('analysisExploreDepartment'),
            delta: t('analysisV2CanvasDelta'),
            deltaPct: t('analysisV2CanvasDeltaPct'),
            employmentType: t('analysisV2CanvasEmploymentType'),
            employmentTypeLabels: {
              APPRENTICE: t('analysisV2EmploymentTypeApprentice'),
              CONTRACTOR: t('analysisV2EmploymentTypeContractor'),
              EMPLOYEE: t('analysisV2EmploymentTypeEmployee'),
              FREELANCER: t('analysisV2EmploymentTypeFreelancer'),
              INTERN: t('analysisV2EmploymentTypeIntern'),
              NO_PAYROLL: t('analysisV2EmploymentTypeNoPayroll'),
              TEMPORARY_AGENCY: t('analysisV2EmploymentTypeTemporaryAgency'),
              VOLUNTEER: t('analysisV2EmploymentTypeVolunteer'),
            },
            headcount: t('analysisCanvasHeadcount'),
            job: t('analysisExploreJob'),
            noResults: t('analysisCanvasNoResults'),
            summary: t('analysisV2CanvasSummary'),
            table: t('analysisCanvasTable'),
            title: t('analysisV2CanvasTitle'),
            unavailable: t('analysisV2CanvasUnavailable'),
            unknown: t('analysisCanvasUnknown'),
          }} result={result} />
        </div>
      </PageShell>
    )
  }
  if (result.version !== 1) return <UnavailableSavedAnalysis t={t} />

  return (
    <PageShell className="py-8 lg:py-10">
      <PageHeader
        actions={<Link className="text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/insights/analysis/my-analyses">{t('analysisMyAnalysesBack')}</Link>}
        description={t('analysisSavedDefinitionDescription')}
        title={definition.name}
      />
      <div className="mt-8">
        <AnalysisExploration labels={{
          back: t('analysisExploreBack'),
          canvas: {
            dimension: t('analysisCanvasDimension'),
            fallback: t('analysisCanvasFallback'),
            headcount: t('analysisCanvasHeadcount'),
            noResults: t('analysisCanvasNoResults'),
            selectRow: t('analysisCanvasSelectRow'),
            summary: t('analysisCanvasSummary'),
            table: t('analysisCanvasTable'),
            title: t('analysisCanvasTitle'),
            unknown: t('analysisCanvasUnknown'),
          },
          compare: t('analysisExploreCompare'),
          compareBreakdown: t('analysisExploreCompareBreakdown'),
          compareDescription: t('analysisExploreCompareDescription'),
          compareFailed: t('analysisExploreCompareFailed'),
          compareLeft: t('analysisExploreCompareLeft'),
          compareNoBreakdown: t('analysisExploreCompareNoBreakdown'),
          compareNotPersisted: t('analysisExploreCompareNotPersisted'),
          compareRight: t('analysisExploreCompareRight'),
          compareTitle: t('analysisExploreCompareTitle'),
          comparing: t('analysisExploreComparing'),
          contextDescription: t('analysisExploreContextDescription'),
          contextTitle: t('analysisExploreContextTitle'),
          department: t('analysisExploreDepartment'),
          difference: t('analysisExploreDifference'),
          drill: t('analysisExploreDrill'),
          drillDescription: t('analysisExploreDrillDescription'),
          drillInto: t('analysisExploreDrillInto'),
          drillTitle: t('analysisExploreDrillTitle'),
          drilling: t('analysisExploreDrilling'),
          employmentStatus: t('analysisExploreEmploymentStatus'),
          job: t('analysisExploreJob'),
          noComparisonOptions: t('analysisExploreNoComparisonOptions'),
          reset: t('analysisExploreReset'),
          workforce: t('analysisExploreWorkforce'),
        }} rootResult={result} rootSpec={definition.spec} />
      </div>
    </PageShell>
  )
}

function UnavailableSavedAnalysis({ t }: { readonly t: (key: string) => string }) {
  return (
    <PageShell className="py-8 lg:py-10">
      <PageHeader
        actions={<Link className="text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/insights/analysis/my-analyses">{t('analysisMyAnalysesBack')}</Link>}
        title={t('analysisSavedUnavailableTitle')}
      />
      <div className="mt-8"><EmptyState description={t('analysisSavedUnavailableDescription')} title={t('analysisSavedUnavailableTitle')} /></div>
    </PageShell>
  )
}

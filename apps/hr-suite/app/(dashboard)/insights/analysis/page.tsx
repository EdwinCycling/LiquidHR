import { AnalysisHub } from '@/components/insights/analysis-hub'
import { getTranslator } from '@/lib/i18n/server'
import { requireAnalysisPageAccess } from '@/lib/insights/analysis-page-access'

export default async function AnalysisPage() {
  await requireAnalysisPageAccess()
  const t = await getTranslator('insights')
  return <AnalysisHub labels={{
    active: t('analysisActive'),
    eyebrow: t('analysisEyebrow'),
    exploreDescription: t('analysisExploreDescription'),
    exploreTitle: t('analysisExploreTitle'),
    intro: t('analysisIntro'),
    myAnalysesDescription: t('analysisMyAnalysesDescription'),
    myAnalysesTitle: t('analysisMyAnalysesTitle'),
    newAnalysisDescription: t('analysisNewDescription'),
    newAnalysisTitle: t('analysisNewTitle'),
    openReports: t('analysisOpenReports'),
    openExplore: t('analysisOpenExplore'),
    openMyAnalyses: t('analysisOpenMyAnalyses'),
    planned: t('analysisPlanned'),
    reportsDescription: t('analysisReportsDescription'),
    reportsTitle: t('analysisReportsTitle'),
    title: t('analysisTitle'),
  }} />
}

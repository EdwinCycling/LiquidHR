import { AnalysisHub } from '@/components/insights/analysis-hub'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { ANALYSIS_PERMISSION } from '@/lib/insights/analysis-contract'
import { getTranslator } from '@/lib/i18n/server'
import { redirect } from 'next/navigation'

export default async function AnalysisPage() {
  try {
    await requirePermission(ANALYSIS_PERMISSION)
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

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
    planned: t('analysisPlanned'),
    reportsDescription: t('analysisReportsDescription'),
    reportsTitle: t('analysisReportsTitle'),
    title: t('analysisTitle'),
  }} />
}

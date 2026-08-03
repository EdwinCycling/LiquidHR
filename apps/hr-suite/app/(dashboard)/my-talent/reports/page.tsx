import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentReportWorkspace } from '@/components/talent/talent-report-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentReport } from '@/lib/talent/report-service'

export default async function MyTalentReportsPage() {
  try { await requirePermission('self:talent-report:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [initial, t] = await Promise.all([listTalentReport('self', { mode: 'self' }), getTranslator('talent')])
  const labels = { title: t('reportTitle'), subtitle: t('reportSelfSubtitle'), export: t('reportExport'), exportFailed: t('reportExportFailed'), goals: t('reportGoals'), capabilities: t('reportCapabilities'), empty: t('reportEmpty'), employee: t('reportEmployee'), goalOrCapability: t('reportGoalOrCapability'), status: t('reportStatus'), progress: t('reportProgress'), period: t('reportPeriod'), validity: t('reportValidity'), type: t('reportType'), source: t('reportSource'), evidence: t('reportEvidence'), level: t('reportLevel'), all: t('reportAll'), loading: t('reportLoading'), current: t('reportCurrent'), history: t('reportHistory'), periodFrom: t('reportPeriodFrom'), periodTo: t('reportPeriodTo'), applyFilters: t('reportApplyFilters'), population: t('reportPopulation') }
  return <section className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/my-talent" backLabel={t('backToMyTalent')} title={t('reportTitle')} subtitle={t('reportSelfSubtitle')} /><TalentReportWorkspace mode="self" initial={initial} labels={labels} /></section>
}

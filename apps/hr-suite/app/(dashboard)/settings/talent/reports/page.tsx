import { redirect } from 'next/navigation'
import { AdminSettingsPageHeader } from '@/components/settings/admin-settings-page-header'
import { TalentReportWorkspace } from '@/components/talent/talent-report-workspace'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listTalentReport } from '@/lib/talent/report-service'

export default async function TalentReportsSettingsPage() {
  try { await requirePermission('talent-report:read') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [initial, t] = await Promise.all([listTalentReport('admin', { mode: 'admin' }), getTranslator('talent')])
  const labels = { title: t('reportTitle'), subtitle: t('reportAdminSubtitle'), export: t('reportExport'), exportFailed: t('reportExportFailed'), goals: t('reportGoals'), capabilities: t('reportCapabilities'), empty: t('reportEmpty'), employee: t('reportEmployee'), goalOrCapability: t('reportGoalOrCapability'), status: t('reportStatus'), progress: t('reportProgress'), period: t('reportPeriod'), validity: t('reportValidity'), type: t('reportType'), source: t('reportSource'), evidence: t('reportEvidence'), level: t('reportLevel'), all: t('reportAll'), loading: t('reportLoading'), current: t('reportCurrent'), history: t('reportHistory'), periodFrom: t('reportPeriodFrom'), periodTo: t('reportPeriodTo'), applyFilters: t('reportApplyFilters'), population: t('reportPopulation') }
  return <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10"><AdminSettingsPageHeader backHref="/settings/talent" backLabel={t('backToTalent')} title={t('reportTitle')} subtitle={t('reportAdminSubtitle')} /><TalentReportWorkspace mode="admin" initial={initial} labels={labels} /></section>
}

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { RecruitmentError } from '@/lib/recruitment/errors'
import { defaultVacancyReportQuery, getRecruitmentVacancyReport, parseVacancyReportQuery, type VacancyReportSearchParams } from '@/lib/recruitment/vacancy-report-service'
import { PageShell } from '@/components/layout/page-shell'
import { RecruitmentVacancyReport } from '@/components/recruitment/vacancy-report'

export default async function RecruitmentVacancyReportPage({ params, searchParams }: { readonly params: Promise<{ vacancyId: string }>; readonly searchParams: Promise<VacancyReportSearchParams> }) {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:read')
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ vacancyId }, rawSearchParams, t] = await Promise.all([params, searchParams, getTranslator('recruitment')])
  let query = defaultVacancyReportQuery()
  try {
    query = parseVacancyReportQuery(rawSearchParams)
  } catch {
    // A malformed URL should still render the safe unfiltered report view.
  }
  const { context, supabase } = await getRequestAuthorizationContext()
  let report
  try {
    report = await getRecruitmentVacancyReport(context, vacancyId, query, supabase)
  } catch (error) {
    if (error instanceof RecruitmentError && error.status === 404) notFound()
    throw error
  }

  return <main><PageShell className="py-8" width="standard"><Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/recruitment/vacancies/${vacancyId}`}>{t('report.back')}</Link><header className="mt-6"><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{report.vacancy.title}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t('report.title')} · {t('report.description')}</p></header><RecruitmentVacancyReport initial={report} labels={{ title: t('report.title'), description: t('report.description'), back: t('report.back'), filters: t('report.filters'), periodFrom: t('report.periodFrom'), periodTo: t('report.periodTo'), status: t('report.status'), allStatuses: t('report.allStatuses'), activeStatus: t('report.activeStatus'), rejectedStatus: t('report.rejectedStatus'), hiredStatus: t('report.hiredStatus'), stage: t('report.stage'), allStages: t('report.allStages'), source: t('report.source'), allSources: t('report.allSources'), manualSource: t('report.manualSource'), publicSource: t('report.publicSource'), applyFilters: t('report.applyFilters'), resetFilters: t('report.resetFilters'), activeFilters: t('report.activeFilters'), loading: t('report.loading'), loadFailed: t('report.loadFailed'), totalApplications: t('report.totalApplications'), activeApplications: t('report.activeApplications'), hiredApplications: t('report.hiredApplications'), rejectedApplications: t('report.rejectedApplications'), conversionRate: t('report.conversionRate'), statuses: t('report.statuses'), sources: t('report.sources'), applications: t('report.applications'), noApplications: t('report.noApplications'), noResults: t('report.noResults'), unassigned: t('report.unassigned'), outcomeRejected: t('report.outcomeRejected'), outcomeHired: t('report.outcomeHired'), vacancyDraft: t('report.vacancyDraft'), vacancyActive: t('report.vacancyActive'), vacancyClosed: t('report.vacancyClosed'), vacancyArchived: t('report.vacancyArchived'), notAvailable: t('report.notAvailable') }} /></PageShell></main>
}

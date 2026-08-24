import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { RecruitmentOverviewDashboard } from '@/components/recruitment/recruitment-overview-dashboard'
import { getRecruitmentOverview, getRecruitmentOverviewCapabilities, type RecruitmentOverviewData } from '@/lib/recruitment/overview-service'

export default async function RecruitmentOverviewPage() {
  try {
    await requireTenantModule('RECRUITMENT')
    await requireAnyPermission([
      'recruitment-vacancy:read',
      'recruitment-candidate:read',
      'recruitment-assessment:read',
      'recruitment-settings:manage',
    ])
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const [{ context, supabase }, t] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment')])
  const capabilities = getRecruitmentOverviewCapabilities(context.permissions)
  let overview: RecruitmentOverviewData = { vacancies: [], analytics: null, analyticsError: false }
  let loadError = false

  try {
    overview = await getRecruitmentOverview(context, supabase)
  } catch {
    loadError = true
  }

  return (
    <RecruitmentOverviewDashboard
      analytics={overview.analytics}
      analyticsError={overview.analyticsError}
      canCreateVacancy={capabilities.canCreateVacancy}
      canManageSettings={capabilities.canManageSettings}
      canReadAssigned={capabilities.canReadAssigned}
      loadError={loadError}
      vacancies={overview.vacancies}
      labels={{
        eyebrow: t('eyebrow'),
        title: t('overview.title'),
        description: t('overview.description'),
        newVacancy: t('overview.newVacancy'),
        summaryTitle: t('overview.summaryTitle'),
        vacancies: t('overview.vacancies'),
        openVacancies: t('overview.openVacancies'),
        activeApplications: t('overview.activeApplications'),
        newApplications: t('overview.newApplications'),
        applications: t('overview.applications'),
        open: t('overview.open'),
        draft: t('overview.draft'),
        closed: t('overview.closed'),
        archived: t('overview.archived'),
        vacancyListTitle: t('overview.vacancyListTitle'),
        vacancyListDescription: t('overview.vacancyListDescription'),
        pipelineTitle: t('overview.pipelineTitle'),
        pipelineDescription: t('overview.pipelineDescription'),
        openPipeline: t('overview.openPipeline'),
        openApplications: t('overview.openApplications'),
        noApplications: t('overview.noApplications'),
        hiredCount: t('overview.hiredCount'),
        rejectedCount: t('overview.rejectedCount'),
        settings: t('overview.settings'),
        assigned: t('overview.assigned'),
        empty: t('overview.empty'),
        emptyDescription: t('overview.emptyDescription'),
        noCandidateAccess: t('overview.noCandidateAccess'),
        analyticsUnavailable: t('overview.analyticsUnavailable'),
        loadErrorTitle: t('overview.loadErrorTitle'),
        loadErrorDescription: t('overview.loadErrorDescription'),
        retry: t('overview.retry'),
        notAvailable: t('overview.notAvailable'),
      }}
    />
  )
}

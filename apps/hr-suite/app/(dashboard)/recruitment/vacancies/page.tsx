import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { RecruitmentVacancyList } from '@/components/recruitment/recruitment-vacancy-list'
import { buttonClasses } from '@/components/ui/button'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { listRecruitmentVacancyPage, parseRecruitmentVacancyListQuery } from '@/lib/recruitment/vacancy-service'

interface RecruitmentVacanciesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function authorizeRecruitmentVacancyList() {
  try {
    await requireTenantModule('RECRUITMENT')
    return await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read'])
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
}

export default async function RecruitmentVacanciesPage({ searchParams }: RecruitmentVacanciesPageProps) {
  const authContext = await authorizeRecruitmentVacancyList()

  const [requestContext, t, locale, rawSearchParams] = await Promise.all([
    getRequestAuthorizationContext(),
    getTranslator('recruitment'),
    getLocale(),
    searchParams,
  ])
  const query = parseRecruitmentVacancyListQuery(rawSearchParams)
  const result = await listRecruitmentVacancyPage(authContext, requestContext.supabase, query)
  const canWrite = authContext.permissions.includes('recruitment-vacancy:write')

  return (
    <PageShell className="py-6 lg:py-8" width="standard">
      <PageHeader
        actions={canWrite ? <Link className={buttonClasses({ className: 'gap-2' })} href="/recruitment/vacancies/new"><Plus aria-hidden="true" />{t('vacancies.newVacancy')}</Link> : undefined}
        description={t('vacancies.description')}
        title={t('vacancies.title')}
      />
      <RecruitmentVacancyList
        canWrite={canWrite}
        labels={{
          search: t('vacancies.search'),
          searchPlaceholder: t('vacancies.searchPlaceholder'),
          applyFilters: t('vacancies.applyFilters'),
          clearFilters: t('vacancies.clearFilters'),
          status: t('vacancies.status'),
          allStatuses: t('vacancies.allStatuses'),
          statuses: {
            DRAFT: t('vacancies.statuses.DRAFT'),
            ACTIVE: t('vacancies.statuses.ACTIVE'),
            CLOSED: t('vacancies.statuses.CLOSED'),
            ARCHIVED: t('vacancies.statuses.ARCHIVED'),
          },
          publication: t('vacancies.publication'),
          allPublications: t('vacancies.allPublications'),
          publications: {
            UNPUBLISHED: t('vacancies.publications.UNPUBLISHED'),
            OPEN: t('vacancies.publications.OPEN'),
            CLOSED: t('vacancies.publications.CLOSED'),
            ARCHIVED: t('vacancies.publications.ARCHIVED'),
          },
          sort: t('vacancies.sort'),
          sorts: {
            UPDATED_DESC: t('vacancies.sorts.UPDATED_DESC'),
            TITLE_ASC: t('vacancies.sorts.TITLE_ASC'),
            APPLICATIONS_DESC: t('vacancies.sorts.APPLICATIONS_DESC'),
          },
          resultCount: t('vacancies.resultCount', { count: result.total }),
          updated: t('vacancies.updated'),
          applications: t('vacancies.applications'),
          activeApplications: t('vacancies.activeApplications'),
          workModes: {
            ON_SITE: t('vacancies.workModes.ON_SITE'),
            HYBRID: t('vacancies.workModes.HYBRID'),
            REMOTE: t('vacancies.workModes.REMOTE'),
          },
          notSet: t('vacancies.notSet'),
          edit: t('vacancies.edit'),
          view: t('vacancies.view'),
          emptyTitle: t('vacancies.emptyTitle'),
          emptyDescription: t('vacancies.emptyDescription'),
          noResultsTitle: t('vacancies.noResultsTitle'),
          noResultsDescription: t('vacancies.noResultsDescription'),
          newVacancy: t('vacancies.newVacancy'),
          previousPage: t('vacancies.previousPage'),
          nextPage: t('vacancies.nextPage'),
          pageOf: t('vacancies.pageOf'),
        }}
        locale={locale}
        query={query}
        result={result}
      />
    </PageShell>
  )
}

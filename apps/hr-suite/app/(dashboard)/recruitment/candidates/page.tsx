import { notFound, redirect } from 'next/navigation'
import { RecruitmentCandidateIndex } from '@/components/recruitment/recruitment-candidate-index'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { candidateIndexQueryParams, listRecruitmentCandidateIndex, parseCandidateIndexQuery } from '@/lib/recruitment/candidate-service'

interface RecruitmentCandidatesPageProps {
  readonly searchParams: Promise<{ q?: string; state?: string; vacancy?: string; stage?: string; sort?: string; page?: string }>
}

function toUrlSearchParams(values: Awaited<RecruitmentCandidatesPageProps['searchParams']>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (typeof value === 'string') params.set(key, value)
  return params
}

export default async function RecruitmentCandidatesPage({ searchParams }: RecruitmentCandidatesPageProps) {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:read')
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const rawParams = await searchParams
  const query = parseCandidateIndexQuery(toUrlSearchParams(rawParams))
  const [{ context, supabase }, t, locale] = await Promise.all([
    getRequestAuthorizationContext(),
    getTranslator('recruitment'),
    getLocale(),
  ])
  const data = await listRecruitmentCandidateIndex(context, query, supabase)

  return (
    <RecruitmentCandidateIndex
      data={data}
      labels={{
        title: t('candidates.title'),
        description: t('candidates.description'),
        search: t('candidates.search'),
        searchPlaceholder: t('candidates.searchPlaceholder'),
        filters: t('candidates.filters'),
        state: t('candidates.state'),
        allStates: t('candidates.allStates'),
        active: t('candidates.active'),
        accepted: t('candidates.accepted'),
        rejected: t('candidates.rejected'),
        vacancy: t('candidates.vacancy'),
        allVacancies: t('candidates.allVacancies'),
        stage: t('candidates.stage'),
        allStages: t('candidates.allStages'),
        sort: t('candidates.sort'),
        recent: t('candidates.recent'),
        name: t('candidates.name'),
        applyFilters: t('candidates.applyFilters'),
        clear: t('candidates.clear'),
        candidate: t('candidates.candidate'),
        applications: t('candidates.applications'),
        lastActivity: t('candidates.lastActivity'),
        contact: t('candidates.contact'),
        source: t('candidates.source'),
        manual: t('candidates.manual'),
        public: t('candidates.public'),
        noStage: t('candidates.noStage'),
        noContact: t('candidates.noContact'),
        noApplications: t('candidates.noApplications'),
        possibleDuplicate: t('candidates.possibleDuplicate'),
        noResultsTitle: t('candidates.noResultsTitle'),
        noResultsDescription: t('candidates.noResultsDescription'),
        noResultsClear: t('candidates.noResultsClear'),
        applicationCount: (count) => t(count === 1 ? 'candidates.applicationCountOne' : 'candidates.applicationCountMany', { count }),
        resultRange: (from, to, total) => t('candidates.resultRange', { from, to, total }),
        perPage: (count) => t('candidates.perPage', { count }),
        openApplication: (candidate, vacancy) => t('candidates.openApplication', { candidate, vacancy }),
        previous: t('candidates.previous'),
        next: t('candidates.next'),
        pagination: t('candidates.pagination'),
      }}
      locale={locale}
      query={query}
      queryString={candidateIndexQueryParams(query).toString()}
    />
  )
}

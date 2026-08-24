import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/page-header'
import { RecruitmentVacancyPipeline } from '@/components/recruitment/recruitment-vacancy-pipeline'
import { buttonClasses } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { AuthorizationError, getRequestAuthorizationContext, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { listRecruitmentVacancyPipeline } from '@/lib/recruitment/application-service'
import { RecruitmentError } from '@/lib/recruitment/errors'

export default async function RecruitmentVacancyCandidatesPage({ params }: { readonly params: Promise<{ vacancyId: string }> }) {
  try {
    await requireTenantModule('RECRUITMENT')
    await requirePermission('recruitment-candidate:read')
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }

  const { vacancyId } = await params
  const [{ context, supabase }, t] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment')])
  let pipeline
  try {
    pipeline = await listRecruitmentVacancyPipeline(context, vacancyId, supabase)
  } catch (error) {
    if (error instanceof RecruitmentError && error.status === 404) notFound()
    throw error
  }

  return <PageShell className="py-8 lg:py-10" width="wide">
    <PageHeader actions={<Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/recruitment/vacancies/${vacancyId}`}>{t('pipeline.back')}</Link>} description={t('pipeline.description')} title={pipeline.vacancyTitle} />
    <div className="mt-6">
      <RecruitmentVacancyPipeline labels={{
        title: t('pipeline.title'), description: t('pipeline.description'), total: t('pipeline.total'), active: t('pipeline.active'), terminal: t('pipeline.terminal'),
        filter: t('pipeline.filter'), allStages: t('pipeline.allStages'), terminalRejected: t('pipeline.terminalRejected'), terminalHired: t('pipeline.terminalHired'), empty: t('pipeline.empty'),
        source: t('pipeline.source'), manualSource: t('pipeline.manualSource'), publicSource: t('pipeline.publicSource'), stage: t('pipeline.stage'), move: t('pipeline.move'), reject: t('pipeline.reject'),
        hire: t('pipeline.hire'), actionFailed: t('pipeline.actionFailed'), conflict: t('pipeline.conflict'), invalidTransition: t('pipeline.invalidTransition'), moved: t('pipeline.moved'), rejected: t('pipeline.rejected'),
      }} pipeline={pipeline} />
    </div>
  </PageShell>
}

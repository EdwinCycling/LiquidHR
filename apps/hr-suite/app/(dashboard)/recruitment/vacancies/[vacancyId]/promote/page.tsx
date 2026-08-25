import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { PublicationPanel } from '@/components/recruitment/publication-panel'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancy } from '@/lib/recruitment/vacancy-service'
import { createClient } from '@/lib/supabase/server'

async function authorizePromotePage(): Promise<Awaited<ReturnType<typeof requirePermission>>> {
  try {
    await requireTenantModule('RECRUITMENT')
    return await requirePermission('recruitment-vacancy:publish')
  } catch (error) {
    if (error instanceof ModuleError && error.status === 404) notFound()
    if (error instanceof AuthorizationError) redirect('/geen-toegang')
    throw error
  }
}

export default async function RecruitmentVacancyPromotePage({ params }: { readonly params: Promise<{ vacancyId: string }> }) {
  const context = await authorizePromotePage()
  const { vacancyId } = await params
  const [vacancy, t] = await Promise.all([getRecruitmentVacancy(context, vacancyId, await createClient()), getTranslator('recruitment')])
  if (!vacancy) notFound()
  return <PageShell className="py-8 lg:py-10" width="standard"><PageHeader actions={<Link className="button-secondary" href={`/recruitment/vacancies/${vacancy.id}`}>{t('promote.back')}</Link>} description={t('promote.description')} title={t('promote.title')} /><div className="mt-8"><PublicationPanel vacancyId={vacancy.id} vacancyStatus={vacancy.status} vacancyTitle={vacancy.title} sections={vacancy.sections} publication={vacancy.publication} labels={{ title: t('promote.configurationTitle'), description: t('promote.configurationDescription'), status: t('promote.status'), draft: t('promote.draft'), active: t('promote.active'), closed: t('promote.closed'), archived: t('promote.archived'), previewTitle: t('promote.previewTitle'), previewDescription: t('promote.previewDescription'), emptySection: t('promote.emptySection'), formTitle: t('promote.formTitle'), phone: t('promote.phone'), cv: t('promote.cv'), motivation: t('promote.motivation'), hidden: t('promote.hidden'), optional: t('promote.optional'), required: t('promote.required'), slug: t('promote.slug'), save: t('promote.save'), saving: t('promote.saving'), saved: t('promote.saved'), openConfigurationNotice: t('promote.openConfigurationNotice'), configurationRequiresPublication: t('promote.configurationRequiresPublication'), actionsTitle: t('promote.actionsTitle'), actionsDescription: t('promote.actionsDescription'), publish: t('promote.publish'), close: t('promote.close'), archive: t('promote.archive'), publicLink: t('promote.publicLink'), archivedNotice: t('promote.archivedNotice'), error: t('promote.error'), confirmPublishTitle: t('promote.confirmPublishTitle'), confirmPublishDescription: t('promote.confirmPublishDescription'), confirmCloseTitle: t('promote.confirmCloseTitle'), confirmCloseDescription: t('promote.confirmCloseDescription'), confirmArchiveTitle: t('promote.confirmArchiveTitle'), confirmArchiveDescription: t('promote.confirmArchiveDescription'), confirm: t('promote.confirm'), cancel: t('promote.cancel') }} /></div></PageShell>
}

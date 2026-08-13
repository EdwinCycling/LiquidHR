import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancy } from '@/lib/recruitment/vacancy-service'
import { listRecruitmentApplications } from '@/lib/recruitment/application-service'
import { ManualApplicationForm } from '@/components/recruitment/manual-application-form'
import { PipelineBoard } from '@/components/recruitment/pipeline-board'
import { PublicationPanel } from '@/components/recruitment/publication-panel'

export default async function RecruitmentVacancyDetailPage({ params }: { readonly params: Promise<{ vacancyId: string }> }) {
  try { await requireTenantModule('RECRUITMENT'); await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read']) } catch (error) { if (error instanceof ModuleError && error.status === 404) notFound(); if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const { vacancyId } = await params
  const [{ context, supabase }, t] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment')])
  const vacancy = await getRecruitmentVacancy(context, vacancyId, supabase)
  if (!vacancy) notFound()
  const applications = await listRecruitmentApplications(context, vacancy.id, supabase)
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{vacancy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{vacancy.locationLabel ?? '—'} · {vacancy.activeApplicationCount} {t('overview.openApplications')}</p></div><Link className="button-secondary" href={`/recruitment/vacancies/${vacancy.id}/edit`}>{t('vacancy.editTitle')}</Link></div><div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-6"><PipelineBoard applications={applications} labels={{ title: t('pipeline.title'), allStages: t('pipeline.allStages'), empty: t('pipeline.empty'), candidate: t('pipeline.candidate'), stage: t('pipeline.stage'), source: t('pipeline.source'), possibleDuplicate: t('pipeline.possibleDuplicate'), move: t('pipeline.move'), reject: t('pipeline.reject'), reopen: t('pipeline.reopen'), hire: t('pipeline.hire') }} /><ManualApplicationForm vacancyId={vacancy.id} labels={{ title: t('manual.title'), firstName: t('manual.firstName'), lastName: t('manual.lastName'), email: t('manual.email'), phone: t('manual.phone'), motivation: t('manual.motivation'), save: t('manual.save'), saving: t('manual.saving'), saved: t('manual.saved'), error: t('manual.error') }} /></div><PublicationPanel vacancyId={vacancy.id} vacancyTitle={vacancy.title} sections={vacancy.sections} publication={vacancy.publication} labels={{ title: t('vacancy.publication'), publish: t('vacancy.publish'), close: t('vacancy.close'), archive: t('vacancy.archive'), formTitle: t('vacancy.formTitle'), phone: t('vacancy.phone'), cv: t('vacancy.cv'), motivation: t('vacancy.motivation'), hidden: t('vacancy.hidden'), optional: t('vacancy.optional'), required: t('vacancy.required'), save: t('vacancy.save'), slug: t('vacancy.slug'), publicLink: t('vacancy.publicLink'), error: t('vacancy.error') }} /></div></div>
}

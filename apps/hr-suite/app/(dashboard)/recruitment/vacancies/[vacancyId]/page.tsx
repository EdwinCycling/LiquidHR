import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { getRecruitmentVacancy } from '@/lib/recruitment/vacancy-service'
import { listRecruitmentApplications } from '@/lib/recruitment/application-service'
import { ManualApplicationForm } from '@/components/recruitment/manual-application-form'
import { PipelineBoard } from '@/components/recruitment/pipeline-board'

export default async function RecruitmentVacancyDetailPage({ params }: { readonly params: Promise<{ vacancyId: string }> }) {
  try { await requireTenantModule('RECRUITMENT'); await requireAnyPermission(['recruitment-vacancy:read', 'recruitment-candidate:read']) } catch (error) { if (error instanceof ModuleError && error.status === 404) notFound(); if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const { vacancyId } = await params
  const [{ context, supabase }, t] = await Promise.all([getRequestAuthorizationContext(), getTranslator('recruitment')])
  const vacancy = await getRecruitmentVacancy(context, vacancyId, supabase)
  if (!vacancy) notFound()
  const applications = await listRecruitmentApplications(context, vacancy.id, supabase)
  const canPublish = context.permissions.includes('recruitment-vacancy:publish')
  return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">{t('eyebrow')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{vacancy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{vacancy.locationLabel ?? '—'} · {vacancy.activeApplicationCount} {t('overview.openApplications')}</p></div><div className="flex flex-wrap gap-2"><Link className="button-secondary" href={`/recruitment/vacancies/${vacancy.id}/edit`}>{t('vacancy.editTitle')}</Link>{canPublish ? <Link className="button-primary" href={`/recruitment/vacancies/${vacancy.id}/promote`}>{t('promote.open')}</Link> : null}</div></div><div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="space-y-6"><PipelineBoard applications={applications} labels={{ title: t('pipeline.title'), allStages: t('pipeline.allStages'), empty: t('pipeline.empty'), candidate: t('pipeline.candidate'), stage: t('pipeline.stage'), source: t('pipeline.source'), possibleDuplicate: t('pipeline.possibleDuplicate'), move: t('pipeline.move'), reject: t('pipeline.reject'), reopen: t('pipeline.reopen'), hire: t('pipeline.hire') }} /><ManualApplicationForm vacancyId={vacancy.id} labels={{ title: t('manual.title'), firstName: t('manual.firstName'), lastName: t('manual.lastName'), email: t('manual.email'), phone: t('manual.phone'), motivation: t('manual.motivation'), save: t('manual.save'), saving: t('manual.saving'), saved: t('manual.saved'), error: t('manual.error') }} /></div></div></div>
}

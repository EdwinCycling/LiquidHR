import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { listRecruitmentVacancies } from '@/lib/recruitment/vacancy-service'

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
  const vacancies = await listRecruitmentVacancies(context, supabase)
  const openVacancies = vacancies.filter((vacancy) => vacancy.status === 'ACTIVE').length
  const openApplications = vacancies.reduce((total, vacancy) => total + vacancy.activeApplicationCount, 0)
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('overview.title')}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('overview.description')}</p>
        </div>
        <Link className="button-primary" href="/recruitment/vacancies/new">{t('overview.newVacancy')}</Link>
      </header>
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-surface p-5"><p className="text-sm text-muted-foreground">{t('overview.vacancies')}</p><p className="mt-2 text-3xl font-semibold">{vacancies.length}</p></div>
        <div className="rounded-xl border bg-surface p-5"><p className="text-sm text-muted-foreground">{t('overview.open')}</p><p className="mt-2 text-3xl font-semibold">{openVacancies}</p></div>
        <div className="rounded-xl border bg-surface p-5"><p className="text-sm text-muted-foreground">{t('overview.applications')}</p><p className="mt-2 text-3xl font-semibold">{openApplications}</p></div>
      </section>
      <section className="mt-8 rounded-xl border bg-surface">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">{t('overview.vacancies')}</h2></div>
        {vacancies.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{t('overview.empty')}</p> : <div className="divide-y">{vacancies.map((vacancy) => <Link className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 transition hover:bg-muted/30" href={`/recruitment/vacancies/${vacancy.id}`} key={vacancy.id}><div><p className="font-semibold">{vacancy.title}</p><p className="mt-1 text-sm text-muted-foreground">{vacancy.locationLabel ?? '—'} · {vacancy.activeApplicationCount} {t('overview.openApplications')}</p></div><div className="flex items-center gap-3 text-sm"><span className="rounded-full border px-2.5 py-1">{vacancy.publication?.status === 'OPEN' ? t('overview.open') : vacancy.status === 'DRAFT' ? t('overview.draft') : t('overview.closed')}</span><span className="font-semibold text-primary">{t('overview.view')}</span></div></Link>)}</div>}
      </section>
    </div>
  )
}

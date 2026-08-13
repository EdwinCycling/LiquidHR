import { notFound, redirect } from 'next/navigation'
import { AuthorizationError, requireAnyPermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { ModuleError, requireTenantModule } from '@/lib/modules/module-service'

export default async function RecruitmentFoundationPage() {
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
  const t = await getTranslator('recruitment')
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-10">
      <header>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('foundationTitle')}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t('foundationDescription')}</p>
      </header>
      <section className="mt-8 rounded-2xl border bg-surface p-6">
        <h2 className="font-semibold">{t('foundationReadyTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('foundationReadyDescription')}</p>
      </section>
    </div>
  )
}

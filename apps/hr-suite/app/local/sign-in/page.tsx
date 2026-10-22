import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isLocalPersonaRuntime } from '@/lib/auth/test-role-switch'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { buttonClasses } from '@/components/ui/button'
import { getTranslator } from '@/lib/i18n/server'
export default async function LocalSignInPage() {
  if(!isLocalPersonaRuntime((await headers()).get('host')))notFound()
  const t = await getTranslator('auth')
  return <PageShell className="space-y-5 py-8">
    <PageHeader title={t('localSignInTitle')} description={t('localSignInDescription')} />
    <form action="/api/local/sign-in" method="post">
      <input name="account" value="hr-admin" type="hidden" />
      <button data-testid="test-login-hr-admin" className={buttonClasses({variant:'primary',size:'md'})} type="submit">{t('localSignInHrAdmin')}</button>
    </form>
    <a href="/login">{t('localSignInNormal')}</a>
  </PageShell>
}

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isLocalPersonaRuntime } from '@/lib/auth/test-role-switch'
import { getLocalTestSignInOptions } from '@/lib/auth/local-test-personas'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { buttonClasses } from '@/components/ui/button'
import { getTranslator } from '@/lib/i18n/server'

export default async function LocalSignInPage() {
  if (!isLocalPersonaRuntime((await headers()).get('host'))) notFound()

  const t = await getTranslator('auth')
  const personaOptions = getLocalTestSignInOptions()

  return (
    <PageShell className="space-y-5 py-8">
      <PageHeader title={t('localSignInTitle')} description={t('localSignInDescription')} />
      <div className="flex flex-wrap gap-3">
        {personaOptions.map((persona) => persona.configured ? (
          <form action="/api/local/sign-in" method="post" key={persona.key}>
            <input name="account" value={persona.key} type="hidden" />
            <button
              data-testid={'test-login-' + persona.key}
              className={buttonClasses({ variant: 'primary', size: 'md' })}
              type="submit"
            >
              {t(persona.labelKey)}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid={'test-login-unavailable-' + persona.key} key={persona.key}>
            {t(persona.unavailableKey)}
          </p>
        ))}
      </div>
      <a href="/login">{t('localSignInNormal')}</a>
    </PageShell>
  )
}

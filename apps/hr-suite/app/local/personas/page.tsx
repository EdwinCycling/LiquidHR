import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { LocalPersonaSwitcher, type LocalPersonaOption } from '@/components/auth/local-persona-switcher'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { canInitiateTestRoleSwitch, canReturnToLocalPersonaOwner, canUseLocalPersonaSwitcher, isLocalPersonaRuntime, TEST_ROLE_SWITCH_TARGETS } from '@/lib/auth/test-role-switch'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

const PERSONA_LABEL_KEYS = {
  edwin: 'localPersonaEdwin',
  'hr-admin': 'localPersonaHrAdmin',
  manager: 'localPersonaManager',
  employee: 'localPersonaEmployee',
  'payroll-lisa': 'localPersonaPayrollLisa',
  'payroll-jaap': 'localPersonaPayrollJaap',
  'payroll-frits': 'localPersonaPayrollFrits',
} as const

export default async function LocalPersonasPage() {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  if (!isLocalPersonaRuntime(host)) notFound()

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const identity = {
    email: typeof claims?.email === 'string' ? claims.email : null,
    emailVerified: claims?.email_verified === true,
  }
  const isOwner = !claimsError && Boolean(claims?.sub) && canUseLocalPersonaSwitcher(host, identity)
  const canReturnToOwner = !claimsError && Boolean(claims?.sub) && canReturnToLocalPersonaOwner(host, identity)
  if (!isOwner && !canReturnToOwner) notFound()

  const t = await getTranslator('navigation')
  const roleCodes = await (async (): Promise<string[] | null> => {
    if (!isOwner || !claims?.sub) return null
    try {
      const requestContext = await getRequestAuthorizationContext()
      return requestContext.context.userId === claims.sub ? [...requestContext.context.activeRoles] : null
    } catch {
      return null
    }
  })()
  const options: LocalPersonaOption[] = TEST_ROLE_SWITCH_TARGETS.map((target) => ({
    ...target,
    label: t(PERSONA_LABEL_KEYS[target.key]),
    availabilityLabel: target.available ? undefined : t('localPersonaUnavailable'),
  }))
  const roleGuardAllowed = canInitiateTestRoleSwitch(roleCodes ?? [])

  return <PageShell className="mx-auto w-full max-w-3xl space-y-6 py-6 sm:py-10">
    <PageHeader title={t('localPersonaTitle')} description={t('localPersonaDescription')} />
    <Surface className="space-y-2 border border-info-border bg-info-surface p-4 sm:p-5">
      <p className="text-sm font-medium text-foreground">{t('localPersonaScopeNotice')}</p>
      <p className="text-sm text-muted-foreground">{t('localPersonaRightsNotice')}</p>
    </Surface>
    {isOwner ? <Surface aria-label={t('localPersonaAccessStatus')} className="space-y-2 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">{t('localPersonaAccessStatus')}</h2>
      <p className="text-sm text-muted-foreground">{t('localPersonaEffectiveRoles')}: <span className="font-mono text-foreground">{roleCodes?.length ? roleCodes.join(', ') : t('localPersonaRolesUnavailable')}</span></p>
      <p className="text-sm text-muted-foreground">{t('localPersonaBusinessRoleGuard')}: <span className="font-medium text-foreground">{t(roleGuardAllowed ? 'localPersonaGuardWouldAllow' : 'localPersonaGuardWouldDeny')}</span></p>
      <p className="text-sm text-muted-foreground">{t('localPersonaLocalGuard')}: <span className="font-medium text-foreground">{t('localPersonaGuardAllowed')}</span></p>
    </Surface> : null}
    <LocalPersonaSwitcher
      isOwner={isOwner}
      labels={{
        choosePersona: t('localPersonaChoose'),
        switchAccount: t('localPersonaSwitch'),
        returnToOwner: t('localPersonaReturn'),
        unavailable: t('localPersonaUnavailable'),
        returnDescription: t('localPersonaReturnDescription'),
      }}
      options={options}
    />
    <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href="/dashboard/start">{t('localPersonaBackToApp')}</Link>
  </PageShell>
}

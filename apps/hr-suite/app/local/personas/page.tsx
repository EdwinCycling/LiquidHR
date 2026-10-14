import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { LocalPersonaSwitcher, type LocalPersonaOption } from '@/components/auth/local-persona-switcher'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { canInitiateTestRoleSwitch, canReturnToLocalPersonaOwner, getLocalPersonaOwnerKey, getLocalPersonaOperatorTargetKeys, getVerifiedLocalPersonaIdentity, isLocalPersonaRuntime, readLocalPersonaOwnerMarker, TEST_ROLE_SWITCH_OWNER_COOKIE, TEST_ROLE_SWITCH_TARGETS } from '@/lib/auth/test-role-switch'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocalPayrollPersonaReadiness, type LocalPayrollPersonaKey, type LocalPayrollPersonaReadiness } from '@/lib/auth/local-payroll-persona-readiness'
import { getTranslator } from '@/lib/i18n/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const cookieStore = await cookies()
  const ownerMarker = cookieStore.get(TEST_ROLE_SWITCH_OWNER_COOKIE)?.value ?? null

  const supabase = await createClient()
  const verified = await getVerifiedLocalPersonaIdentity(supabase)
  const identity = verified?.identity ?? { email: null, emailVerified: false }
  const ownerKey = verified ? getLocalPersonaOwnerKey(host, identity) : null
  const isOwner = ownerKey !== null
  const canReturnToOwner = Boolean(verified)
    && canReturnToLocalPersonaOwner(host, identity, ownerMarker)
  if (!isOwner && !canReturnToOwner) notFound()
  const returnTargetKey = isOwner ? 'edwin' : readLocalPersonaOwnerMarker(ownerMarker) ?? 'edwin'

  const t = await getTranslator('navigation')
  const roleCodes = await (async (): Promise<string[] | null> => {
    if (!isOwner || !verified) return null
    try {
      const requestContext = await getRequestAuthorizationContext()
      return requestContext.context.userId === verified.userId ? [...requestContext.context.activeRoles] : null
    } catch {
      return null
    }
  })()
  const allowedTargets = ownerKey ? getLocalPersonaOperatorTargetKeys(ownerKey) : []
  const payrollReadiness = new Map<LocalPayrollPersonaKey, LocalPayrollPersonaReadiness>()
  if (isOwner) {
    const admin = createAdminClient()
    const payrollKeys: readonly LocalPayrollPersonaKey[] = ['payroll-lisa', 'payroll-jaap', 'payroll-frits']
    await Promise.all(payrollKeys.map(async (key) => {
      try {
        payrollReadiness.set(key, await getLocalPayrollPersonaReadiness(key, admin))
      } catch {
        payrollReadiness.set(key, {
          key,
          status: 'unavailable',
          available: false,
          canStartSignIn: false,
          canProvision: false,
          authUserId: null,
        })
      }
    }))
  }
  const availabilityCopyKeys = {
    'account-required': 'localPersonaAccountRequired',
    'link-required': 'localPersonaLinkRequired',
    'first-sign-in-required': 'localPersonaFirstSignInRequired',
    available: 'localPersonaReady',
    conflict: 'localPersonaNeedsReview',
    unavailable: 'localPersonaStatusUnavailable',
  } as const
  const options: LocalPersonaOption[] = TEST_ROLE_SWITCH_TARGETS.filter((target) => allowedTargets.includes(target.key)).map((target) => {
    const payrollKey = target.key === 'payroll-lisa' || target.key === 'payroll-jaap' || target.key === 'payroll-frits'
      ? target.key
      : null
    const readiness = payrollKey ? payrollReadiness.get(payrollKey) : null
    if (readiness) {
      return {
        ...target,
        available: readiness.available,
        canSwitch: readiness.canStartSignIn,
        canProvision: ownerKey === 'hr-admin' && readiness.canProvision,
        availabilityLabel: t(availabilityCopyKeys[readiness.status]),
        label: t(PERSONA_LABEL_KEYS[target.key]),
      }
    }
    return {
      ...target,
      canSwitch: target.available,
      label: t(PERSONA_LABEL_KEYS[target.key]),
      availabilityLabel: target.available ? undefined : t('localPersonaUnavailable'),
    }
  })
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
      returnTargetKey={returnTargetKey}
      labels={{
        choosePersona: t('localPersonaChoose'),
        switchAccount: t('localPersonaSwitch'),
        returnToOwner: t('localPersonaReturn'),
        unavailable: t('localPersonaUnavailable'),
        returnDescription: t('localPersonaReturnDescription'),
        provisionTitle: t('localPersonaProvisionTitle'),
        provisionDescription: t('localPersonaProvisionDescription'),
        provisionAccount: t('localPersonaProvisionAccount'),
      }}
      options={options}
    />
    <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href="/dashboard/start">{t('localPersonaBackToApp')}</Link>
  </PageShell>
}

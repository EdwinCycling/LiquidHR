import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { LocalPersonaSwitcher, type LocalPersonaOption } from '@/components/auth/local-persona-switcher'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'
import { buttonClasses } from '@/components/ui/button'
import { canInitiateTestRoleSwitch, canReturnToLocalPersonaOwner, getLocalPersonaOwnerKey, getLocalPersonaOperatorTargetKeys, getVerifiedLocalPersonaIdentity, isLocalPersonaRuntime, normalizedEmail, readLocalPersonaOwnerMarker, TEST_ROLE_SWITCH_OWNER_COOKIE, TEST_ROLE_SWITCH_TARGETS } from '@/lib/auth/test-role-switch'
import { getRequestAuthorizationContext } from '@/lib/auth/permissions'
import { getLocalPayrollPersonaReadiness, type LocalPayrollPersonaKey, type LocalPayrollPersonaReadiness } from '@/lib/auth/local-payroll-persona-readiness'
import { getTranslator } from '@/lib/i18n/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireComponentLibraryAccess } from '@/lib/payroll/component-library-access'
import { PAYFULL02_MARS_SCOPE } from '@/lib/auth/local-payroll-persona-readiness'

const PERSONA_LABEL_KEYS = {
  edwin: 'localPersonaEdwin',
  'hr-admin': 'localPersonaHrAdmin',
  manager: 'localPersonaManager',
  employee: 'localPersonaEmployee',
  'payroll-lisa': 'localPersonaPayrollLisa',
  'payroll-jaap': 'localPersonaPayrollJaap',
  'payroll-frits': 'localPersonaPayrollFrits',
  'payroll-demo-002': 'localPersonaPayrollDemo002',
} as const

const DEMO_002_PROVISION_OPERATOR_EMAIL = 'hradmin.fixture@liquidhr.test'

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
  let canManageMarsDemo002 = false
  if (!isOwner && verified?.identity.emailVerified) {
    try {
      const access = await requireComponentLibraryAccess(true)
      canManageMarsDemo002 = access.scope.tenantId === PAYFULL02_MARS_SCOPE.tenantId
        && access.scope.hrGroupId === PAYFULL02_MARS_SCOPE.hrGroupId
        && access.scope.administrationId === PAYFULL02_MARS_SCOPE.administrationId
    } catch {
      canManageMarsDemo002 = false
    }
  }
  if (!isOwner && !canReturnToOwner && !canManageMarsDemo002) notFound()
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
  if (isOwner || canManageMarsDemo002) {
    const admin = createAdminClient()
    const payrollKeys: readonly LocalPayrollPersonaKey[] = isOwner
      ? ['payroll-lisa', 'payroll-jaap', 'payroll-frits', 'payroll-demo-002']
      : ['payroll-demo-002']
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
    'context-access-required': 'localPersonaContextAccessRequired',
    'first-sign-in-required': 'localPersonaFirstSignInRequired',
    available: 'localPersonaReady',
    conflict: 'localPersonaNeedsReview',
    unavailable: 'localPersonaStatusUnavailable',
  } as const
  const options: LocalPersonaOption[] = TEST_ROLE_SWITCH_TARGETS.filter((target) => allowedTargets.includes(target.key)).map((target) => {
    const payrollKey = target.key === 'payroll-lisa' || target.key === 'payroll-jaap' || target.key === 'payroll-frits' || target.key === 'payroll-demo-002'
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
  const demo002Readiness = payrollReadiness.get('payroll-demo-002')
  const canProvisionDemo002 = demo002Readiness?.canProvision === true
    && normalizedEmail(identity.email) === DEMO_002_PROVISION_OPERATOR_EMAIL

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
    {isOwner || canReturnToOwner ? <LocalPersonaSwitcher
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
    /> : null}
    {canManageMarsDemo002 && demo002Readiness ? <Surface className="space-y-3 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{t('localPersonaPayrollDemo002')}</h2>
        <p className="text-sm text-muted-foreground">{t('localPersonaProvisionDescription')}</p>
        <p className="text-sm text-muted-foreground">{t(availabilityCopyKeys[demo002Readiness.status])}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {canProvisionDemo002 ? <form action="/api/local/personas/provision" method="post">
          <input name="target" type="hidden" value="payroll-demo-002" />
          <button className={buttonClasses({ size: 'md', variant: 'secondary' })} type="submit">{t('localPersonaProvisionAccount')}</button>
        </form> : null}
        {demo002Readiness.canStartSignIn ? <form action="/api/auth/test-role-switch" method="post">
          <input name="target" type="hidden" value="payroll-demo-002" />
          <input name="next" type="hidden" value="/my-salary" />
          <button className={buttonClasses({ size: 'md', variant: 'primary' })} type="submit">{t('localPersonaSwitch')}</button>
        </form> : null}
      </div>
    </Surface> : null}
    <Link className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href="/dashboard/start">{t('localPersonaBackToApp')}</Link>
  </PageShell>
}

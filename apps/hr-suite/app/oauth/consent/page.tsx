import { redirect } from 'next/navigation'
import { ArrowRight, Check, MessageSquareText, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { AuthShell } from '@/components/auth/auth-shell'
import { LiquidHRLogo } from '@/components/layout/liquidhr-logo'
import { resolveEmployeeSelfContext } from '@/lib/api-v1/auth/employee-self-context'
import { resolveDirectManagerContext } from '@/lib/api-v1/auth/manager-context'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { isChatGptOAuthGrant, readUserOAuthGrants } from '@/lib/oauth/user-grants'
import { setManagerMcpConsentMarker } from '@/lib/workforce-tools/mcp/manager-consent-admin'
import { approveChatGptMcpConsent, denyChatGptMcpConsent } from './actions'
import {
  buildConsentLoginHref,
  isAllowedChatGptRedirectUri,
  isAuthorizationId,
  isSupportedChatGptScope,
  parseConsentAuthorization,
  parseSupabaseAuthorizationRedirect,
} from './authorization'

export const dynamic = 'force-dynamic'

interface OAuthConsentPageProps {
  readonly searchParams: Promise<{
    readonly authorization_id?: string | string[]
  }>
}

type ConsentContextResolution =
  | { readonly kind: 'employee' | 'manager' }
  | { readonly kind: 'none' | 'selection-required' | 'unavailable' }

async function resolveConsentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ConsentContextResolution> {
  const employee = await resolveEmployeeSelfContext(supabase, userId)
  if (employee.kind === 'resolved') return { kind: 'employee' }

  const manager = await resolveDirectManagerContext(supabase, userId)
  if (manager.kind === 'resolved') return { kind: 'manager' }
  if (employee.kind === 'selection-required' || manager.kind === 'selection-required') {
    return { kind: 'selection-required' }
  }
  if (employee.kind === 'unavailable' || manager.kind === 'unavailable') return { kind: 'unavailable' }
  return { kind: 'none' }
}

function contextMessage(
  kind: Exclude<ConsentContextResolution['kind'], 'employee' | 'manager'>,
  translate: (key: string) => string,
): string {
  if (kind === 'selection-required') return translate('oauthConsentContextSelectionRequired')
  if (kind === 'unavailable') return translate('oauthConsentContextUnavailable')
  return translate('oauthConsentNoEmployeeContext')
}

export default async function OAuthConsentPage({ searchParams }: OAuthConsentPageProps) {
  const [params, auth, common] = await Promise.all([
    searchParams,
    getTranslator('auth'),
    getTranslator('common'),
  ])
  const authorizationId = typeof params.authorization_id === 'string' ? params.authorization_id : ''
  const t = auth
  let message: string | null = null
  let approvedRedirectUrl: string | null = null
  let details: {
    clientName: string
    authorizationId: string
    redirectUri: string
    scope: string
    resource: string | null
    canApprove: boolean
    canDeny: boolean
  } | null = null

  if (!isAuthorizationId(authorizationId)) {
    message = t('oauthConsentInvalidRequest')
  } else {
    const supabase = await createClient()
    let userId: string | null = null
    try {
      const { data, error } = await supabase.auth.getClaims()
      const subject = data?.claims?.sub
      if (!error && typeof subject === 'string' && subject.length > 0) userId = subject
    } catch {
      userId = null
    }
    if (!userId) redirect(buildConsentLoginHref(authorizationId))

    let authorizationResponse: unknown = null
    let authorizationError = false
    try {
      const response = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      authorizationResponse = response.data
      authorizationError = response.error !== null
    } catch {
      authorizationError = true
    }

    const approvedRedirect = authorizationError ? null : parseSupabaseAuthorizationRedirect(authorizationResponse)
    const authorization = authorizationError || approvedRedirect
      ? null
      : parseConsentAuthorization(authorizationResponse, authorizationId)
    if (approvedRedirect) {
      const grants = await readUserOAuthGrants(supabase.auth.oauth)
      const chatGptGrants = grants.status === 'ready'
        ? grants.grants.filter(isChatGptOAuthGrant)
        : []
      let cleared = grants.status === 'ready' && chatGptGrants.length > 0
      for (const grant of chatGptGrants) {
        if (!(await setManagerMcpConsentMarker(userId, grant.clientId, false))) cleared = false
      }
      if (!cleared) {
        message = t('oauthConsentManagerReconnectResetFailed')
      } else {
        const resolution = await resolveConsentContext(supabase, userId)
        if (resolution.kind === 'employee' || resolution.kind === 'manager') {
          approvedRedirectUrl = approvedRedirect
        } else {
          message = contextMessage(resolution.kind, t)
        }
      }
    } else if (!authorization) {
      message = t('oauthConsentInvalidRequest')
    } else if (!isAllowedChatGptRedirectUri(authorization.redirectUri)) {
      message = t('oauthConsentUnsupportedClient')
    } else {
      const scopesSupported = isSupportedChatGptScope(authorization.scope)
      let canApprove = scopesSupported
      if (scopesSupported) {
        const resolution = await resolveConsentContext(supabase, userId)
        if (resolution.kind !== 'employee' && resolution.kind !== 'manager') {
          canApprove = false
          message = contextMessage(resolution.kind, t)
        }
      }
      if (!scopesSupported) message = t('oauthConsentUnsupportedScope')
      details = {
        clientName: authorization.clientName,
        authorizationId,
        redirectUri: authorization.redirectUri,
        scope: authorization.scope,
        resource: authorization.resource,
        canApprove,
        canDeny: true,
      }
    }
  }

  if (approvedRedirectUrl) redirect(approvedRedirectUrl)

  return (
    <AuthShell
      brand={common('appName')}
      visualBody={auth('oauthConsentVisualBody')}
      visualPoints={[
        auth('oauthConsentVisualPointSelf'),
        auth('oauthConsentVisualPointManager'),
        auth('oauthConsentVisualPointReadOnly'),
        auth('oauthConsentVisualPointDeny'),
      ]}
      visualTitle={auth('oauthConsentVisualTitle')}
    >
      <div className="mb-6 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">{auth('oauthConsentEyebrow')}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">{auth('oauthConsentTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{auth('oauthConsentDescription')}</p>
      </div>

      {message && !details ? (
        <Surface className="p-5" role="alert">
          <p className="text-sm leading-6 text-foreground">{message}</p>
        </Surface>
      ) : details ? (
        <Surface className="space-y-5 p-5 sm:p-6">
          <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <LiquidHRLogo decorative size="sm" variant="mark" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{common('appName')}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentConnectedAccount')}</p>
                </div>
              </div>
              <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] border border-border-subtle bg-surface text-foreground">
                  <MessageSquareText className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{details.clientName}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentClientLabel')}</p>
                </div>
              </div>
            </div>
          </div>

          {message ? (
            <p className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3 text-sm leading-6 text-foreground" role="alert">
              {message}
            </p>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold text-foreground">{auth('oauthConsentDataTitle')}</h2>
            <h3 className="mt-3 text-sm font-medium text-foreground">{auth('oauthConsentEmployeeDataTitle')}</h3>
            <ul className="mt-2 space-y-2.5 text-sm leading-6 text-muted-foreground">
              {[
                auth('oauthConsentDevelopmentPlans'),
                auth('oauthConsentDevelopmentGaps'),
                auth('oauthConsentSkills'),
                auth('oauthConsentCompetencies'),
                auth('oauthConsentLeaveBalance'),
                auth('oauthConsentNextLeave'),
                auth('oauthConsentLeaveRequests'),
                auth('oauthConsentReminders'),
              ].map((item) => (
                <li className="flex items-start gap-2.5" key={item}>
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-sm font-medium text-foreground">{auth('oauthConsentManagerDataTitle')}</h3>
            <ul className="mt-2 space-y-2.5 text-sm leading-6 text-muted-foreground">
              {[
                auth('oauthConsentManagerTeamOverview'),
                auth('oauthConsentManagerPendingWork'),
                auth('oauthConsentManagerLeaveCalendar'),
                auth('oauthConsentManagerDevelopmentPlans'),
                auth('oauthConsentManagerFollowUps'),
                auth('oauthConsentManagerCapabilityMatrix'),
              ].map((item) => (
                <li className="flex items-start gap-2.5" key={item}>
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3 text-sm leading-6 text-foreground">
            {auth('oauthConsentAccountRoleScope')}
          </p>

          <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-subtle p-3">
            <ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{auth('oauthConsentAccessType')}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{auth('oauthConsentReadOnly')}</p>
            </div>
          </div>

          <div className="space-y-4 border-t border-border-subtle pt-4">
            <h2 className="text-sm font-semibold text-foreground">{auth('oauthConsentRequestDetailsLabel')}</h2>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{auth('oauthConsentRedirectLabel')}</p>
              <p className="mt-1 break-all text-sm leading-6 text-foreground">{details.redirectUri}</p>
            </div>
            {details.resource ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground">{auth('oauthConsentResourceLabel')}</p>
                <p className="mt-1 break-all text-sm leading-6 text-foreground">{details.resource}</p>
              </div>
            ) : null}
            <div>
              <p className="text-sm font-medium text-muted-foreground">{auth('oauthConsentScopesLabel')}</p>
              <p className="mt-1 break-all font-mono text-xs leading-5 text-foreground">{details.scope}</p>
            </div>
            {details.scope.split(/\s+/u).includes('email') ? (
              <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentEmailScope')}</p>
            ) : null}
            {details.scope.split(/\s+/u).includes('offline_access') ? (
              <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentOfflineAccessScope')}</p>
            ) : null}
          </div>

          <div className="grid gap-3 pt-1">
            {details.canApprove ? (
              <form action={approveChatGptMcpConsent}>
                <input name="authorization_id" type="hidden" value={details.authorizationId} />
                <Button className="w-full" type="submit">{auth('oauthConsentApprove')}</Button>
              </form>
            ) : null}
            {details.canDeny ? (
              <form action={denyChatGptMcpConsent}>
                <input name="authorization_id" type="hidden" value={details.authorizationId} />
                <Button className="w-full" type="submit" variant="secondary">{auth('oauthConsentDeny')}</Button>
              </form>
            ) : null}
          </div>
        </Surface>
      ) : (
        <Surface className="p-5" role="alert">
          <p className="text-sm leading-6 text-foreground">{t('oauthConsentInvalidRequest')}</p>
        </Surface>
      )}
    </AuthShell>
  )
}
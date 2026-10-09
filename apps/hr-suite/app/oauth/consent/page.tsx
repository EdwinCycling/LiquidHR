import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { AuthShell } from '@/components/auth/auth-shell'
import { resolveEmployeeSelfContext } from '@/lib/api-v1/auth/employee-self-context'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
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
      const resolution = await resolveEmployeeSelfContext(supabase, userId)
      if (resolution.kind === 'resolved') {
        approvedRedirectUrl = approvedRedirect
      } else {
        message = resolution.kind === 'selection-required'
          ? t('oauthConsentContextSelectionRequired')
          : resolution.kind === 'unavailable'
            ? t('oauthConsentContextUnavailable')
            : t('oauthConsentNoEmployeeContext')
      }
    } else if (!authorization) {
      message = t('oauthConsentInvalidRequest')
    } else if (!isAllowedChatGptRedirectUri(authorization.redirectUri)) {
      message = t('oauthConsentUnsupportedClient')
    } else {
      const scopesSupported = isSupportedChatGptScope(authorization.scope)
      let canApprove = scopesSupported
      if (scopesSupported) {
        const resolution = await resolveEmployeeSelfContext(supabase, userId)
        if (resolution.kind !== 'resolved') {
          canApprove = false
          message = resolution.kind === 'selection-required'
            ? t('oauthConsentContextSelectionRequired')
            : resolution.kind === 'unavailable'
              ? t('oauthConsentContextUnavailable')
              : t('oauthConsentNoEmployeeContext')
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
      visualPoints={[auth('oauthConsentVisualPointSelf'), auth('oauthConsentVisualPointReadOnly'), auth('oauthConsentVisualPointDeny')]}
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
          {message ? <p className="text-sm leading-6 text-foreground" role="alert">{message}</p> : null}
          <div>
            <p className="text-sm font-medium text-muted-foreground">{auth('oauthConsentClientLabel')}</p>
            <p className="mt-1 break-words text-lg font-semibold text-foreground">{details.clientName}</p>
          </div>
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
            <h2 className="text-sm font-semibold text-foreground">{auth('oauthConsentDataTitle')}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
              <li>{auth('oauthConsentDevelopmentPlans')}</li>
              <li>{auth('oauthConsentDevelopmentGaps')}</li>
              <li>{auth('oauthConsentSkills')}</li>
              <li>{auth('oauthConsentCompetencies')}</li>
            </ul>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{auth('oauthConsentSelfOnly')}</p>
          <p className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3 text-sm leading-6 text-foreground">
            {auth('oauthConsentReadOnly')}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">{auth('oauthConsentScopesLabel')}: </span>
            <span>{details.scope}</span>
          </p>
          {details.scope.split(/\s+/u).includes('email') ? (
            <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentEmailScope')}</p>
          ) : null}
          {details.scope.split(/\s+/u).includes('offline_access') ? (
            <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentOfflineAccessScope')}</p>
          ) : null}

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
        </Surface>
      ) : (
        <Surface className="p-5" role="alert">
          <p className="text-sm leading-6 text-foreground">{t('oauthConsentInvalidRequest')}</p>
        </Surface>
      )}
    </AuthShell>
  )
}

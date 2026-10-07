import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { AuthShell } from '@/components/auth/auth-shell'
import { requireAuthContext } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { approveChatGptMcpConsent, denyChatGptMcpConsent } from './actions'

export const dynamic = 'force-dynamic'

const AUTHORIZATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CHATGPT_CALLBACK_PATTERN = /^\/connector\/oauth\/[a-zA-Z0-9_-]{1,128}$/

type ConsentErrorCode = 'invalid-request' | 'unsupported-client' | 'unsupported-scope' | 'employee-only' | 'approval-failed'

function isAllowedChatGptRedirectUri(value: string): boolean {
  try {
    const uri = new URL(value)
    return uri.protocol === 'https:'
      && uri.hostname === 'chatgpt.com'
      && !uri.port
      && !uri.username
      && !uri.password
      && !uri.search
      && !uri.hash
      && (uri.pathname === '/connector_platform_oauth_redirect' || CHATGPT_CALLBACK_PATTERN.test(uri.pathname))
  } catch {
    return false
  }
}

function consentErrorMessage(code: string | undefined, t: Awaited<ReturnType<typeof getTranslator>>): string | null {
  const messages: Record<ConsentErrorCode, string> = {
    'invalid-request': t('oauthConsentInvalidRequest'),
    'unsupported-client': t('oauthConsentUnsupportedClient'),
    'unsupported-scope': t('oauthConsentUnsupportedScope'),
    'employee-only': t('oauthConsentEmployeeOnly'),
    'approval-failed': t('oauthConsentApprovalFailed'),
  }
  return code && Object.hasOwn(messages, code) ? messages[code as ConsentErrorCode] ?? null : null
}

interface OAuthConsentPageProps {
  readonly searchParams: Promise<{
    readonly authorization_id?: string | string[]
    readonly error?: string | string[]
  }>
}

export default async function OAuthConsentPage({ searchParams }: OAuthConsentPageProps) {
  const [params, auth, common] = await Promise.all([
    searchParams,
    getTranslator('auth'),
    getTranslator('common'),
  ])
  const authorizationId = typeof params.authorization_id === 'string' ? params.authorization_id : ''
  const errorCode = typeof params.error === 'string' ? params.error : undefined
  const t = auth
  let message = consentErrorMessage(errorCode, t)
  let details: {
    clientName: string
    authorizationId: string
    scope: string
    canApprove: boolean
    canDeny: boolean
  } | null = null

  if (!AUTHORIZATION_ID_PATTERN.test(authorizationId)) {
    message = t('oauthConsentInvalidRequest')
  } else {
    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub
    if (claimsError || typeof userId !== 'string') {
      const nextPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
      redirect(`/login?next=${encodeURIComponent(nextPath)}`)
    }

    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    if (error || !data) {
      message = t('oauthConsentInvalidRequest')
    } else if ('redirect_url' in data) {
      if (isAllowedChatGptRedirectUri(data.redirect_url)) redirect(data.redirect_url)
      message = t('oauthConsentUnsupportedClient')
    } else if (data.authorization_id !== authorizationId || data.user.id !== userId) {
      message = t('oauthConsentInvalidRequest')
    } else if (!isAllowedChatGptRedirectUri(data.redirect_uri)) {
      message = t('oauthConsentUnsupportedClient')
    } else {
      const requestedScopes = data.scope.split(/\s+/u).filter(Boolean)
      const scopesSupported = requestedScopes.length === 1 && requestedScopes[0] === 'openid'
      let canApprove = scopesSupported
      try {
        const context = await requireAuthContext()
        const isEmployeeSelf = context.employeeId !== null
          && context.activeRoles.includes('EMPLOYEE')
          && !context.activeRoles.some((role) => role === 'DIRECT_MANAGER' || role.includes('HR') || role === 'TENANT_ADMIN')
        if (!isEmployeeSelf) {
          canApprove = false
          message = t('oauthConsentEmployeeOnly')
        }
      } catch {
        canApprove = false
        message = t('oauthConsentEmployeeOnly')
      }
      if (!scopesSupported) message = t('oauthConsentUnsupportedScope')
      details = {
        clientName: data.client.name,
        authorizationId,
        scope: data.scope,
        canApprove,
        canDeny: true,
      }
    }
  }

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

      {message ? (
        <Surface className="p-5" role="alert">
          <p className="text-sm leading-6 text-foreground">{message}</p>
        </Surface>
      ) : details ? (
        <Surface className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{auth('oauthConsentClientLabel')}</p>
            <p className="mt-1 break-words text-lg font-semibold text-foreground">{details.clientName}</p>
          </div>
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
          <p className="text-xs leading-5 text-muted-foreground">{auth('oauthConsentOpenIdScope')}</p>

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

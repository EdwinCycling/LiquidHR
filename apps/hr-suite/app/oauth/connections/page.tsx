import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { Surface } from '@/components/ui/surface'
import { isChatGptOAuthGrant, readUserOAuthGrants } from '@/lib/oauth/user-grants'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { resolveDirectManagerContext } from '@/lib/api-v1/auth/manager-context'
import { OAuthConnections, type OAuthConnectionsLabels } from '@/components/oauth/oauth-connections'
import { hasCurrentManagerMcpConsent } from '@/lib/workforce-tools/mcp/manager-consent'

export const dynamic = 'force-dynamic'

export default async function OAuthConnectionsPage() {
  const [auth, common, locale] = await Promise.all([
    getTranslator('auth'),
    getTranslator('common'),
    getLocale(),
  ])
  const supabase = await createClient()

  let isAuthenticated = false
  let authenticatedUserId: string | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    const subject = data?.claims?.sub
    isAuthenticated = !error && typeof subject === 'string' && subject.length > 0
    if (isAuthenticated && typeof subject === 'string') authenticatedUserId = subject
  } catch {
    isAuthenticated = false
  }
  if (!isAuthenticated) redirect('/login?next=%2Foauth%2Fconnections')

  const result = await readUserOAuthGrants(supabase.auth.oauth)
  let managerConsentCheckAvailable = false
  let managerConsentClientIds: string[] = []
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && authenticatedUserId && data.user?.id === authenticatedUserId) {
      const managerContext = await resolveDirectManagerContext(supabase, authenticatedUserId)
      if (managerContext.kind === 'resolved') {
        managerConsentCheckAvailable = true
        if (result.status === 'ready') {
          managerConsentClientIds = result.grants
            .filter((grant) => isChatGptOAuthGrant(grant) && hasCurrentManagerMcpConsent(data.user?.app_metadata, grant.clientId))
            .map((grant) => grant.clientId)
        }
      }
    }
  } catch {
    managerConsentCheckAvailable = false
  }
  const labels: OAuthConnectionsLabels = {
    application: auth('oauthConnectionsApplication'),
    scopes: auth('oauthConnectionsScopes'),
    noScopes: auth('oauthConnectionsNoScopes'),
    authorizedAt: auth('oauthConnectionsAuthorizedAt'),
    revoke: auth('oauthConnectionsRevoke'),
    confirmTitle: auth('oauthConnectionsConfirmTitle'),
    confirmDescription: auth('oauthConnectionsConfirmDescription'),
    confirmRevoke: auth('oauthConnectionsConfirmRevoke'),
    cancel: auth('oauthConnectionsCancel'),
    revoked: auth('oauthConnectionsRevoked'),
    revokeFailed: auth('oauthConnectionsRevokeFailed'),
    empty: auth('oauthConnectionsEmpty'),
    managerConsentHeading: auth('oauthManagerConsentHeading'),
    managerConsentDescription: auth('oauthManagerConsentDescription'),
    managerConsentItemsHeading: auth('oauthConsentManagerDataTitle'),
    managerConsentItems: [
      auth('oauthConsentManagerTeamOverview'),
      auth('oauthConsentManagerPendingWork'),
      auth('oauthConsentManagerLeaveCalendar'),
      auth('oauthConsentManagerDevelopmentPlans'),
      auth('oauthConsentManagerFollowUps'),
      auth('oauthConsentManagerCapabilityMatrix'),
    ],
    managerConsentReadOnly: auth('oauthConsentReadOnly'),
    managerConsentEnabled: auth('oauthManagerConsentEnabled'),
    managerConsentGrant: auth('oauthManagerConsentGrant'),
    managerConsentUnavailable: auth('oauthManagerConsentUnavailable'),
    managerConsentConfirmTitle: auth('oauthManagerConsentConfirmTitle'),
    managerConsentConfirmDescription: auth('oauthManagerConsentConfirmDescription'),
    managerConsentConfirm: auth('oauthManagerConsentConfirm'),
    managerConsentSuccess: auth('oauthManagerConsentSuccess'),
    managerConsentFailed: auth('oauthManagerConsentFailed'),
  }

  return (
    <AuthShell
      brand={common('appName')}
      visualBody={auth('oauthConnectionsVisualBody')}
      visualPoints={[
        auth('oauthConnectionsVisualPointScope'),
        auth('oauthConnectionsVisualPointRevoke'),
        auth('oauthConnectionsVisualPointEmployee'),
      ]}
      visualTitle={auth('oauthConnectionsVisualTitle')}
    >
      <div className="mb-6 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
          {auth('oauthConnectionsEyebrow')}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          {auth('oauthConnectionsTitle')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {auth('oauthConnectionsDescription')}
        </p>
      </div>
      {result.status === 'ready' ? (
        <OAuthConnections
          grants={result.grants}
          labels={labels}
          locale={locale}
          managerConsentCheckAvailable={managerConsentCheckAvailable}
          managerConsentClientIds={managerConsentClientIds}
        />
      ) : (
        <Surface className="p-5" role="alert">
          <p className="text-sm leading-6 text-foreground">{auth('oauthConnectionsLoadFailed')}</p>
        </Surface>
      )}
    </AuthShell>
  )
}

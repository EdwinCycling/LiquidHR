import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { Surface } from '@/components/ui/surface'
import { readUserOAuthGrants } from '@/lib/oauth/user-grants'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'
import { OAuthConnections, type OAuthConnectionsLabels } from '@/components/oauth/oauth-connections'

export const dynamic = 'force-dynamic'

export default async function OAuthConnectionsPage() {
  const [auth, common, locale] = await Promise.all([
    getTranslator('auth'),
    getTranslator('common'),
    getLocale(),
  ])
  const supabase = await createClient()

  let isAuthenticated = false
  try {
    const { data, error } = await supabase.auth.getClaims()
    const subject = data?.claims?.sub
    isAuthenticated = !error && typeof subject === 'string' && subject.length > 0
  } catch {
    isAuthenticated = false
  }
  if (!isAuthenticated) redirect('/login?next=%2Foauth%2Fconnections')

  const result = await readUserOAuthGrants(supabase.auth.oauth)
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
        <OAuthConnections grants={result.grants} labels={labels} locale={locale} />
      ) : (
        <Surface className="p-5" role="alert">
          <p className="text-sm leading-6 text-foreground">{auth('oauthConnectionsLoadFailed')}</p>
        </Surface>
      )}
    </AuthShell>
  )
}

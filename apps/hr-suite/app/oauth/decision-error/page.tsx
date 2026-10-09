import { AuthShell } from '@/components/auth/auth-shell'
import { Surface } from '@/components/ui/surface'
import { getTranslator } from '@/lib/i18n/server'

export default async function OAuthDecisionErrorPage() {
  const [auth, common] = await Promise.all([
    getTranslator('auth'),
    getTranslator('common'),
  ])

  return (
    <AuthShell
      brand={common('appName')}
      visualBody={auth('oauthConsentVisualBody')}
      visualPoints={[
        auth('oauthConsentVisualPointSelf'),
        auth('oauthConsentVisualPointReadOnly'),
        auth('oauthConsentVisualPointDeny'),
      ]}
      visualTitle={auth('oauthConsentVisualTitle')}
    >
      <Surface aria-live="polite" className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
          {auth('oauthDecisionErrorEyebrow')}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
          {auth('oauthDecisionErrorTitle')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {auth('oauthDecisionErrorDescription')}
        </p>
      </Surface>
    </AuthShell>
  )
}

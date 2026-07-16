import { AuthShell } from '@/components/auth/auth-shell'
import { InvitationForm, type InvitationFormLabels } from '@/components/auth/invitation-form'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

interface InvitationPageProps {
  params: Promise<{ token: string }>
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const [{ token }, auth, common] = await Promise.all([
    params,
    getTranslator('auth'),
    getTranslator('common'),
  ])
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : ''
  const labels: InvitationFormLabels = {
    signedInAs: auth('inviteSignedInAs'),
    passwordLabel: auth('invitePasswordLabel'),
    passwordHelp: auth('invitePasswordHelp'),
    accept: auth('acceptInvite'),
    accepting: auth('acceptingInvite'),
    signInFirst: auth('inviteSignInFirst'),
    google: auth('signInWithGoogle'),
    googleHelp: auth('inviteGoogleHelp'),
    goToLogin: auth('inviteGoToLogin'),
    differentAccount: auth('inviteDifferentAccount'),
    signOut: auth('signOut'),
    errors: {
      invalidInput: auth('inviteInvalid'),
      notAuthenticated: auth('inviteSignInFirst'),
      passwordRejected: auth('invitePasswordRejected'),
      configuration: auth('inviteConfiguration'),
      expired: auth('inviteExpired'),
      emailMismatch: auth('inviteEmailMismatch'),
      invalid: auth('inviteInvalid'),
      employeeAlreadyLinked: auth('inviteAlreadyLinked'),
      unknown: auth('inviteUnknown'),
    },
  }

  return (
    <AuthShell
      brand={common('appName')}
      visualBody={auth('visualBody')}
      visualPoints={[
        auth('visualPointIdentity'),
        auth('visualPointContext'),
        auth('visualPointPreference'),
      ]}
      visualTitle={auth('visualTitle')}
    >
      <div className="mb-7 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">{common('appName')}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-foreground">{auth('inviteTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{auth('inviteSubtitle')}</p>
      </div>
      <InvitationForm
        authenticated={Boolean(data?.claims?.sub)}
        email={email}
        labels={labels}
        token={token}
      />
    </AuthShell>
  )
}

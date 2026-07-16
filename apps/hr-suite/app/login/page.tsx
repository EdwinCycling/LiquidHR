import { AuthShell } from '@/components/auth/auth-shell'
import { LoginForm, type LoginFormLabels } from '@/components/auth/login-form'
import { getTranslator } from '@/lib/i18n/server'

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[]
    error?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, auth, common] = await Promise.all([
    searchParams,
    getTranslator('auth'),
    getTranslator('common'),
  ])
  const nextPath = typeof params.next === 'string' ? params.next : '/departments'
  const labels: LoginFormLabels = {
    email: auth('email'),
    password: auth('password'),
    signIn: auth('signIn'),
    signingIn: auth('signingIn'),
    signInWithGoogle: auth('signInWithGoogle'),
    or: auth('or'),
    forgotPassword: auth('forgotPassword'),
    resetPassword: auth('resetPassword'),
    resetInstruction: auth('resetInstruction'),
    sendReset: auth('sendReset'),
    sendingReset: auth('sendingReset'),
    backToLogin: auth('backToLogin'),
    resetSent: auth('resetSent'),
    invalidCredentials: auth('invalidCredentials'),
    providerUnavailable: auth('providerUnavailable'),
    invitationOnly: auth('invitationOnly'),
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
          {auth('eyebrow')}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-foreground">
          {auth('title')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{auth('subtitle')}</p>
      </div>
      <LoginForm
        labels={labels}
        nextPath={nextPath}
        providerError={params.error === 'provider'}
      />
    </AuthShell>
  )
}

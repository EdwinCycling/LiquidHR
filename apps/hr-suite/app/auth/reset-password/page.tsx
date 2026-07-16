import { AuthShell } from '@/components/auth/auth-shell'
import { PasswordResetForm, type PasswordResetFormLabels } from '@/components/auth/password-reset-form'
import { getTranslator } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

export default async function ResetPasswordPage() {
  const [auth, common] = await Promise.all([
    getTranslator('auth'),
    getTranslator('common'),
  ])
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const labels: PasswordResetFormLabels = {
    password: auth('newPassword'),
    passwordConfirmation: auth('confirmPassword'),
    passwordHint: auth('passwordHint'),
    update: auth('updatePassword'),
    updating: auth('updatingPassword'),
    invalid: auth('passwordMismatch'),
    missingSession: auth('recoverySessionMissing'),
    failed: auth('passwordUpdateFailed'),
    updated: auth('passwordUpdated'),
    backToLogin: auth('backToLogin'),
    continueToApp: auth('continueToApp'),
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
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-foreground">{auth('resetTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{auth('resetSubtitle')}</p>
      </div>
      <PasswordResetForm authenticated={Boolean(data?.claims?.sub)} labels={labels} />
    </AuthShell>
  )
}

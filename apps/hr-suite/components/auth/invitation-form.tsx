'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { KeyRound, LoaderCircle, LogIn, ShieldCheck } from 'lucide-react'
import {
  acceptInvitationAction,
  type InvitationActionCode,
  type InvitationActionState,
} from '@/app/invite/[token]/actions'
import { signInWithGoogle } from '@/lib/auth/login-actions'
import { createClient } from '@/lib/supabase/client'

const initialInvitationActionState: InvitationActionState = { code: 'idle' }

export interface InvitationFormLabels {
  signedInAs: string
  passwordLabel: string
  passwordHelp: string
  accept: string
  accepting: string
  signInFirst: string
  google: string
  googleHelp: string
  goToLogin: string
  differentAccount: string
  signOut: string
  errors: Readonly<Record<Exclude<InvitationActionCode, 'idle'>, string>>
}

interface InvitationFormProps {
  authenticated: boolean
  email: string
  labels: InvitationFormLabels
  token: string
}

export function InvitationForm({ authenticated, email, labels, token }: InvitationFormProps) {
  const [state, action, pending] = useActionState(
    acceptInvitationAction,
    initialInvitationActionState,
  )
  const nextPath = `/invite/${encodeURIComponent(token)}`

  useEffect(() => {
    if (authenticated) return

    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.reload()
    })
  }, [authenticated])

  if (!authenticated) {
    return (
      <div className="liquid-panel-shadow rounded-2xl border bg-surface p-6 sm:p-8">
        <div className="flex items-start gap-3 rounded-xl bg-accent px-4 py-3.5 text-accent-foreground">
          <LogIn aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
          <p className="text-sm leading-6">{labels.signInFirst}</p>
        </div>

        <Link className="mt-6 flex h-12 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover" href={`/login?next=${encodeURIComponent(nextPath)}`}>
          {labels.goToLogin}
        </Link>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{labels.googleHelp}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form action={signInWithGoogle}>
          <input name="next" type="hidden" value={nextPath} />
          <button className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border bg-surface-raised px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted" type="submit">
            <span aria-hidden="true" className="grid size-6 place-items-center rounded-md border bg-surface text-xs font-bold text-accent-foreground">G</span>
            {labels.google}
          </button>
        </form>
      </div>
    )
  }

  const error = state.code === 'idle' ? null : labels.errors[state.code]

  return (
    <div className="liquid-panel-shadow rounded-2xl border bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-3 rounded-xl bg-success-surface px-4 py-3.5 text-success">
        <ShieldCheck aria-hidden="true" size={20} />
        <p className="min-w-0 truncate text-sm font-medium">{labels.signedInAs.replace('{email}', email)}</p>
      </div>

      <form action={action} className="mt-6">
        <input name="token" type="hidden" value={token} />
        <label className="text-sm font-medium text-foreground" htmlFor="invite-password">
          {labels.passwordLabel}
        </label>
        <div className="relative mt-2">
          <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            aria-describedby="invite-password-help"
            autoComplete="new-password"
            className="h-12 w-full rounded-lg border bg-surface-raised pl-10 pr-3 text-foreground outline-none transition-colors focus:border-focus"
            id="invite-password"
            maxLength={72}
            minLength={12}
            name="password"
            type="password"
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground" id="invite-password-help">
          {labels.passwordHelp}
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive-surface px-3 py-2.5 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <button className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : null}
          {pending ? labels.accepting : labels.accept}
        </button>
      </form>

      <div className="mt-6 border-t pt-5">
        <p className="text-xs leading-5 text-muted-foreground">{labels.differentAccount}</p>
        <form action="/auth/signout" method="post">
          <button className="mt-2 rounded text-sm font-semibold text-accent-foreground hover:text-primary" type="submit">
            {labels.signOut}
          </button>
        </form>
      </div>
    </div>
  )
}

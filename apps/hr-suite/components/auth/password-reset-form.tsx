'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react'
import {
  updatePasswordAction,
  type PasswordResetActionState,
} from '@/app/auth/reset-password/actions'
import { createClient } from '@/lib/supabase/client'

const initialState: PasswordResetActionState = { code: 'idle' }

export interface PasswordResetFormLabels {
  password: string
  passwordConfirmation: string
  passwordHint: string
  update: string
  updating: string
  invalid: string
  missingSession: string
  failed: string
  updated: string
  backToLogin: string
  continueToApp: string
}

interface PasswordResetFormProps {
  authenticated: boolean
  labels: PasswordResetFormLabels
}

export function PasswordResetForm({ authenticated, labels }: PasswordResetFormProps) {
  const [state, action, pending] = useActionState(updatePasswordAction, initialState)

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
        <p className="rounded-lg border border-warning/25 bg-warning-surface px-4 py-3 text-sm leading-6 text-warning" role="alert">
          {labels.missingSession}
        </p>
        <Link className="mt-6 flex h-11 items-center justify-center rounded-lg border bg-surface-raised px-4 text-sm font-semibold text-foreground hover:bg-muted" href="/login">
          {labels.backToLogin}
        </Link>
      </div>
    )
  }

  if (state.code === 'updated') {
    return (
      <div className="liquid-panel-shadow rounded-2xl border bg-surface p-6 text-center sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-success-surface text-success">
          <CheckCircle2 aria-hidden="true" size={23} />
        </span>
        <p className="mt-4 text-sm leading-6 text-success" role="status">{labels.updated}</p>
        <Link className="mt-6 flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" href="/departments">
          {labels.continueToApp}
        </Link>
      </div>
    )
  }

  const error = state.code === 'invalid'
    ? labels.invalid
    : state.code === 'missingSession'
      ? labels.missingSession
      : state.code === 'failed'
        ? labels.failed
        : null

  return (
    <form action={action} className="liquid-panel-shadow rounded-2xl border bg-surface p-6 sm:p-8">
      <label className="text-sm font-medium text-foreground" htmlFor="new-password">{labels.password}</label>
      <div className="relative mt-2">
        <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input autoComplete="new-password" className="h-12 w-full rounded-lg border bg-surface-raised pl-10 pr-3 outline-none focus:border-focus" id="new-password" maxLength={72} minLength={12} name="password" required type="password" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{labels.passwordHint}</p>

      <label className="mt-5 block text-sm font-medium text-foreground" htmlFor="password-confirmation">{labels.passwordConfirmation}</label>
      <div className="relative mt-2">
        <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input autoComplete="new-password" className="h-12 w-full rounded-lg border bg-surface-raised pl-10 pr-3 outline-none focus:border-focus" id="password-confirmation" maxLength={72} minLength={12} name="passwordConfirmation" required type="password" />
      </div>

      {error ? <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive-surface px-3 py-2.5 text-sm text-destructive" role="alert">{error}</p> : null}

      <button className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-wait disabled:opacity-65" disabled={pending} type="submit">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : null}
        {pending ? labels.updating : labels.update}
      </button>
    </form>
  )
}

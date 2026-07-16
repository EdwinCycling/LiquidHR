'use client'

import { useActionState, useState } from 'react'
import { ArrowLeft, KeyRound, LoaderCircle, Mail } from 'lucide-react'
import {
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  type LoginActionState,
} from '@/lib/auth/login-actions'

const initialLoginActionState: LoginActionState = { code: 'idle' }

export interface LoginFormLabels {
  email: string
  password: string
  signIn: string
  signingIn: string
  signInWithGoogle: string
  or: string
  forgotPassword: string
  resetPassword: string
  resetInstruction: string
  sendReset: string
  sendingReset: string
  backToLogin: string
  resetSent: string
  invalidCredentials: string
  providerUnavailable: string
  invitationOnly: string
}

interface LoginFormProps {
  labels: LoginFormLabels
  nextPath: string
  providerError: boolean
}

export function LoginForm({ labels, nextPath, providerError }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [loginState, loginAction, loginPending] = useActionState(
    signInWithPassword,
    initialLoginActionState,
  )
  const [resetState, resetAction, resetPending] = useActionState(
    requestPasswordReset,
    initialLoginActionState,
  )

  if (mode === 'reset') {
    return (
      <div className="liquid-panel-shadow rounded-2xl border bg-surface p-6 sm:p-8">
        <button
          className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setMode('login')}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          {labels.backToLogin}
        </button>
        <h1 className="mt-8 text-3xl font-semibold tracking-[-0.035em] text-foreground">
          {labels.resetPassword}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{labels.resetInstruction}</p>

        <form action={resetAction} className="mt-7">
          <label className="text-sm font-medium text-foreground" htmlFor="reset-email">
            {labels.email}
          </label>
          <div className="relative mt-2">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              autoComplete="email"
              className="h-12 w-full rounded-lg border bg-surface-raised pl-10 pr-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-focus"
              id="reset-email"
              name="email"
              required
              type="email"
            />
          </div>
          {resetState.code === 'resetRequested' ? (
            <p className="mt-4 rounded-lg border border-success/25 bg-success-surface px-3 py-2.5 text-sm text-success" role="status">
              {labels.resetSent}
            </p>
          ) : null}
          <button
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-65"
            disabled={resetPending}
            type="submit"
          >
            {resetPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : null}
            {resetPending ? labels.sendingReset : labels.sendReset}
          </button>
        </form>
      </div>
    )
  }

  const loginError = loginState.code === 'invalidCredentials'
    ? labels.invalidCredentials
    : loginState.code === 'providerUnavailable' || providerError
      ? labels.providerUnavailable
      : null

  return (
    <div className="liquid-panel-shadow rounded-2xl border bg-surface p-6 sm:p-8">
      <form action={loginAction}>
        <input name="next" type="hidden" value={nextPath} />
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="email">
            {labels.email}
          </label>
          <div className="relative mt-2">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              aria-invalid={loginError ? true : undefined}
              autoComplete="email"
              className="h-12 w-full rounded-lg border bg-surface-raised pl-10 pr-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-focus"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              {labels.password}
            </label>
            <button
              className="rounded text-xs font-semibold text-accent-foreground transition-colors hover:text-primary"
              onClick={() => setMode('reset')}
              type="button"
            >
              {labels.forgotPassword}
            </button>
          </div>
          <div className="relative mt-2">
            <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              aria-describedby={loginError ? 'login-error' : undefined}
              aria-invalid={loginError ? true : undefined}
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border bg-surface-raised pl-10 pr-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground/65 focus:border-focus"
              id="password"
              maxLength={72}
              name="password"
              required
              type="password"
            />
          </div>
        </div>

        {loginError ? (
          <p className="mt-4 rounded-lg border border-destructive/25 bg-destructive-surface px-3 py-2.5 text-sm text-destructive" id="login-error" role="alert">
            {loginError}
          </p>
        ) : null}

        <button
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-65"
          disabled={loginPending}
          type="submit"
        >
          {loginPending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : null}
          {loginPending ? labels.signingIn : labels.signIn}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3" role="separator">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{labels.or}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <input name="next" type="hidden" value={nextPath} />
        <button className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border bg-surface-raised px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted" type="submit">
          <span aria-hidden="true" className="grid size-6 place-items-center rounded-md border bg-surface text-xs font-bold text-accent-foreground">G</span>
          {labels.signInWithGoogle}
        </button>
      </form>

      <p className="mt-6 border-t pt-5 text-center text-xs leading-5 text-muted-foreground">
        {labels.invitationOnly}
      </p>
    </div>
  )
}

'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

export type TurnstileWidgetId = string

export interface TurnstileRenderOptions {
  readonly sitekey: string
  readonly callback: (token: string) => void
  readonly 'expired-callback': () => void
  readonly 'error-callback': () => void
}

export interface TurnstileApi {
  render(element: HTMLElement, options: TurnstileRenderOptions): TurnstileWidgetId
  reset(widgetId: TurnstileWidgetId): void
  remove(widgetId: TurnstileWidgetId): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export interface PublicApplicationLabels {
  readonly title: string
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone: string
  readonly motivation: string
  readonly cv: string
  readonly privacy: string
  readonly privacyLink: string
  readonly challenge: string
  readonly challengeDescription: string
  readonly challengeLoading: string
  readonly challengeUnavailable: string
  readonly challengeError: string
  readonly challengeRetry: string
  readonly submit: string
  readonly submitting: string
  readonly securityBlocked: string
  readonly confirmed: string
  readonly confirmedDescription: string
  readonly error: string
}

export type PublicApplicationFieldMode = 'HIDDEN' | 'OPTIONAL' | 'REQUIRED'

export interface PublicApplicationFormConfig {
  readonly phone: PublicApplicationFieldMode
  readonly cv: PublicApplicationFieldMode
  readonly motivation: PublicApplicationFieldMode
}

type FormState = 'FORM' | 'SUBMITTING' | 'CONFIRMED' | 'SECURITY_BLOCKED' | 'ERROR'
type ChallengeState = 'LOADING' | 'SOLVED' | 'ERROR' | 'UNAVAILABLE'

export interface PublicApplicationFormProps {
  readonly publicId: string
  readonly slug: string
  readonly labels: PublicApplicationLabels
  readonly config?: PublicApplicationFormConfig
  readonly siteKey?: string
}

export function PublicApplicationForm({ publicId, slug, labels, config = { phone: 'OPTIONAL', cv: 'OPTIONAL', motivation: 'OPTIONAL' }, siteKey: configuredSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '' }: PublicApplicationFormProps): ReactElement {
  const siteKey = configuredSiteKey.trim()
  const [state, setState] = useState<FormState>('FORM')
  const [file, setFile] = useState<File | null>(null)
  const [challengeState, setChallengeState] = useState<ChallengeState>(siteKey ? 'LOADING' : 'UNAVAILABLE')
  const [challengeToken, setChallengeToken] = useState('')
  const challengeContainerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)

  const renderChallenge = useCallback(() => {
    const turnstile = window.turnstile
    const container = challengeContainerRef.current
    if (!siteKey) {
      setChallengeState('UNAVAILABLE')
      return
    }
    if (!turnstile || !container) {
      setChallengeState('ERROR')
      return
    }
    if (widgetIdRef.current !== null) {
      turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
    setChallengeToken('')
    setChallengeState('LOADING')
    try {
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        callback: (token) => {
          setChallengeToken(token)
          setChallengeState('SOLVED')
        },
        'expired-callback': () => {
          setChallengeToken('')
          setChallengeState('LOADING')
        },
        'error-callback': () => {
          setChallengeToken('')
          setChallengeState('ERROR')
        },
      })
    } catch {
      setChallengeState('ERROR')
    }
  }, [siteKey])

  const resetChallenge = useCallback(() => {
    setChallengeToken('')
    setChallengeState(siteKey ? 'LOADING' : 'UNAVAILABLE')
    const turnstile = window.turnstile
    if (turnstile && widgetIdRef.current !== null) {
      try {
        turnstile.reset(widgetIdRef.current)
      } catch {
        setChallengeState('ERROR')
      }
    }
  }, [siteKey])

  useEffect(() => {
    if (!siteKey || !window.turnstile) return
    const timer = window.setTimeout(renderChallenge, 0)
    return () => window.clearTimeout(timer)
  }, [renderChallenge, siteKey])

  useEffect(() => () => {
    const turnstile = window.turnstile
    if (turnstile && widgetIdRef.current !== null) turnstile.remove(widgetIdRef.current)
  }, [])

  if (state === 'CONFIRMED') return <section aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><h2 className="text-xl font-semibold">{labels.confirmed}</h2><p className="mt-2 text-sm leading-6">{labels.confirmedDescription}</p></section>
  const challengeMessage = challengeState === 'UNAVAILABLE'
    ? labels.challengeUnavailable
    : challengeState === 'ERROR'
      ? labels.challengeError
      : challengeState === 'LOADING'
        ? labels.challengeLoading
        : null
  return (
    <>
      {siteKey ? <Script id="cloudflare-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onError={() => setChallengeState('ERROR')} onLoad={renderChallenge} /> : null}
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault()
      if (!challengeToken || challengeState !== 'SOLVED') {
        setState('ERROR')
        return
      }
      setState('SUBMITTING')
      const form = new FormData(event.currentTarget)
      form.set('slug', slug); form.set('idempotencyKey', crypto.randomUUID()); form.set('renderedAt', new Date().toISOString()); form.set('challengeToken', challengeToken)
      if (file) form.set('cv', file)
      try {
        const response = await fetch(`/api/public/recruitment/vacancies/${publicId}/applications`, { method: 'POST', body: form })
        const body: unknown = await response.json().catch(() => null)
        if (response.ok) setState('CONFIRMED')
        else {
          setState(typeof body === 'object' && body !== null && 'state' in body && body.state === 'SECURITY_BLOCKED' ? 'SECURITY_BLOCKED' : 'ERROR')
          resetChallenge()
        }
      } catch {
        setState('ERROR')
        resetChallenge()
      }
    }}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">{labels.firstName}<input required name="firstName" className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" /></label>
        <label className="block text-sm font-medium">{labels.lastName}<input required name="lastName" className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" /></label>
      </div>
      <label className="block text-sm font-medium">{labels.email}<input required type="email" name="email" className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" /></label>
      {config.phone !== 'HIDDEN' ? <label className="block text-sm font-medium">{labels.phone}<input name="phone" required={config.phone === 'REQUIRED'} type="tel" className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" /></label> : null}
      {config.motivation !== 'HIDDEN' ? <label className="block text-sm font-medium">{labels.motivation}<textarea name="motivation" required={config.motivation === 'REQUIRED'} className="mt-2 min-h-32 w-full rounded-lg border bg-background px-3 py-3 text-sm" /></label> : null}
      {config.cv !== 'HIDDEN' ? <label className="block text-sm font-medium">{labels.cv}<input accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required={config.cv === 'REQUIRED'} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border bg-background px-3 py-2 text-sm" /></label> : null}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground"><p>{labels.privacy}</p><a className="mt-2 inline-block underline" href="#privacy">{labels.privacyLink}</a></div>
      <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
      <fieldset aria-describedby="public-application-challenge-description" className="space-y-3 rounded-lg border bg-muted/30 p-4" disabled={state === 'SUBMITTING'}>
        <legend className="px-1 text-sm font-medium">{labels.challenge}</legend>
        <p className="text-sm text-muted-foreground" id="public-application-challenge-description">{labels.challengeDescription}</p>
        <div aria-live="polite" className="min-h-16"><div ref={challengeContainerRef} />{challengeMessage ? <p className="mt-2 text-xs text-muted-foreground">{challengeMessage}</p> : null}</div>
        {challengeState === 'ERROR' || state === 'SECURITY_BLOCKED' ? <button className="rounded-lg border px-3 py-2 text-sm font-medium" onClick={() => { setState('FORM'); resetChallenge() }} type="button">{labels.challengeRetry}</button> : null}
      </fieldset>
      {state === 'ERROR' || state === 'SECURITY_BLOCKED' ? <p aria-live="polite" className="text-sm text-destructive">{state === 'SECURITY_BLOCKED' ? labels.securityBlocked : labels.error}</p> : null}
      <button className="h-12 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60" disabled={state === 'SUBMITTING' || !challengeToken || challengeState !== 'SOLVED'} type="submit">{state === 'SUBMITTING' ? labels.submitting : labels.submit}</button>
    </form>
    </>
  )
}

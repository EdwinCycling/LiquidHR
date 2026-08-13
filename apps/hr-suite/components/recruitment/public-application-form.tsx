'use client'

import { useState } from 'react'
import type { ReactElement } from 'react'

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

export function PublicApplicationForm({ publicId, slug, labels, config = { phone: 'OPTIONAL', cv: 'OPTIONAL', motivation: 'OPTIONAL' } }: { readonly publicId: string; readonly slug: string; readonly labels: PublicApplicationLabels; readonly config?: PublicApplicationFormConfig }): ReactElement {
  const [state, setState] = useState<'FORM' | 'SUBMITTING' | 'CONFIRMED' | 'SECURITY_BLOCKED' | 'ERROR'>('FORM')
  const [file, setFile] = useState<File | null>(null)
  if (state === 'CONFIRMED') return <section aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"><h2 className="text-xl font-semibold">{labels.confirmed}</h2><p className="mt-2 text-sm leading-6">{labels.confirmedDescription}</p></section>
  if (state === 'SECURITY_BLOCKED') return <section aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h2 className="text-xl font-semibold">{labels.securityBlocked}</h2><p className="mt-2 text-sm leading-6">{labels.error}</p></section>
  return (
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault(); setState('SUBMITTING')
      const form = new FormData(event.currentTarget)
      form.set('slug', slug); form.set('idempotencyKey', crypto.randomUUID()); form.set('renderedAt', new Date().toISOString())
      if (file) form.set('cv', file)
      try {
        const response = await fetch(`/api/public/recruitment/vacancies/${publicId}/applications`, { method: 'POST', body: form })
        const body: unknown = await response.json().catch(() => null)
        if (response.ok) setState('CONFIRMED')
        else if (typeof body === 'object' && body !== null && 'state' in body && body.state === 'SECURITY_BLOCKED') setState('SECURITY_BLOCKED')
        else setState('ERROR')
      } catch { setState('ERROR') }
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
      {state === 'ERROR' ? <p aria-live="polite" className="text-sm text-destructive">{labels.error}</p> : null}
      <button className="h-12 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60" disabled={state === 'SUBMITTING'} type="submit">{state === 'SUBMITTING' ? labels.submitting : labels.submit}</button>
    </form>
  )
}

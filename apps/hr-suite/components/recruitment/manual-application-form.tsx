'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactElement } from 'react'

interface ManualApplicationFormProps {
  readonly vacancyId: string
  readonly labels: { readonly title: string; readonly firstName: string; readonly lastName: string; readonly email: string; readonly phone: string; readonly motivation: string; readonly save: string; readonly saving: string; readonly saved: string; readonly error: string }
}

export function ManualApplicationForm({ vacancyId, labels }: ManualApplicationFormProps): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setState('SAVING')
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/recruitment/vacancies/${vacancyId}/applications`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firstName: form.get('firstName'), lastName: form.get('lastName'), privateEmail: form.get('email'), phone: form.get('phone') || null, motivation: form.get('motivation') || null }) }).catch(() => null)
    if (!response?.ok) { setState('ERROR'); return }
    event.currentTarget.reset(); setState('SAVED'); router.refresh()
  }
  return <details className="rounded-xl border bg-surface p-5"><summary className="cursor-pointer font-semibold">{labels.title}</summary><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}><label className="text-sm font-medium">{labels.firstName}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="firstName" required /></label><label className="text-sm font-medium">{labels.lastName}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="lastName" required /></label><label className="text-sm font-medium">{labels.email}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="email" required type="email" /></label><label className="text-sm font-medium">{labels.phone}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="phone" type="tel" /></label><label className="sm:col-span-2 text-sm font-medium">{labels.motivation}<textarea className="mt-2 min-h-24 w-full rounded-lg border bg-background px-3 py-3 text-sm" name="motivation" /></label><div className="sm:col-span-2 flex items-center justify-between gap-3"><div>{state === 'SAVED' ? <p className="text-sm text-emerald-700">{labels.saved}</p> : null}{state === 'ERROR' ? <p className="text-sm text-destructive">{labels.error}</p> : null}</div><button className="button-primary" disabled={state === 'SAVING'} type="submit">{state === 'SAVING' ? labels.saving : labels.save}</button></div></form></details>
}

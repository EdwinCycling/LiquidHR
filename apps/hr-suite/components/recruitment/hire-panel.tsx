'use client'

import { useState, type FormEvent, type ReactElement } from 'react'

interface HirePanelProps {
  readonly applicationId: string
  readonly version: number
  readonly labels: { readonly title: string; readonly description: string; readonly administrationId: string; readonly employeeId: string; readonly employmentId: string; readonly confirm: string; readonly saved: string; readonly error: string }
}

export function HirePanel({ applicationId, version, labels }: HirePanelProps): ReactElement {
  const [state, setState] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setState('SAVING')
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/recruitment/applications/${applicationId}/hire`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choice: 'EXISTING_EMPLOYEE', administrationId: form.get('administrationId'), employeeId: form.get('employeeId'), employmentId: form.get('employmentId') || null, expectedVersion: version }) }).catch(() => null)
    setState(response?.ok ? 'SAVED' : 'ERROR')
  }
  return <details className="rounded-xl border bg-surface p-5"><summary className="cursor-pointer font-semibold">{labels.title}</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">{labels.description}</p><form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}><label className="block text-sm font-medium">{labels.administrationId}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="administrationId" required /></label><label className="block text-sm font-medium">{labels.employeeId}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="employeeId" required /></label><label className="block text-sm font-medium">{labels.employmentId}<input className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm" name="employmentId" /></label>{state === 'SAVED' ? <p className="text-sm text-emerald-700">{labels.saved}</p> : null}{state === 'ERROR' ? <p className="text-sm text-destructive">{labels.error}</p> : null}<button className="button-primary w-full" disabled={state === 'SAVING'} type="submit">{labels.confirm}</button></form></details>
}

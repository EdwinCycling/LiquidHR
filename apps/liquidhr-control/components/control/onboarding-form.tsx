'use client'

import { useActionState, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { onboardTenant, type ControlActionState } from '@/lib/control/actions'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { FormField } from '@/components/patterns/form-field'

const initialState: ControlActionState = { code: 'idle' }

export function OnboardingForm() {
  const labels = getDictionary().onboarding
  const [state, action, pending] = useActionState(onboardTenant, initialState)
  const [rows, setRows] = useState([crypto.randomUUID()])
  return <form action={action} className="mt-8 space-y-6">
    <Surface className="p-5 sm:p-6"><h2 className="text-lg font-semibold">{labels.company}</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><FormField label={labels.name}><TextInput name="name" placeholder={labels.namePlaceholder} required /></FormField><FormField label={labels.slug}><TextInput name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder={labels.slugPlaceholder} required /></FormField><FormField className="sm:col-span-2" label={labels.email}><TextInput name="primaryContactEmail" required type="email" /></FormField></div></Surface>
    <fieldset className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6"><legend className="px-2 text-lg font-semibold">{labels.model}</legend><div className="grid gap-4 md:grid-cols-2"><label className="rounded-[var(--radius-surface)] border border-border p-5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-subtle"><input className="mr-3 accent-primary" defaultChecked name="administrationMode" type="radio" value="COMBINED" /><strong className="font-medium">{labels.combined}</strong><span className="mt-2 block text-sm leading-6 text-muted-foreground">{labels.combinedHint}</span></label><label className="rounded-[var(--radius-surface)] border border-border p-5 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-subtle"><input className="mr-3 accent-primary" name="administrationMode" type="radio" value="SEPARATE" /><strong className="font-medium">{labels.separate}</strong><span className="mt-2 block text-sm leading-6 text-muted-foreground">{labels.separateHint}</span></label></div></fieldset>
    <Surface className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{labels.administrations}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.administrationsHint}</p></div><Button onClick={() => setRows((current) => [...current, crypto.randomUUID()])} size="sm" type="button" variant="secondary"><Plus />{labels.addAdministration}</Button></div><div className="mt-5 space-y-3">{rows.map((row, index) => <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface-subtle p-4 sm:grid-cols-[150px_minmax(0,1fr)_auto]" key={row}><FormField label={labels.administrationCode}><TextInput defaultValue={index === 0 ? 'HOLDING' : ''} name="administrationCode" required /></FormField><FormField label={labels.administrationName}><TextInput name="administrationName" required /></FormField><button aria-label={labels.remove} className="self-end rounded-[var(--radius-control)] p-3 text-destructive transition-colors hover:bg-destructive-subtle focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-30" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((id) => id !== row))} type="button"><Trash2 size={18} /></button></div>)}</div></Surface>
    {state.code !== 'idle' ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-4 py-3 text-sm text-destructive" role="alert">{state.code === 'invalid' ? labels.invalid : labels.failed}</p> : null}
    <div className="flex flex-col justify-between gap-5 rounded-[var(--radius-surface)] bg-primary p-5 text-primary-foreground sm:flex-row sm:items-center sm:p-6"><div><p className="font-semibold">{labels.after}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-primary-foreground/70">{labels.afterHint}</p></div><Button className="shrink-0" loading={pending} type="submit" variant="secondary">{pending ? labels.submitting : labels.submit}</Button></div>
  </form>
}

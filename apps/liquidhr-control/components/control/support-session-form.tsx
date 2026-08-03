'use client'

import { useActionState } from 'react'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'
import { startSupportSession, type ControlActionState } from '@/lib/control/actions'

const initialState: ControlActionState = { code: 'idle' }

export function SupportSessionForm({ tenantId }: { tenantId: string }) {
  const labels = getDictionary().tenant
  const [state, action, pending] = useActionState(startSupportSession, initialState)

  return <form action={action} className="mt-5 space-y-4">
    <input name="tenantId" type="hidden" value={tenantId} />
    <div className="rounded-xl bg-panel-soft p-3 text-sm leading-6 text-muted-foreground"><div className="flex items-center gap-2 font-bold text-foreground"><ShieldCheck size={16} />{labels.supportReadOnly}</div><p className="mt-1">{labels.supportReadOnlyHint}</p></div>
    <label className="block text-sm font-semibold">{labels.supportReason}<textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-border bg-panel-soft px-3 py-2 font-normal outline-none focus:border-primary" maxLength={500} minLength={5} name="reason" placeholder={labels.supportReasonPlaceholder} required /></label>
    <label className="block text-sm font-semibold">{labels.supportDuration}<select className="mt-2 h-11 w-full rounded-xl border border-border bg-panel-soft px-3 font-normal outline-none focus:border-primary" defaultValue="30" name="durationMinutes"><option value="15">{labels.supportDuration15}</option><option value="30">{labels.supportDuration30}</option><option value="60">{labels.supportDuration60}</option></select></label>
    {state.code !== 'idle' ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{state.code === 'invalid' ? labels.supportInvalid : labels.supportFailed}</p> : null}
    <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={16} /> : null}{pending ? labels.supportStarting : labels.supportStart}</button>
  </form>
}

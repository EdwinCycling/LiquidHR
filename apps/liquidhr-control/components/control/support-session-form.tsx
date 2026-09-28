'use client'

import { useActionState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'
import { startSupportSession, type ControlActionState } from '@/lib/control/actions'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/patterns/form-field'

const initialState: ControlActionState = { code: 'idle' }

export function SupportSessionForm({ tenantId }: { tenantId: string }) {
  const labels = getDictionary().tenant
  const [state, action, pending] = useActionState(startSupportSession, initialState)

  return <form action={action} className="mt-5 space-y-4">
    <input name="tenantId" type="hidden" value={tenantId} />
    <div className="rounded-[var(--radius-control)] bg-surface-subtle p-3 text-sm leading-6 text-muted-foreground"><div className="flex items-center gap-2 font-medium text-foreground"><ShieldCheck size={16} />{labels.supportReadOnly}</div><p className="mt-1">{labels.supportReadOnlyHint}</p></div>
    <FormField label={labels.supportReason}><Textarea maxLength={500} minLength={5} name="reason" placeholder={labels.supportReasonPlaceholder} required /></FormField>
    <FormField label={labels.supportDuration}><DropdownSelect defaultValue="30" name="durationMinutes" searchPlaceholder={labels.selectSearch}><option value="15">{labels.supportDuration15}</option><option value="30">{labels.supportDuration30}</option><option value="60">{labels.supportDuration60}</option></DropdownSelect></FormField>
    {state.code !== 'idle' ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{state.code === 'invalid' ? labels.supportInvalid : labels.supportFailed}</p> : null}
    <Button className="w-full" loading={pending} type="submit">{pending ? labels.supportStarting : labels.supportStart}</Button>
  </form>
}

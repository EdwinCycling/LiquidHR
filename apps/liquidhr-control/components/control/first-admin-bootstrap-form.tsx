'use client'

import { useActionState } from 'react'
import { ExternalLink } from 'lucide-react'
import { bootstrapFirstAdminAction, type ControlActionState } from '@/lib/control/actions'
import type { HrGroup } from '@/lib/control/schemas'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { FormField } from '@/components/patterns/form-field'

const initialState: ControlActionState = { code: 'idle' }

export function FirstAdminBootstrapForm({ tenantId, groups }: { tenantId: string; groups: HrGroup[] }) {
  const labels = getDictionary().tenant
  const [state, action, pending] = useActionState(bootstrapFirstAdminAction, initialState)

  return <form action={action} className="mt-5 space-y-4">
    <input name="tenantId" type="hidden" value={tenantId} />
    <FormField hint={labels.bootstrapGroupHint} label={labels.bootstrapGroup}><DropdownSelect name="hrGroupId" required searchPlaceholder={labels.selectSearch}><option value="">{labels.bootstrapGroupPlaceholder}</option>{groups.filter((group) => group.isActive).map((group) => <option key={group.id} value={group.id}>{group.name} · {group.code}</option>)}</DropdownSelect></FormField>
    <FormField hint={labels.bootstrapAdministrationHint} label={labels.bootstrapAdministration}><DropdownSelect name="administrationId" required searchPlaceholder={labels.selectSearch}><option value="">{labels.bootstrapAdministrationPlaceholder}</option>{groups.filter((group) => group.isActive).flatMap((group) => group.administrations.filter((administration) => administration.isActive).map((administration) => <option key={administration.id} value={administration.id}>{group.name} · {administration.name} ({administration.code})</option>))}</DropdownSelect></FormField>
    <FormField hint={labels.bootstrapEmailHint} label={labels.bootstrapEmail}><TextInput autoComplete="email" name="email" required type="email" /></FormField>
    {state.code === 'invalid' ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{labels.bootstrapInvalid}</p> : null}
    {state.code === 'failed' ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{labels.bootstrapFailed}</p> : null}
    {state.code === 'success' ? <p className="rounded-[var(--radius-control)] bg-success-subtle px-3 py-2 text-sm text-success" role="status">{labels.bootstrapCreated}</p> : null}
    {state.captureUrl ? <div className="rounded-[var(--radius-control)] border border-success/30 bg-success-subtle p-3 text-sm text-success"><p className="font-medium">{labels.bootstrapCaptureTitle}</p><a className="mt-2 inline-flex items-center gap-2 break-all underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus" href={state.captureUrl}>{state.captureUrl}<ExternalLink size={14} /></a></div> : null}
    <Button loading={pending} type="submit">{pending ? labels.bootstrapCreating : labels.bootstrapCreate}</Button>
  </form>
}

'use client'

import { useActionState } from 'react'
import { Plus } from 'lucide-react'
import { createPlatformHrGroup, type ControlActionState } from '@/lib/control/actions'
import type { HrGroup } from '@/lib/control/schemas'
import { getDictionary } from '@/lib/i18n/dictionary'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/patterns/form-field'

const initialState: ControlActionState = { code: 'idle' }

export function HrGroupManager({ tenantId, groups, canWrite }: { tenantId: string; groups: HrGroup[]; canWrite: boolean }) {
  const labels = getDictionary().tenant
  const [state, action, pending] = useActionState(createPlatformHrGroup, initialState)

  return (
    <Surface className="mt-7 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold">{labels.hrGroups}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.hrGroupsHint}</p>
        </div>
        <span className="rounded-full bg-surface-subtle px-3 py-1 text-sm font-medium">{groups.length}</span>
      </div>

      <div className="mt-5 space-y-3">
        {groups.length === 0 ? <EmptyState title={labels.noHrGroups} /> : groups.map((group) => (
          <article className="rounded-[var(--radius-surface)] border border-border bg-surface-subtle p-4" key={group.id}>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="font-medium">{group.name}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.code}</p>
                {group.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p> : null}
              </div>
              <p className="text-sm text-muted-foreground">{group.administrations.length} {labels.administrations.toLocaleLowerCase()}</p>
            </div>
            {group.administrations.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{group.administrations.map((administration) => <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium" key={administration.id}>{administration.name} · {administration.administrationNumber}</span>)}</div> : null}
          </article>
        ))}
      </div>

      {canWrite ? <form action={action} className="mt-6 rounded-[var(--radius-surface)] border border-dashed border-border p-4">
        <input name="tenantId" type="hidden" value={tenantId} />
        <div className="flex items-center gap-2"><Plus size={17} /><h3 className="font-medium">{labels.createHrGroup}</h3></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label={labels.hrGroupCode}><TextInput name="code" required /></FormField>
          <FormField label={labels.hrGroupName}><TextInput name="name" required /></FormField>
          <FormField className="sm:col-span-2" label={labels.hrGroupDescription}><Textarea name="description" /></FormField>
        </div>
        {state.code === 'invalid' ? <p className="mt-4 rounded-[var(--radius-control)] bg-destructive-subtle px-4 py-3 text-sm text-destructive" role="alert">{labels.hrGroupInvalid}</p> : null}
        {state.code === 'failed' ? <p className="mt-4 rounded-[var(--radius-control)] bg-destructive-subtle px-4 py-3 text-sm text-destructive" role="alert">{labels.hrGroupFailed}</p> : null}
        {state.code === 'success' ? <p className="mt-4 rounded-[var(--radius-control)] bg-success-subtle px-4 py-3 text-sm text-success" role="status">{labels.hrGroupCreated}</p> : null}
        <Button className="mt-4" loading={pending} type="submit">{pending ? labels.hrGroupCreating : labels.hrGroupCreate}</Button>
      </form> : null}
    </Surface>
  )
}

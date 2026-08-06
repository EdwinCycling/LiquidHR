'use client'

import { useActionState } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import { createPlatformHrGroup, type ControlActionState } from '@/lib/control/actions'
import type { HrGroup } from '@/lib/control/schemas'
import { getDictionary } from '@/lib/i18n/dictionary'

const initialState: ControlActionState = { code: 'idle' }

export function HrGroupManager({ tenantId, groups, canWrite }: { tenantId: string; groups: HrGroup[]; canWrite: boolean }) {
  const labels = getDictionary().tenant
  const [state, action, pending] = useActionState(createPlatformHrGroup, initialState)

  return (
    <section className="mt-7 rounded-2xl border border-border bg-panel p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold">{labels.hrGroups}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.hrGroupsHint}</p>
        </div>
        <span className="rounded-full bg-panel-soft px-3 py-1 text-sm font-bold">{groups.length}</span>
      </div>

      <div className="mt-5 space-y-3">
        {groups.length === 0 ? <p className="rounded-xl bg-panel-soft p-4 text-sm text-muted-foreground">{labels.noHrGroups}</p> : groups.map((group) => (
          <article className="rounded-xl border border-border bg-panel-soft p-4" key={group.id}>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="font-bold">{group.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.code}</p>
                {group.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p> : null}
              </div>
              <p className="text-sm text-muted-foreground">{group.administrations.length} {labels.administrations.toLocaleLowerCase()}</p>
            </div>
            {group.administrations.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{group.administrations.map((administration) => <span className="rounded-full border border-border bg-panel px-3 py-1 text-xs font-semibold" key={administration.id}>{administration.name} · {administration.administrationNumber}</span>)}</div> : null}
          </article>
        ))}
      </div>

      {canWrite ? <form action={action} className="mt-6 rounded-xl border border-dashed border-border p-4">
        <input name="tenantId" type="hidden" value={tenantId} />
        <div className="flex items-center gap-2"><Plus size={17} /><h3 className="font-bold">{labels.createHrGroup}</h3></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">{labels.hrGroupCode}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-panel-soft px-3 outline-none focus:border-primary" name="code" required /></label>
          <label className="text-sm font-semibold">{labels.hrGroupName}<input className="mt-2 h-11 w-full rounded-xl border border-border bg-panel-soft px-3 outline-none focus:border-primary" name="name" required /></label>
          <label className="text-sm font-semibold sm:col-span-2">{labels.hrGroupDescription}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-border bg-panel-soft px-3 py-2 outline-none focus:border-primary" name="description" /></label>
        </div>
        {state.code === 'invalid' ? <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{labels.hrGroupInvalid}</p> : null}
        {state.code === 'failed' ? <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{labels.hrGroupFailed}</p> : null}
        {state.code === 'success' ? <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm text-success" role="status">{labels.hrGroupCreated}</p> : null}
        <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={17} /> : null}{pending ? labels.hrGroupCreating : labels.hrGroupCreate}</button>
      </form> : null}
    </section>
  )
}

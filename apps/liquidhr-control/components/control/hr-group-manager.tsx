'use client'

import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionary'
import type { HrGroup } from '@/lib/control/schemas'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { HrGroupFormPanel, type HrGroupPanelState } from '@/components/control/hr-group-form-panel'

export function HrGroupManager({ tenantId, groups, canWrite }: { tenantId: string; groups: HrGroup[]; canWrite: boolean }) {
  const labels = getDictionary().tenant
  const [panel, setPanel] = useState<HrGroupPanelState | null>(null)
  const [notice, setNotice] = useState<'created' | 'updated' | null>(null)

  function openCreatePanel() {
    setNotice(null)
    setPanel({ kind: 'create', tenantId })
  }

  function openEditPanel(group: HrGroup) {
    setNotice(null)
    setPanel({ kind: 'edit', tenantId, group })
  }

  function handleSaved(kind: HrGroupPanelState['kind']) {
    setPanel(null)
    setNotice(kind === 'create' ? 'created' : 'updated')
  }

  return (
    <div className="space-y-4">
      {canWrite ? <div className="flex justify-end"><Button onClick={openCreatePanel} type="button"><Plus aria-hidden="true" size={17} />{labels.hrGroupAdd}</Button></div> : null}
      {notice ? <p className="rounded-[var(--radius-control)] bg-success-subtle px-4 py-3 text-sm text-success" role="status">{notice === 'created' ? labels.hrGroupCreated : labels.hrGroupUpdated}</p> : null}

      <div className="space-y-3">
        {groups.length === 0 ? <EmptyState title={labels.noHrGroups} /> : groups.map((group) => (
          <article className="rounded-[var(--radius-surface)] border border-border bg-surface-subtle p-4" key={group.id}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="font-medium">{group.name}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.code}</p>
                {group.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                <p className="text-sm text-muted-foreground">{group.administrations.length} {labels.administrations.toLocaleLowerCase()}</p>
                {canWrite ? <Button aria-label={labels.hrGroupEdit + ': ' + group.name} onClick={() => openEditPanel(group)} type="button" variant="secondary"><Pencil aria-hidden="true" size={16} />{labels.hrGroupEdit}</Button> : null}
              </div>
            </div>
            {group.administrations.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{group.administrations.map((administration) => <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium" key={administration.id}>{administration.name} · {administration.administrationNumber}</span>)}</div> : null}
          </article>
        ))}
      </div>

      {panel ? <HrGroupFormPanel key={panel.kind === 'edit' ? panel.group.id : 'create'} onClose={() => setPanel(null)} onSaved={handleSaved} panel={panel} /> : null}
    </div>
  )
}

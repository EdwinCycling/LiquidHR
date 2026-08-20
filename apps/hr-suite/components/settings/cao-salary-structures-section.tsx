'use client'

import type { SalaryStructureCatalog } from '@/lib/salary-structures/service'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

type Labels = {
  sectionTitle: string
  description: string
  scalesAndSteps: string
  salaryBands: string
  linked: string
  noActiveRevision: string
  save: string
  cancel: string
  unsaved: string
  saving: string
  saved: string
  failed: string
  readOnly: string
}

function formatDate(value: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00Z`))
}

function currentRevision(catalog: SalaryStructureCatalog, structureId: string): SalaryStructureCatalog['revisions'][number] | null {
  const today = new Date().toISOString().slice(0, 10)
  return catalog.revisions
    .filter((revision) => revision.salary_structure_id === structureId && revision.status === 'PUBLISHED')
    .sort((left, right) => right.effective_from.localeCompare(left.effective_from))
    .find((revision) => revision.effective_from <= today) ?? null
}

export function CaoSalaryStructuresSection({
  laborConditionSetId,
  catalog,
  locale,
  selectedStructureIds,
  labels,
}: {
  laborConditionSetId: string
  catalog: SalaryStructureCatalog
  locale: 'nl' | 'en'
  selectedStructureIds: string[]
  labels: Labels
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(() => new Set(selectedStructureIds))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null)
  const grouped = {
    scales: catalog.structures.filter((structure) => structure.structure_type === 'SCALE_WITH_STEPS'),
    bands: catalog.structures.filter((structure) => structure.structure_type === 'SALARY_BAND'),
  }

  function toggle(structureId: string): void {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(structureId)) next.delete(structureId)
      else next.add(structureId)
      return next
    })
    setDirty(true)
    setStatus(null)
  }

  async function save(): Promise<void> {
    setSaving(true)
    setStatus(null)
    const response = await fetch(`/api/settings/employment/labor-condition-sets/${laborConditionSetId}/salary-structures`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ salaryStructureIds: Array.from(selected) }),
    })
    setSaving(false)
    if (!response.ok) {
      setStatus('failed')
      return
    }
    setDirty(false)
    setStatus('saved')
    router.refresh()
  }

  function renderGroup(title: string, structures: SalaryStructureCatalog['structures']): ReactNode {
    return <section className="rounded-2xl border bg-background/70 p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3 space-y-2">
        {structures.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : structures.map((structure) => {
          const revision = currentRevision(catalog, structure.id)
          const isSelected = selected.has(structure.id)
          return <label className={`flex gap-3 rounded-xl border p-3 transition ${isSelected ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'}`} key={structure.id}>
            <input
              aria-label={`${structure.name} · ${title}`}
              checked={isSelected}
              className="mt-1 size-4 accent-primary"
              disabled={!catalog.canWriteRelations || saving}
              onChange={() => toggle(structure.id)}
              type="checkbox"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{structure.name}</span>
                {isSelected ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{labels.linked}</span> : null}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{structure.code ?? '—'} · {revision ? `${revision.currency_code} · ${formatDate(revision.effective_from, locale)}` : labels.noActiveRevision}</span>
            </span>
          </label>
        })}
      </div>
    </section>
  }

  return <section className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5" aria-labelledby={`cao-salary-structures-${laborConditionSetId}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold" id={`cao-salary-structures-${laborConditionSetId}`}>{labels.sectionTitle}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.description}</p>
      </div>
      {!catalog.canWriteRelations ? <p className="text-xs font-medium text-muted-foreground">{labels.readOnly}</p> : null}
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {renderGroup(labels.scalesAndSteps, grouped.scales)}
      {renderGroup(labels.salaryBands, grouped.bands)}
    </div>
    {catalog.canWriteRelations ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="text-sm" aria-live="polite">{status === 'saved' ? <span className="text-success">{labels.saved}</span> : status === 'failed' ? <span className="text-destructive">{labels.failed}</span> : dirty ? <span className="text-muted-foreground">{labels.unsaved}</span> : null}</div>
      <div className="flex gap-2">
        <button className="button-secondary" disabled={!dirty || saving} onClick={() => { setSelected(new Set(selectedStructureIds)); setDirty(false); setStatus(null) }} type="button">{labels.cancel}</button>
        <button className="button-primary" disabled={!dirty || saving} onClick={() => void save()} type="button">{saving ? labels.saving : labels.save}</button>
      </div>
    </div> : null}
  </section>
}

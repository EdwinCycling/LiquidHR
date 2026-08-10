'use client'

import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ResearchTargetOptions } from '@/lib/research/target-service'
import type { ResearchTargetMode } from '@/lib/research/schemas'
import { DropdownSelect } from '@/components/ui/dropdown-select'

interface TargetLabels {
  targetMode: string
  targetAll: string
  targetDepartments: string
  targetLocations: string
  targetEntities: string
  targetEmployees: string
  targetSearch: string
  targetEmpty: string
  selected: string
}

function selectedLabel(template: string, count: number) {
  return template.replace('{count}', String(count))
}

export function ResearchTargetPicker({ labels, options, mode, selectedIds, onModeChange, onSelectedIdsChange }: { labels: TargetLabels; options: ResearchTargetOptions; mode: ResearchTargetMode; selectedIds: string[]; onModeChange: (mode: ResearchTargetMode) => void; onSelectedIdsChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('')
  const available = useMemo(() => {
    const source = mode === 'DEPARTMENTS' ? options.departments : mode === 'LOCATIONS' ? options.locations : mode === 'ENTITIES' ? options.entities : mode === 'EMPLOYEES' ? options.employees.map((employee) => ({ id: employee.id, name: `${employee.label} · ${employee.employeeNumber}` })) : []
    const query = search.trim().toLocaleLowerCase()
    return query ? source.filter((option) => option.name.toLocaleLowerCase().includes(query)) : source
  }, [mode, options, search])

  function toggle(id: string) {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id])
  }

  return <div className="space-y-4">
    <div><label className="mb-2 block text-sm font-semibold" htmlFor="research-target-mode">{labels.targetMode}</label><DropdownSelect id="research-target-mode" onChange={(event) => { onModeChange(event.target.value as ResearchTargetMode); onSelectedIdsChange([]); setSearch('') }} searchable value={mode}><option value="ALL">{labels.targetAll}</option><option value="DEPARTMENTS">{labels.targetDepartments}</option><option value="LOCATIONS">{labels.targetLocations}</option><option value="ENTITIES">{labels.targetEntities}</option><option value="EMPLOYEES">{labels.targetEmployees}</option></DropdownSelect></div>
    {mode === 'ALL' ? <div className="rounded-2xl border border-dashed bg-muted/40 p-4 text-sm font-medium text-muted-foreground">{labels.targetAll}</div> : <div className="rounded-2xl border bg-background p-3">
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input aria-label={labels.targetSearch} className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => setSearch(event.target.value)} placeholder={labels.targetSearch} value={search} /></div>
      {selectedIds.length ? <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">{selectedLabel(labels.selected, selectedIds.length)}</span>{selectedIds.slice(0, 8).map((id) => { const item = [...options.departments, ...options.locations, ...options.entities, ...options.employees.map((employee) => ({ id: employee.id, name: employee.label }))].find((option) => option.id === id); return item ? <button className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground" key={id} onClick={() => toggle(id)} type="button">{item.name}<X aria-hidden="true" size={12} /></button> : null })}{selectedIds.length > 8 ? <span className="text-xs text-muted-foreground">+{selectedIds.length - 8}</span> : null}</div> : null}
      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">{available.length ? available.map((option) => <label className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${selectedIds.includes(option.id) ? 'bg-accent font-semibold text-accent-foreground' : 'hover:bg-muted'}`} key={option.id}><input checked={selectedIds.includes(option.id)} className="size-4 accent-[var(--primary)]" onChange={() => toggle(option.id)} type="checkbox" />{option.name}</label>) : <p className="px-3 py-5 text-center text-sm text-muted-foreground">{labels.targetEmpty}</p>}</div>
    </div>}
  </div>
}

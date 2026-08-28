'use client'

import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { FormField } from '@/components/patterns/form-field'
import type { ResearchTargetOptions } from '@/lib/research/target-service'
import type { ResearchTargetMode } from '@/lib/research/schemas'

interface TargetLabels { targetMode: string; targetAll: string; targetDepartments: string; targetLocations: string; targetEntities: string; targetEmployees: string; targetSearch: string; targetEmpty: string; selected: string }
function selectedLabel(template: string, count: number): string { return template.replace('{count}', String(count)) }

export function ResearchTargetPicker({ labels, options, mode, selectedIds, onModeChange, onSelectedIdsChange }: { labels: TargetLabels; options: ResearchTargetOptions; mode: ResearchTargetMode; selectedIds: string[]; onModeChange: (mode: ResearchTargetMode) => void; onSelectedIdsChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('')
  const available = useMemo(() => { const source = mode === 'DEPARTMENTS' ? options.departments : mode === 'LOCATIONS' ? options.locations : mode === 'ENTITIES' ? options.entities : mode === 'EMPLOYEES' ? options.employees.map((employee) => ({ id: employee.id, name: `${employee.label} · ${employee.employeeNumber}` })) : []; const query = search.trim().toLocaleLowerCase(); return query ? source.filter((option) => option.name.toLocaleLowerCase().includes(query)) : source }, [mode, options, search])
  const allOptions = [...options.departments, ...options.locations, ...options.entities, ...options.employees.map((employee) => ({ id: employee.id, name: employee.label }))]
  function toggle(id: string): void { onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((selected) => selected !== id) : [...selectedIds, id]) }
  return <div className="space-y-4"><FormField control={<DropdownSelect id="research-target-mode" onChange={(event) => { onModeChange(event.target.value as ResearchTargetMode); onSelectedIdsChange([]); setSearch('') }} searchable value={mode}><option value="ALL">{labels.targetAll}</option><option value="DEPARTMENTS">{labels.targetDepartments}</option><option value="LOCATIONS">{labels.targetLocations}</option><option value="ENTITIES">{labels.targetEntities}</option><option value="EMPLOYEES">{labels.targetEmployees}</option></DropdownSelect>} label={labels.targetMode} required />{mode === 'ALL' ? <Surface className="border-dashed p-4 text-sm font-medium text-muted-foreground" variant="subtle">{labels.targetAll}</Surface> : <Surface className="p-3" variant="subtle"><TextInput aria-label={labels.targetSearch} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} placeholder={labels.targetSearch} value={search} />{selectedIds.length ? <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">{selectedLabel(labels.selected, selectedIds.length)}</span>{selectedIds.slice(0, 8).map((id) => { const item = allOptions.find((option) => option.id === id); return item ? <Badge key={id}><span>{item.name}</span><Button aria-label={`${labels.selected}: ${item.name}`} className="ml-1 min-h-5 px-1" onClick={() => toggle(id)} size="sm" type="button" variant="ghost"><X aria-hidden="true" size={12} /></Button></Badge> : null })}{selectedIds.length > 8 ? <span className="text-xs text-muted-foreground">+{selectedIds.length - 8}</span> : null}</div> : null}<div className="mt-3 max-h-64 space-y-1 overflow-y-auto">{available.length ? available.map((option) => <div className={`rounded-[var(--radius-control)] px-3 py-2.5 text-sm ${selectedIds.includes(option.id) ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`} key={option.id}><Checkbox checked={selectedIds.includes(option.id)} label={option.name} onChange={() => toggle(option.id)} /></div>) : <p className="px-3 py-5 text-center text-sm text-muted-foreground">{labels.targetEmpty}</p>}</div></Surface>}</div>
}

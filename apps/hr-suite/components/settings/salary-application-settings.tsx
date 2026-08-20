'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { SalaryApplicationRoute } from '@/lib/salary-application/service'

type StructureOption = {
  id: string
  code: string | null
  name: string
  structureType: 'SCALE_WITH_STEPS' | 'SALARY_BAND'
  isActive: boolean
}

type Labels = {
  intro: string
  routeTitle: string
  routeDescription: string
  manual: string
  manualDescription: string
  minimumWage: string
  minimumWageDescription: string
  scaleWithSteps: string
  scaleWithStepsDescription: string
  salaryBand: string
  salaryBandDescription: string
  structuresTitle: string
  structuresDescription: string
  searchStructures: string
  scales: string
  bands: string
  noStructures: string
  save: string
  saved: string
  failed: string
  readOnly: string
}

const routeOrder: SalaryApplicationRoute[] = ['MANUAL', 'MINIMUM_WAGE', 'SCALE_WITH_STEPS', 'SALARY_BAND']

export function SalaryApplicationSettings({
  routes,
  structureIds,
  structures,
  canWrite,
  labels,
}: {
  routes: SalaryApplicationRoute[]
  structureIds: string[]
  structures: StructureOption[]
  canWrite: boolean
  labels: Labels
}) {
  const router = useRouter()
  const [selectedRoutes, setSelectedRoutes] = useState<SalaryApplicationRoute[]>(() => routeOrder.filter((route) => routes.includes(route)))
  const [selectedStructureIds, setSelectedStructureIds] = useState<string[]>(structureIds)
  const [search, setSearch] = useState('')
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle')
  const filteredStructures = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return query
      ? structures.filter((structure) => `${structure.code ?? ''} ${structure.name}`.toLocaleLowerCase().includes(query))
      : structures
  }, [search, structures])

  function toggleRoute(route: SalaryApplicationRoute, enabled: boolean): void {
    if (route === 'MANUAL') return
    setSelectedRoutes((current) => enabled ? routeOrder.filter((item) => item === route || current.includes(item)) : current.filter((item) => item !== route))
    setState('idle')
  }

  function toggleStructure(id: string, enabled: boolean): void {
    setSelectedStructureIds((current) => enabled ? [...new Set([...current, id])] : current.filter((item) => item !== id))
    setState('idle')
  }

  async function save(): Promise<void> {
    const response = await fetch('/api/settings/employment-contracts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'SALARY_SETTINGS', routes: selectedRoutes, structureIds: selectedStructureIds }),
    })
    setState(response.ok ? 'saved' : 'failed')
    if (response.ok) router.refresh()
  }

  const routeCopy: Record<SalaryApplicationRoute, { title: string; description: string }> = {
    MANUAL: { title: labels.manual, description: labels.manualDescription },
    MINIMUM_WAGE: { title: labels.minimumWage, description: labels.minimumWageDescription },
    SCALE_WITH_STEPS: { title: labels.scaleWithSteps, description: labels.scaleWithStepsDescription },
    SALARY_BAND: { title: labels.salaryBand, description: labels.salaryBandDescription },
  }

  return <div className="max-w-4xl">
    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{labels.intro}</p>
    <fieldset className="mt-6 grid gap-3">
      <legend className="text-sm font-semibold">{labels.routeTitle}</legend>
      <p className="text-sm text-muted-foreground">{labels.routeDescription}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {routeOrder.map((route) => <label className={`flex gap-3 rounded-2xl border p-4 transition-colors ${selectedRoutes.includes(route) ? 'border-primary bg-primary/5' : 'bg-surface'}`} key={route}>
          <input className="mt-1 size-4" type="checkbox" checked={selectedRoutes.includes(route)} disabled={!canWrite || route === 'MANUAL'} onChange={(event) => toggleRoute(route, event.target.checked)} />
          <span><span className="block font-semibold">{routeCopy[route].title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{routeCopy[route].description}</span></span>
        </label>)}
      </div>
    </fieldset>
    <section className="mt-8 rounded-2xl border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-sm font-semibold">{labels.structuresTitle}</h2><p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{labels.structuresDescription}</p></div>
        <input aria-label={labels.searchStructures} className="form-field w-full sm:w-64" placeholder={labels.searchStructures} value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {(['SCALE_WITH_STEPS', 'SALARY_BAND'] as const).map((structureType) => {
          const items = filteredStructures.filter((structure) => structure.structureType === structureType)
          return <fieldset className="rounded-2xl border p-4" key={structureType}>
            <legend className="px-1 text-sm font-semibold">{structureType === 'SCALE_WITH_STEPS' ? labels.scales : labels.bands}</legend>
            <div className="mt-2 grid gap-2">{items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noStructures}</p> : items.map((structure) => <label className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm" key={structure.id}>
              <input className="size-4" type="checkbox" checked={selectedStructureIds.includes(structure.id)} disabled={!canWrite || !structure.isActive} onChange={(event) => toggleStructure(structure.id, event.target.checked)} />
              <span><span className="block font-medium">{structure.name}</span>{structure.code && <span className="text-xs text-muted-foreground">{structure.code}</span>}</span>
            </label>)}</div>
          </fieldset>
        })}
      </div>
    </section>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" className="button-primary" disabled={!canWrite} onClick={() => void save()}>{labels.save}</button>
      {!canWrite && <p className="text-sm text-muted-foreground">{labels.readOnly}</p>}
      {state === 'saved' && <p role="status" className="text-sm text-success">{labels.saved}</p>}
      {state === 'failed' && <p role="alert" className="text-sm text-destructive">{labels.failed}</p>}
    </div>
  </div>
}

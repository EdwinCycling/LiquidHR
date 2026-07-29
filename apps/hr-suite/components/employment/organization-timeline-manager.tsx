'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

interface Placement {
  id: string
  departmentId: string
  departmentName: string
  jobId: string | null
  jobName: string
  effectiveFrom: string
  effectiveTo: string | null
}

export function OrganizationTimelineManager({ employmentId, placements, options, canWrite, labels }: {
  employmentId: string
  placements: Placement[]
  options: {
    departments: Array<{ id: string; code: string; name: string }>
    jobs: Array<{ id: string; code: string; name: string }>
  }
  canWrite: boolean
  labels: {
    current: string; history: string; add: string; edit: string; save: string; cancel: string
    department: string; job: string; effectiveOn: string; active: string; failed: string
  }
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Placement | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view')
  const [effectiveOn, setEffectiveOn] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [jobId, setJobId] = useState('')
  const [error, setError] = useState('')

  function open(placement: Placement): void {
    setSelected(placement); setMode('view'); setEffectiveOn(placement.effectiveFrom)
    setDepartmentId(placement.departmentId); setJobId(placement.jobId ?? ''); setError('')
  }
  function add(): void {
    const current = placements[0]
    setSelected(null); setMode('add'); setEffectiveOn('')
    setDepartmentId(current?.departmentId ?? options.departments[0]?.id ?? '')
    setJobId(current?.jobId ?? options.jobs[0]?.id ?? ''); setError('')
  }
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    const response = await fetch(`/api/employments/${employmentId}/organization`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        placementId: mode === 'edit' ? selected?.id : null,
        effectiveOn, departmentId, jobId,
      }),
    })
    if (!response.ok) {
      const result = await response.json() as { code?: string }
      setError(result.code ?? labels.failed); return
    }
    setSelected(null); setMode('view'); router.refresh()
  }

  return <section className="rounded-2xl border bg-surface p-5 shadow-sm">
    <div className="flex justify-end">{canWrite && <button type="button" className="button-primary" onClick={add}>{labels.add}</button>}</div>
    <div className="mt-4 grid gap-3">{placements.map((placement, index) => <button type="button" key={placement.id} onClick={() => open(placement)} className="cursor-pointer rounded-2xl border p-4 text-left transition hover:border-primary hover:bg-primary/5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{index === 0 ? labels.current : labels.history}</p><p className="mt-1 font-semibold">{placement.departmentName}</p></div><span className="status-chip bg-accent text-accent-foreground">{placement.effectiveTo ?? labels.active}</span></div>
      <p className="mt-3 text-sm text-muted-foreground">{placement.jobName} · {placement.effectiveFrom}</p>
    </button>)}</div>
    {(selected || mode === 'add') && <div className="fixed inset-0 z-[70] grid place-items-center bg-sidebar/70 p-4" role="presentation">
      <form onSubmit={save} role="dialog" aria-modal="true" className="w-full max-w-xl rounded-3xl border bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4"><h3 className="text-xl font-semibold">{mode === 'add' ? labels.add : mode === 'edit' ? labels.edit : selected?.departmentName}</h3><button type="button" className="button-secondary" onClick={() => { setSelected(null); setMode('view') }}>{labels.cancel}</button></div>
        {mode === 'view' ? <dl className="mt-5 grid gap-3 sm:grid-cols-2"><Item label={labels.department} value={selected?.departmentName ?? ''} /><Item label={labels.job} value={selected?.jobName ?? ''} /><Item label={labels.effectiveOn} value={selected?.effectiveFrom ?? ''} /><Item label={labels.active} value={selected?.effectiveTo ?? labels.active} /></dl> : <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">{labels.department}<select className="form-field" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.job}<select className="form-field" value={jobId} onChange={(event) => setJobId(event.target.value)}>{options.jobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">{labels.effectiveOn}<input type="date" readOnly={mode === 'edit'} className="form-field" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} /></label>
        </div>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-3 border-t pt-4">{mode === 'view' && canWrite ? <button type="button" className="button-primary" onClick={() => setMode('edit')}>{labels.edit}</button> : mode !== 'view' && <button type="submit" className="button-primary">{labels.save}</button>}</div>
      </form>
    </div>}
  </section>
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
}

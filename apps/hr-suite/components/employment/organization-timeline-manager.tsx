'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { buttonClasses } from '@/components/ui/button'

interface Placement { id: string; departmentId: string; departmentName: string; jobId: string | null; jobName: string; effectiveFrom: string; effectiveTo: string | null }

export function OrganizationTimelineManager({ employmentId, placements, options, canWrite, labels }: {
  employmentId: string; placements: Placement[]; options: { departments: Array<{ id: string; code: string; name: string }>; jobs: Array<{ id: string; code: string; name: string }> }; canWrite: boolean
  labels: { current: string; history: string; add: string; edit: string; save: string; cancel: string; department: string; job: string; effectiveOn: string; active: string; failed: string; discardTitle?: string; discardDescription?: string; discardConfirm?: string; discardCancel?: string }
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Placement | null>(null)
  const [mode, setMode] = useState<'edit' | 'add'>('add')
  const [effectiveOn, setEffectiveOn] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [jobId, setJobId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [initialValues, setInitialValues] = useState('')
  const currentValues = JSON.stringify({ mode, selectedId: selected?.id ?? null, effectiveOn, departmentId, jobId })
  const dirty = open && currentValues !== initialValues

  function openEdit(placement: Placement): void {
    setSelected(placement); setMode('edit'); setEffectiveOn(placement.effectiveFrom); setDepartmentId(placement.departmentId); setJobId(placement.jobId ?? ''); setError('');
    setInitialValues(JSON.stringify({ mode: 'edit', selectedId: placement.id, effectiveOn: placement.effectiveFrom, departmentId: placement.departmentId, jobId: placement.jobId ?? '' })); setOpen(true)
  }

  function add(): void {
    const current = placements[0]
    const nextValues = { mode: 'add', selectedId: null, effectiveOn: '', departmentId: current?.departmentId ?? options.departments[0]?.id ?? '', jobId: current?.jobId ?? options.jobs[0]?.id ?? '' }
    setSelected(null); setMode('add'); setEffectiveOn(nextValues.effectiveOn); setDepartmentId(nextValues.departmentId); setJobId(nextValues.jobId); setError(''); setInitialValues(JSON.stringify(nextValues)); setOpen(true)
  }

  function close(): void { setOpen(false); setSelected(null); setError('') }

  function discard(): void { close() }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    if (!canWrite) return
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch(`/api/employments/${employmentId}/organization`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ placementId: mode === 'edit' ? selected?.id : null, effectiveOn, departmentId, jobId }) })
      if (!response.ok) { const result = await response.json() as { code?: string }; setError(result.code ?? labels.failed); return }
      close(); router.refresh()
    } catch { setError(labels.failed) } finally { setSaving(false) }
  }

  return <Surface className="p-5">
    <div className="flex justify-end">{canWrite && options.departments.length > 0 ? <button type="button" className={buttonClasses()} onClick={add}>{labels.add}</button> : null}</div>
    <div className="mt-4 divide-y divide-subtle border-y border-subtle">{placements.map((placement, index) => { const content = <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{index === 0 ? labels.current : labels.history}</p><p className="mt-1 font-semibold">{placement.departmentName}</p></div><Badge tone={index === 0 ? 'info' : 'neutral'}>{placement.effectiveTo ?? labels.active}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{placement.jobName} · {placement.effectiveFrom}</p></>; return canWrite ? <button type="button" key={placement.id} onClick={() => openEdit(placement)} className="w-full cursor-pointer px-2 py-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{content}</button> : <article className="px-2 py-4 text-left" key={placement.id}>{content}</article> })}</div>
    {canWrite ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.cancel} dirty={dirty} dirtyProtection={{ title: labels.discardTitle ?? labels.cancel, description: labels.discardDescription ?? labels.failed, discardLabel: labels.discardConfirm ?? labels.cancel, keepEditingLabel: labels.discardCancel ?? labels.cancel }} onDiscard={discard} onOpenChange={(nextOpen) => { if (!nextOpen) close() }} onSubmit={save} open={open} saveLabel={labels.save} saving={saving} title={mode === 'add' ? labels.add : labels.edit}>
      <FormField label={labels.department} required control={<DropdownSelect required value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option disabled value="">{labels.department}</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect>} />
      <FormField label={labels.job} required control={<DropdownSelect required value={jobId} onChange={(event) => setJobId(event.target.value)}><option disabled value="">{labels.job}</option>{options.jobs.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</DropdownSelect>} />
      <FormField label={labels.effectiveOn} required control={<input type="date" required readOnly={mode === 'edit'} className="form-field" value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} />} />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </FormDrawer> : null}
  </Surface>
}

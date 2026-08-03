'use client'

import { useMemo, useState } from 'react'
import type { TalentGoal, TalentGoalWorkspace } from '@/lib/talent/goal-service'
import { TalentGoalCheckIns } from './talent-goal-check-ins'

type GoalMode = 'admin' | 'manager' | 'self'

type GoalLabels = {
  title: string
  subtitle: string
  add: string
  edit: string
  save: string
  cancel: string
  employee: string
  chooseEmployee: string
  capability: string
  noCapability: string
  notAvailable: string
  goalTitle: string
  description: string
  periodStart: string
  periodEnd: string
  progress: string
  status: string
  draft: string
  active: string
  completed: string
  cancelled: string
  archived: string
  complete: string
  cancelGoal: string
  archive: string
  all: string
  empty: string
  noResults: string
  saved: string
  failed: string
  readOnly: string
  checkIns: {
    title: string
    open: string
    reflection: string
    observation: string
    followUp: string
    body: string
    followUpTitle: string
    dueOn: string
    save: string
    complete: string
    empty: string
    saved: string
    failed: string
  }
}

type GoalDraft = {
  employeeId: string
  capabilityId: string
  title: string
  description: string
  periodStart: string
  periodEnd: string
  progressPercent: string
  status: 'DRAFT' | 'ACTIVE'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyDraft(employeeId = ''): GoalDraft {
  return { employeeId, capabilityId: '', title: '', description: '', periodStart: today(), periodEnd: '', progressPercent: '0', status: 'DRAFT' }
}

function statusLabel(status: string, labels: GoalLabels): string {
  if (status === 'ACTIVE') return labels.active
  if (status === 'COMPLETED') return labels.completed
  if (status === 'CANCELLED') return labels.cancelled
  if (status === 'ARCHIVED') return labels.archived
  return labels.draft
}

export function TalentGoalWorkspace({ mode, initial, labels }: { mode: GoalMode; initial: TalentGoalWorkspace; labels: GoalLabels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [draft, setDraft] = useState<GoalDraft>(() => emptyDraft(mode === 'self' ? '' : initial.employees[0]?.id ?? ''))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const visibleGoals = useMemo(() => filterStatus ? workspace.goals.filter((goal) => goal.status === filterStatus) : workspace.goals, [filterStatus, workspace.goals])

  function beginEdit(goal: TalentGoal) {
    setEditingId(goal.id)
    setDraft({ employeeId: goal.employee_id, capabilityId: goal.capability_id ?? '', title: goal.title, description: goal.description ?? '', periodStart: goal.period_start, periodEnd: goal.period_end ?? '', progressPercent: String(goal.progress_percent), status: goal.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT' })
    setMessage(null)
  }

  async function refresh() {
    const response = await fetch(`/api/talent/goals?mode=${mode}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('read')
    const payload = await response.json() as { data: TalentGoalWorkspace }
    setWorkspace(payload.data)
  }

  async function save() {
    setError(false)
    setMessage(null)
    const body = {
      employeeId: mode === 'self' ? undefined : draft.employeeId || undefined,
      capabilityId: draft.capabilityId || null,
      title: draft.title,
      description: draft.description || null,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd || null,
      progressPercent: Number(draft.progressPercent),
      status: draft.status,
    }
    const response = editingId
      ? await fetch(`/api/talent/goals/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capabilityId: body.capabilityId,
            title: body.title,
            description: body.description,
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
            progressPercent: body.progressPercent,
            status: body.status,
            version: workspace.goals.find((goal) => goal.id === editingId)?.version ?? 0,
          }),
        })
      : await fetch(`/api/talent/goals?mode=${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) { setError(true); setMessage(labels.failed); return }
    await refresh()
    setEditingId(null)
    setDraft(emptyDraft(mode === 'self' ? '' : workspace.employees[0]?.id ?? ''))
    setMessage(labels.saved)
  }

  async function command(goal: TalentGoal, status: 'COMPLETED' | 'CANCELLED' | 'ARCHIVED') {
    setError(false)
    setMessage(null)
    const response = await fetch(`/api/talent/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, version: goal.version }) })
    if (!response.ok) { setError(true); setMessage(labels.failed); return }
    await refresh()
    setMessage(labels.saved)
  }

  return <section className="mt-6 space-y-5">
    <header className="rounded-2xl border bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
      {message ? <p className={`mt-3 text-sm ${error ? 'text-destructive' : 'text-primary'}`} role="status">{message}</p> : null}
    </header>

    <div className="rounded-2xl border bg-surface p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        {mode !== 'self' ? <label className="text-sm"><span className="mb-1 block">{labels.employee}</span><select className="form-field" value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}><option value="">{labels.chooseEmployee}</option>{workspace.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>)}</select></label> : null}
        <label className="text-sm"><span className="mb-1 block">{labels.capability}</span><select className="form-field" value={draft.capabilityId} onChange={(event) => setDraft({ ...draft, capabilityId: event.target.value })}><option value="">{labels.noCapability}</option>{workspace.capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.label}</option>)}</select></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block">{labels.goalTitle}</span><input className="form-field" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block">{labels.description}</span><textarea className="form-field min-h-20" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.periodStart}</span><input className="form-field" type="date" value={draft.periodStart} onChange={(event) => setDraft({ ...draft, periodStart: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.periodEnd}</span><input className="form-field" type="date" value={draft.periodEnd} onChange={(event) => setDraft({ ...draft, periodEnd: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.progress}</span><input className="form-field" type="number" min="0" max="100" value={draft.progressPercent} onChange={(event) => setDraft({ ...draft, progressPercent: event.target.value })} /></label>
        <label className="text-sm"><span className="mb-1 block">{labels.status}</span><select className="form-field" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as 'DRAFT' | 'ACTIVE' })}><option value="DRAFT">{labels.draft}</option><option value="ACTIVE">{labels.active}</option></select></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button className="button-primary" onClick={() => void save()} type="button">{editingId ? labels.edit : labels.add}</button>{editingId ? <button className="button-secondary" onClick={() => { setEditingId(null); setDraft(emptyDraft(mode === 'self' ? '' : workspace.employees[0]?.id ?? '')) }} type="button">{labels.cancel}</button> : null}</div>
    </div>

    <div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">{labels.title}</h3><label className="text-sm"><span className="sr-only">{labels.status}</span><select className="form-field" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="">{labels.all}</option><option value="DRAFT">{labels.draft}</option><option value="ACTIVE">{labels.active}</option><option value="COMPLETED">{labels.completed}</option><option value="CANCELLED">{labels.cancelled}</option><option value="ARCHIVED">{labels.archived}</option></select></label></div>

    {visibleGoals.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{workspace.goals.length === 0 ? labels.empty : labels.noResults}</p> : <div className="grid gap-4 lg:grid-cols-2">{visibleGoals.map((goal) => <article className="rounded-2xl border bg-surface p-5 shadow-sm" key={goal.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{goal.employeeLabel ?? labels.employee}</p><h3 className="mt-1 text-lg font-semibold">{goal.title}</h3></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{statusLabel(goal.status, labels)}</span></div><p className="mt-3 text-sm text-muted-foreground">{goal.description ?? ''}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">{labels.periodStart}</dt><dd>{goal.period_start}</dd></div><div><dt className="text-muted-foreground">{labels.periodEnd}</dt><dd>{goal.period_end ?? labels.notAvailable}</dd></div><div><dt className="text-muted-foreground">{labels.progress}</dt><dd>{goal.progress_percent}%</dd></div><div><dt className="text-muted-foreground">{labels.capability}</dt><dd>{goal.capabilityLabel ?? labels.noCapability}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2">{goal.status === 'DRAFT' || goal.status === 'ACTIVE' ? <button className="button-secondary" onClick={() => beginEdit(goal)} type="button">{labels.edit}</button> : null}{goal.status === 'ACTIVE' ? <button className="button-secondary" onClick={() => void command(goal, 'COMPLETED')} type="button">{labels.complete}</button> : null}{goal.status === 'DRAFT' || goal.status === 'ACTIVE' ? <button className="button-secondary" onClick={() => void command(goal, 'CANCELLED')} type="button">{labels.cancelGoal}</button> : null}{mode === 'admin' && goal.status !== 'ARCHIVED' ? <button className="button-secondary" onClick={() => void command(goal, 'ARCHIVED')} type="button">{labels.archive}</button> : null}</div><TalentGoalCheckIns goalId={goal.id} mode={mode} labels={labels.checkIns} /></article>)}</div>}
    <p className="text-xs text-muted-foreground">{labels.readOnly}</p>
  </section>
}

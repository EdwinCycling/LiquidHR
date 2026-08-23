'use client'

import { Archive, Ban, CheckCircle2, PencilLine, Plus, RefreshCw } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { ActionMenu } from '@/components/ui/action-menu'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import type { TalentGoal, TalentGoalWorkspace as TalentGoalWorkspaceData } from '@/lib/talent/goal-service'
import { TalentGoalCheckIns, type CheckInLabels } from './talent-goal-check-ins'

type GoalMode = 'admin' | 'manager' | 'self'
type GoalStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
type EditableGoalStatus = 'DRAFT' | 'ACTIVE'

export type GoalLabels = {
  title: string
  subtitle: string
  add: string
  edit: string
  save: string
  cancel: string
  close: string
  employee: string
  own: string
  chooseEmployee: string
  capability: string
  noCapability: string
  noEmployees: string
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
  search: string
  searchPlaceholder: string
  refresh: string
  saved: string
  failed: string
  conflict: string
  notEditable: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardKeep: string
  confirmTitle: string
  confirmDescription: string
  confirmComplete: string
  confirmCancel: string
  confirmArchive: string
  readOnly: string
  checkIns: CheckInLabels
}

type GoalDraft = {
  employeeId: string
  capabilityId: string
  title: string
  description: string
  periodStart: string
  periodEnd: string
  progressPercent: string
  status: EditableGoalStatus
}

type GoalCommand = { goal: TalentGoal; status: Exclude<GoalStatus, 'DRAFT' | 'ACTIVE'> }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyDraft(employeeId = ''): GoalDraft {
  return { employeeId, capabilityId: '', title: '', description: '', periodStart: today(), periodEnd: '', progressPercent: '0', status: 'DRAFT' }
}

function draftFromGoal(goal: TalentGoal): GoalDraft {
  return {
    employeeId: goal.employee_id,
    capabilityId: goal.capability_id ?? '',
    title: goal.title,
    description: goal.description ?? '',
    periodStart: goal.period_start,
    periodEnd: goal.period_end ?? '',
    progressPercent: String(goal.progress_percent),
    status: goal.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
  }
}

function statusLabel(status: GoalStatus, labels: GoalLabels): string {
  if (status === 'ACTIVE') return labels.active
  if (status === 'COMPLETED') return labels.completed
  if (status === 'CANCELLED') return labels.cancelled
  if (status === 'ARCHIVED') return labels.archived
  return labels.draft
}

function statusTone(status: GoalStatus): BadgeTone {
  if (status === 'ACTIVE') return 'info'
  if (status === 'COMPLETED') return 'success'
  if (status === 'CANCELLED') return 'danger'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function canEditGoal(mode: GoalMode, goal: TalentGoal): boolean {
  if (!['DRAFT', 'ACTIVE'].includes(goal.status)) return false
  if (mode === 'admin') return true
  return mode === 'self' ? goal.source_type === 'SELF_ENTERED' : goal.source_type === 'MANAGER_ENTERED'
}

async function responseIsSuccessful(response: Response): Promise<boolean> {
  return response.ok
}

export function TalentGoalWorkspace({ mode, initial, labels }: { mode: GoalMode; initial: TalentGoalWorkspaceData; labels: GoalLabels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [draft, setDraft] = useState<GoalDraft>(() => emptyDraft(mode === 'self' ? '' : initial.employees[0]?.id ?? ''))
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [initialDraft, setInitialDraft] = useState<GoalDraft>(() => emptyDraft(mode === 'self' ? '' : initial.employees[0]?.id ?? ''))
  const [filterStatus, setFilterStatus] = useState<GoalStatus | ''>('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [commandCandidate, setCommandCandidate] = useState<GoalCommand | null>(null)
  const [commandPending, setCommandPending] = useState(false)

  const defaultEmployeeId = mode === 'self' ? '' : workspace.employees[0]?.id ?? ''
  const dirty = editorOpen && JSON.stringify(draft) !== JSON.stringify(initialDraft)
  const canSubmit = Boolean(draft.title.trim() && draft.periodStart && (mode === 'self' || draft.employeeId))

  const visibleGoals = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return workspace.goals.filter((goal) => {
      const matchesStatus = !filterStatus || goal.status === filterStatus
      const haystack = [goal.title, goal.description, goal.employeeLabel, goal.capabilityLabel].filter(Boolean).join(' ').toLocaleLowerCase()
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch))
    })
  }, [filterStatus, search, workspace.goals])

  function resetEditor(): void {
    const nextDraft = emptyDraft(defaultEmployeeId)
    setDraft(nextDraft)
    setInitialDraft(nextDraft)
    setEditingId(null)
    setEditorOpen(false)
  }

  function beginAdd(): void {
    const nextDraft = emptyDraft(defaultEmployeeId)
    setDraft(nextDraft)
    setInitialDraft(nextDraft)
    setEditingId(null)
    setMessage(null)
    setError(false)
    setEditorOpen(true)
    if (workspace.capabilities.length === 0 && mode !== 'self') void loadCapabilityOptions()
  }

  async function loadCapabilityOptions(): Promise<void> {
    try {
      const response = await fetch(`/api/talent/goals?mode=${mode}&includeEmployeeOptions=false&includeCapabilityOptions=true`, { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json() as { data: TalentGoalWorkspaceData }
      setWorkspace((current) => ({ ...current, capabilities: payload.data.capabilities }))
    } catch {
      // Capability is optional; a slow or restricted catalogue must not block goal creation.
    }
  }

  function beginEdit(goal: TalentGoal): void {
    if (!canEditGoal(mode, goal)) return
    const nextDraft = draftFromGoal(goal)
    setDraft(nextDraft)
    setInitialDraft(nextDraft)
    setEditingId(goal.id)
    setMessage(null)
    setError(false)
    setEditorOpen(true)
  }

  async function refresh(): Promise<void> {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/talent/goals?mode=${mode}&includeEmployeeOptions=true&includeCapabilityOptions=false`, { cache: 'no-store' })
      if (!await responseIsSuccessful(response)) throw new Error('read')
      const payload = await response.json() as { data: TalentGoalWorkspaceData }
      setWorkspace(payload.data)
    } catch {
      setError(true)
      setMessage(labels.failed)
    } finally {
      setRefreshing(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (saving || !canSubmit) return
    setSaving(true)
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
    try {
      const response = editingId
        ? await fetch(`/api/talent/goals/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, employeeId: undefined, version: workspace.goals.find((goal) => goal.id === editingId)?.version ?? 0 }),
          })
        : await fetch(`/api/talent/goals?mode=${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!await responseIsSuccessful(response)) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        if (payload?.error === 'TALENT_GOAL_VERSION_CONFLICT') throw new Error('conflict')
        throw new Error('save')
      }
      await refresh()
      resetEditor()
      setMessage(labels.saved)
    } catch (caught) {
      setError(true)
      setMessage(caught instanceof Error && caught.message === 'conflict' ? labels.conflict : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function runCommand(): Promise<void> {
    if (!commandCandidate || commandPending) return
    setCommandPending(true)
    setError(false)
    setMessage(null)
    try {
      const response = await fetch(`/api/talent/goals/${commandCandidate.goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: commandCandidate.status, version: commandCandidate.goal.version }) })
      if (!await responseIsSuccessful(response)) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        if (payload?.error === 'TALENT_GOAL_VERSION_CONFLICT') throw new Error('conflict')
        throw new Error('command')
      }
      setCommandCandidate(null)
      await refresh()
      setMessage(labels.saved)
    } catch (caught) {
      setError(true)
      setMessage(caught instanceof Error && caught.message === 'conflict' ? labels.conflict : labels.failed)
    } finally {
      setCommandPending(false)
    }
  }

  function commandLabel(status: GoalCommand['status']): string {
    if (status === 'COMPLETED') return labels.confirmComplete
    if (status === 'CANCELLED') return labels.confirmCancel
    return labels.confirmArchive
  }

  return (
    <section className="mt-6 space-y-5">
      <SectionHeader actions={<div className="flex flex-wrap gap-2"><Button disabled={refreshing} onClick={() => void refresh()} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : undefined} />{labels.refresh}</Button><Button onClick={beginAdd} size="sm" type="button"><Plus aria-hidden="true" />{labels.add}</Button></div>} description={labels.subtitle} title={labels.title} />
      {message ? <p className={`border px-4 py-3 text-sm ${error ? 'border-destructive/40 bg-destructive-surface text-destructive' : 'border-success bg-success-surface text-success'}`} role={error ? 'alert' : 'status'}>{message}</p> : null}

      <FilterBar aria-label={labels.search}>
        <div className="min-w-56 flex-1"><TextInput aria-label={labels.search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} value={search} /></div>
        <div className="w-full sm:w-48"><DropdownSelect aria-label={labels.status} onChange={(event) => setFilterStatus(event.target.value as GoalStatus | '')} value={filterStatus}><option value="">{labels.all}</option><option value="DRAFT">{labels.draft}</option><option value="ACTIVE">{labels.active}</option><option value="COMPLETED">{labels.completed}</option><option value="CANCELLED">{labels.cancelled}</option><option value="ARCHIVED">{labels.archived}</option></DropdownSelect></div>
      </FilterBar>

      {visibleGoals.length === 0 ? <EmptyState title={workspace.goals.length === 0 ? labels.empty : labels.noResults} /> : <div className="grid gap-4 lg:grid-cols-2">{visibleGoals.map((goal) => {
        const status = goal.status as GoalStatus
        const editable = canEditGoal(mode, goal)
        const actions = []
        if (editable) actions.push({ id: 'edit', label: labels.edit, onSelect: () => beginEdit(goal), icon: <PencilLine aria-hidden="true" /> })
        if (editable && status === 'ACTIVE') actions.push({ id: 'complete', label: labels.complete, onSelect: () => setCommandCandidate({ goal, status: 'COMPLETED' }), icon: <CheckCircle2 aria-hidden="true" /> })
        if (editable && (status === 'DRAFT' || status === 'ACTIVE')) actions.push({ id: 'cancel', label: labels.cancelGoal, onSelect: () => setCommandCandidate({ goal, status: 'CANCELLED' }), destructive: true, icon: <Ban aria-hidden="true" /> })
        if (mode === 'admin' && status !== 'ARCHIVED') actions.push({ id: 'archive', label: labels.archive, onSelect: () => setCommandCandidate({ goal, status: 'ARCHIVED' }), destructive: true, icon: <Archive aria-hidden="true" /> })
        return <Surface className="min-w-0 p-5" key={goal.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{mode === 'self' ? labels.own : goal.employeeLabel ?? labels.employee}</p><h3 className="mt-1 break-words text-lg font-semibold text-foreground">{goal.title}</h3></div><div className="flex shrink-0 items-start gap-2"><Badge tone={statusTone(status)}>{statusLabel(status, labels)}</Badge>{actions.length ? <ActionMenu items={actions} label={labels.status} /> : null}</div></div>
          {goal.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{goal.description}</p> : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><div><dt className="text-muted-foreground">{labels.periodStart}</dt><dd className="text-foreground"><time dateTime={goal.period_start}>{goal.period_start}</time></dd></div><div><dt className="text-muted-foreground">{labels.periodEnd}</dt><dd className="text-foreground">{goal.period_end ? <time dateTime={goal.period_end}>{goal.period_end}</time> : labels.notAvailable}</dd></div><div><dt className="text-muted-foreground">{labels.progress}</dt><dd className="text-foreground">{goal.progress_percent}%</dd></div><div><dt className="text-muted-foreground">{labels.capability}</dt><dd className="break-words text-foreground">{goal.capabilityLabel ?? labels.noCapability}</dd></div></dl>
          {!editable && status !== 'ARCHIVED' ? <p className="mt-4 text-xs text-muted-foreground">{labels.notEditable}</p> : null}
          <TalentGoalCheckIns goalId={goal.id} goalStatus={status} mode={mode} labels={labels.checkIns} />
        </Surface>
      })}</div>}
      <p className="text-xs text-muted-foreground">{labels.readOnly}</p>

      <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={mode === 'self' ? labels.subtitle : labels.employee} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardKeep, title: labels.discardTitle }} onDiscard={resetEditor} onOpenChange={(open) => { if (!open) resetEditor() }} onSubmit={(event) => void save(event)} open={editorOpen} saveLabel={editingId ? labels.edit : labels.save} saving={saving} disabled={!canSubmit} title={editingId ? labels.edit : labels.add}>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode !== 'self' ? <FormField control={<DropdownSelect aria-label={labels.employee} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })} searchable searchPlaceholder={labels.searchPlaceholder} value={draft.employeeId}>{workspace.employees.length ? workspace.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.label}</option>) : <option value="">{labels.noEmployees}</option>}</DropdownSelect>} label={labels.employee} required /> : null}
          <FormField className={mode === 'self' ? 'sm:col-span-2' : undefined} control={<DropdownSelect aria-label={labels.capability} onChange={(event) => setDraft({ ...draft, capabilityId: event.target.value })} searchable searchPlaceholder={labels.searchPlaceholder} value={draft.capabilityId}><option value="">{labels.noCapability}</option>{workspace.capabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.label}</option>)}</DropdownSelect>} label={labels.capability} />
          <FormField className="sm:col-span-2" control={<TextInput aria-label={labels.goalTitle} maxLength={160} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} />} label={labels.goalTitle} required />
          <FormField className="sm:col-span-2" control={<Textarea aria-label={labels.description} maxLength={4000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description} />} label={labels.description} />
          <FormField control={<TextInput aria-label={labels.periodStart} onChange={(event) => setDraft({ ...draft, periodStart: event.target.value })} required type="date" value={draft.periodStart} />} label={labels.periodStart} required />
          <FormField control={<TextInput aria-label={labels.periodEnd} onChange={(event) => setDraft({ ...draft, periodEnd: event.target.value })} type="date" value={draft.periodEnd} />} label={labels.periodEnd} />
          <FormField control={<TextInput aria-label={labels.progress} max="100" min="0" onChange={(event) => setDraft({ ...draft, progressPercent: event.target.value })} type="number" value={draft.progressPercent} />} label={labels.progress} />
          <FormField control={<DropdownSelect aria-label={labels.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EditableGoalStatus })} value={draft.status}><option value="DRAFT">{labels.draft}</option><option value="ACTIVE">{labels.active}</option></DropdownSelect>} label={labels.status} />
        </div>
      </FormDrawer>

      <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={commandCandidate ? commandLabel(commandCandidate.status) : labels.complete} description={labels.confirmDescription} destructive={commandCandidate?.status !== 'COMPLETED'} onConfirm={() => runCommand()} onOpenChange={(open) => { if (!open && !commandPending) setCommandCandidate(null) }} open={commandCandidate !== null} pending={commandPending} title={labels.confirmTitle} />
    </section>
  )
}

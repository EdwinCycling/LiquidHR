'use client'

/* eslint-disable @next/next/no-img-element -- employee avatars use the authenticated avatar route. */

import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpRight, Bell, Check, GripVertical, History, LockKeyhole, Minus, Plus, RotateCcw, Save, Search, Send, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import { TextInput } from '@/components/ui/text-input'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import type { TalentReviewCampaign, TalentReviewEmployee, TalentReviewScore, TalentReviewWorkspace as ReviewWorkspace } from '@/lib/talent-review/service'
import { GRID_VALUES, movementDirection, type GridCell, type GridValue } from '@/lib/talent-review/rules'

type Mode = 'hr' | 'manager'

export type TalentReviewLabels = {
  title: string
  subtitle: string
  campaignOverview: string
  newCampaign: string
  campaignName: string
  description: string
  startsOn: string
  endsOn: string
  previousCampaign: string
  noPreviousCampaign: string
  create: string
  save: string
  start: string
  close: string
  reopen: string
  remind: string
  campaigns: string
  noCampaigns: string
  selectCampaign: string
  active: string
  scheduled: string
  draft: string
  hrReview: string
  closed: string
  archived: string
  progress: string
  placed: string
  managers: string
  manager: string
  team: string
  employees: string
  searchEmployees: string
  searchCampaigns: string
  dropHere: string
  grid: string
  performance: string
  potential: string
  low: string
  normal: string
  high: string
  cellHighLow: string
  cellHighNormal: string
  cellHighHigh: string
  cellNormalLow: string
  cellNormalNormal: string
  cellNormalHigh: string
  cellLowLow: string
  cellLowNormal: string
  cellLowHigh: string
  selectedEmployee: string
  noEmployeeSelected: string
  previousScore: string
  currentScore: string
  note: string
  notePlaceholder: string
  saveDraft: string
  submitTeam: string
  submitted: string
  notStarted: string
  inProgress: string
  returned: string
  reminderSent: string
  noTeam: string
  noScores: string
  companyGrid: string
  teamGrid: string
  history: string
  noHistory: string
  readOnly: string
  saved: string
  failed: string
  openProfile: string
  place: string
  selectEmployeeFirst: string
  emptyCell: string
  movement: string
  movementUp: string
  movementDown: string
  movementStable: string
  movementNew: string
  confirmAction: string
  cancelAction: string
  confirmStartDescription: string
  confirmCloseDescription: string
  confirmReopenDescription: string
  confirmSubmitTitle: string
  confirmSubmitDescription: string
  confirmSubmit: string
}

type DraftScore = {
  performanceScore: GridValue | null
  potentialScore: GridValue | null
  note: string
  version?: number
}

type CreateDraft = {
  name: string
  description: string
  startsOn: string
  endsOn: string
  previousCampaignId: string
}

const DEFAULT_CREATE_DRAFT: CreateDraft = {
  name: '',
  description: '',
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  previousCampaignId: '',
}

const GRID_ROWS: readonly GridValue[] = ['HIGH', 'NORMAL', 'LOW']
const GRID_COLUMNS: readonly GridValue[] = ['LOW', 'NORMAL', 'HIGH']
const CELL_LABEL_KEYS: Record<GridCell, keyof TalentReviewLabels> = {
  HIGH_LOW: 'cellHighLow',
  HIGH_NORMAL: 'cellHighNormal',
  HIGH_HIGH: 'cellHighHigh',
  NORMAL_LOW: 'cellNormalLow',
  NORMAL_NORMAL: 'cellNormalNormal',
  NORMAL_HIGH: 'cellNormalHigh',
  LOW_LOW: 'cellLowLow',
  LOW_NORMAL: 'cellLowNormal',
  LOW_HIGH: 'cellLowHigh',
}

function asGridCell(value: string | null): GridCell | null {
  return value && Object.prototype.hasOwnProperty.call(CELL_LABEL_KEYS, value) ? value as GridCell : null
}

function valueLabel(value: GridValue, labels: TalentReviewLabels): string {
  return value === 'LOW' ? labels.low : value === 'NORMAL' ? labels.normal : labels.high
}

function scoreLabel(score: TalentReviewScore | null, labels: TalentReviewLabels): string {
  const cell = asGridCell(score?.grid_cell ?? null)
  return cell ? labels[CELL_LABEL_KEYS[cell]] : labels.noScores
}

function statusLabel(status: string, labels: TalentReviewLabels): string {
  const keys: Record<string, keyof TalentReviewLabels> = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    ACTIVE: 'active',
    HR_REVIEW: 'hrReview',
    CLOSED: 'closed',
    ARCHIVED: 'archived',
    NOT_STARTED: 'notStarted',
    IN_PROGRESS: 'inProgress',
    SUBMITTED: 'submitted',
    RETURNED: 'returned',
  }
  return labels[keys[status] ?? 'draft']
}

function statusTone(status: string): BadgeTone {
  if (status === 'ACTIVE' || status === 'SUBMITTED') return 'success'
  if (status === 'SCHEDULED' || status === 'IN_PROGRESS') return 'info'
  if (status === 'HR_REVIEW' || status === 'RETURNED') return 'warning'
  return 'neutral'
}

function initials(label: string): string {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function avatar(employee: TalentReviewEmployee, large = false): ReactNode {
  return employee.avatarUrl
    ? <img alt="" className={`${large ? 'size-12' : 'size-8'} shrink-0 rounded-full object-cover ring-1 ring-border`} src={employee.avatarUrl} />
    : <span aria-hidden="true" className={`grid ${large ? 'size-12 text-sm' : 'size-8 text-[0.65rem]'} shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-foreground ring-1 ring-border`}>{initials(employee.label)}</span>
}

function scoreDraft(score: TalentReviewScore | null): DraftScore {
  return {
    performanceScore: score?.performance_score as GridValue | null,
    potentialScore: score?.potential_score as GridValue | null,
    note: score?.note ?? '',
    version: score?.version,
  }
}

function ProgressBar({ labels, placed, total }: { labels: TalentReviewLabels; placed: number; total: number }) {
  const percentage = total ? Math.round((placed / total) * 100) : 0
  return <div className="mt-5">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{labels.progress}</span>
      <strong className="tabular-nums">{placed} / {total} {labels.placed}</strong>
    </div>
    <div aria-label={`${labels.progress}: ${percentage}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percentage} className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
    </div>
  </div>
}

function EmployeeContext({ employee, currentScore, labels, previousScore }: { employee: TalentReviewEmployee | null; currentScore: TalentReviewScore | null; labels: TalentReviewLabels; previousScore: TalentReviewScore | null }) {
  if (!employee) return <EmptyState icon={<Users />} title={labels.noEmployeeSelected} />

  const currentCell = asGridCell(currentScore?.grid_cell ?? null)
  const previousCell = asGridCell(previousScore?.grid_cell ?? null)
  const movement = movementDirection(previousCell, currentCell)
  const movementLabel = movement === 'UP' ? labels.movementUp : movement === 'DOWN' ? labels.movementDown : movement === 'STABLE' ? labels.movementStable : movement === 'NEW' ? labels.movementNew : labels.noScores
  const movementIcon = movement === 'UP' ? <ArrowUp aria-hidden="true" /> : movement === 'DOWN' ? <ArrowDown aria-hidden="true" /> : <Minus aria-hidden="true" />

  return <div className="border-t border-subtle pt-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {avatar(employee, true)}
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{employee.label}</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">{employee.jobTitle || labels.team}</p>
          <p className="mt-1 text-xs text-muted-foreground">{employee.employeeNumber}</p>
        </div>
      </div>
      <Link className="inline-flex min-h-8 items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/employees/${employee.id}`}>
        {labels.openProfile}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
    <dl className="mt-4 grid gap-3 border-t border-subtle pt-4 text-sm sm:grid-cols-3">
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.previousScore}</dt><dd className="mt-1 break-words font-medium">{scoreLabel(previousScore, labels)}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.currentScore}</dt><dd className="mt-1 break-words font-medium">{scoreLabel(currentScore, labels)}</dd></div>
      <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.movement}</dt><dd className="mt-1 flex items-center gap-1.5 font-medium">{movementIcon}{movementLabel}</dd></div>
    </dl>
  </div>
}

function GridCell({ canPlace, cell, labels, members, onPlace, onSelect, placementLabel, scores, selectedEmployeeId }: { canPlace: boolean; cell: GridCell; labels: TalentReviewLabels; members: TalentReviewEmployee[]; onPlace: (cell: GridCell, employeeId?: string) => void; onSelect: (employeeId: string) => void; placementLabel: string; scores: TalentReviewScore[]; selectedEmployeeId: string | null }) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const cellScores = scores.filter((score) => asGridCell(score.grid_cell) === cell)
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canPlace) return
    event.preventDefault()
    onPlace(cell, event.dataTransfer.getData('text/plain') || undefined)
  }

  return <div className="flex min-h-28 min-w-0 flex-col border-b border-l border-subtle p-2.5 sm:min-h-32 sm:p-3" onDragOver={canPlace ? (event) => event.preventDefault() : undefined} onDrop={handleDrop}>
    <div className="flex min-w-0 items-start justify-between gap-2">
      <span className="min-w-0 break-words text-xs font-semibold leading-4 text-foreground">{labels[CELL_LABEL_KEYS[cell]]}</span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{cellScores.length}</span>
    </div>
    <div className="mt-3 flex min-h-8 flex-wrap gap-1.5">
      {cellScores.map((score) => {
        const member = membersById.get(score.employee_id)
        return member ? <button aria-label={member.label} aria-pressed={member.id === selectedEmployeeId} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" draggable={canPlace} key={member.id} onClick={() => onSelect(member.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', member.id) }} type="button">{avatar(member)}<span className="sr-only">{member.label}</span></button> : null
      })}
      {cellScores.length === 0 && !canPlace ? <span className="text-xs text-muted-foreground">{labels.emptyCell}</span> : null}
    </div>
    {canPlace ? <Button className="mt-3 min-h-8 w-full justify-start whitespace-normal px-2 text-left text-xs" disabled={!selectedEmployeeId} onClick={() => onPlace(cell)} size="sm" type="button" variant="ghost"><Plus aria-hidden="true" />{selectedEmployeeId ? placementLabel : labels.selectEmployeeFirst}</Button> : null}
  </div>
}

function Grid({ canPlace, labels, members, onPlace, onSelect, placementLabel, scores, selectedEmployeeId }: { canPlace: boolean; labels: TalentReviewLabels; members: TalentReviewEmployee[]; onPlace: (cell: GridCell, employeeId?: string) => void; onSelect: (employeeId: string) => void; placementLabel: string; scores: TalentReviewScore[]; selectedEmployeeId: string | null }) {
  return <div className="overflow-hidden rounded-[var(--radius-surface)] border border-subtle bg-surface">
    <div className="grid grid-cols-[minmax(4.5rem,.65fr)_repeat(3,minmax(0,1fr))] border-b border-subtle">
      <div className="p-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:p-3">{labels.performance} ↓<span className="sr-only"> / {labels.potential} →</span></div>
      {GRID_COLUMNS.map((value) => <div className="border-l border-subtle p-2.5 text-xs font-semibold uppercase tracking-[0.08em] sm:p-3" key={value}>{valueLabel(value, labels)}</div>)}
    </div>
    {GRID_ROWS.map((performance) => <div className="grid grid-cols-[minmax(4.5rem,.65fr)_repeat(3,minmax(0,1fr))]" key={performance}>
      <div className="flex min-w-0 flex-col justify-start border-b border-subtle bg-surface-subtle p-2.5 sm:p-3"><span className="text-xs font-semibold">{valueLabel(performance, labels)}</span><span className="mt-1 text-[0.65rem] text-muted-foreground">{labels.performance}</span></div>
      {GRID_COLUMNS.map((potential) => <GridCell canPlace={canPlace} cell={`${performance}_${potential}` as GridCell} key={`${performance}_${potential}`} labels={labels} members={members} onPlace={onPlace} onSelect={onSelect} placementLabel={placementLabel} scores={scores} selectedEmployeeId={selectedEmployeeId} />)}
    </div>)}
  </div>
}

export function TalentReviewWorkspace({ mode, initial, labels }: { mode: Mode; initial: ReviewWorkspace; labels: TalentReviewLabels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [selectedCampaignId, setSelectedCampaignId] = useState(initial.selectedCampaignId)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initial.members[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft>(DEFAULT_CREATE_DRAFT)

  const selectedCampaign = workspace.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null
  const scoreByEmployee = useMemo(() => new Map(workspace.scores.map((score) => [score.employee_id, score])), [workspace.scores])
  const selectedEmployee = workspace.members.find((member) => member.id === selectedEmployeeId) ?? null
  const selectedScore = selectedEmployee ? scoreByEmployee.get(selectedEmployee.id) ?? null : null
  const previousScore = selectedEmployee ? workspace.previousScores.find((score) => score.employee_id === selectedEmployee.id) ?? null : null
  const members = useMemo(() => workspace.members.filter((member) => `${member.label} ${member.jobTitle ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [search, workspace.members])
  const campaignOptions = useMemo(() => workspace.campaigns.filter((campaign) => campaign.name.toLocaleLowerCase().includes(campaignSearch.toLocaleLowerCase())), [campaignSearch, workspace.campaigns])

  async function refresh(campaignId = selectedCampaignId) {
    if (!campaignId) return
    window.history.replaceState(null, '', `/workforce/9-grid?campaignId=${encodeURIComponent(campaignId)}`)
    const response = await fetch(`/api/talent/review/campaigns/${campaignId}/workspace?mode=${mode}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('read')
    const payload = await response.json() as { data: ReviewWorkspace }
    setWorkspace(payload.data)
    setSelectedCampaignId(payload.data.selectedCampaignId)
    setSelectedEmployeeId((current) => payload.data.members.some((member) => member.id === current) ? current : payload.data.members[0]?.id ?? null)
  }

  async function request(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    setSaving(true)
    setError(false)
    setMessage(null)
    try {
      const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) throw new Error('write')
      await refresh()
      setMessage(labels.saved)
    } catch {
      setError(true)
      setMessage(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function createCampaign() {
    setSaving(true)
    setError(false)
    setMessage(null)
    try {
      const response = await fetch('/api/talent/review/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createDraft.name, description: createDraft.description || null, startsOn: createDraft.startsOn, endsOn: createDraft.endsOn, previousCampaignId: createDraft.previousCampaignId || null }) })
      if (!response.ok) throw new Error('create')
      const payload = await response.json() as { data: { id: string } }
      const overview = await fetch('/api/talent/review/campaigns', { cache: 'no-store' })
      if (!overview.ok) throw new Error('read')
      const data = await overview.json() as { data: ReviewWorkspace }
      setWorkspace(data.data)
      setSelectedCampaignId(payload.data.id)
      window.history.replaceState(null, '', `/workforce/9-grid?campaignId=${encodeURIComponent(payload.data.id)}`)
      setCreateDraft((current) => ({ ...current, name: '', description: '', previousCampaignId: '' }))
      setMessage(labels.saved)
    } catch {
      setError(true)
      setMessage(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function saveScore(employeeId: string, draft: DraftScore) {
    if (!selectedCampaignId) return
    setSaving(true)
    setError(false)
    setMessage(null)
    try {
      const response = await fetch(`/api/talent/review/campaigns/${selectedCampaignId}/scores/${employeeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, note: draft.note || null }) })
      if (!response.ok) throw new Error('score')
      await refresh()
      setMessage(labels.saved)
    } catch {
      setError(true)
      setMessage(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  function dropEmployee(cell: GridCell, employeeId = selectedEmployee?.id) {
    if (!employeeId || !selectedCampaign || selectedCampaign.status !== 'ACTIVE') return
    const [performanceScore, potentialScore] = cell.split('_') as [GridValue, GridValue]
    void saveScore(employeeId, { ...scoreDraft(scoreByEmployee.get(employeeId) ?? null), performanceScore, potentialScore })
  }

  const statusMessage = message ? <p className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`} role={error ? 'alert' : 'status'}>{message}</p> : null
  return <section className="mt-6 space-y-6">
    {statusMessage ? <Surface className="px-4 py-3" variant={error ? 'subtle' : 'default'}>{statusMessage}</Surface> : null}
    {mode === 'hr' ? <HrView campaign={selectedCampaign} campaigns={campaignOptions} campaignSearch={campaignSearch} createDraft={createDraft} labels={labels} onAction={request} onCampaignChange={(id) => { setSelectedCampaignId(id); void refresh(id) }} onCampaignSearch={setCampaignSearch} onCreate={createCampaign} onCreateDraft={setCreateDraft} onSelectEmployee={setSelectedEmployeeId} previousScore={previousScore} selectedCampaignId={selectedCampaignId} selectedEmployee={selectedEmployee} selectedEmployeeId={selectedEmployeeId} selectedScore={selectedScore} saving={saving} workspace={workspace} /> : <ManagerView campaign={selectedCampaign} labels={labels} members={members} onCampaignChange={(id) => { setSelectedCampaignId(id); void refresh(id) }} onDrop={dropEmployee} onSave={saveScore} onSearch={setSearch} onSelectEmployee={setSelectedEmployeeId} onSubmit={() => selectedCampaignId ? void request(`/api/talent/review/campaigns/${selectedCampaignId}/submit`, 'POST') : undefined} previousScore={previousScore} selectedEmployee={selectedEmployee} selectedScore={selectedScore} saving={saving} workspace={workspace} />}
  </section>
}

function HrView({ campaign, campaigns, campaignSearch, createDraft, labels, onAction, onCampaignChange, onCampaignSearch, onCreate, onCreateDraft, onSelectEmployee, previousScore, selectedCampaignId, selectedEmployee, selectedEmployeeId, selectedScore, saving, workspace }: { campaign: TalentReviewCampaign | null; campaigns: TalentReviewCampaign[]; campaignSearch: string; createDraft: CreateDraft; labels: TalentReviewLabels; onAction: (url: string, method: 'POST' | 'PATCH', body?: unknown) => Promise<void>; onCampaignChange: (id: string) => void; onCampaignSearch: (value: string) => void; onCreate: () => void; onCreateDraft: (value: CreateDraft) => void; onSelectEmployee: (id: string) => void; previousScore: TalentReviewScore | null; selectedCampaignId: string | null; selectedEmployee: TalentReviewEmployee | null; selectedEmployeeId: string | null; selectedScore: TalentReviewScore | null; saving: boolean; workspace: ReviewWorkspace }) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.28fr)]">
    <div className="space-y-6">
      <Surface className="p-5">
        <SectionHeader description={labels.campaignOverview} title={labels.newCampaign} />
        <div className="mt-5 grid gap-4">
          <FormField control={<TextInput onChange={(event) => onCreateDraft({ ...createDraft, name: event.target.value })} value={createDraft.name} />} label={labels.campaignName} required />
          <FormField control={<Textarea onChange={(event) => onCreateDraft({ ...createDraft, description: event.target.value })} value={createDraft.description} />} label={labels.description} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={<TextInput onChange={(event) => onCreateDraft({ ...createDraft, startsOn: event.target.value })} type="date" value={createDraft.startsOn} />} label={labels.startsOn} required />
            <FormField control={<TextInput onChange={(event) => onCreateDraft({ ...createDraft, endsOn: event.target.value })} type="date" value={createDraft.endsOn} />} label={labels.endsOn} required />
          </div>
          <FormField control={<DropdownSelect aria-label={labels.previousCampaign} onChange={(event) => onCreateDraft({ ...createDraft, previousCampaignId: event.target.value })} placeholder={labels.noPreviousCampaign} searchable searchPlaceholder={labels.searchCampaigns} value={createDraft.previousCampaignId}><option value="">{labels.noPreviousCampaign}</option>{workspace.campaigns.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</DropdownSelect>} label={labels.previousCampaign} />
          <Button className="w-full whitespace-normal text-left" disabled={saving || !createDraft.name.trim()} loading={saving} onClick={onCreate} type="button"><Plus aria-hidden="true" />{labels.create}</Button>
        </div>
      </Surface>

      <Surface className="p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{labels.campaigns}</h2><Badge>{workspace.campaigns.length}</Badge></div>
        <TextInput className="mt-3" leadingIcon={<Search aria-hidden="true" />} onChange={(event) => onCampaignSearch(event.target.value)} placeholder={labels.searchCampaigns} value={campaignSearch} />
        <div className="mt-3 divide-y divide-subtle border-y border-subtle">
          {campaigns.map((option) => <button aria-pressed={option.id === selectedCampaignId} className={`block w-full px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${option.id === selectedCampaignId ? 'bg-accent/60' : 'hover:bg-surface-subtle'}`} key={option.id} onClick={() => onCampaignChange(option.id)} type="button"><span className="flex flex-wrap items-start justify-between gap-2"><span className="min-w-0 break-words text-sm font-semibold">{option.name}</span><Badge tone={statusTone(option.status)}>{statusLabel(option.status, labels)}</Badge></span><span className="mt-1 block text-xs text-muted-foreground">{option.starts_on} – {option.ends_on}</span></button>)}
          {campaigns.length === 0 ? <EmptyState className="border-0" title={labels.noCampaigns} /> : null}
        </div>
      </Surface>
    </div>
    {campaign ? <HrCampaignPanel campaign={campaign} labels={labels} onAction={onAction} onSelectEmployee={onSelectEmployee} previousScore={previousScore} selectedEmployee={selectedEmployee} selectedEmployeeId={selectedEmployeeId} selectedScore={selectedScore} saving={saving} workspace={workspace} /> : <EmptyState className="min-h-64" title={labels.selectCampaign} />}
  </div>
}

function HrCampaignPanel({ campaign, labels, onAction, onSelectEmployee, previousScore, selectedEmployee, selectedEmployeeId, selectedScore, saving, workspace }: { campaign: TalentReviewCampaign; labels: TalentReviewLabels; onAction: (url: string, method: 'POST' | 'PATCH', body?: unknown) => Promise<void>; onSelectEmployee: (id: string) => void; previousScore: TalentReviewScore | null; selectedEmployee: TalentReviewEmployee | null; selectedEmployeeId: string | null; selectedScore: TalentReviewScore | null; saving: boolean; workspace: ReviewWorkspace }) {
  const placed = workspace.scores.filter((score) => Boolean(score.grid_cell)).length
  const total = workspace.members.length
  const [pendingAction, setPendingAction] = useState<'start' | 'close' | 'reopen' | null>(null)
  const actionUrl = pendingAction === 'start' ? 'start' : pendingAction === 'close' ? 'close' : 'reopen'
  const actionDescription = pendingAction === 'start' ? labels.confirmStartDescription : pendingAction === 'close' ? labels.confirmCloseDescription : labels.confirmReopenDescription
  const allAssignmentsSubmitted = workspace.assignments.length > 0 && workspace.assignments.every((assignment) => assignment.status === 'SUBMITTED')

  return <div className="space-y-6">
    <Surface className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status, labels)}</Badge><span className="text-sm text-muted-foreground">{campaign.starts_on} – {campaign.ends_on}</span></div><h2 className="mt-3 break-words text-xl font-semibold">{campaign.name}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{campaign.description || labels.campaignOverview}</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {campaign.status === 'DRAFT' ? <Button disabled={saving} loading={saving} onClick={() => setPendingAction('start')} type="button"><Plus aria-hidden="true" />{labels.start}</Button> : null}
          {['ACTIVE', 'HR_REVIEW'].includes(campaign.status) ? <Button disabled={saving || !allAssignmentsSubmitted} onClick={() => setPendingAction('close')} type="button" variant="secondary"><LockKeyhole aria-hidden="true" />{labels.close}</Button> : null}
          {campaign.status === 'CLOSED' ? <Button disabled={saving} onClick={() => setPendingAction('reopen')} type="button" variant="secondary"><RotateCcw aria-hidden="true" />{labels.reopen}</Button> : null}
        </div>
      </div>
      <ProgressBar labels={labels} placed={placed} total={total} />
    </Surface>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,.6fr)]">
      <Surface className="p-5">
        <SectionHeader description={labels.campaignOverview} title={labels.companyGrid} />
        <div className="mt-4"><Grid canPlace={false} labels={labels} members={workspace.members} onPlace={() => undefined} onSelect={onSelectEmployee} placementLabel={labels.place} scores={workspace.scores} selectedEmployeeId={selectedEmployeeId} /></div>
      </Surface>
      <Surface className="p-5">
        <SectionHeader title={labels.managers} />
        <div className="mt-4 divide-y divide-subtle border-y border-subtle">
          {workspace.assignments.map((assignment) => <div className="py-4 first:pt-0 last:pb-0" key={assignment.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{assignment.managerLabel}</p><p className="mt-1 text-xs tabular-nums text-muted-foreground">{assignment.scored_count} / {assignment.employee_count} {labels.placed}</p></div><Badge tone={statusTone(assignment.status)}>{statusLabel(assignment.status, labels)}</Badge></div>{assignment.status !== 'SUBMITTED' && ['ACTIVE', 'SCHEDULED', 'HR_REVIEW'].includes(campaign.status) ? <Button className="mt-3 w-full whitespace-normal text-left" disabled={saving} loading={saving} onClick={() => void onAction(`/api/talent/review/campaigns/${campaign.id}/reminders`, 'POST', { assignmentId: assignment.id })} size="sm" type="button" variant="secondary"><Bell aria-hidden="true" />{assignment.last_reminded_at ? labels.reminderSent : labels.remind}</Button> : null}</div>)}
          {workspace.assignments.length === 0 ? <EmptyState className="border-0 px-0" title={labels.noTeam} /> : null}
        </div>
      </Surface>
    </div>

    <Surface className="p-5">
      <SectionHeader description={campaign.previous_campaign_id ? labels.previousScore : labels.noHistory} title={labels.history} />
      <div className="mt-4"><EmployeeContext employee={selectedEmployee} currentScore={selectedScore} labels={labels} previousScore={previousScore} /></div>
    </Surface>

    <ConfirmDialog cancelLabel={labels.cancelAction} confirmLabel={labels.confirmAction} description={actionDescription} onConfirm={async () => { const action = pendingAction; setPendingAction(null); if (action) await onAction(`/api/talent/review/campaigns/${campaign.id}/${actionUrl}`, 'POST') }} onOpenChange={(open) => { if (!open && !saving) setPendingAction(null) }} open={pendingAction !== null} title={statusLabel(campaign.status, labels)} />
  </div>
}

function ManagerView({ campaign, labels, members, onCampaignChange, onDrop, onSave, onSearch, onSelectEmployee, onSubmit, previousScore, selectedEmployee, selectedScore, saving, workspace }: { campaign: TalentReviewCampaign | null; labels: TalentReviewLabels; members: TalentReviewEmployee[]; onCampaignChange: (id: string) => void; onDrop: (cell: GridCell, employeeId?: string) => void; onSave: (employeeId: string, draft: DraftScore) => Promise<void>; onSearch: (value: string) => void; onSelectEmployee: (id: string) => void; onSubmit: () => void; previousScore: TalentReviewScore | null; selectedEmployee: TalentReviewEmployee | null; selectedScore: TalentReviewScore | null; saving: boolean; workspace: ReviewWorkspace }) {
  const [localDraft, setLocalDraft] = useState<DraftScore>(() => scoreDraft(selectedScore))
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  if (!campaign) return <EmptyState className="min-h-64" title={labels.noCampaigns} />

  const readOnly = campaign.status !== 'ACTIVE'
  const placed = workspace.scores.filter((score) => Boolean(score.grid_cell)).length
  const total = workspace.members.length
  const updateDraft = (patch: Partial<DraftScore>) => setLocalDraft((current) => ({ ...current, ...patch }))
  const placementLabel = selectedEmployee ? `${labels.place}: ${selectedEmployee.label}` : labels.selectEmployeeFirst

  return <div className="space-y-6">
    <Surface className="p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <FormField control={<DropdownSelect aria-label={labels.campaigns} onChange={(event) => onCampaignChange(event.target.value)} value={campaign.id}>{workspace.campaigns.map((option) => <option key={option.id} value={option.id}>{option.name} · {statusLabel(option.status, labels)}</option>)}</DropdownSelect>} label={labels.campaigns} />
        <div className="rounded-[var(--radius-control)] bg-surface-subtle px-4 py-2.5 text-sm"><strong className="tabular-nums">{placed} / {total}</strong> {labels.placed}</div>
      </div>
      <ProgressBar labels={labels} placed={placed} total={total} />
    </Surface>

    <div className="grid gap-6 xl:grid-cols-[minmax(14rem,.62fr)_minmax(0,1.38fr)_minmax(17rem,.68fr)]">
      <Surface className="p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{labels.team}</h2><Badge>{members.length}</Badge></div>
        <TextInput className="mt-3" leadingIcon={<Search aria-hidden="true" />} onChange={(event) => onSearch(event.target.value)} placeholder={labels.searchEmployees} />
        <div className="mt-3 divide-y divide-subtle border-y border-subtle">
          {members.map((member) => { const score = workspace.scores.find((candidate) => candidate.employee_id === member.id); return <button aria-pressed={member.id === selectedEmployee?.id} className={`flex w-full min-w-0 items-center gap-3 px-1 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ${member.id === selectedEmployee?.id ? 'bg-accent/60' : 'hover:bg-surface-subtle'}`} draggable={!readOnly} key={member.id} onClick={() => onSelectEmployee(member.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', member.id) }} type="button">{avatar(member)}<span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{member.label}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{member.jobTitle || labels.team}</span></span>{score?.grid_cell ? <Check aria-label={labels.placed} className="size-4 shrink-0 text-success" /> : <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}</button> })}
          {members.length === 0 ? <EmptyState className="border-0 px-0" title={labels.noTeam} /> : null}
        </div>
      </Surface>

      <Surface className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{labels.teamGrid}</h2><p className="mt-1 text-sm text-muted-foreground">{campaign.starts_on} – {campaign.ends_on}</p></div><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status, labels)}</Badge></div>
        {!readOnly ? <p className="mt-3 text-sm text-muted-foreground">{selectedEmployee ? placementLabel : labels.selectEmployeeFirst}</p> : <p className="mt-3 text-sm text-muted-foreground">{labels.readOnly}</p>}
        <div className="mt-4"><Grid canPlace={!readOnly} labels={labels} members={workspace.members} onPlace={onDrop} onSelect={onSelectEmployee} placementLabel={placementLabel} scores={workspace.scores} selectedEmployeeId={selectedEmployee?.id ?? null} /></div>
      </Surface>

      <Surface className="p-5">
        <SectionHeader title={selectedEmployee?.label ?? labels.selectedEmployee} />
        {selectedEmployee ? <>
          <div className="mt-4"><EmployeeContext employee={selectedEmployee} currentScore={selectedScore} labels={labels} previousScore={previousScore} /></div>
          <div className="mt-4 grid gap-4">
            <FormField control={<DropdownSelect aria-label={labels.performance} disabled={readOnly} onChange={(event) => updateDraft({ performanceScore: (event.target.value || null) as GridValue | null })} value={localDraft.performanceScore ?? ''}><option value="">—</option>{GRID_VALUES.map((value) => <option key={value} value={value}>{valueLabel(value, labels)}</option>)}</DropdownSelect>} label={labels.performance} />
            <FormField control={<DropdownSelect aria-label={labels.potential} disabled={readOnly} onChange={(event) => updateDraft({ potentialScore: (event.target.value || null) as GridValue | null })} value={localDraft.potentialScore ?? ''}><option value="">—</option>{GRID_VALUES.map((value) => <option key={value} value={value}>{valueLabel(value, labels)}</option>)}</DropdownSelect>} label={labels.potential} />
            <FormField control={<Textarea disabled={readOnly} onChange={(event) => updateDraft({ note: event.target.value })} placeholder={labels.notePlaceholder} value={localDraft.note} />} label={labels.note} />
            <Button disabled={saving || readOnly} loading={saving} onClick={() => void onSave(selectedEmployee.id, localDraft)} type="button" variant="secondary"><Save aria-hidden="true" />{labels.saveDraft}</Button>
          </div>
        </> : <EmptyState className="mt-4 border-0 px-0" title={labels.noEmployeeSelected} />}
      </Surface>
    </div>

    <Surface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><History aria-hidden="true" className="size-4" />{readOnly ? labels.readOnly : labels.progress}</span>
      <Button className="whitespace-normal text-left" disabled={saving || readOnly || total === 0 || placed !== total} onClick={() => setConfirmSubmit(true)} type="button"><Send aria-hidden="true" />{labels.submitTeam}</Button>
    </Surface>

    <ConfirmDialog cancelLabel={labels.cancelAction} confirmLabel={labels.confirmSubmit} description={labels.confirmSubmitDescription} onConfirm={async () => { setConfirmSubmit(false); await onSubmit() }} onOpenChange={(open) => { if (!open && !saving) setConfirmSubmit(false) }} open={confirmSubmit} title={labels.confirmSubmitTitle} />
  </div>
}

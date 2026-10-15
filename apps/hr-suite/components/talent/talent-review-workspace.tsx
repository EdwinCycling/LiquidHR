'use client'

/* eslint-disable @next/next/no-img-element -- employee avatars use the authenticated avatar route. */

import Link from 'next/link'
import { useMemo, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, Bell, Check, ChevronDown, GripVertical, History, LockKeyhole, Minus, Plus, RotateCcw, Save, Search, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { Textarea } from '@/components/ui/textarea'
import { TextInput } from '@/components/ui/text-input'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import type { TalentReviewCampaign, TalentReviewEmployee, TalentReviewScore, TalentReviewWorkspace as ReviewWorkspace } from '@/lib/talent-review/service'
import { canHrReviewMode, canManagerReviewMode, GRID_VALUES, movementDirection, type GridCell, type GridValue, type TalentReviewMode } from '@/lib/talent-review/rules'

type Mode = 'hr' | 'manager'
type WorkspaceTab = 'campaigns' | 'review' | 'results'
type CampaignFilter = 'DRAFT' | 'RUNNING' | 'CLOSED'
type DisplayMode = 'photos' | 'names'

export type TalentReviewLabels = {
  title: string
  subtitle: string
  campaignsTab: string
  reviewTab: string
  resultsTab: string
  newCampaign: string
  campaignName: string
  description: string
  startsOn: string
  endsOn: string
  previousCampaign: string
  noPreviousCampaign: string
  reviewMode: string
  managerOnly: string
  hrOnly: string
  hybrid: string
  create: string
  start: string
  close: string
  reopen: string
  remind: string
  campaigns: string
  noCampaigns: string
  selectCampaign: string
  selectManager: string
  active: string
  scheduled: string
  draft: string
  hrReview: string
  closed: string
  archived: string
  filterDraft: string
  filterRunning: string
  filterClosed: string
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
  modeNotAllowed: string
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
  photoView: string
  nameView: string
  closeRequirements: string
  closeBlocked: string
  closeReady: string
  returnAssignment: string
  returnReason: string
  returnReasonPlaceholder: string
  confirmReturn: string
  lastSubmitted: string
  resultsSummary: string
  selectionCount: string
  tabs: string
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
  reviewMode: TalentReviewMode
}

const DEFAULT_CREATE_DRAFT: CreateDraft = {
  name: '',
  description: '',
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  previousCampaignId: '',
  reviewMode: 'MANAGER_ONLY',
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
const CELL_ACCENTS: Record<GridCell, string> = {
  HIGH_LOW: 'var(--color-chart-1)',
  HIGH_NORMAL: 'var(--color-chart-2)',
  HIGH_HIGH: 'var(--color-chart-3)',
  NORMAL_LOW: 'var(--color-chart-5)',
  NORMAL_NORMAL: 'var(--color-chart-1)',
  NORMAL_HIGH: 'var(--color-chart-2)',
  LOW_LOW: 'var(--color-chart-5)',
  LOW_NORMAL: 'var(--color-chart-4)',
  LOW_HIGH: 'var(--color-chart-4)',
}

function asGridCell(value: string | null): GridCell | null {
  return value && Object.prototype.hasOwnProperty.call(CELL_LABEL_KEYS, value) ? value as GridCell : null
}

function valueLabel(value: GridValue, labels: TalentReviewLabels): string {
  return value === 'LOW' ? labels.low : value === 'NORMAL' ? labels.normal : labels.high
}

function statusLabel(status: string, labels: TalentReviewLabels): string {
  const keys: Record<string, keyof TalentReviewLabels> = {
    DRAFT: 'draft', SCHEDULED: 'scheduled', ACTIVE: 'active', HR_REVIEW: 'hrReview', CLOSED: 'closed', ARCHIVED: 'archived',
    NOT_STARTED: 'notStarted', IN_PROGRESS: 'inProgress', SUBMITTED: 'submitted', RETURNED: 'returned',
  }
  return labels[keys[status] ?? 'draft']
}

function statusTone(status: string): BadgeTone {
  if (status === 'ACTIVE' || status === 'SUBMITTED') return 'success'
  if (status === 'SCHEDULED' || status === 'IN_PROGRESS') return 'info'
  if (status === 'HR_REVIEW' || status === 'RETURNED') return 'warning'
  return 'neutral'
}

function modeLabel(mode: string, labels: TalentReviewLabels): string {
  if (mode === 'HR_ONLY') return labels.hrOnly
  if (mode === 'HYBRID') return labels.hybrid
  return labels.managerOnly
}

function initials(label: string): string {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function Avatar({ employee, large = false }: { employee: TalentReviewEmployee; large?: boolean }): ReactNode {
  const size = large ? 'size-12' : 'size-8'
  return employee.avatarUrl
    ? <img alt="" className={`${size} shrink-0 rounded-full object-cover ring-1 ring-border`} src={employee.avatarUrl} />
    : <span aria-hidden="true" className={`grid ${size} shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground ring-1 ring-border`}>{initials(employee.label)}</span>
}

function scoreDraft(score: TalentReviewScore | null): DraftScore {
  return { performanceScore: score?.performance_score as GridValue | null, potentialScore: score?.potential_score as GridValue | null, note: score?.note ?? '', version: score?.version }
}

function ProgressBar({ labels, placed, total }: { labels: TalentReviewLabels; placed: number; total: number }) {
  const percentage = total ? Math.round((placed / total) * 100) : 0
  return <div className="mt-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{labels.progress}</span><strong className="tabular-nums">{placed} / {total} {labels.placed}</strong></div>
    <div aria-label={`${labels.progress}: ${percentage}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percentage} className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar"><div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${percentage}%` }} /></div>
  </div>
}

function GridCell({ canPlace, cell, displayMode, dragTarget, labels, members, onDragTarget, onPlace, onSelect, placementLabel, scores, selectedEmployeeId }: {
  canPlace: boolean
  cell: GridCell
  displayMode: DisplayMode
  dragTarget: GridCell | null
  labels: TalentReviewLabels
  members: TalentReviewEmployee[]
  onDragTarget: (cell: GridCell | null) => void
  onPlace: (cell: GridCell, employeeId?: string) => void
  onSelect: (employeeId: string) => void
  placementLabel: string
  scores: TalentReviewScore[]
  selectedEmployeeId: string | null
}) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const cellScores = scores.filter((score) => asGridCell(score.grid_cell) === cell)
  const accent = CELL_ACCENTS[cell]
  const isDropTarget = dragTarget === cell
  const style = {
    '--cell-accent': accent,
    backgroundColor: 'color-mix(in srgb, var(--cell-accent) 14%, var(--color-surface))',
    borderColor: 'color-mix(in srgb, var(--cell-accent) 48%, var(--color-border))',
  } as CSSProperties
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canPlace) return
    event.preventDefault()
    const employeeId = event.dataTransfer.getData('text/plain')
    onDragTarget(null)
    if (employeeId) onPlace(cell, employeeId)
  }
  const handleGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canPlace || (event.key !== 'Enter' && event.key !== ' ')) return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    onPlace(cell)
  }

  return <div
    aria-label={`${labels[CELL_LABEL_KEYS[cell]]}, ${cellScores.length} ${labels.employees}`}
    className={`group relative flex min-h-32 min-w-0 flex-col rounded-[var(--radius-surface)] border p-2.5 transition-[border-color,background-color,outline-color] duration-150 motion-reduce:transition-none sm:min-h-40 sm:p-3.5 ${canPlace ? 'cursor-pointer hover:border-primary/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus' : ''} ${isDropTarget ? 'border-2 !border-primary outline outline-2 outline-primary/35' : ''}`}
    onClick={(event) => {
      const target = event.target
      if (canPlace && target instanceof HTMLElement && !target.closest('button')) onPlace(cell)
    }}
    onDragEnter={canPlace ? (event) => { event.preventDefault(); onDragTarget(cell) } : undefined}
    onDragLeave={canPlace ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragTarget(null) } : undefined}
    onDragOver={canPlace ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; onDragTarget(cell) } : undefined}
    onDrop={handleDrop}
    onKeyDown={handleGridKey}
    role="group"
    style={style}
    tabIndex={canPlace ? 0 : -1}
  >
    <div className="flex min-w-0 items-start justify-between gap-2">
      <span className="min-w-0 break-words text-xs font-semibold leading-4 text-foreground sm:text-sm">{labels[CELL_LABEL_KEYS[cell]]}</span>
      <span aria-label={`${cellScores.length} ${labels.employees}`} className="grid size-5 shrink-0 place-items-center rounded-full bg-surface/90 text-[0.65rem] font-bold tabular-nums text-foreground ring-1 ring-[color-mix(in_srgb,var(--cell-accent)_50%,var(--color-border))]">{cellScores.length}</span>
    </div>
    <div className="mt-3 flex min-h-8 flex-wrap content-start gap-2">
      {cellScores.map((score) => {
        const member = membersById.get(score.employee_id)
        if (!member) return null
        const selected = member.id === selectedEmployeeId
        return <button aria-label={member.label} aria-pressed={selected} className={`group/person relative flex min-h-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'z-10 ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'ring-1 ring-[color-mix(in_srgb,var(--cell-accent)_55%,var(--color-border))]'} ${canPlace ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`} draggable={canPlace} key={member.id} onClick={(event) => { event.stopPropagation(); onSelect(member.id) }} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', member.id); onDragTarget(null) }} type="button">
          {displayMode === 'photos' ? <Avatar employee={member} /> : <span className="max-w-32 truncate rounded-full border border-[color-mix(in_srgb,var(--cell-accent)_45%,var(--color-border))] bg-surface px-2.5 py-1 text-xs font-semibold text-foreground">{member.label}</span>}
          {selected ? <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-surface"><Check aria-hidden="true" className="size-2.5" /></span> : null}
        </button>
      })}
      {cellScores.length === 0 && !canPlace ? <span className="text-xs text-muted-foreground">{labels.emptyCell}</span> : null}
    </div>
    {canPlace ? <div className={`mt-auto pt-3 ${isDropTarget ? 'text-primary' : 'text-muted-foreground'}`}>
      <span className={`inline-flex min-h-8 w-full items-center gap-1.5 rounded-[var(--radius-control)] border border-dashed px-2 text-left text-xs font-medium transition-colors motion-reduce:transition-none ${isDropTarget ? 'border-primary bg-primary/10 text-primary' : 'border-[color-mix(in_srgb,var(--cell-accent)_52%,var(--color-border))] bg-surface/45'}`}><Plus aria-hidden="true" className="size-3.5 shrink-0" />{isDropTarget ? labels.dropHere : selectedEmployeeId ? placementLabel : labels.selectEmployeeFirst}</span>
    </div> : null}
  </div>
}

function Grid({ canPlace, displayMode, dragTarget, labels, members, onDragTarget, onPlace, onSelect, placementLabel, scores, selectedEmployeeId }: {
  canPlace: boolean
  displayMode: DisplayMode
  dragTarget: GridCell | null
  labels: TalentReviewLabels
  members: TalentReviewEmployee[]
  onDragTarget: (cell: GridCell | null) => void
  onPlace: (cell: GridCell, employeeId?: string) => void
  onSelect: (employeeId: string) => void
  placementLabel: string
  scores: TalentReviewScore[]
  selectedEmployeeId: string | null
}) {
  return <div aria-label={labels.grid} className="min-w-0" role="group">
    <div className="mb-2 grid grid-cols-[minmax(3.5rem,.62fr)_repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-[minmax(4.5rem,.62fr)_repeat(3,minmax(0,1fr))]">
      <span className="self-end pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.potential} →</span>
      {GRID_COLUMNS.map((value) => <span className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-xs" key={value}>{valueLabel(value, labels)}</span>)}
    </div>
    <div className="space-y-2 sm:space-y-3">
      {GRID_ROWS.map((performance) => <div className="grid grid-cols-[minmax(3.5rem,.62fr)_repeat(3,minmax(0,1fr))] items-stretch gap-2 sm:grid-cols-[minmax(4.5rem,.62fr)_repeat(3,minmax(0,1fr))] sm:gap-3" key={performance}>
        <div className="flex min-w-0 flex-col justify-center border-r border-subtle pr-2 text-right"><span className="break-words text-xs font-semibold sm:text-sm">{valueLabel(performance, labels)}</span><span className="mt-1 text-[0.6rem] text-muted-foreground">{labels.performance} ↓</span></div>
        {GRID_COLUMNS.map((potential) => {
          const cell = `${performance}_${potential}` as GridCell
          return <GridCell canPlace={canPlace} cell={cell} displayMode={displayMode} dragTarget={dragTarget} key={cell} labels={labels} members={members} onDragTarget={onDragTarget} onPlace={onPlace} onSelect={onSelect} placementLabel={placementLabel} scores={scores} selectedEmployeeId={selectedEmployeeId} />
        })}
      </div>)}
    </div>
  </div>
}

function EmployeeDetails({ employee, labels, onSave, previousScore, score, saving, readOnly }: {
  employee: TalentReviewEmployee | null
  labels: TalentReviewLabels
  onSave: (employeeId: string, draft: DraftScore) => Promise<void>
  previousScore: TalentReviewScore | null
  score: TalentReviewScore | null
  saving: boolean
  readOnly: boolean
}) {
  const [draft, setDraft] = useState<DraftScore>(() => scoreDraft(score))
  const [showHistory, setShowHistory] = useState(false)
  if (!employee) return <EmptyState className="border-0 px-0" icon={<Users />} title={labels.noEmployeeSelected} />

  const update = (patch: Partial<DraftScore>) => setDraft((current) => ({ ...current, ...patch }))
  const currentCell = asGridCell(score?.grid_cell ?? null)
  const previousCell = asGridCell(previousScore?.grid_cell ?? null)
  const movement = movementDirection(previousCell, currentCell)
  const movementLabel = movement === 'UP' ? labels.movementUp : movement === 'DOWN' ? labels.movementDown : movement === 'STABLE' ? labels.movementStable : movement === 'NEW' ? labels.movementNew : labels.noScores
  const movementIcon = movement === 'UP' ? <ArrowUp aria-hidden="true" className="size-4" /> : movement === 'DOWN' ? <ArrowDown aria-hidden="true" className="size-4" /> : <Minus aria-hidden="true" className="size-4" />

  return <div className="min-w-0">
    <div className="flex min-w-0 items-start gap-3">{<Avatar employee={employee} large />}<div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{employee.label}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{employee.jobTitle || labels.team}</p><p className="mt-1 text-xs text-muted-foreground">{employee.employeeNumber}</p></div><Link aria-label={labels.openProfile} className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/employees/${employee.id}`}><ArrowUpRight aria-hidden="true" className="size-4" /></Link></div>
    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-subtle pt-4 text-sm"><div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.currentScore}</dt><dd className="mt-1 break-words font-medium">{score?.grid_cell ? labels[CELL_LABEL_KEYS[score.grid_cell as GridCell]] : labels.noScores}</dd></div><div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.movement}</dt><dd className="mt-1 flex items-center gap-1.5 font-medium">{movementIcon}{movementLabel}</dd></div></dl>
    <Button aria-expanded={showHistory} className="mt-3 min-h-9 w-full justify-start" onClick={() => setShowHistory((visible) => !visible)} type="button" variant="ghost"><History aria-hidden="true" className="size-4" />{labels.history}<ChevronDown aria-hidden="true" className={`ml-auto size-4 transition-transform motion-reduce:transition-none ${showHistory ? 'rotate-180' : ''}`} /></Button>
    {showHistory ? <div className="mt-2 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><p className="text-xs font-semibold text-muted-foreground">{labels.previousScore}</p><p className="mt-1 text-sm font-medium">{previousScore?.grid_cell && asGridCell(previousScore.grid_cell) ? labels[CELL_LABEL_KEYS[asGridCell(previousScore.grid_cell) as GridCell]] : labels.noHistory}</p></div> : null}
    <div className="mt-4 grid gap-3 border-t border-subtle pt-4">
      <FormField control={<DropdownSelect aria-label={labels.performance} disabled={readOnly} onChange={(event) => update({ performanceScore: (event.target.value || null) as GridValue | null })} value={draft.performanceScore ?? ''}><option value="">—</option>{GRID_VALUES.map((value) => <option key={value} value={value}>{value === 'LOW' ? labels.low : value === 'NORMAL' ? labels.normal : labels.high}</option>)}</DropdownSelect>} label={labels.performance} />
      <FormField control={<DropdownSelect aria-label={labels.potential} disabled={readOnly} onChange={(event) => update({ potentialScore: (event.target.value || null) as GridValue | null })} value={draft.potentialScore ?? ''}><option value="">—</option>{GRID_VALUES.map((value) => <option key={value} value={value}>{value === 'LOW' ? labels.low : value === 'NORMAL' ? labels.normal : labels.high}</option>)}</DropdownSelect>} label={labels.potential} />
      <FormField control={<Textarea disabled={readOnly} onChange={(event) => update({ note: event.target.value })} placeholder={labels.notePlaceholder} value={draft.note} />} label={labels.note} />
      <Button disabled={saving || readOnly} loading={saving} onClick={() => void onSave(employee.id, draft)} type="button" variant="secondary"><Save aria-hidden="true" />{labels.saveDraft}</Button>
    </div>
  </div>
}

function DisplayModeToggle({ displayMode, labels, onChange }: { displayMode: DisplayMode; labels: TalentReviewLabels; onChange: (value: DisplayMode) => void }) {
  return <div aria-label={labels.grid} className="inline-flex rounded-[var(--radius-control)] border border-subtle bg-surface p-1" role="group">
    <Button aria-pressed={displayMode === 'photos'} className="min-h-8 px-2.5 text-xs aria-pressed:bg-accent aria-pressed:text-primary" onClick={() => onChange('photos')} size="sm" type="button" variant="ghost">{labels.photoView}</Button>
    <Button aria-pressed={displayMode === 'names'} className="min-h-8 px-2.5 text-xs aria-pressed:bg-accent aria-pressed:text-primary" onClick={() => onChange('names')} size="sm" type="button" variant="ghost">{labels.nameView}</Button>
  </div>
}

export function TalentReviewWorkspace({ mode, initial, initialTab = 'review', labels }: { mode: Mode; initial: ReviewWorkspace; initialTab?: WorkspaceTab; labels: TalentReviewLabels }) {
  const [workspace, setWorkspace] = useState(initial)
  const [selectedCampaignId, setSelectedCampaignId] = useState(initial.selectedCampaignId)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(mode === 'manager' ? initial.assignments[0]?.id ?? null : initial.assignments.length === 1 ? initial.assignments[0]?.id ?? null : null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(mode === 'manager' ? 'review' : initialTab)
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>('RUNNING')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('photos')
  const [dragTarget, setDragTarget] = useState<GridCell | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft>(DEFAULT_CREATE_DRAFT)
  const [showReturnFor, setShowReturnFor] = useState<string | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [confirmAction, setConfirmAction] = useState<'start' | 'close' | 'submit' | null>(null)

  function changeDisplayMode(nextMode: DisplayMode) {
    setDisplayMode(nextMode)
  }

  const campaign = workspace.campaigns.find((item) => item.id === selectedCampaignId) ?? null
  const selectedAssignment = workspace.assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null
  const scoresByEmployee = useMemo(() => new Map(workspace.scores.map((score) => [score.employee_id, score])), [workspace.scores])
  const activeMembers = useMemo(() => selectedAssignment ? workspace.members.filter((member) => member.assignmentId === selectedAssignment.id) : [], [selectedAssignment, workspace.members])
  const selectedEmployee = workspace.members.find((member) => member.id === selectedEmployeeId) ?? null
  const selectedScore = selectedEmployee ? scoresByEmployee.get(selectedEmployee.id) ?? null : null
  const previousScore = selectedEmployee ? workspace.previousScores.find((score) => score.employee_id === selectedEmployee.id) ?? null : null
  const matchingCampaigns = useMemo(() => workspace.campaigns.filter((item) => item.name.toLocaleLowerCase().includes(campaignSearch.toLocaleLowerCase())), [campaignSearch, workspace.campaigns])
  const filteredCampaigns = useMemo(() => matchingCampaigns.filter((item) => {
    if (campaignFilter === 'DRAFT') return item.status === 'DRAFT'
    if (campaignFilter === 'CLOSED') return item.status === 'CLOSED' || item.status === 'ARCHIVED'
    return item.status === 'SCHEDULED' || item.status === 'ACTIVE' || item.status === 'HR_REVIEW'
  }), [campaignFilter, matchingCampaigns])
  const visibleMembers = useMemo(() => activeMembers.filter((member) => `${member.label} ${member.jobTitle ?? ''} ${member.employeeNumber}`.toLocaleLowerCase().includes(employeeSearch.toLocaleLowerCase())), [activeMembers, employeeSearch])
  const placed = activeMembers.filter((member) => {
    const score = scoresByEmployee.get(member.id)
    return Boolean(score?.performance_score && score.potential_score)
  }).length
  const assignmentComplete = activeMembers.length > 0 && placed === activeMembers.length
  const campaignComplete = workspace.members.length > 0 && workspace.members.every((member) => {
    const score = scoresByEmployee.get(member.id)
    return Boolean(score?.performance_score && score.potential_score)
  })
  const allAssignmentsSubmitted = workspace.assignments.length > 0 && workspace.assignments.every((assignment) => assignment.status === 'SUBMITTED')
  const canCloseCampaign = Boolean(campaign && ['ACTIVE', 'HR_REVIEW'].includes(campaign.status) && allAssignmentsSubmitted && campaignComplete)
  const campaignMode = (campaign?.review_mode ?? 'MANAGER_ONLY') as TalentReviewMode
  const roleMayReview = campaign ? mode === 'hr' ? canHrReviewMode(campaignMode) : canManagerReviewMode(campaignMode) : false
  const canEdit = Boolean(campaign && selectedAssignment && campaign.status === 'ACTIVE' && selectedAssignment.status !== 'SUBMITTED' && roleMayReview)
  const placementLabel = selectedEmployee ? `${labels.place}: ${selectedEmployee.label}` : labels.selectEmployeeFirst

  function urlFor(tab: WorkspaceTab, campaignId: string | null): string {
    const params = new URLSearchParams()
    if (campaignId) params.set('campaignId', campaignId)
    params.set('tab', tab)
    return `/workforce/9-grid?${params.toString()}`
  }

  function chooseTab(tab: WorkspaceTab) {
    const nextTab = mode === 'manager' ? 'review' : tab
    setActiveTab(nextTab)
    window.history.pushState(null, '', urlFor(nextTab, selectedCampaignId))
  }

  async function refresh(campaignId = selectedCampaignId, tab = activeTab) {
    if (!campaignId) return
    window.history.replaceState(null, '', urlFor(tab, campaignId))
    const response = await fetch(`/api/talent/review/campaigns/${campaignId}/workspace?mode=${mode}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('read')
    const payload = await response.json() as { data: ReviewWorkspace }
    setWorkspace(payload.data)
    setSelectedCampaignId(payload.data.selectedCampaignId)
    setSelectedAssignmentId((current) => payload.data.assignments.some((assignment) => assignment.id === current)
      ? current
      : mode === 'manager' || payload.data.assignments.length === 1 ? payload.data.assignments[0]?.id ?? null : null)
    setSelectedEmployeeId((current) => payload.data.members.some((member) => member.id === current) ? current : null)
  }

  async function request(url: string, method: 'POST' | 'PATCH' | 'PUT', body?: unknown, refreshTab = activeTab) {
    setSaving(true)
    setError(false)
    setMessage(null)
    try {
      const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) throw new Error('write')
      await refresh(selectedCampaignId, refreshTab)
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
      const response = await fetch('/api/talent/review/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createDraft.name, description: createDraft.description || null, startsOn: createDraft.startsOn, endsOn: createDraft.endsOn, previousCampaignId: createDraft.previousCampaignId || null, reviewMode: createDraft.reviewMode }) })
      if (!response.ok) throw new Error('create')
      const payload = await response.json() as { data: { id: string } }
      const overview = await fetch(`/api/talent/review/campaigns?campaignId=${encodeURIComponent(payload.data.id)}`, { cache: 'no-store' })
      if (!overview.ok) throw new Error('read')
      const data = await overview.json() as { data: ReviewWorkspace }
      setWorkspace(data.data)
      setSelectedCampaignId(payload.data.id)
      setSelectedAssignmentId(null)
      setSelectedEmployeeId(null)
      setCampaignFilter('DRAFT')
      window.history.replaceState(null, '', urlFor('campaigns', payload.data.id))
      setActiveTab('campaigns')
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
      const response = await fetch(`/api/talent/review/campaigns/${selectedCampaignId}/scores/${employeeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ performanceScore: draft.performanceScore, potentialScore: draft.potentialScore, note: draft.note || null, version: draft.version }) })
      if (!response.ok) throw new Error('score')
      await refresh(selectedCampaignId, activeTab)
      setMessage(labels.saved)
    } catch {
      setError(true)
      setMessage(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  function placeEmployee(cell: GridCell, employeeId = selectedEmployee?.id) {
    if (!employeeId || !canEdit) return
    const existing = scoresByEmployee.get(employeeId) ?? null
    const [performanceScore, potentialScore] = cell.split('_') as [GridValue, GridValue]
    void saveScore(employeeId, { ...scoreDraft(existing), performanceScore, potentialScore })
  }

  async function submitAssignment() {
    if (!selectedCampaignId || !selectedAssignment) return
    await request(`/api/talent/review/campaigns/${selectedCampaignId}/submit`, 'POST', { assignmentId: selectedAssignment.id }, activeTab)
    setConfirmAction(null)
  }

  async function returnAssignment(assignmentId: string) {
    if (!selectedCampaignId || !returnReason.trim()) return
    await request(`/api/talent/review/campaigns/${selectedCampaignId}/return`, 'POST', { assignmentId, reason: returnReason.trim() }, 'campaigns')
    setShowReturnFor(null)
    setReturnReason('')
  }

  async function reopenCampaign() {
    if (!selectedCampaignId || !reopenReason.trim()) return
    await request(`/api/talent/review/campaigns/${selectedCampaignId}/reopen`, 'POST', { reason: reopenReason.trim() }, 'campaigns')
    setReopenReason('')
  }

  const statusMessage = message ? <Surface className="px-4 py-3"><p className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`} role={error ? 'alert' : 'status'}>{statusMessageText(message, error, labels)}</p></Surface> : null
  const tabOptions = mode === 'hr' ? [
    { id: 'campaigns' as const, label: labels.campaignsTab },
    { id: 'review' as const, label: labels.reviewTab },
    { id: 'results' as const, label: labels.resultsTab },
  ] : [{ id: 'review' as const, label: labels.reviewTab }]

  return <section className="mt-6 space-y-5">
    {statusMessage}
    <ScrollableTabs ariaLabel={labels.tabs} contentProps={{ role: 'tablist' }} leftLabel={labels.tabs} rightLabel={labels.tabs}>
      {tabOptions.map((tab) => <TabButton aria-controls={`${tab.id}-tabpanel`} id={`${tab.id}-tab`} active={activeTab === tab.id} key={tab.id} onClick={() => chooseTab(tab.id)}>{tab.label}</TabButton>)}
    </ScrollableTabs>
    <div aria-labelledby={`${activeTab}-tab`} className="min-w-0 focus:outline-none" id={`${activeTab}-tabpanel`} role="tabpanel" tabIndex={0}>
      {activeTab === 'campaigns' && mode === 'hr' ? <div className="space-y-5">
        <details className="group rounded-[var(--radius-surface)] border border-subtle bg-surface">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus [&::-webkit-details-marker]:hidden"><span>{labels.newCampaign}</span><ChevronDown aria-hidden="true" className="size-4 transition-transform motion-reduce:transition-none group-open:rotate-180" /></summary>
          <form className="grid gap-4 border-t border-subtle p-4 md:grid-cols-2 md:p-5" onSubmit={(event) => { event.preventDefault(); void createCampaign() }}>
            <FormField control={<TextInput onChange={(event) => setCreateDraft((draft) => ({ ...draft, name: event.target.value }))} value={createDraft.name} />} label={labels.campaignName} required />
            <FormField control={<DropdownSelect aria-label={labels.reviewMode} onChange={(event) => setCreateDraft((draft) => ({ ...draft, reviewMode: event.target.value as TalentReviewMode }))} value={createDraft.reviewMode}><option value="MANAGER_ONLY">{labels.managerOnly}</option><option value="HR_ONLY">{labels.hrOnly}</option><option value="HYBRID">{labels.hybrid}</option></DropdownSelect>} label={labels.reviewMode} />
            <FormField control={<Textarea onChange={(event) => setCreateDraft((draft) => ({ ...draft, description: event.target.value }))} value={createDraft.description} />} label={labels.description} />
            <FormField control={<DropdownSelect aria-label={labels.previousCampaign} onChange={(event) => setCreateDraft((draft) => ({ ...draft, previousCampaignId: event.target.value }))} placeholder={labels.noPreviousCampaign} searchable searchPlaceholder={labels.searchCampaigns} value={createDraft.previousCampaignId}><option value="">{labels.noPreviousCampaign}</option>{workspace.campaigns.filter((item) => item.status === 'CLOSED' || item.status === 'ARCHIVED').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</DropdownSelect>} label={labels.previousCampaign} />
            <FormField control={<TextInput onChange={(event) => setCreateDraft((draft) => ({ ...draft, startsOn: event.target.value }))} type="date" value={createDraft.startsOn} />} label={labels.startsOn} required />
            <FormField control={<TextInput onChange={(event) => setCreateDraft((draft) => ({ ...draft, endsOn: event.target.value }))} type="date" value={createDraft.endsOn} />} label={labels.endsOn} required />
            <div className="md:col-span-2"><Button disabled={saving || !createDraft.name.trim() || createDraft.endsOn <= createDraft.startsOn} loading={saving} type="submit"><Plus aria-hidden="true" />{labels.create}</Button></div>
          </form>
        </details>

        <Surface className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{labels.campaigns}</h2><Badge>{workspace.campaigns.length}</Badge></div>
          <div className="grid gap-3 md:grid-cols-[minmax(13rem,1fr)_minmax(15rem,1.5fr)]">
            <DropdownSelect aria-label={labels.campaigns} onChange={(event) => setCampaignFilter(event.target.value as CampaignFilter)} value={campaignFilter}><option value="DRAFT">{labels.filterDraft}</option><option value="RUNNING">{labels.filterRunning}</option><option value="CLOSED">{labels.filterClosed}</option></DropdownSelect>
            <TextInput leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setCampaignSearch(event.target.value)} placeholder={labels.searchCampaigns} value={campaignSearch} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCampaigns.map((item) => <button aria-pressed={item.id === selectedCampaignId} className={`rounded-[var(--radius-surface)] border p-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${item.id === selectedCampaignId ? 'border-primary bg-accent/40' : 'border-subtle bg-surface hover:bg-surface-subtle'}`} key={item.id} onClick={() => { setSelectedCampaignId(item.id); setSelectedAssignmentId(null); setSelectedEmployeeId(null); void refresh(item.id, 'campaigns') }} type="button"><span className="flex items-start justify-between gap-2"><span className="break-words font-semibold">{item.name}</span><Badge tone={statusTone(item.status)}>{statusLabel(item.status, labels)}</Badge></span><span className="mt-2 block text-xs text-muted-foreground">{item.starts_on} – {item.ends_on}</span><span className="mt-2 block text-xs font-medium text-primary">{modeLabel(item.review_mode, labels)}</span></button>)}
            {filteredCampaigns.length === 0 ? <EmptyState className="border-0 sm:col-span-2 xl:col-span-3" title={labels.noCampaigns} /> : null}
          </div>
        </Surface>

        {campaign ? <CampaignDetails campaign={campaign} labels={labels} onAction={(action, assignmentId) => void request(action === 'reminders' ? `/api/talent/review/campaigns/${campaign.id}/reminders` : `/api/talent/review/campaigns/${campaign.id}/${action}`, 'POST', action === 'reminders' ? { assignmentId } : undefined, 'campaigns')} onReopen={() => void reopenCampaign()} onReturn={(assignmentId) => void returnAssignment(assignmentId)} onReturnReasonChange={setReturnReason} onToggleReturn={(assignmentId) => { setShowReturnFor((current) => current === assignmentId ? null : assignmentId); setReturnReason('') }} reopenReason={reopenReason} setReopenReason={setReopenReason} showReturnFor={showReturnFor} returnReason={returnReason} saving={saving} workspace={workspace} canClose={canCloseCampaign} /> : null}
      </div> : null}

      {activeTab === 'review' ? <div className="space-y-4">
        <Surface className="space-y-4 p-4 sm:p-5">
          {campaign ? <>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(14rem,.8fr)_auto] md:items-end">
              <FormField control={<DropdownSelect aria-label={labels.campaigns} onChange={(event) => { const id = event.target.value; setSelectedCampaignId(id || null); setSelectedAssignmentId(null); setSelectedEmployeeId(null); if (id) void refresh(id, 'review') }} value={campaign.id}>{workspace.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name} · {statusLabel(item.status, labels)}</option>)}</DropdownSelect>} label={labels.campaigns} />
              <FormField control={<DropdownSelect aria-label={labels.selectManager} disabled={mode === 'manager'} onChange={(event) => { setSelectedAssignmentId(event.target.value || null); setSelectedEmployeeId(null) }} placeholder={labels.selectManager} value={selectedAssignmentId ?? ''}><option value="">{labels.selectManager}</option>{workspace.assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.managerLabel} · {statusLabel(assignment.status, labels)}</option>)}</DropdownSelect>} label={labels.manager} />
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-surface-subtle px-3 py-2.5 text-sm"><Badge tone={statusTone(selectedAssignment?.status ?? campaign.status)}>{statusLabel(selectedAssignment?.status ?? campaign.status, labels)}</Badge><span className="tabular-nums font-semibold">{placed} / {activeMembers.length}</span></div>
            </div>
            <ProgressBar labels={labels} placed={placed} total={activeMembers.length} />
            {selectedAssignment?.status === 'SUBMITTED' && selectedAssignment.submitted_at ? <p className="text-sm text-muted-foreground">{labels.lastSubmitted}: {new Date(selectedAssignment.submitted_at).toLocaleString()}</p> : null}
            {selectedAssignment?.status === 'RETURNED' && selectedAssignment.return_reason ? <p className="rounded-[var(--radius-control)] border border-warning bg-warning-surface px-3 py-2 text-sm">{labels.returned}: {selectedAssignment.return_reason}</p> : null}
            {!roleMayReview ? <p className="text-sm text-muted-foreground">{labels.modeNotAllowed}</p> : null}
            {!canEdit && selectedAssignment?.status !== 'SUBMITTED' && roleMayReview ? <p className="text-sm text-muted-foreground">{labels.readOnly}</p> : null}
          </> : <EmptyState className="border-0" title={labels.selectCampaign} />}
        </Surface>

        {campaign && selectedAssignment ? <>
          <Surface className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{labels.team}</h2><DisplayModeToggle displayMode={displayMode} labels={labels} onChange={changeDisplayMode} /></div>
            <TextInput leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={labels.searchEmployees} value={employeeSearch} />
            <div className="flex min-h-14 gap-2 overflow-x-auto pb-1">
              {visibleMembers.map((member) => {
                const employeeScore = scoresByEmployee.get(member.id)
                const selected = member.id === selectedEmployeeId
                return <button aria-pressed={selected} className={`relative flex min-h-12 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'border-primary bg-accent/50 ring-2 ring-primary/40' : 'border-subtle bg-surface hover:bg-surface-subtle'}`} draggable={canEdit} key={member.id} onClick={() => setSelectedEmployeeId(member.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', member.id) }} type="button">
                  {displayMode === 'photos' ? <Avatar employee={member} /> : null}<span className="max-w-36 truncate text-sm font-medium">{member.label}</span>{employeeScore?.grid_cell ? <Check aria-label={labels.placed} className="size-4 text-success" /> : <GripVertical aria-hidden="true" className="size-4 text-muted-foreground" />}{selected ? <span className="sr-only">{labels.selectedEmployee}</span> : null}
                </button>
              })}
              {visibleMembers.length === 0 ? <EmptyState className="min-h-14 border-0 px-0" title={labels.noTeam} /> : null}
            </div>
          </Surface>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(18rem,.75fr)]">
            <Surface className="min-w-0 p-3 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.teamGrid}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.performance} ↓ · {labels.potential} →</p></div><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status, labels)}</Badge></div>
              <Grid canPlace={canEdit} displayMode={displayMode} dragTarget={dragTarget} labels={labels} members={activeMembers} onDragTarget={setDragTarget} onPlace={placeEmployee} onSelect={setSelectedEmployeeId} placementLabel={placementLabel} scores={workspace.scores} selectedEmployeeId={selectedEmployeeId} />
            </Surface>
            <Surface className="min-w-0 p-4 sm:p-5"><EmployeeDetails key={`${selectedEmployee?.id ?? 'none'}:${selectedScore?.version ?? 'new'}`} employee={selectedEmployee && activeMembers.some((member) => member.id === selectedEmployee.id) ? selectedEmployee : null} labels={labels} onSave={saveScore} previousScore={previousScore} score={selectedScore} saving={saving} readOnly={!canEdit} /></Surface>
          </div>

          <Surface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">{selectedAssignment.status === 'SUBMITTED' ? labels.readOnly : labels.progress}</span>
            <Button disabled={saving || !canEdit || !assignmentComplete} onClick={() => setConfirmAction('submit')} type="button"><Send aria-hidden="true" />{labels.submitTeam}</Button>
          </Surface>
        </> : campaign ? <EmptyState className="min-h-44" title={labels.selectManager} /> : null}
      </div> : null}

      {activeTab === 'results' && mode === 'hr' ? <div className="space-y-4">
        {campaign ? <>
          <Surface className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end sm:p-5">
            <FormField control={<DropdownSelect aria-label={labels.campaigns} onChange={(event) => { const id = event.target.value; setSelectedCampaignId(id || null); setSelectedEmployeeId(null); if (id) void refresh(id, 'results') }} value={campaign.id}>{workspace.campaigns.map((item) => <option key={item.id} value={item.id}>{item.name} · {statusLabel(item.status, labels)}</option>)}</DropdownSelect>} label={labels.campaigns} />
            <DisplayModeToggle displayMode={displayMode} labels={labels} onChange={changeDisplayMode} />
            <p className="text-sm text-muted-foreground md:col-span-2">{labels.resultsSummary}: {workspace.assignments.filter((assignment) => assignment.status === 'SUBMITTED').length} / {workspace.assignments.length} {labels.managers}</p>
          </Surface>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(18rem,.75fr)]">
            <Surface className="min-w-0 p-3 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{labels.companyGrid}</h2><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status, labels)}</Badge></div><Grid canPlace={false} displayMode={displayMode} dragTarget={null} labels={labels} members={workspace.members} onDragTarget={() => undefined} onPlace={() => undefined} onSelect={setSelectedEmployeeId} placementLabel={labels.place} scores={workspace.scores} selectedEmployeeId={selectedEmployeeId} /></Surface>
            <Surface className="min-w-0 p-4 sm:p-5"><h2 className="text-lg font-semibold">{selectedEmployee?.label ?? labels.selectedEmployee}</h2><div className="mt-4"><EmployeeDetails key={`${selectedEmployee?.id ?? 'none'}:${selectedScore?.version ?? 'new'}`} employee={selectedEmployee} labels={labels} onSave={saveScore} previousScore={previousScore} score={selectedScore} saving={saving} readOnly /></div></Surface>
          </div>
          <Surface className="p-4 sm:p-5"><h2 className="text-lg font-semibold">{labels.managers}</h2><div className="mt-3 divide-y divide-subtle border-y border-subtle">{workspace.assignments.map((assignment) => <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={assignment.id}><div className="min-w-0"><p className="break-words font-medium">{assignment.managerLabel}</p><p className="mt-1 text-xs text-muted-foreground">{assignment.scored_count} / {assignment.employee_count} {labels.placed}{assignment.submitted_at ? ` · ${labels.lastSubmitted}: ${new Date(assignment.submitted_at).toLocaleString()}` : ''}</p></div><Badge tone={statusTone(assignment.status)}>{statusLabel(assignment.status, labels)}</Badge></div>)}{workspace.assignments.length === 0 ? <EmptyState className="border-0" title={labels.noTeam} /> : null}</div></Surface>
        </> : <EmptyState className="min-h-44" title={labels.selectCampaign} />}
      </div> : null}
    </div>

    <ConfirmDialog cancelLabel={labels.cancelAction} confirmLabel={confirmAction === 'submit' ? labels.confirmSubmit : labels.confirmAction} description={confirmAction === 'submit' ? labels.confirmSubmitDescription : confirmAction === 'close' ? labels.confirmCloseDescription : labels.confirmStartDescription} onConfirm={async () => {
      const action = confirmAction
      if (action === 'submit') await submitAssignment()
      else if (action && selectedCampaignId) {
        await request(`/api/talent/review/campaigns/${selectedCampaignId}/${action}`, 'POST', undefined, 'campaigns')
        setConfirmAction(null)
      }
    }} onOpenChange={(open) => { if (!open && !saving) setConfirmAction(null) }} open={confirmAction !== null} title={confirmAction === 'submit' ? labels.confirmSubmitTitle : confirmAction === 'close' ? labels.close : labels.start} />
  </section>
}

function statusMessageText(message: string, error: boolean, labels: TalentReviewLabels): string {
  return error ? labels.failed : message || labels.saved
}

function CampaignDetails({ campaign, canClose, labels, onAction, onReopen, onReturn, onReturnReasonChange, onToggleReturn, reopenReason, setReopenReason, showReturnFor, returnReason, saving, workspace }: {
  campaign: TalentReviewCampaign
  canClose: boolean
  labels: TalentReviewLabels
  onAction: (action: 'start' | 'close' | 'reminders', assignmentId?: string) => void
  onReopen: () => void
  onReturn: (assignmentId: string) => void
  onReturnReasonChange: (value: string) => void
  onToggleReturn: (assignmentId: string) => void
  reopenReason: string
  setReopenReason: (value: string) => void
  showReturnFor: string | null
  returnReason: string
  saving: boolean
  workspace: ReviewWorkspace
}) {
  const [confirm, setConfirm] = useState<'start' | 'close' | null>(null)
  const placed = workspace.members.filter((member) => {
    const score = workspace.scores.find((item) => item.employee_id === member.id)
    return Boolean(score?.performance_score && score.potential_score)
  }).length
  return <div className="space-y-4">
    <Surface className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status, labels)}</Badge><Badge>{modeLabel(campaign.review_mode, labels)}</Badge><span className="text-sm text-muted-foreground">{campaign.starts_on} – {campaign.ends_on}</span></div><h2 className="mt-3 break-words text-xl font-semibold">{campaign.name}</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{campaign.description || labels.campaigns}</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">{campaign.status === 'DRAFT' ? <Button disabled={saving} onClick={() => setConfirm('start')} type="button"><Plus aria-hidden="true" />{labels.start}</Button> : null}{['ACTIVE', 'HR_REVIEW'].includes(campaign.status) ? <Button disabled={saving || !canClose} onClick={() => setConfirm('close')} type="button" variant="secondary"><LockKeyhole aria-hidden="true" />{labels.close}</Button> : null}</div>
      </div>
      <ProgressBar labels={labels} placed={placed} total={workspace.members.length} />
      {['ACTIVE', 'HR_REVIEW'].includes(campaign.status) ? <div className="mt-4 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><p className="font-semibold">{labels.closeRequirements}</p><p className="mt-1 text-sm text-muted-foreground">{canClose ? labels.closeReady : labels.closeBlocked}</p></div> : null}
      {campaign.status === 'CLOSED' ? <div className="mt-4 rounded-[var(--radius-control)] border border-subtle p-3"><FormField control={<Textarea onChange={(event) => setReopenReason(event.target.value)} placeholder={labels.returnReasonPlaceholder} value={reopenReason} />} label={labels.returnReason} /><Button className="mt-3" disabled={saving || !reopenReason.trim()} loading={saving} onClick={onReopen} type="button" variant="secondary"><RotateCcw aria-hidden="true" />{labels.reopen}</Button></div> : null}
    </Surface>
    <Surface className="p-4 sm:p-5"><h2 className="text-lg font-semibold">{labels.managers}</h2><div className="mt-3 divide-y divide-subtle border-y border-subtle">
      {workspace.assignments.map((assignment) => <div className="py-3" key={assignment.id}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{assignment.managerLabel}</p><p className="mt-1 text-xs text-muted-foreground">{assignment.scored_count} / {assignment.employee_count} {labels.placed}{assignment.submitted_at ? ` · ${labels.lastSubmitted}: ${new Date(assignment.submitted_at).toLocaleString()}` : ''}</p>{assignment.return_reason ? <p className="mt-2 text-sm text-warning">{labels.returned}: {assignment.return_reason}</p> : null}</div><Badge tone={statusTone(assignment.status)}>{statusLabel(assignment.status, labels)}</Badge></div>
        {assignment.status !== 'SUBMITTED' && ['ACTIVE', 'SCHEDULED'].includes(campaign.status) && campaign.review_mode !== 'HR_ONLY' ? <Button className="mt-3" disabled={saving} loading={saving} onClick={() => void onAction('reminders', assignment.id)} size="sm" type="button" variant="secondary"><Bell aria-hidden="true" />{assignment.last_reminded_at ? labels.reminderSent : labels.remind}</Button> : null}
        {assignment.status === 'SUBMITTED' && ['ACTIVE', 'HR_REVIEW'].includes(campaign.status) ? <div className="mt-3"><Button disabled={saving} onClick={() => onToggleReturn(assignment.id)} size="sm" type="button" variant="secondary"><RotateCcw aria-hidden="true" />{labels.returnAssignment}</Button>{showReturnFor === assignment.id ? <div className="mt-3 max-w-xl"><FormField control={<Textarea onChange={(event) => onReturnReasonChange(event.target.value)} placeholder={labels.returnReasonPlaceholder} value={returnReason} />} label={labels.returnReason} /><Button className="mt-2" disabled={saving || !returnReason.trim()} loading={saving} onClick={() => onReturn(assignment.id)} size="sm" type="button">{labels.confirmReturn}</Button></div> : null}</div> : null}
      </div>)}
      {workspace.assignments.length === 0 ? <EmptyState className="border-0" title={labels.noTeam} /> : null}
    </div></Surface>
    <ConfirmDialog cancelLabel={labels.cancelAction} confirmLabel={labels.confirmAction} description={confirm === 'close' ? labels.confirmCloseDescription : labels.confirmStartDescription} onConfirm={async () => { const action = confirm; setConfirm(null); if (action) await onAction(action) }} onOpenChange={(open) => { if (!open && !saving) setConfirm(null) }} open={confirm !== null} title={confirm === 'close' ? labels.close : labels.start} />
  </div>
}

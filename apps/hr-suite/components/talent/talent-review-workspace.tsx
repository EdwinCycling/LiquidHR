'use client'

/* eslint-disable @next/next/no-img-element -- employee avatars use the authenticated avatar route. */

import { useMemo, useState } from 'react'
import { Bell, Check, CircleHelp, GripVertical, History, LockKeyhole, Plus, RotateCcw, Save, Search, Send, Sparkles, Users } from 'lucide-react'
import type { TalentReviewCampaign, TalentReviewEmployee, TalentReviewScore, TalentReviewWorkspace as ReviewWorkspace } from '@/lib/talent-review/service'
import type { GridValue } from '@/lib/talent-review/rules'

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
}

type DraftScore = { performanceScore: GridValue | null; potentialScore: GridValue | null; note: string; version?: number }

const DEFAULT_CREATE_DRAFT = {
  name: '',
  description: '',
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  previousCampaignId: '',
}

const GRID_ROWS: GridValue[] = ['HIGH', 'NORMAL', 'LOW']
const GRID_COLUMNS: GridValue[] = ['LOW', 'NORMAL', 'HIGH']
const CELL_LABEL_KEYS: Record<string, keyof TalentReviewLabels> = {
  HIGH_LOW: 'cellHighLow', HIGH_NORMAL: 'cellHighNormal', HIGH_HIGH: 'cellHighHigh',
  NORMAL_LOW: 'cellNormalLow', NORMAL_NORMAL: 'cellNormalNormal', NORMAL_HIGH: 'cellNormalHigh',
  LOW_LOW: 'cellLowLow', LOW_NORMAL: 'cellLowNormal', LOW_HIGH: 'cellLowHigh',
}

function initials(label: string): string {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function avatar(employee: TalentReviewEmployee, large = false) {
  return employee.avatarUrl
    ? <img alt="" className={`${large ? 'size-12' : 'size-9'} shrink-0 rounded-full object-cover ring-2 ring-surface`} src={employee.avatarUrl} />
    : <span aria-hidden="true" className={`grid ${large ? 'size-12 text-sm' : 'size-9 text-xs'} shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-foreground ring-2 ring-surface`}>{initials(employee.label)}</span>
}

function statusLabel(status: string, labels: TalentReviewLabels): string {
  const keys: Record<string, keyof TalentReviewLabels> = {
    DRAFT: 'draft', SCHEDULED: 'scheduled', ACTIVE: 'active', HR_REVIEW: 'hrReview', CLOSED: 'closed', ARCHIVED: 'archived',
    NOT_STARTED: 'notStarted', IN_PROGRESS: 'inProgress', SUBMITTED: 'submitted', RETURNED: 'returned',
  }
  return labels[keys[status] ?? 'draft']
}

function scoreDraft(score: TalentReviewScore | null): DraftScore {
  return { performanceScore: score?.performance_score as GridValue | null, potentialScore: score?.potential_score as GridValue | null, note: score?.note ?? '', version: score?.version }
}

function GridCell({ cell, scores, members, labels, onDrop, onSelect }: { cell: string; scores: TalentReviewScore[]; members: TalentReviewEmployee[]; labels: TalentReviewLabels; onDrop: (cell: string, employeeId?: string) => void; onSelect: (employeeId: string) => void }) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const cellScores = scores.filter((score) => score.grid_cell === cell)
  return <div className="flex min-h-36 flex-col border-b border-r border-border p-3 last:border-r-0" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(cell, event.dataTransfer.getData('text/plain') || undefined) }}>
    <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold uppercase tracking-[0.1em] text-foreground">{labels[CELL_LABEL_KEYS[cell] ?? 'grid']}</span><span className="text-xs font-semibold text-muted-foreground">{cellScores.length}</span></div>
    <div className="mt-4 flex flex-wrap gap-2">
      {cellScores.map((score) => {
        const member = membersById.get(score.employee_id)
        return member ? <button aria-label={member.label} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" draggable onClick={() => onSelect(member.id)} onDragStart={(event) => event.dataTransfer.setData('text/plain', member.id)} key={member.id} type="button">{avatar(member)}<span className="sr-only">{member.label}</span></button> : null
      })}
      {cellScores.length === 0 ? <button aria-label={labels.dropHere} className="grid size-16 place-items-center rounded-xl border border-dashed border-primary/25 text-xs text-muted-foreground hover:border-primary/50" onClick={() => onDrop(cell)} type="button"><Plus aria-hidden="true" size={17} /></button> : null}
    </div>
  </div>
}

function Grid({ scores, members, labels, onDrop, onSelect }: { scores: TalentReviewScore[]; members: TalentReviewEmployee[]; labels: TalentReviewLabels; onDrop: (cell: string, employeeId?: string) => void; onSelect: (employeeId: string) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-border bg-background"><div className="grid grid-cols-3 border-b border-border"><div className="p-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{labels.performance} ↓ / {labels.potential} →</div>{GRID_COLUMNS.map((value) => <div className="border-l border-border p-3 text-xs font-bold uppercase tracking-[0.1em]" key={value}>{value === 'LOW' ? labels.low : value === 'NORMAL' ? labels.normal : labels.high}</div>)}</div>{GRID_ROWS.map((performance) => <div className="grid grid-cols-3" key={performance}>{GRID_COLUMNS.map((potential) => <GridCell cell={`${performance}_${potential}`} key={`${performance}_${potential}`} labels={labels} members={members} onDrop={onDrop} onSelect={onSelect} scores={scores} />)}</div>)}</div>
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
  const [createDraft, setCreateDraft] = useState(DEFAULT_CREATE_DRAFT)

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
    setSaving(true); setError(false); setMessage(null)
    try {
      const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
      if (!response.ok) throw new Error('write')
      await refresh()
      setMessage(labels.saved)
    } catch { setError(true); setMessage(labels.failed) } finally { setSaving(false) }
  }

  async function createCampaign() {
    setSaving(true); setError(false); setMessage(null)
    try {
      const response = await fetch('/api/talent/review/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: createDraft.name, description: createDraft.description || null, startsOn: createDraft.startsOn, endsOn: createDraft.endsOn, previousCampaignId: createDraft.previousCampaignId || null }) })
      if (!response.ok) throw new Error('create')
      const payload = await response.json() as { data: { id: string } }
      const overview = await fetch('/api/talent/review/campaigns', { cache: 'no-store' })
      if (!overview.ok) throw new Error('read')
      const data = await overview.json() as { data: ReviewWorkspace }
      setWorkspace(data.data); setSelectedCampaignId(payload.data.id); window.history.replaceState(null, '', `/workforce/9-grid?campaignId=${encodeURIComponent(payload.data.id)}`); setCreateDraft((current) => ({ ...current, name: '', description: '', previousCampaignId: '' })); setMessage(labels.saved)
    } catch { setError(true); setMessage(labels.failed) } finally { setSaving(false) }
  }

  async function saveScore(employeeId: string, draft: DraftScore) {
    if (!selectedCampaignId) return
    setSaving(true); setError(false); setMessage(null)
    try {
      const response = await fetch(`/api/talent/review/campaigns/${selectedCampaignId}/scores/${employeeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, note: draft.note || null }) })
      if (!response.ok) throw new Error('score')
      await refresh()
      setMessage(labels.saved)
    } catch { setError(true); setMessage(labels.failed) } finally { setSaving(false) }
  }

  function dropEmployee(cell: string, employeeId = selectedEmployee?.id) {
    if (!employeeId || !selectedCampaign || selectedCampaign.status !== 'ACTIVE') return
    const [performanceScore, potentialScore] = cell.split('_') as [GridValue, GridValue]
    void saveScore(employeeId, { ...scoreDraft(scoreByEmployee.get(employeeId) ?? null), performanceScore, potentialScore })
  }

  const statusMessage = message ? <p className={`mt-3 text-sm ${error ? 'text-destructive' : 'text-primary-foreground/80'}`} role="status">{message}</p> : null
  return <section className="mt-6 space-y-6">
    <header className="rounded-[1.5rem] border border-primary/15 bg-primary p-6 text-primary-foreground shadow-[0_1.5rem_3rem_color-mix(in_srgb,var(--primary)_18%,transparent)] sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground/65">{mode === 'hr' ? labels.campaignOverview : labels.team}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{labels.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/75 sm:text-base">{labels.subtitle}</p></div>{selectedCampaign ? <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 px-4 py-3 text-sm"><span className="block text-xs uppercase tracking-[0.15em] text-primary-foreground/60">{selectedCampaign.name}</span><span className="mt-1 block font-semibold">{selectedCampaign.starts_on} – {selectedCampaign.ends_on}</span></div> : null}</div>{statusMessage}</header>
    {mode === 'hr' ? <HrView campaign={selectedCampaign} workspace={workspace} labels={labels} campaigns={campaignOptions} selectedCampaignId={selectedCampaignId} campaignSearch={campaignSearch} saving={saving} onCampaignSearch={setCampaignSearch} onCampaignChange={(id) => { setSelectedCampaignId(id); void refresh(id) }} onCreate={createCampaign} onCreateDraft={setCreateDraft} createDraft={createDraft} onAction={request} onSelectEmployee={setSelectedEmployeeId} /> : <ManagerView key={`${selectedEmployeeId ?? 'none'}:${selectedScore?.version ?? 0}`} campaign={selectedCampaign} workspace={workspace} labels={labels} members={members} selectedEmployee={selectedEmployee} selectedScore={selectedScore} previousScore={previousScore} saving={saving} onCampaignChange={(id) => { setSelectedCampaignId(id); void refresh(id) }} onDrop={dropEmployee} onSave={saveScore} onSelectEmployee={setSelectedEmployeeId} onSearch={setSearch} onSubmit={() => selectedCampaignId ? void request(`/api/talent/review/campaigns/${selectedCampaignId}/submit`, 'POST') : undefined} />}
  </section>
}

function HrView({ campaign, workspace, labels, campaigns, selectedCampaignId, campaignSearch, saving, onCampaignSearch, onCampaignChange, onCreate, onCreateDraft, createDraft, onAction, onSelectEmployee }: { campaign: TalentReviewCampaign | null; workspace: ReviewWorkspace; labels: TalentReviewLabels; campaigns: TalentReviewCampaign[]; selectedCampaignId: string | null; campaignSearch: string; saving: boolean; onCampaignSearch: (value: string) => void; onCampaignChange: (id: string) => void; onCreate: () => void; onCreateDraft: (value: { name: string; description: string; startsOn: string; endsOn: string; previousCampaignId: string }) => void; createDraft: { name: string; description: string; startsOn: string; endsOn: string; previousCampaignId: string }; onAction: (url: string, method: 'POST' | 'PATCH', body?: unknown) => Promise<void>; onSelectEmployee: (id: string) => void }) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]"><div className="space-y-6"><section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><Plus aria-hidden="true" size={19} /></span><div><h2 className="font-semibold">{labels.newCampaign}</h2><p className="text-sm text-muted-foreground">{labels.campaignOverview}</p></div></div><div className="mt-5 space-y-3"><label className="block text-sm"><span className="mb-1 block">{labels.campaignName}</span><input className="form-field" value={createDraft.name} onChange={(event) => onCreateDraft({ ...createDraft, name: event.target.value })} /></label><label className="block text-sm"><span className="mb-1 block">{labels.description}</span><textarea className="form-field min-h-20" value={createDraft.description} onChange={(event) => onCreateDraft({ ...createDraft, description: event.target.value })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm"><span className="mb-1 block">{labels.startsOn}</span><input className="form-field" type="date" value={createDraft.startsOn} onChange={(event) => onCreateDraft({ ...createDraft, startsOn: event.target.value })} /></label><label className="block text-sm"><span className="mb-1 block">{labels.endsOn}</span><input className="form-field" type="date" value={createDraft.endsOn} onChange={(event) => onCreateDraft({ ...createDraft, endsOn: event.target.value })} /></label></div><label className="block text-sm"><span className="mb-1 block">{labels.previousCampaign}</span><select className="form-field" value={createDraft.previousCampaignId} onChange={(event) => onCreateDraft({ ...createDraft, previousCampaignId: event.target.value })}><option value="">{labels.noPreviousCampaign}</option>{workspace.campaigns.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><button className="button-primary w-full" disabled={saving || !createDraft.name} onClick={onCreate} type="button">{labels.create}</button></div></section><section className="rounded-2xl border bg-surface p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{labels.campaigns}</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{workspace.campaigns.length}</span></div><label className="relative mt-3 block"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><span className="sr-only">{labels.searchCampaigns}</span><input className="form-field pl-9" placeholder={labels.searchCampaigns} value={campaignSearch} onChange={(event) => onCampaignSearch(event.target.value)} /></label><div className="mt-3 space-y-2">{campaigns.map((option) => <button aria-pressed={option.id === selectedCampaignId} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${option.id === selectedCampaignId ? 'border-primary/40 bg-primary/5' : 'bg-background hover:border-primary/30'}`} key={option.id} onClick={() => onCampaignChange(option.id)} type="button"><span><span className="block text-sm font-semibold">{option.name}</span><span className="mt-1 block text-xs text-muted-foreground">{option.starts_on} – {option.ends_on}</span></span><span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-semibold">{statusLabel(option.status, labels)}</span></button>)}{campaigns.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{labels.noCampaigns}</p> : null}</div></section></div><div>{campaign ? <HrCampaignPanel campaign={campaign} workspace={workspace} labels={labels} saving={saving} onAction={onAction} onSelectEmployee={onSelectEmployee} /> : <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{labels.selectCampaign}</div>}</div></div>
}

function HrCampaignPanel({ campaign, workspace, labels, saving, onAction, onSelectEmployee }: { campaign: TalentReviewCampaign; workspace: ReviewWorkspace; labels: TalentReviewLabels; saving: boolean; onAction: (url: string, method: 'POST' | 'PATCH', body?: unknown) => Promise<void>; onSelectEmployee: (id: string) => void }) {
  const placed = workspace.scores.filter((score) => score.grid_cell).length
  const total = workspace.members.length
  const percentage = total ? Math.round((placed / total) * 100) : 0
  return <div className="space-y-6"><section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{statusLabel(campaign.status, labels)}</span><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{campaign.starts_on} – {campaign.ends_on}</span></div><h2 className="mt-3 text-2xl font-semibold">{campaign.name}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{campaign.description || labels.campaignOverview}</p></div><div className="flex flex-wrap gap-2">{campaign.status === 'DRAFT' ? <button className="button-primary" disabled={saving} onClick={() => void onAction(`/api/talent/review/campaigns/${campaign.id}/start`, 'POST')} type="button"><Sparkles aria-hidden="true" size={16} />{labels.start}</button> : null}{['ACTIVE', 'HR_REVIEW'].includes(campaign.status) ? <button className="button-secondary" disabled={saving || !workspace.assignments.every((assignment) => assignment.status === 'SUBMITTED')} onClick={() => void onAction(`/api/talent/review/campaigns/${campaign.id}/close`, 'POST')} type="button"><LockKeyhole aria-hidden="true" size={16} />{labels.close}</button> : null}{campaign.status === 'CLOSED' ? <button className="button-secondary" disabled={saving} onClick={() => void onAction(`/api/talent/review/campaigns/${campaign.id}/reopen`, 'POST')} type="button"><RotateCcw aria-hidden="true" size={16} />{labels.reopen}</button> : null}</div></div><div className="mt-5 rounded-xl bg-muted/60 p-4"><div className="flex items-center justify-between gap-3 text-sm"><span>{labels.progress}</span><strong>{placed} / {total} {labels.placed}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} /></div></div></section><section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]"><div className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{labels.companyGrid}</h2><CircleHelp aria-hidden="true" className="text-muted-foreground" size={18} /></div><div className="mt-4"><Grid labels={labels} members={workspace.members} onDrop={() => undefined} onSelect={onSelectEmployee} scores={workspace.scores} /></div></div><div className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><Users aria-hidden="true" className="text-primary" size={18} /><h2 className="text-lg font-semibold">{labels.managers}</h2></div><div className="mt-4 space-y-3">{workspace.assignments.map((assignment) => <div className="rounded-xl border bg-background p-3" key={assignment.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{assignment.managerLabel}</p><p className="mt-1 text-xs text-muted-foreground">{assignment.scored_count} / {assignment.employee_count} {labels.placed}</p></div><span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-semibold">{statusLabel(assignment.status, labels)}</span></div>{assignment.status !== 'SUBMITTED' && ['ACTIVE', 'SCHEDULED', 'HR_REVIEW'].includes(campaign.status) ? <button className="button-secondary mt-3 w-full" disabled={saving} onClick={() => void onAction(`/api/talent/review/campaigns/${campaign.id}/reminders`, 'POST', { assignmentId: assignment.id })} type="button"><Bell aria-hidden="true" size={15} />{assignment.last_reminded_at ? labels.reminderSent : labels.remind}</button> : null}</div>)}{workspace.assignments.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noTeam}</p> : null}</div></div></section><section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><History aria-hidden="true" className="text-primary" size={18} /><h2 className="text-lg font-semibold">{labels.history}</h2></div><p className="mt-2 text-sm text-muted-foreground">{campaign.previous_campaign_id ? labels.previousScore : labels.noHistory}</p></section></div>
}

function ManagerView({ campaign, workspace, labels, members, selectedEmployee, selectedScore, previousScore, saving, onCampaignChange, onDrop, onSave, onSelectEmployee, onSearch, onSubmit }: { campaign: TalentReviewCampaign | null; workspace: ReviewWorkspace; labels: TalentReviewLabels; members: TalentReviewEmployee[]; selectedEmployee: TalentReviewEmployee | null; selectedScore: TalentReviewScore | null; previousScore: TalentReviewScore | null; saving: boolean; onCampaignChange: (id: string) => void; onDrop: (cell: string, employeeId?: string) => void; onSave: (employeeId: string, draft: DraftScore) => Promise<void>; onSelectEmployee: (id: string) => void; onSearch: (value: string) => void; onSubmit: () => void }) {
  const [localDraft, setLocalDraft] = useState<DraftScore>(() => scoreDraft(selectedScore))
  const readOnly = !campaign || campaign.status !== 'ACTIVE'
  if (!campaign) return <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">{labels.noCampaigns}</div>
  const placed = workspace.scores.filter((score) => score.grid_cell).length
  const total = workspace.members.length
  const updateDraft = (patch: Partial<DraftScore>) => setLocalDraft((current) => ({ ...current, ...patch }))
  return <div className="space-y-6"><section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><label className="block min-w-0 flex-1 text-sm"><span className="mb-1 block">{labels.campaigns}</span><select className="form-field" value={campaign.id} onChange={(event) => onCampaignChange(event.target.value)}>{workspace.campaigns.map((option) => <option key={option.id} value={option.id}>{option.name} · {statusLabel(option.status, labels)}</option>)}</select></label><div className="rounded-xl bg-muted/60 px-4 py-3 text-sm"><strong>{placed} / {total}</strong> {labels.placed}</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? Math.round((placed / total) * 100) : 0}%` }} /></div></section><div className="grid gap-6 xl:grid-cols-[minmax(14rem,0.6fr)_minmax(0,1.4fr)_minmax(17rem,0.65fr)]"><aside className="rounded-2xl border bg-surface p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{labels.team}</h2><span className="rounded-full bg-muted px-2 py-1 text-xs">{members.length}</span></div><label className="relative mt-3 block"><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><span className="sr-only">{labels.searchEmployees}</span><input className="form-field pl-9" placeholder={labels.searchEmployees} onChange={(event) => onSearch(event.target.value)} /></label><div className="mt-3 space-y-2">{members.map((member) => { const score = workspace.scores.find((candidate) => candidate.employee_id === member.id); return <button aria-pressed={member.id === selectedEmployee?.id} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${member.id === selectedEmployee?.id ? 'border-primary/40 bg-primary/5' : 'bg-background hover:border-primary/30'}`} draggable onClick={() => onSelectEmployee(member.id)} onDragStart={(event) => event.dataTransfer.setData('text/plain', member.id)} key={member.id} type="button">{avatar(member)}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{member.label}</span><span className="block truncate text-xs text-muted-foreground">{member.jobTitle || labels.team}</span></span>{score?.grid_cell ? <Check aria-label={labels.placed} className="text-primary" size={16} /> : <GripVertical aria-hidden="true" className="text-muted-foreground" size={17} />}</button> })}{members.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{labels.noTeam}</p> : null}</div></aside><section className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{labels.teamGrid}</h2><p className="mt-1 text-sm text-muted-foreground">{campaign.starts_on} – {campaign.ends_on}</p></div><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{statusLabel(campaign.status, labels)}</span></div><div className="mt-4"><Grid labels={labels} members={workspace.members} onDrop={onDrop} onSelect={onSelectEmployee} scores={workspace.scores} /></div></section><aside className="rounded-2xl border bg-surface p-5 shadow-sm"><h2 className="text-lg font-semibold">{selectedEmployee?.label ?? labels.noEmployeeSelected}</h2>{selectedEmployee ? <><div className="mt-4 flex items-center gap-3">{avatar(selectedEmployee, true)}<div><p className="text-sm font-semibold">{selectedEmployee.jobTitle || labels.team}</p><p className="text-xs text-muted-foreground">{selectedEmployee.employeeNumber}</p></div></div><div className="mt-5 rounded-xl border bg-background p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.previousScore}</p>{previousScore?.grid_cell ? <p className="mt-2 font-semibold">{labels[CELL_LABEL_KEYS[previousScore.grid_cell] ?? 'grid']}</p> : <p className="mt-2 text-sm text-muted-foreground">{labels.noHistory}</p>}</div><div className="mt-4 space-y-3"><label className="block text-sm"><span className="mb-1 block">{labels.performance}</span><select className="form-field" disabled={readOnly} value={localDraft.performanceScore ?? ''} onChange={(event) => updateDraft({ performanceScore: (event.target.value || null) as GridValue | null })}><option value="">—</option><option value="LOW">{labels.low}</option><option value="NORMAL">{labels.normal}</option><option value="HIGH">{labels.high}</option></select></label><label className="block text-sm"><span className="mb-1 block">{labels.potential}</span><select className="form-field" disabled={readOnly} value={localDraft.potentialScore ?? ''} onChange={(event) => updateDraft({ potentialScore: (event.target.value || null) as GridValue | null })}><option value="">—</option><option value="LOW">{labels.low}</option><option value="NORMAL">{labels.normal}</option><option value="HIGH">{labels.high}</option></select></label><label className="block text-sm"><span className="mb-1 block">{labels.note}<textarea className="form-field mt-1 min-h-24" disabled={readOnly} placeholder={labels.notePlaceholder} value={localDraft.note} onChange={(event) => updateDraft({ note: event.target.value })} /></span></label><button className="button-secondary w-full" disabled={saving || readOnly || !selectedEmployee} onClick={() => selectedEmployee ? void onSave(selectedEmployee.id, localDraft) : undefined} type="button"><Save aria-hidden="true" size={15} />{labels.saveDraft}</button></div><div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><History aria-hidden="true" size={14} />{selectedScore ? `${labels.currentScore}: ${labels[CELL_LABEL_KEYS[selectedScore.grid_cell ?? ''] ?? 'grid']}` : labels.noScores}</div></> : <p className="mt-4 text-sm text-muted-foreground">{labels.noEmployeeSelected}</p>}</aside></div><footer className="flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Save aria-hidden="true" size={16} />{readOnly ? labels.readOnly : labels.progress}</span><button className="button-primary" disabled={saving || readOnly || total === 0 || placed !== total} onClick={onSubmit} type="button"><Send aria-hidden="true" size={16} />{labels.submitTeam}</button></footer></div>
}

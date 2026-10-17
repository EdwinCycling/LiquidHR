'use client'

import Link from 'next/link'
import { ArrowUpRight, BriefcaseBusiness, Check, CircleAlert, Compass, Mail, MoveDown, MoveUp, Radar, Search, Target, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StarPerformerWorkspaceQuery } from '@/lib/star-performers/schemas'
import type { StarPerformersInsights as StarPerformersInsightsData } from '@/lib/star-performers/insights-service'
import type { StarPerformersDetail, StarPerformersWorkspacePage, StarPerformersWorkspaceRow } from '@/lib/star-performers/v2-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormField } from '@/components/patterns/form-field'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { StarPerformersInsights } from './star-performers-insights'

export type StarPerformersWorkspaceLabels = {
  perspective: string
  topTalent: string
  keyEmployees: string
  topTalentDescription: string
  keyEmployeesDescription: string
  areaNavigation: string
  overview: string
  employees: string
  keyRoles: string
  development: string
  insights: string
  insightsDescription: string
  insightsTopTalent: string
  insightsKeyEmployees: string
  insightsSkills: string
  insightsDevelopment: string
  insightNavigation: string
  insightKpiScope: string
  period: string
  allPeriods: string
  comparableMovement: string
  gridDistribution: string
  gridDistributionDescription: string
  ofAssessed: string
  highHighEmployees: string
  highHighEmployeesDescription: string
  sourceUnavailable: string
  noHighHighEmployees: string
  noHighHighEmployeesDescription: string
  comparedWith: string
  comparableHistory: string
  movementUnavailable: string
  highCriticalEmployees: string
  overlap: string
  criticalityDistribution: string
  criticalityDistributionDescription: string
  highCriticalThreshold: string
  overlapDescription: string
  overlapEmployees: string
  independentAssessmentSources: string
  group: string
  assessedCount: string
  highCriticalCount: string
  byDepartment: string
  byJobGroup: string
  byJob: string
  noBreakdownData: string
  employee: string
  noAssessedKeyEmployees: string
  roleSkillCoverage: string
  roleSkillCoverageDescription: string
  evaluatedEmployees: string
  rolesWithEvidence: string
  vulnerabilitySignals: string
  requirements: string
  coverage: string
  gaps: string
  noSkillsData: string
  noSkillsDataDescription: string
  topGaps: string
  activePlans: string
  employeesWithPlans: string
  averageProgress: string
  openActions: string
  noDevelopmentData: string
  due: string
  until: string
  noOpenActions: string
  trendAvailable: string
  trendUnavailable: string
  filtersTitle: string
  search: string
  searchPlaceholder: string
  team: string
  allTeams: string
  job: string
  allJobs: string
  jobGroup: string
  allJobGroups: string
  relevantStatus: string
  allStatuses: string
  statusHighHigh: string
  statusAssessed: string
  statusNotAssessed: string
  employeesInScope: string
  approvedGrid: string
  highHighSignals: string
  assessedKeyEmployees: string
  inSelection: string
  employeesTitle: string
  employeesDescription: string
  keyRolesTitle: string
  keyRolesDescription: string
  developmentTitle: string
  developmentDescription: string
  overviewTitle: string
  overviewDescription: string
  noEmployees: string
  noEmployeesDescription: string
  noSelectedEmployee: string
  selectEmployee: string
  detailTitle: string
  employeeNumber: string
  department: string
  notAssessed: string
  approvedSignal: string
  noApprovedSignal: string
  campaign: string
  closedOn: string
  movement: string
  movementUp: string
  movementDown: string
  movementStable: string
  movementNew: string
  performance: string
  potential: string
  grid: string
  skills: string
  skillsDescription: string
  noSkills: string
  jobProfile: string
  jobProfileDescription: string
  noJobProfile: string
  skillGaps: string
  noSkillGaps: string
  developmentPlans: string
  noDevelopmentPlans: string
  appraisal: string
  noAppraisal: string
  openSource: string
  openEmployee: string
  openGrid: string
  openSkills: string
  openRoleExplorer: string
  openComparison: string
  openDevelopment: string
  openAppraisal: string
  unavailable: string
  loading: string
  loadFailed: string
  retry: string
  readOnly: string
  criticality: string
  saved: string
  saveFailed: string
  saving: string
  tags: string
  noTags: string
  noTagsAvailable: string
  pagination: string
  previous: string
  next: string
  rolesPageOnly: string
  roleEmployees: string
  noRoleData: string
}

type Props = {
  initial: StarPerformersWorkspacePage
  initialQuery: StarPerformerWorkspaceQuery
  canWrite: boolean
  canViewEmployees: boolean
  labels: StarPerformersWorkspaceLabels
}

type DetailModuleProps = {
  title: string
  description?: string
  state: 'ready' | 'unavailable'
  children: React.ReactNode
  sourceHref?: string
  sourceLabel?: string
  labels: StarPerformersWorkspaceLabels
}

function initials(employee: Pick<StarPerformersWorkspaceRow, 'firstName' | 'birthName'>): string {
  return `${employee.firstName.slice(0, 1)}${employee.birthName.slice(0, 1) || employee.firstName.slice(1, 2)}`.toUpperCase()
}

function employeeLabel(employee: Pick<StarPerformersWorkspaceRow, 'firstName' | 'birthName'>): string {
  return [employee.firstName, employee.birthName].filter(Boolean).join(' ')
}

function EmployeeAvatar({ employee }: { employee: StarPerformersWorkspaceRow }) {
  if (employee.avatarUrl) return <span aria-hidden="true" className="size-10 shrink-0 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${employee.avatarUrl}")` }} />
  return <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary">{initials(employee)}</span>
}

function ModuleCard({ children, description, labels, sourceHref, sourceLabel, state, title }: DetailModuleProps) {
  return <Surface className="p-4" variant="subtle">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {state === 'unavailable' ? <Badge tone="warning">{labels.unavailable}</Badge> : null}
    </div>
    {state === 'unavailable' ? <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />{labels.unavailable}</p> : <div className="mt-3">{children}</div>}
    {sourceHref && sourceLabel ? <Link className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={sourceHref}>{sourceLabel}<ArrowUpRight aria-hidden="true" className="size-3.5" /></Link> : null}
  </Surface>
}

function StatusBadge({ row, perspective, labels }: { row: StarPerformersWorkspaceRow; perspective: StarPerformerWorkspaceQuery['perspective']; labels: StarPerformersWorkspaceLabels }) {
  if (perspective === 'top-talent') return row.gridSignal?.isHighHigh ? <Badge tone="success">{labels.statusHighHigh}</Badge> : row.gridSignal ? <Badge tone="info">{labels.approvedSignal}</Badge> : <Badge tone="neutral">{labels.notAssessed}</Badge>
  return row.assessment ? <Badge tone={row.assessment.criticalityLevel >= 4 ? 'warning' : 'info'}>{labels.criticality} {row.assessment.criticalityLevel}/5</Badge> : <Badge tone="neutral">{labels.notAssessed}</Badge>
}

function KpiStrip({ data, labels }: { data: StarPerformersWorkspacePage; labels: StarPerformersWorkspaceLabels }) {
  const values = [
    [labels.employeesInScope, data.kpis.employeesInScope, UsersRound],
    [labels.approvedGrid, data.kpis.approvedGrid, Target],
    [labels.highHighSignals, data.kpis.highHighSignals, Radar],
    [labels.assessedKeyEmployees, data.kpis.assessedKeyEmployees, BriefcaseBusiness],
  ] as const
  return <Surface className="overflow-hidden"><dl className="grid divide-y divide-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{values.map(([label, value, Icon]) => <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5" key={label}><div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</dd><p className="mt-1 text-[11px] text-muted-foreground">{labels.inSelection}</p></div><Icon aria-hidden="true" className="size-5 text-primary" /></div>)}</dl></Surface>
}

function EmployeeRow({ canViewEmployees, labels, onSelect, perspective, row, selected }: { canViewEmployees: boolean; labels: StarPerformersWorkspaceLabels; onSelect: () => void; perspective: StarPerformerWorkspaceQuery['perspective']; row: StarPerformersWorkspaceRow; selected: boolean }) {
  return <Surface className={selected ? 'border-primary/60 bg-accent/40' : ''} variant="default">
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <button aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-control)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={onSelect} type="button">
        <EmployeeAvatar employee={row} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{employeeLabel(row)}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{labels.employeeNumber}: {row.employeeNumber}</span>{row.departmentName ? <span>{labels.department}: {row.departmentName}</span> : null}{row.jobName ? <span>{row.jobName}</span> : null}</span>
        </span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <StatusBadge labels={labels} perspective={perspective} row={row} />
        {row.gridSignal?.movement === 'UP' ? <Badge tone="success"><MoveUp aria-hidden="true" className="mr-1 size-3.5" />{labels.movementUp}</Badge> : null}
        {row.gridSignal?.movement === 'DOWN' ? <Badge tone="danger"><MoveDown aria-hidden="true" className="mr-1 size-3.5" />{labels.movementDown}</Badge> : null}
        {canViewEmployees ? <Link aria-label={`${labels.openEmployee}: ${employeeLabel(row)}`} className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-control)] px-2 text-xs font-semibold text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/employees/${row.employeeId}`}><UserRound aria-hidden="true" className="size-3.5" />{labels.openEmployee}</Link> : null}
      </div>
    </div>
  </Surface>
}

function RolesArea({ labels, onSelect, rows }: { labels: StarPerformersWorkspaceLabels; onSelect: (employeeId: string) => void; rows: StarPerformersWorkspaceRow[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, StarPerformersWorkspaceRow[]>()
    for (const row of rows) {
      const key = row.jobGroupName ?? row.jobName ?? labels.noRoleData
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'nl'))
  }, [labels.noRoleData, rows])
  if (!grouped.length) return <EmptyState icon={<BriefcaseBusiness />} title={labels.noRoleData} />
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">{labels.rolesPageOnly}</p>{grouped.map(([role, roleRows]) => <Surface className="p-4" key={role}><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-foreground">{role}</h3><p className="mt-1 text-xs text-muted-foreground">{roleRows.length} {labels.roleEmployees}</p></div><BriefcaseBusiness aria-hidden="true" className="size-5 text-primary" /></div><div className="mt-4 flex flex-wrap gap-2">{roleRows.map((row) => <button className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" key={row.employeeId} onClick={() => onSelect(row.employeeId)} type="button"><span aria-hidden="true" className="size-2 rounded-full bg-primary" />{employeeLabel(row)}</button>)}</div></Surface>)}</div>
}

function DetailDrawer({ canViewEmployees, canWrite, detail, labels, onSave, perspective }: { canViewEmployees: boolean; canWrite: boolean; detail: StarPerformersDetail | null; labels: StarPerformersWorkspaceLabels; onSave: (criticalityLevel: number, tagIds: string[]) => Promise<void>; perspective: StarPerformerWorkspaceQuery['perspective'] }) {
  const [pendingLevel, setPendingLevel] = useState<number | null>(null)
  if (!detail) return <Surface className="flex min-h-[22rem] flex-col items-center justify-center p-8 text-center" variant="subtle"><Compass aria-hidden="true" className="size-8 text-primary" /><h2 className="mt-4 text-lg font-semibold text-foreground">{labels.noSelectedEmployee}</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">{labels.selectEmployee}</p></Surface>
  const employee = detail.employee
  const assessment = employee.assessment
  const activeTags = detail.employee.assessment?.tagIds ?? []
  const tags = detail.tags
  const scopeAvailable = Boolean(assessment?.jobId || assessment?.jobGroupId || employee.jobId || employee.jobGroupId)

  async function saveLevel(level: number) {
    if (!scopeAvailable) return
    setPendingLevel(level)
    try { await onSave(level, activeTags) } finally { setPendingLevel(null) }
  }

  return <div className="space-y-4">
    <Surface className="p-5">
      <div className="flex items-start gap-3"><EmployeeAvatar employee={employee} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">{employeeLabel(employee)}</h2><p className="mt-1 text-sm text-muted-foreground">{employee.jobName ?? labels.noJobProfile}{employee.jobGroupName ? ` · ${employee.jobGroupName}` : ''}</p></div>{perspective === 'key-employees' ? <StatusBadge labels={labels} perspective={perspective} row={employee} /> : null}</div><p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{labels.employeeNumber}: {employee.employeeNumber}</span>{employee.departmentName ? <span>{labels.department}: {employee.departmentName}</span> : null}{employee.workEmail ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${employee.workEmail}`}><Mail aria-hidden="true" className="size-3.5" />{employee.workEmail}</a> : null}</p></div></div>
      {perspective === 'key-employees' && canWrite ? <div className="mt-5 border-t border-border-subtle pt-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{labels.criticality}</h3>{!scopeAvailable ? <Badge tone="warning">{labels.notAssessed}</Badge> : null}</div><div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={labels.criticality}>{[1, 2, 3, 4, 5].map((level) => <Button disabled={!scopeAvailable} key={level} loading={pendingLevel === level} onClick={() => void saveLevel(level)} size="sm" type="button" variant={assessment?.criticalityLevel === level ? 'primary' : 'secondary'}>{level}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">{assessment ? `${labels.saved}: ${new Date(assessment.updatedAt).toLocaleDateString('nl-NL')}` : labels.notAssessed}</p></div> : null}
      {perspective === 'key-employees' && !canWrite ? <div className="mt-4"><Badge tone="neutral">{labels.readOnly}</Badge></div> : null}
      {canViewEmployees ? <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={detail.links.employee}>{labels.openEmployee}<ArrowUpRight aria-hidden="true" className="size-4" /></Link> : null}
    </Surface>

    <ModuleCard labels={labels} sourceHref={detail.links.grid} sourceLabel={labels.openGrid} state={detail.grid.state} title={labels.approvedSignal}>
      {detail.grid.signal ? <div className="space-y-2 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge tone={detail.grid.signal.isHighHigh ? 'success' : 'info'}>{detail.grid.signal.gridCell ?? labels.approvedSignal}</Badge>{detail.grid.signal.movement === 'UP' ? <span className="inline-flex items-center gap-1 text-success"><MoveUp aria-hidden="true" className="size-4" />{labels.movementUp}</span> : null}{detail.grid.signal.movement === 'DOWN' ? <span className="inline-flex items-center gap-1 text-destructive"><MoveDown aria-hidden="true" className="size-4" />{labels.movementDown}</span> : null}{detail.grid.signal.movement === 'STABLE' ? <span className="text-muted-foreground">{labels.movementStable}</span> : null}{detail.grid.signal.movement === 'NEW' ? <span className="text-muted-foreground">{labels.movementNew}</span> : null}</div><p className="text-muted-foreground">{detail.grid.signal.campaignName}{detail.grid.signal.closedAt ? ` · ${labels.closedOn} ${new Date(detail.grid.signal.closedAt).toLocaleDateString('nl-NL')}` : ''}</p><dl className="grid grid-cols-2 gap-3 pt-2"><div><dt className="text-xs text-muted-foreground">{labels.performance}</dt><dd className="font-semibold text-foreground">{detail.grid.signal.performanceScore ?? labels.notAssessed}</dd></div><div><dt className="text-xs text-muted-foreground">{labels.potential}</dt><dd className="font-semibold text-foreground">{detail.grid.signal.potentialScore ?? labels.notAssessed}</dd></div></dl></div> : <p className="text-sm text-muted-foreground">{labels.noApprovedSignal}</p>}
    </ModuleCard>

    <ModuleCard description={labels.skillsDescription} labels={labels} sourceHref={detail.links.skills} sourceLabel={labels.openSkills} state={detail.skills.state} title={labels.skills}>
      {detail.skills.records.length ? <div className="space-y-2">{detail.skills.records.map((record) => <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-2 last:border-0 last:pb-0" key={record.id}><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{record.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{record.type} · {record.source}</p></div><div className="shrink-0 text-right text-xs"><p className="font-semibold text-foreground">{record.level ?? labels.notAssessed}</p><p className="mt-0.5 text-muted-foreground">{record.evidenceStatus ?? labels.notAssessed}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">{labels.noSkills}</p>}
    </ModuleCard>

    <ModuleCard description={labels.jobProfileDescription} labels={labels} sourceHref={detail.links.roleExplorer} sourceLabel={labels.openRoleExplorer} state={detail.jobProfile.state} title={labels.jobProfile}>
      {detail.jobProfile.profile ? <div><p className="text-sm font-medium text-foreground">{detail.jobProfile.profile.jobCode}{detail.jobProfile.profile.jobGroupName ? ` · ${detail.jobProfile.profile.jobGroupName}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">v{detail.jobProfile.profile.version}</p><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.skillGaps}</p>{detail.jobProfile.gaps.length ? <ul className="mt-2 space-y-2">{detail.jobProfile.gaps.map((gap, index) => <li className="flex items-start justify-between gap-3 text-sm" key={`${gap.name}-${index}`}><span className="min-w-0 text-foreground">{gap.name}</span><Badge tone={gap.status === 'GAP' ? 'warning' : 'neutral'}>{gap.status}</Badge></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{labels.noSkillGaps}</p>}</div></div> : <p className="text-sm text-muted-foreground">{labels.noJobProfile}</p>}
    </ModuleCard>

    <ModuleCard labels={labels} sourceHref={detail.links.comparison} sourceLabel={labels.openComparison} state={detail.jobProfile.state} title={labels.grid}>
      <p className="text-sm text-muted-foreground">{labels.openComparison}</p>
    </ModuleCard>

    <ModuleCard labels={labels} sourceHref={detail.links.development} sourceLabel={labels.openDevelopment} state={detail.development.state} title={labels.developmentPlans}>
      {detail.development.plans.length ? <div className="space-y-3">{detail.development.plans.map((plan) => <div key={plan.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-foreground">{plan.title}</span><span className="tabular-nums text-muted-foreground">{plan.progressPercent}%</span></div><div aria-label={`${plan.title}: ${plan.progressPercent}%`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, plan.progressPercent))}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{plan.status} · {plan.periodStart}{plan.periodEnd ? ` – ${plan.periodEnd}` : ''}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{labels.noDevelopmentPlans}</p>}
    </ModuleCard>

    <ModuleCard labels={labels} sourceHref={detail.links.appraisal} sourceLabel={labels.openAppraisal} state={detail.appraisal.state} title={labels.appraisal}>
      {detail.appraisal.items.length ? <div className="space-y-2">{detail.appraisal.items.map((item) => <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-2 last:border-0 last:pb-0" key={item.id}><div><p className="text-sm font-medium text-foreground">{item.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.itemType} · {item.occurredOn}</p></div><Badge tone="neutral">{item.status}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">{labels.noAppraisal}</p>}
    </ModuleCard>
    {perspective === 'key-employees' && canWrite && tags.length ? <Surface className="p-4" variant="subtle"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{labels.tags}</h3><Check aria-hidden="true" className="size-4 text-primary" /></div><div className="mt-3 flex flex-wrap gap-2">{tags.filter((tag) => tag.isActive).map((tag) => { const selected = activeTags.includes(tag.id); return <Button key={tag.id} onClick={() => void onSave(assessment?.criticalityLevel ?? 1, selected ? activeTags.filter((id) => id !== tag.id) : [...activeTags, tag.id])} size="sm" type="button" variant={selected ? 'primary' : 'secondary'}>{tag.name}</Button> })}</div></Surface> : null}
  </div>
}

function queryString(query: StarPerformerWorkspaceQuery): string {
  const params = new URLSearchParams()
  params.set('perspective', query.perspective)
  params.set('area', query.area)
  params.set('insight', query.insight)
  if (query.q) params.set('q', query.q)
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (query.jobId) params.set('jobId', query.jobId)
  if (query.jobGroupId) params.set('jobGroupId', query.jobGroupId)
  if (query.period) params.set('period', query.period)
  if (query.status !== 'all') params.set('status', query.status)
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  return params.toString()
}

export function StarPerformersWorkspace({ canViewEmployees, canWrite, initial, initialQuery, labels }: Props) {
  const [data, setData] = useState(initial)
  const [query, setQuery] = useState(initialQuery)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(initial.rows[0]?.employeeId ?? null)
  const [detail, setDetail] = useState<StarPerformersDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const [insights, setInsights] = useState<StarPerformersInsightsData | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState(false)
  const [insightsReloadToken, setInsightsReloadToken] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)
  const [detailReloadToken, setDetailReloadToken] = useState(0)
  const initialRender = useRef(true)

  function setUrl(next: StarPerformerWorkspaceQuery) {
    window.history.replaceState(null, '', `/workforce/star-performers?${queryString(next)}`)
  }

  function updateQuery(patch: Partial<StarPerformerWorkspaceQuery>) {
    const next = { ...query, ...patch, page: patch.page ?? 1 }
    setQuery(next)
    setUrl(next)
  }

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    if (query.area === 'insights') return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(false)
    })
    void fetch(`/api/star-performers/assessments?${queryString(query)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('workspace-load-failed')
        return response.json() as Promise<{ data: StarPerformersWorkspacePage }>
      })
      .then((payload) => {
        if (cancelled) return
        setData(payload.data)
        setSelectedEmployeeId((current) => payload.data.rows.some((row) => row.employeeId === current) ? current : payload.data.rows[0]?.employeeId ?? null)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, reloadToken])

  useEffect(() => {
    if (query.area !== 'insights') return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setInsightsLoading(true)
      setInsightsError(false)
    })
    void fetch(`/api/star-performers/insights?${queryString(query)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('insights-load-failed')
        return response.json() as Promise<{ data: StarPerformersInsightsData }>
      })
      .then((payload) => { if (!cancelled) setInsights(payload.data) })
      .catch(() => { if (!cancelled) setInsightsError(true) })
      .finally(() => { if (!cancelled) setInsightsLoading(false) })
    return () => { cancelled = true }
  }, [query, insightsReloadToken])

  useEffect(() => {
    if (!selectedEmployeeId || query.area === 'insights') return
    let cancelled = false
    void fetch(`/api/star-performers/assessments?employeeId=${encodeURIComponent(selectedEmployeeId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('detail-load-failed')
        return response.json() as Promise<{ data: StarPerformersDetail }>
      })
      .then((payload) => { if (!cancelled) setDetail(payload.data) })
      .catch(() => { if (!cancelled) setDetailError(true) })
    return () => { cancelled = true }
  }, [selectedEmployeeId, detailReloadToken, query.area])

  async function saveAssessment(criticalityLevel: number, tagIds: string[]) {
    if (!detail) return
    const scope = detail.employee.assessment?.jobId ? { jobId: detail.employee.assessment.jobId } : detail.employee.assessment?.jobGroupId ? { jobGroupId: detail.employee.assessment.jobGroupId } : detail.employee.jobId ? { jobId: detail.employee.jobId } : detail.employee.jobGroupId ? { jobGroupId: detail.employee.jobGroupId } : null
    if (!scope) return
    try {
      const response = await fetch('/api/star-performers/assessments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: detail.employee.employeeId, ...scope, criticalityLevel, tagIds }) })
      if (!response.ok) throw new Error('assessment-save-failed')
      const payload = await response.json() as { data: StarPerformersWorkspaceRow['assessment'] }
      if (!payload.data) return
      setDetail((current) => current ? { ...current, employee: { ...current.employee, assessment: payload.data } } : current)
      setData((current) => ({ ...current, rows: current.rows.map((row) => row.employeeId === detail.employee.employeeId ? { ...row, assessment: payload.data } : row), kpis: { ...current.kpis, assessedKeyEmployees: Math.max(current.kpis.assessedKeyEmployees, 1) } }))
    } catch {
      setDetailError(true)
    }
  }

  const statusOptions = query.perspective === 'top-talent' ? [['all', labels.allStatuses], ['assessed', labels.statusAssessed], ['high-high', labels.statusHighHigh], ['not-assessed', labels.statusNotAssessed]] : [['all', labels.allStatuses], ['assessed', labels.statusAssessed], ['not-assessed', labels.statusNotAssessed]]
  const activeTags = useMemo(() => data.filters.tags.filter((tag) => tag.isActive), [data.filters.tags])
  const visibleDetail = selectedEmployeeId ? detail : null
  const detailLoading = Boolean(selectedEmployeeId && !detailError && detail?.employee.employeeId !== selectedEmployeeId)

  function selectEmployee(employeeId: string) {
    setDetail(null)
    setDetailError(false)
    setSelectedEmployeeId(employeeId)
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.perspective}</p><p className="mt-1 text-sm text-muted-foreground">{query.perspective === 'top-talent' ? labels.topTalentDescription : labels.keyEmployeesDescription}</p></div><div className="flex flex-wrap gap-2" role="group" aria-label={labels.perspective}><Button aria-pressed={query.perspective === 'top-talent'} onClick={() => updateQuery({ perspective: 'top-talent', status: 'all', period: undefined, insight: 'top-talent', page: 1 })} size="sm" type="button" variant={query.perspective === 'top-talent' ? 'primary' : 'secondary'}>{labels.topTalent}</Button><Button aria-pressed={query.perspective === 'key-employees'} onClick={() => updateQuery({ perspective: 'key-employees', status: 'all', period: undefined, insight: 'top-talent', page: 1 })} size="sm" type="button" variant={query.perspective === 'key-employees' ? 'primary' : 'secondary'}>{labels.keyEmployees}</Button></div></div>
    <ScrollableTabs ariaLabel={labels.areaNavigation} contentProps={{ role: 'tablist' }} leftLabel={labels.previous} rightLabel={labels.next}><TabButton active={query.area === 'overview'} aria-controls="star-performers-area" onClick={() => updateQuery({ area: 'overview' })}>{labels.overview}</TabButton><TabButton active={query.area === 'employees'} aria-controls="star-performers-area" onClick={() => updateQuery({ area: 'employees' })}>{labels.employees}</TabButton><TabButton active={query.area === 'key-roles'} aria-controls="star-performers-area" onClick={() => updateQuery({ area: 'key-roles' })}>{labels.keyRoles}</TabButton><TabButton active={query.area === 'development'} aria-controls="star-performers-area" onClick={() => updateQuery({ area: 'development' })}>{labels.development}</TabButton><TabButton active={query.area === 'insights'} aria-controls="star-performers-area" onClick={() => updateQuery({ area: 'insights' })}>{labels.insights}</TabButton></ScrollableTabs>
    {query.area === 'insights' ? null : <KpiStrip data={data} labels={labels} />}
    <FilterBar aria-label={labels.filtersTitle}>
      <FormField className="min-w-[15rem] flex-[1.4]" control={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => updateQuery({ q: event.currentTarget.value })} placeholder={labels.searchPlaceholder} value={query.q} />} label={labels.search} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.team} onChange={(event) => updateQuery({ departmentId: event.currentTarget.value || undefined })} searchable searchPlaceholder={labels.team} value={query.departmentId ?? ''}><option value="">{labels.allTeams}</option>{data.filters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect>} label={labels.team} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.jobGroup} onChange={(event) => updateQuery({ jobGroupId: event.currentTarget.value || undefined, jobId: undefined })} searchable searchPlaceholder={labels.jobGroup} value={query.jobGroupId ?? ''}><option value="">{labels.allJobGroups}</option>{data.filters.jobGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</DropdownSelect>} label={labels.jobGroup} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.job} onChange={(event) => updateQuery({ jobId: event.currentTarget.value || undefined })} searchable searchPlaceholder={labels.job} value={query.jobId ?? ''}><option value="">{labels.allJobs}</option>{data.filters.jobs.filter((job) => !query.jobGroupId || job.jobGroupId === query.jobGroupId).map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</DropdownSelect>} label={labels.job} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.relevantStatus} onChange={(event) => updateQuery({ status: event.currentTarget.value as StarPerformerWorkspaceQuery['status'] })} value={query.status}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DropdownSelect>} label={labels.relevantStatus} />
    </FilterBar>
    {error ? <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/40 bg-destructive-surface px-4 py-3 text-sm text-destructive" role="alert"><span className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4" />{labels.loadFailed}</span><Button onClick={() => setReloadToken((current) => current + 1)} size="sm" type="button" variant="secondary">{labels.retry}</Button></div> : null}
    <div aria-busy={loading} className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]" id="star-performers-area">
      <div className="min-w-0 space-y-4">
        {query.area === 'overview' ? <Surface className="p-5" variant="subtle"><div className="flex items-start gap-3"><Target aria-hidden="true" className="mt-0.5 size-5 text-primary" /><div><h2 className="text-lg font-semibold text-foreground">{labels.overviewTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.overviewDescription}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-[var(--radius-control)] border border-border bg-surface p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.topTalent}</p><p className="mt-2 text-sm text-foreground">{data.kpis.highHighSignals} {labels.statusHighHigh}</p></div><div className="rounded-[var(--radius-control)] border border-border bg-surface p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{labels.keyEmployees}</p><p className="mt-2 text-sm text-foreground">{data.kpis.assessedKeyEmployees} {labels.assessedKeyEmployees.toLocaleLowerCase()}</p></div></div></Surface> : null}
        {query.area === 'employees' || query.area === 'overview' ? <section aria-labelledby="star-performers-employees-title"><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground" id="star-performers-employees-title">{labels.employeesTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.employeesDescription}</p></div>{canWrite && query.perspective === 'key-employees' ? <Link className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href="/settings/talent?area=star-performer-tags">{labels.tags}<ArrowUpRight aria-hidden="true" className="size-3.5" /></Link> : null}</div><div className="mt-4 space-y-3">{loading ? <Surface className="p-6 text-sm text-muted-foreground" variant="subtle">{labels.loading}</Surface> : data.rows.length ? data.rows.map((row) => <EmployeeRow canViewEmployees={canViewEmployees} labels={labels} onSelect={() => selectEmployee(row.employeeId)} perspective={query.perspective} row={row} selected={selectedEmployeeId === row.employeeId} key={row.employeeId} />) : <EmptyState icon={<UsersRound />} title={labels.noEmployees} description={labels.noEmployeesDescription} />}</div>{data.totalPages > 1 ? <div className="mt-4"><Pagination ariaLabel={labels.pagination} currentPage={data.page} nextLabel={labels.next} onPageChange={(page) => updateQuery({ page })} previousLabel={labels.previous} totalPages={data.totalPages} /></div> : null}</section> : null}
        {query.area === 'key-roles' ? <section><div><h2 className="text-lg font-semibold text-foreground">{labels.keyRolesTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.keyRolesDescription}</p></div><div className="mt-4"><RolesArea labels={labels} onSelect={selectEmployee} rows={data.rows} /></div></section> : null}
        {query.area === 'development' ? <section><div><h2 className="text-lg font-semibold text-foreground">{labels.developmentTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.developmentDescription}</p></div><div className="mt-4">{visibleDetail ? <p className="text-sm text-muted-foreground">{employeeLabel(visibleDetail.employee)}</p> : <EmptyState icon={<Compass />} title={labels.noSelectedEmployee} description={labels.selectEmployee} />}</div></section> : null}
        {query.area === 'insights' ? <StarPerformersInsights activeArea={query.insight} canViewEmployees={canViewEmployees} data={insights} error={insightsError} labels={labels} loading={insightsLoading} onAreaChange={(insight) => updateQuery({ insight })} onPeriodChange={(period) => updateQuery({ period })} onRetry={() => setInsightsReloadToken((current) => current + 1)} showPeriod={query.perspective === 'top-talent'} /> : null}
        {data.rows.length ? <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{query.perspective === 'top-talent' ? <><Badge tone="info">{labels.approvedGrid}</Badge><span>{labels.approvedSignal}</span></> : <><Badge tone="warning">{labels.criticality}</Badge><span>{labels.keyEmployees}</span></>}</div> : null}
      </div>
      {query.area === 'insights' ? null : <aside aria-label={labels.detailTitle} className="min-w-0 xl:sticky xl:top-5 xl:self-start">{detailLoading ? <Surface className="flex min-h-[22rem] items-center justify-center p-8 text-sm text-muted-foreground" variant="subtle">{labels.loading}</Surface> : detailError ? <Surface className="p-6" variant="subtle"><p className="text-sm text-destructive">{labels.loadFailed}</p><Button className="mt-3" onClick={() => { setDetail(null); setDetailError(false); setDetailReloadToken((current) => current + 1) }} size="sm" type="button" variant="secondary">{labels.retry}</Button></Surface> : <DetailDrawer canViewEmployees={canViewEmployees} canWrite={canWrite} detail={visibleDetail} labels={labels} onSave={saveAssessment} perspective={query.perspective} />}</aside>}
    </div>
    {activeTags.length === 0 && query.perspective === 'key-employees' ? <p className="text-xs text-muted-foreground">{labels.noTagsAvailable}</p> : null}
  </div>
}

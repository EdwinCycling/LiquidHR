'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type ReactNode } from 'react'
import { BriefcaseBusiness, Mail, Search, Star, Tag } from 'lucide-react'
import type { StarPerformerAssessment, StarPerformerEmployee, StarPerformerWorkspace } from '@/lib/star-performers/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { EntityList } from '@/components/patterns/entity-list'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormField } from '@/components/patterns/form-field'

interface StarPerformerManagerLabels {
  filtersTitle: string
  levelJob: string
  levelJobGroup: string
  jobGroup: string
  job: string
  search: string
  searchPlaceholder: string
  tagFilter: string
  minStars: string
  all: string
  selectJobGroup: string
  selectJob: string
  summaryEmployees: string
  summaryRated: string
  summaryAverage: string
  summaryTags: string
  emptyTitle: string
  emptyDescription: string
  noResults: string
  stars: string
  notRatedYet: string
  tags: string
  noTagsSelected: string
  saveFailed: string
  saving: string
  saved: string
  noTagsAvailable: string
  toggleTags: string
  employeeNumber: string
  department: string
  workEmail: string
  currentContext: string
  moreTags: string
  openEmployee: string
  readOnly: string
}

interface StarPerformerManagerProps {
  canViewEmployees: boolean
  canWrite: boolean
  workspace: StarPerformerWorkspace
  query: {
    level: 'job' | 'job-group'
    q: string
    jobId?: string
    jobGroupId?: string
    tagId?: string
    minStars?: '1' | '2' | '3' | '4' | '5'
  }
  labels: StarPerformerManagerLabels
}

function initials(firstName: string, birthName: string): string {
  return `${firstName.slice(0, 1)}${birthName.slice(0, 1) || firstName.slice(1, 2)}`.toUpperCase()
}

function assessmentKey(employeeId: string, jobId: string | null | undefined, jobGroupId: string | null | undefined): string {
  return `${employeeId}::${jobId ?? '-'}::${jobGroupId ?? '-'}`
}

function EmployeeAvatar({ employee }: { employee: StarPerformerEmployee }): ReactNode {
  if (employee.avatarUrl) {
    return <span aria-hidden="true" className="size-9 rounded-full bg-cover bg-center" style={{ backgroundImage: `url("${employee.avatarUrl}")` }} />
  }
  return <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-primary">{initials(employee.firstName, employee.birthName)}</span>
}

function SummaryStrip({ labels, values }: { labels: Pick<StarPerformerManagerLabels, 'summaryEmployees' | 'summaryRated' | 'summaryAverage' | 'summaryTags'>; values: [string, string, string, string] }) {
  const entries = [
    [labels.summaryEmployees, values[0], BriefcaseBusiness],
    [labels.summaryRated, values[1], Star],
    [labels.summaryAverage, values[2], Star],
    [labels.summaryTags, values[3], Tag],
  ] as const

  return <Surface><dl className="grid divide-y divide-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{entries.map(([label, value, Icon]) => <div className="flex items-center justify-between gap-4 px-4 py-3 first:pt-4 last:pb-4 sm:px-5 sm:py-4" key={label}><div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</dd></div><Icon aria-hidden="true" className="size-4 text-primary" /></div>)}</dl></Surface>
}

function StarRating({ assessment, canWrite, labels, onSave }: { assessment?: StarPerformerAssessment; canWrite: boolean; labels: Pick<StarPerformerManagerLabels, 'stars' | 'notRatedYet'>; onSave: (level: number) => void }) {
  const currentLevel = assessment?.criticalityLevel ?? 0
  if (!canWrite) {
    return <div aria-label={assessment ? `${labels.stars}: ${currentLevel}/5` : labels.notRatedYet} className="flex items-center gap-0.5 text-warning" role="img">{[1, 2, 3, 4, 5].map((value) => <Star aria-hidden="true" className={value <= currentLevel ? 'size-4 fill-current' : 'size-4 text-muted'} key={value} />)}<span className="ml-2 text-sm text-muted-foreground">{assessment ? `${currentLevel}/5` : labels.notRatedYet}</span></div>
  }

  return <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label={labels.stars}>{[1, 2, 3, 4, 5].map((value) => <IconButton className={value <= currentLevel ? 'text-warning' : 'text-muted-foreground'} key={value} label={`${labels.stars}: ${value}`} onClick={() => onSave(value)} size="sm" type="button" variant="ghost"><Star aria-hidden="true" className={value <= currentLevel ? 'fill-current' : ''} /></IconButton>)}<span className="ml-2 text-sm text-muted-foreground">{assessment ? `${currentLevel}/5` : labels.notRatedYet}</span></div>
}

export function StarPerformerManager({ canViewEmployees, canWrite, labels, query, workspace }: StarPerformerManagerProps) {
  const router = useRouter()
  const [assessments, setAssessments] = useState(workspace.assessments)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const activeTags = useMemo(() => workspace.tags.filter((tag) => tag.isActive), [workspace.tags])
  const assessmentByKey = useMemo(() => new Map(assessments.map((assessment) => [assessmentKey(assessment.employeeId, assessment.jobId, assessment.jobGroupId), assessment])), [assessments])
  const scopeJobId = query.level === 'job' ? (query.jobId ?? null) : null
  const scopeJobGroupId = query.level === 'job-group' ? (query.jobGroupId ?? null) : null
  const scopedAssessmentByEmployeeId = useMemo(() => new Map(workspace.employees.map((employee) => [employee.id, assessmentByKey.get(assessmentKey(employee.id, scopeJobId, scopeJobGroupId))])), [assessmentByKey, scopeJobGroupId, scopeJobId, workspace.employees])
  const selectedJobName = workspace.jobs.find((job) => job.id === query.jobId)?.name
  const selectedJobGroupName = workspace.jobGroups.find((group) => group.id === query.jobGroupId)?.name
  const currentContextLabel = query.level === 'job' ? selectedJobName : selectedJobGroupName

  function updateQuery(next: Partial<StarPerformerManagerProps['query']>): void {
    const params = new URLSearchParams()
    const merged = { ...query, ...next }
    params.set('level', merged.level)
    if (merged.q.trim()) params.set('q', merged.q.trim())
    if (merged.jobGroupId) params.set('jobGroupId', merged.jobGroupId)
    if (merged.jobId) params.set('jobId', merged.jobId)
    if (merged.tagId) params.set('tagId', merged.tagId)
    if (merged.minStars) params.set('minStars', merged.minStars)
    router.replace(`/workforce/star-performers?${params.toString()}`, { scroll: false })
  }

  function findAssessment(employeeId: string): StarPerformerAssessment | undefined {
    return scopedAssessmentByEmployeeId.get(employeeId)
  }

  const visibleEmployees = useMemo(() => {
    const search = query.q.toLocaleLowerCase('nl-NL')
    const minStars = query.minStars ? Number(query.minStars) : null
    return workspace.employees.filter((employee) => {
      const inScope = query.level === 'job' ? (query.jobId ? employee.jobId === query.jobId : false) : (query.jobGroupId ? employee.jobGroupId === query.jobGroupId : false)
      if (!inScope) return false
      const assessment = scopedAssessmentByEmployeeId.get(employee.id)
      if (query.tagId && !assessment?.tagIds.includes(query.tagId)) return false
      if (minStars && (!assessment || assessment.criticalityLevel < minStars)) return false
      if (!search) return true
      return [employee.employeeNumber, employee.firstName, employee.birthName, employee.departmentName ?? '', employee.jobName ?? '', employee.jobGroupName ?? ''].join(' ').toLocaleLowerCase('nl-NL').includes(search)
    })
  }, [query, scopedAssessmentByEmployeeId, workspace.employees])

  const ratedEmployees = visibleEmployees.filter((employee) => findAssessment(employee.id))
  const averageStars = ratedEmployees.length ? (ratedEmployees.reduce((total, employee) => total + (findAssessment(employee.id)?.criticalityLevel ?? 0), 0) / ratedEmployees.length).toFixed(1).replace('.', ',') : '0,0'

  async function saveAssessment(employeeId: string, criticalityLevel: number, tagIds: string[]): Promise<void> {
    if (!canWrite) return
    const contextKey = assessmentKey(employeeId, scopeJobId, scopeJobGroupId)
    setPendingKey(contextKey)
    setSaveError(null)
    setSavedKey(null)
    try {
      const response = await fetch('/api/star-performers/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ employeeId, jobId: query.level === 'job' ? query.jobId : undefined, jobGroupId: query.level === 'job-group' ? query.jobGroupId : undefined, criticalityLevel, tagIds }),
      })
      if (!response.ok) {
        setSaveError(labels.saveFailed)
        return
      }
      const payload = await response.json() as { data: StarPerformerAssessment }
      setAssessments((current) => [...current.filter((assessment) => assessment.id !== payload.data.id && assessmentKey(assessment.employeeId, assessment.jobId, assessment.jobGroupId) !== assessmentKey(payload.data.employeeId, payload.data.jobId, payload.data.jobGroupId)), payload.data])
      setSavedKey(contextKey)
    } catch {
      setSaveError(labels.saveFailed)
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{labels.filtersTitle}</h2>
            {currentContextLabel ? <p className="mt-1 text-sm text-muted-foreground">{labels.currentContext}: {currentContextLabel}</p> : null}
          </div>
          {!canWrite ? <Badge tone="neutral">{labels.readOnly}</Badge> : null}
        </div>
        <FilterBar aria-label={labels.filtersTitle} className="mt-5">
          <div className="flex min-w-full flex-wrap items-center gap-2 pb-1">
            <Button aria-pressed={query.level === 'job'} onClick={() => updateQuery({ level: 'job', jobId: undefined })} size="sm" type="button" variant={query.level === 'job' ? 'primary' : 'secondary'}>{labels.levelJob}</Button>
            <Button aria-pressed={query.level === 'job-group'} onClick={() => updateQuery({ level: 'job-group', jobId: undefined })} size="sm" type="button" variant={query.level === 'job-group' ? 'primary' : 'secondary'}>{labels.levelJobGroup}</Button>
          </div>
          <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.jobGroup} onChange={(event) => updateQuery({ jobGroupId: event.currentTarget.value || undefined, jobId: query.level === 'job' ? undefined : query.jobId })} searchable searchPlaceholder={labels.jobGroup} value={query.jobGroupId ?? ''}><option value="">{labels.all}</option>{workspace.jobGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</DropdownSelect>} label={labels.jobGroup} />
          <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.job} disabled={query.level !== 'job'} onChange={(event) => updateQuery({ jobId: event.currentTarget.value || undefined })} searchable searchPlaceholder={labels.job} value={query.jobId ?? ''}><option value="">{query.jobGroupId ? labels.selectJob : labels.selectJobGroup}</option>{workspace.jobs.filter((job) => !query.jobGroupId || job.jobGroupId === query.jobGroupId).map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</DropdownSelect>} label={labels.job} />
          <FormField className="min-w-[15rem] flex-[1.3]" control={<TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => updateQuery({ q: event.currentTarget.value })} placeholder={labels.searchPlaceholder} value={query.q} />} label={labels.search} />
          <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.tagFilter} onChange={(event) => updateQuery({ tagId: event.currentTarget.value || undefined })} searchable searchPlaceholder={labels.tagFilter} value={query.tagId ?? ''}><option value="">{labels.all}</option>{activeTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</DropdownSelect>} label={labels.tagFilter} />
          <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={labels.minStars} onChange={(event) => updateQuery({ minStars: (event.currentTarget.value || undefined) as StarPerformerManagerProps['query']['minStars'] })} searchable searchPlaceholder={labels.minStars} value={query.minStars ?? ''}><option value="">{labels.all}</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</DropdownSelect>} label={labels.minStars} />
        </FilterBar>
      </Surface>

      <SummaryStrip labels={labels} values={[String(visibleEmployees.length), String(ratedEmployees.length), averageStars, String(activeTags.length)]} />

      {saveError ? <p aria-live="polite" className="border border-destructive/40 bg-destructive-surface px-4 py-3 text-sm text-destructive" role="alert">{saveError}</p> : null}

      {(query.level === 'job' && !query.jobId) || (query.level === 'job-group' && !query.jobGroupId) ? <EmptyState icon={<BriefcaseBusiness />} title={labels.emptyTitle} description={labels.emptyDescription} /> : visibleEmployees.length === 0 ? <EmptyState title={labels.noResults} /> : <EntityList
        ariaLabel={labels.summaryEmployees}
        items={visibleEmployees.map((employee) => {
          const assessment = findAssessment(employee.id)
          const selectedTags = workspace.tags.filter((tag) => assessment?.tagIds.includes(tag.id))
          const contextKey = assessmentKey(employee.id, scopeJobId, scopeJobGroupId)
          const isPending = pendingKey === contextKey
          const isExpanded = expandedEmployeeId === employee.id
          return {
            actions: <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:min-w-[17rem] sm:items-end">
              <StarRating assessment={assessment} canWrite={canWrite} labels={labels} onSave={(level) => void saveAssessment(employee.id, level, assessment?.tagIds ?? [])} />
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-sm">
                <span className="text-muted-foreground">{labels.tags}</span>
                {selectedTags.length ? selectedTags.map((tag) => <Badge key={tag.id} tone={tag.isActive ? 'info' : 'warning'}>{tag.name}</Badge>) : <span className="text-muted-foreground">{assessment ? labels.noTagsSelected : labels.notRatedYet}</span>}
                {canWrite && assessment ? <Button onClick={() => setExpandedEmployeeId((current) => current === employee.id ? null : employee.id)} size="sm" type="button" variant="ghost">{isExpanded ? labels.moreTags : labels.toggleTags}</Button> : null}
              </div>
              {isExpanded && assessment ? <Surface className="w-full p-3" variant="subtle"><div className="flex flex-wrap gap-2">{activeTags.length ? activeTags.map((tag) => { const checked = assessment.tagIds.includes(tag.id); return <Button key={tag.id} onClick={() => void saveAssessment(employee.id, assessment.criticalityLevel, checked ? assessment.tagIds.filter((tagId) => tagId !== tag.id) : [...assessment.tagIds, tag.id])} size="sm" type="button" variant={checked ? 'primary' : 'secondary'}>{tag.name}</Button> }) : <p className="text-sm text-muted-foreground">{labels.noTagsAvailable}</p>}</div></Surface> : null}
              {isPending ? <span className="text-xs font-medium text-primary" role="status">{labels.saving}</span> : savedKey === contextKey ? <span className="text-xs font-medium text-success" role="status">{labels.saved}</span> : null}
            </div>,
            avatar: <EmployeeAvatar employee={employee} />,
            badges: selectedTags.slice(0, 3).map((tag) => <Badge key={tag.id} tone={tag.isActive ? 'info' : 'warning'}>{tag.name}</Badge>),
            id: employee.id,
            href: canViewEmployees ? `/employees/${employee.id}` : undefined,
            primary: <span>{employee.firstName} {employee.birthName}</span>,
            secondary: <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{labels.employeeNumber}: {employee.employeeNumber}</span>{employee.departmentName ? <span>{labels.department}: {employee.departmentName}</span> : null}{employee.jobName ? <span>{labels.job}: {employee.jobName}</span> : null}{canViewEmployees && employee.workEmail ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${employee.workEmail}`}><Mail aria-hidden="true" className="size-3.5" />{employee.workEmail}</a> : null}</div>,
          }
        })}
      />}

      {canViewEmployees ? <p className="text-xs text-muted-foreground">{labels.openEmployee}</p> : null}
    </div>
  )
}

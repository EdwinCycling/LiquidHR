'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useMemo, useState } from 'react'
import { BriefcaseBusiness, Mail, Search, Star, Tag } from 'lucide-react'
import type { StarPerformerAssessment, StarPerformerWorkspace } from '@/lib/star-performers/service'

interface StarPerformerManagerLabels {
  filtersTitle: string
  level: string
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
  manageTags: string
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
  lastUpdated: string
  saveFailed: string
  saving: string
  saved: string
  noTagsAvailable: string
  toggleTags: string
  employeeNumber: string
  department: string
  workEmail: string
  currentContext: string
}

interface StarPerformerManagerProps {
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

function initials(firstName: string, birthName: string) {
  return `${firstName.slice(0, 1)}${birthName.slice(0, 1)}`.toUpperCase()
}

function assessmentKey(
  employeeId: string,
  jobId: string | null | undefined,
  jobGroupId: string | null | undefined,
) {
  return `${employeeId}::${jobId ?? '-'}::${jobGroupId ?? '-'}`
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

export function StarPerformerManager({ workspace, query, labels }: StarPerformerManagerProps) {
  const router = useRouter()
  const [assessments, setAssessments] = useState(workspace.assessments)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const activeTags = useMemo(
    () => workspace.tags.filter((tag) => tag.isActive),
    [workspace.tags],
  )
  const assessmentByKey = useMemo(
    () => new Map(assessments.map((assessment) => [
      assessmentKey(assessment.employeeId, assessment.jobId, assessment.jobGroupId),
      assessment,
    ])),
    [assessments],
  )
  const scopeJobId = query.level === 'job' ? (query.jobId ?? null) : null
  const scopeJobGroupId = query.level === 'job-group' ? (query.jobGroupId ?? null) : null
  const scopedAssessmentByEmployeeId = useMemo(
    () => new Map(
      workspace.employees.map((employee) => [
        employee.id,
        assessmentByKey.get(assessmentKey(employee.id, scopeJobId, scopeJobGroupId)),
      ]),
    ),
    [assessmentByKey, scopeJobGroupId, scopeJobId, workspace.employees],
  )

  const selectedJobName = workspace.jobs.find((job) => job.id === query.jobId)?.name
  const selectedJobGroupName = workspace.jobGroups.find((group) => group.id === query.jobGroupId)?.name
  const currentContextLabel = query.level === 'job'
    ? selectedJobName
    : selectedJobGroupName

  function updateQuery(next: Partial<StarPerformerManagerProps['query']>) {
    const params = new URLSearchParams()
    const merged = { ...query, ...next }
    params.set('level', merged.level)
    if (merged.q.trim()) params.set('q', merged.q.trim())
    if (merged.jobGroupId) params.set('jobGroupId', merged.jobGroupId)
    if (merged.jobId) params.set('jobId', merged.jobId)
    if (merged.tagId) params.set('tagId', merged.tagId)
    if (merged.minStars) params.set('minStars', merged.minStars)
    router.replace(`/settings/star-performers?${params.toString()}`)
  }

  function findAssessment(employeeId: string) {
    return scopedAssessmentByEmployeeId.get(employeeId)
  }

  const visibleEmployees = useMemo(() => {
    const q = query.q.toLocaleLowerCase('nl-NL')
    const minStars = query.minStars ? Number(query.minStars) : null

    return workspace.employees.filter((employee) => {
      const inScope = query.level === 'job'
        ? (query.jobId ? employee.jobId === query.jobId : false)
        : (query.jobGroupId ? employee.jobGroupId === query.jobGroupId : false)
      if (!inScope) return false

      const assessment = scopedAssessmentByEmployeeId.get(employee.id)
      if (query.tagId && !assessment?.tagIds.includes(query.tagId)) return false
      if (minStars && (!assessment || assessment.criticalityLevel < minStars)) return false

      if (!q) return true
      const haystack = [
        employee.employeeNumber,
        employee.firstName,
        employee.birthName,
        employee.departmentName ?? '',
        employee.jobName ?? '',
        employee.jobGroupName ?? '',
      ].join(' ').toLocaleLowerCase('nl-NL')
      return haystack.includes(q)
    })
  }, [query, scopedAssessmentByEmployeeId, workspace.employees])

  const ratedEmployees = visibleEmployees.filter((employee) => findAssessment(employee.id))
  const averageStars = ratedEmployees.length
    ? (ratedEmployees.reduce((total, employee) => total + (findAssessment(employee.id)?.criticalityLevel ?? 0), 0) / ratedEmployees.length).toFixed(1)
    : '0,0'

  async function saveAssessment(
    employeeId: string,
    criticalityLevel: number,
    tagIds: string[],
  ) {
    const contextKey = assessmentKey(employeeId, query.jobId, query.jobGroupId)
    setPendingKey(contextKey)
    setSaveError(null)
    const response = await fetch('/api/star-performers/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        jobId: query.level === 'job' ? query.jobId : undefined,
        jobGroupId: query.level === 'job-group' ? query.jobGroupId : undefined,
        criticalityLevel,
        tagIds,
      }),
    })
    setPendingKey(null)

    if (!response.ok) {
      setSaveError(labels.saveFailed)
      return
    }

    const payload = await response.json() as { data: StarPerformerAssessment }
    setAssessments((current) => {
      const next = current.filter((assessment) => assessment.id !== payload.data.id && assessmentKey(
        assessment.employeeId,
        assessment.jobId,
        assessment.jobGroupId,
      ) !== assessmentKey(payload.data.employeeId, payload.data.jobId, payload.data.jobGroupId))
      return [...next, payload.data]
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">{labels.filtersTitle}</p>
              {currentContextLabel ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {labels.currentContext}: {currentContextLabel}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${query.level === 'job' ? 'bg-primary text-primary-foreground' : 'border bg-background'}`}
                onClick={() => updateQuery({ level: 'job', jobId: undefined })}
                type="button"
              >
                {labels.levelJob}
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${query.level === 'job-group' ? 'bg-primary text-primary-foreground' : 'border bg-background'}`}
                onClick={() => updateQuery({ level: 'job-group', jobId: undefined })}
                type="button"
              >
                {labels.levelJobGroup}
              </button>
            </div>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold" href="/settings/star-performer-tags">
            <Tag size={16} />
            {labels.manageTags}
          </Link>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium">
            {labels.jobGroup}
            <select
              className="form-field mt-1 h-10 min-h-10 w-full"
              onChange={(event) => updateQuery({
                jobGroupId: event.currentTarget.value || undefined,
                jobId: query.level === 'job' ? undefined : query.jobId,
              })}
              value={query.jobGroupId ?? ''}
            >
              <option value="">{labels.all}</option>
              {workspace.jobGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            {labels.job}
            <select
              className="form-field mt-1 h-10 min-h-10 w-full"
              disabled={query.level !== 'job'}
              onChange={(event) => updateQuery({ jobId: event.currentTarget.value || undefined })}
              value={query.jobId ?? ''}
            >
              <option value="">
                {query.jobGroupId ? labels.selectJob : labels.selectJobGroup}
              </option>
              {workspace.jobs
                .filter((job) => !query.jobGroupId || job.jobGroupId === query.jobGroupId)
                .map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            {labels.search}
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="form-field h-10 min-h-10 w-full pl-10"
                onChange={(event) => updateQuery({ q: event.currentTarget.value })}
                placeholder={labels.searchPlaceholder}
                value={query.q}
              />
            </div>
          </label>

          <label className="text-sm font-medium">
            {labels.tagFilter}
            <select
              className="form-field mt-1 h-10 min-h-10 w-full"
              onChange={(event) => updateQuery({ tagId: event.currentTarget.value || undefined })}
              value={query.tagId ?? ''}
            >
              <option value="">{labels.all}</option>
              {activeTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            {labels.minStars}
            <select
              className="form-field mt-1 h-10 min-h-10 w-full"
              onChange={(event) => updateQuery({ minStars: (event.currentTarget.value || undefined) as StarPerformerManagerProps['query']['minStars'] })}
              value={query.minStars ?? ''}
            >
              <option value="">{labels.all}</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<BriefcaseBusiness size={18} />} label={labels.summaryEmployees} value={String(visibleEmployees.length)} />
        <StatCard icon={<Star size={18} />} label={labels.summaryRated} value={String(ratedEmployees.length)} />
        <StatCard icon={<Star size={18} />} label={labels.summaryAverage} value={averageStars} />
        <StatCard icon={<Tag size={18} />} label={labels.summaryTags} value={String(activeTags.length)} />
      </section>

      {saveError ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      {(query.level === 'job' && !query.jobId) || (query.level === 'job-group' && !query.jobGroupId) ? (
        <section className="rounded-2xl border border-dashed bg-surface p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">{labels.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{labels.emptyDescription}</p>
        </section>
      ) : visibleEmployees.length === 0 ? (
        <section className="rounded-2xl border bg-surface p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{labels.noResults}</p>
        </section>
      ) : (
        <section className="space-y-3">
          {visibleEmployees.map((employee) => {
            const assessment = findAssessment(employee.id)
            const isPending = pendingKey === assessmentKey(employee.id, query.jobId, query.jobGroupId)
            const selectedTags = workspace.tags.filter((tag) => assessment?.tagIds.includes(tag.id))

            return (
              <article className="rounded-2xl border bg-surface p-5 shadow-sm" key={employee.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    {employee.avatarUrl ? (
                      <div
                        aria-hidden="true"
                        className="size-14 rounded-2xl bg-cover bg-center"
                        style={{ backgroundImage: `url("${employee.avatarUrl}")` }}
                      />
                    ) : (
                      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-sm font-semibold text-primary">
                        {initials(employee.firstName, employee.birthName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">
                        {employee.firstName} {employee.birthName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{labels.employeeNumber}: {employee.employeeNumber}</span>
                        {employee.departmentName ? <span>{labels.department}: {employee.departmentName}</span> : null}
                        {employee.jobName ? <span>{labels.job}: {employee.jobName}</span> : null}
                      </div>
                      {employee.workEmail ? (
                        <a className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline" href={`mailto:${employee.workEmail}`}>
                          <Mail size={14} />
                          {employee.workEmail}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="w-full max-w-md rounded-2xl border bg-background/70 p-4">
                    <p className="text-sm font-semibold">{labels.stars}</p>
                    <div className="mt-3 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          aria-label={`${labels.stars}: ${value}`}
                          className="rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-50"
                          key={value}
                          onClick={() => void saveAssessment(employee.id, value, assessment?.tagIds ?? [])}
                          type="button"
                        >
                          <Star
                            className={value <= (assessment?.criticalityLevel ?? 0) ? 'fill-current' : ''}
                            size={20}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        {assessment ? `${assessment.criticalityLevel}/5` : labels.notRatedYet}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{labels.tags}</p>
                        <button
                          className="text-sm font-semibold text-primary disabled:text-muted-foreground"
                          disabled={!assessment}
                          onClick={() => setExpandedEmployeeId((current) => current === employee.id ? null : employee.id)}
                          type="button"
                        >
                          {labels.toggleTags}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedTags.length ? selectedTags.map((tag) => (
                          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary" key={tag.id}>
                            {tag.name}
                          </span>
                        )) : (
                          <span className="text-sm text-muted-foreground">
                            {assessment ? labels.noTagsSelected : labels.notRatedYet}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-xs text-muted-foreground">
                      {labels.lastUpdated}: {assessment?.updatedAt ? assessment.updatedAt.slice(0, 10) : '-'}
                    </p>
                    {isPending ? (
                      <p className="mt-2 text-xs font-semibold text-primary">{labels.saving}</p>
                    ) : null}
                  </div>
                </div>

                {expandedEmployeeId === employee.id ? (
                  <div className="mt-4 rounded-2xl border bg-background/70 p-4">
                    {activeTags.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{labels.noTagsAvailable}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {activeTags.map((tag) => {
                          const checked = assessment?.tagIds.includes(tag.id) ?? false
                          return (
                            <button
                              className={`rounded-full px-3 py-1.5 text-sm font-medium ${checked ? 'bg-primary text-primary-foreground' : 'border bg-surface text-foreground'}`}
                              key={tag.id}
                              onClick={() => {
                                if (!assessment) return
                                const nextTagIds = checked
                                  ? assessment.tagIds.filter((tagId) => tagId !== tag.id)
                                  : [...assessment.tagIds, tag.id]
                                void saveAssessment(employee.id, assessment.criticalityLevel, nextTagIds)
                              }}
                              type="button"
                            >
                              {tag.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

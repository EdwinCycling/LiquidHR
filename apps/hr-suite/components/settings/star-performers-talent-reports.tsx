'use client'

import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { FilterBar } from '@/components/patterns/filter-bar'
import { FormField } from '@/components/patterns/form-field'
import { TextInput } from '@/components/ui/text-input'
import { StarPerformersInsights } from './star-performers-insights'
import type { StarPerformersInsights as StarPerformersInsightsData } from '@/lib/star-performers/insights-service'
import { starPerformersQueryString } from '@/lib/star-performers/query'
import type { StarPerformersInsightLabels, StarPerformersReportFilterLabels } from '@/lib/star-performers/presentation'
import type { StarPerformerInsightArea, StarPerformerWorkspaceQuery } from '@/lib/star-performers/schemas'
import type { StarPerformersWorkspacePage } from '@/lib/star-performers/v2-service'

type Props = {
  canViewEmployees: boolean
  initial: StarPerformersInsightsData
  initialQuery: StarPerformerWorkspaceQuery
  initialWorkspace: StarPerformersWorkspacePage
  insightLabels: StarPerformersInsightLabels
  filterLabels: StarPerformersReportFilterLabels
}

function reportPerspective(area: StarPerformerInsightArea): StarPerformerWorkspaceQuery['perspective'] {
  return area === 'key-employees' ? 'key-employees' : 'top-talent'
}

function activeFilterCount(query: StarPerformerWorkspaceQuery): number {
  return [query.q, query.departmentId, query.jobGroupId, query.jobId, query.status !== 'all' ? query.status : undefined, query.period].filter(Boolean).length
}

export function StarPerformersTalentReports({ canViewEmployees, filterLabels, initial, initialQuery, initialWorkspace, insightLabels }: Props) {
  const [data, setData] = useState<StarPerformersInsightsData | null>(initial)
  const [query, setQuery] = useState<StarPerformerWorkspaceQuery>(initialQuery)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const initialRender = useRef(true)

  function updateUrl(next: StarPerformerWorkspaceQuery): void {
    window.history.replaceState(null, '', `/workforce/talent/reports/star-performers?${starPerformersQueryString(next)}`)
  }

  function updateQuery(patch: Partial<StarPerformerWorkspaceQuery>): void {
    const next = { ...query, ...patch, area: 'insights' as const, page: patch.page ?? 1 }
    setQuery(next)
    updateUrl(next)
  }

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(false)
      setData(null)
    })
    void fetch(`/api/star-performers/insights?${starPerformersQueryString(query)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('insights-load-failed')
        return response.json() as Promise<{ data: StarPerformersInsightsData }>
      })
      .then((payload) => { if (!cancelled) setData(payload.data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, reloadToken])

  const statusOptions: Array<[StarPerformerWorkspaceQuery['status'], string]> = query.perspective === 'top-talent'
    ? [['all', filterLabels.allStatuses], ['assessed', filterLabels.statusAssessed], ['high-high', filterLabels.statusHighHigh], ['not-assessed', filterLabels.statusNotAssessed]]
    : [['all', filterLabels.allStatuses], ['assessed', filterLabels.statusAssessed], ['not-assessed', filterLabels.statusNotAssessed]]
  const filterCount = activeFilterCount(query)

  return <div className="space-y-5">
    <FilterBar aria-label={filterLabels.filtersTitle}>
      <FormField className="min-w-[15rem] flex-[1.4]" control={<TextInput aria-label={filterLabels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => updateQuery({ q: event.currentTarget.value })} placeholder={filterLabels.searchPlaceholder} value={query.q} />} label={filterLabels.search} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={filterLabels.team} onChange={(event) => updateQuery({ departmentId: event.currentTarget.value || undefined })} searchable searchPlaceholder={filterLabels.team} value={query.departmentId ?? ''}><option value="">{filterLabels.allTeams}</option>{initialWorkspace.filters.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect>} label={filterLabels.team} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={filterLabels.jobGroup} onChange={(event) => updateQuery({ jobGroupId: event.currentTarget.value || undefined, jobId: undefined })} searchable searchPlaceholder={filterLabels.jobGroup} value={query.jobGroupId ?? ''}><option value="">{filterLabels.allJobGroups}</option>{initialWorkspace.filters.jobGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</DropdownSelect>} label={filterLabels.jobGroup} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={filterLabels.job} onChange={(event) => updateQuery({ jobId: event.currentTarget.value || undefined })} searchable searchPlaceholder={filterLabels.job} value={query.jobId ?? ''}><option value="">{filterLabels.allJobs}</option>{initialWorkspace.filters.jobs.filter((job) => !query.jobGroupId || job.jobGroupId === query.jobGroupId).map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</DropdownSelect>} label={filterLabels.job} />
      <FormField className="min-w-[12rem] flex-1" control={<DropdownSelect aria-label={filterLabels.relevantStatus} onChange={(event) => updateQuery({ status: event.currentTarget.value as StarPerformerWorkspaceQuery['status'] })} value={query.status}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DropdownSelect>} label={filterLabels.relevantStatus} />
    </FilterBar>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite"><Badge tone={filterCount ? 'info' : 'neutral'}>{filterCount}</Badge><span>{filterLabels.filtersTitle}</span>{query.insight !== 'top-talent' ? <span>· {insightLabels.insights}</span> : null}</div>
    <StarPerformersInsights activeArea={query.insight} canViewEmployees={canViewEmployees} data={data} error={error} labels={insightLabels} loading={loading} onAreaChange={(area) => updateQuery({ insight: area, perspective: reportPerspective(area), status: 'all', period: area === 'top-talent' ? query.period : undefined })} onPeriodChange={(period) => updateQuery({ period })} onRetry={() => setReloadToken((current) => current + 1)} showPeriod={query.insight === 'top-talent'} />
  </div>
}

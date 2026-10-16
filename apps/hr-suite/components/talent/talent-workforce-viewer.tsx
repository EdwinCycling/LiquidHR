'use client'

import { BriefcaseBusiness, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import type { TalentWorkforceProfile, TalentWorkforceProfileSummary } from '@/lib/talent/service'
import { TalentReadOnlyProfile, type TalentReadOnlyProfileLabels } from './talent-read-only-profile'

type Labels = TalentReadOnlyProfileLabels & {
  search: string
  searchPlaceholder: string
  profiles: string
  empty: string
  noResults: string
  selectProfile: string
  managerReadOnlyHint: string
  employeeFilter: string
  allEmployees: string
  employeeContext: string
  noEmployees: string
  employeeCount: string
  profileCount: string
  loadError: string
  loadingProfiles: string
  profileDetailsLoading: string
  paginationAriaLabel: string
  previousPage: string
  nextPage: string
}

function profileKey(item: TalentWorkforceProfileSummary): string {
  return item.profile.profile_version_id ?? item.profile.job_profile_id ?? item.profile.job_id ?? item.profile.job_code ?? item.profile.tenant_id ?? ''
}

function toReadOnlyProfile(item: TalentWorkforceProfile) {
  const { profile } = item
  return {
    id: profile.job_profile_id ?? profile.job_id ?? profile.job_code ?? profile.tenant_id ?? '',
    jobCode: profile.job_code ?? '',
    groupCode: profile.job_group_code ?? '',
    groupName: profile.job_group_name ?? '',
    familyName: profile.job_family_name,
    seniorityName: profile.seniority_name,
    status: profile.status ?? 'ACTIVE',
    validFrom: profile.valid_from ?? '',
    validUntil: profile.valid_until,
    purpose: profile.purpose,
    summary: profile.summary,
    organizationalContext: profile.organizational_context,
    tasks: profile.tasks,
    responsibilities: profile.responsibilities,
    resultAreas: profile.result_areas,
    requirements: item.requirements.map((requirement) => ({
      id: requirement.id,
      capabilityCode: requirement.capability?.code ?? requirement.capability_id,
      capabilityName: requirement.capability?.name ?? requirement.capability_id,
      capabilityType: requirement.capability?.capability_type ?? '',
      requirementType: requirement.requirement_type,
      targetLevelCode: requirement.targetLevel?.code ?? null,
      targetLevelName: requirement.targetLevel?.name ?? null,
      languageLevel: requirement.language_level,
      rationale: requirement.rationale,
    })),
  }
}

export function TalentWorkforceViewer({ labels }: { labels: Labels }) {
  const [initial, setInitial] = useState<TalentWorkforceProfileSummary[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailResult, setDetailResult] = useState<{ profileVersionId: string; profile?: TalentWorkforceProfile; failed?: boolean } | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 25

  useEffect(() => {
    let cancelled = false
    void fetch('/api/talent/job-profiles?workforce=true', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('TALENT_WORKFORCE_READ_FAILED')
      const payload = await response.json() as { data: TalentWorkforceProfileSummary[] }
      if (cancelled) return
      setInitial(payload.data)
      setSelectedId(payload.data[0] ? profileKey(payload.data[0]) : null)
      setState('ready')
    }).catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [])

  const employeeOptions = useMemo(() => {
    const byId = new Map<string, TalentWorkforceProfileSummary['employees'][number]>()
    for (const item of initial) for (const employee of item.employees) byId.set(employee.id, employee)
    return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label, 'nl-NL'))
  }, [initial])

  useEffect(() => {
    const readUrlSelection = () => {
      const value = new URLSearchParams(window.location.search).get('profile')
      const matched = initial.find((item) => profileKey(item) === value || item.profile.job_profile_id === value)
      if (matched) setSelectedId(profileKey(matched))
    }
    readUrlSelection()
    window.addEventListener('popstate', readUrlSelection)
    return () => window.removeEventListener('popstate', readUrlSelection)
  }, [initial])

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
    return initial.filter((item) => {
      if (employeeId && !item.employees.some((employee) => employee.id === employeeId)) return false
      if (!normalizedQuery) return true
      return [item.profile.job_code, item.profile.job_group_name, item.profile.job_family_name, item.profile.seniority_name,
        ...item.employees.flatMap((employee) => [employee.label, employee.employeeNumber])]
        .some((value) => value?.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
    })
  }, [employeeId, initial, query])

  const selectedSummary = visible.find((item) => profileKey(item) === selectedId) ?? visible[0] ?? null
  const totalPages = Math.ceil(visible.length / pageSize)
  const pageItems = visible.slice((page - 1) * pageSize, page * pageSize)
  const readOnlyLabels: TalentReadOnlyProfileLabels = labels
  const profileVersionId = selectedSummary?.profile.profile_version_id
  const detailIsCurrent = Boolean(profileVersionId && detailResult?.profileVersionId === profileVersionId)

  useEffect(() => {
    if (!profileVersionId) {
      return
    }
    const controller = new AbortController()
    void fetch(`/api/talent/job-profiles?workforce=true&profileVersionId=${encodeURIComponent(profileVersionId)}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('TALENT_WORKFORCE_READ_FAILED')
      const payload = await response.json() as { data: TalentWorkforceProfile }
      setDetailResult({ profileVersionId, profile: payload.data })
    }).catch(() => { if (!controller.signal.aborted) setDetailResult({ profileVersionId, failed: true }) })
    return () => controller.abort()
  }, [profileVersionId])

  function selectProfile(id: string) {
    setSelectedId(id)
    const selectedIndex = visible.findIndex((item) => profileKey(item) === id)
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1)
    const url = new URL(window.location.href)
    url.searchParams.set('profile', id)
    window.history.replaceState({}, '', url)
  }

  return <section className="mt-6 space-y-5">
    <Surface className="p-4 sm:p-5" data-state={state}>
      <SectionHeader
        actions={<Badge tone="info">{labels.profileCount.replace('{count}', String(visible.length)).replace('{total}', String(initial.length))}</Badge>}
        description={labels.managerReadOnlyHint}
        title={labels.profiles}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
        <TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={labels.searchPlaceholder} value={query} />
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
          <span>{labels.employeeFilter}</span>
          <DropdownSelect aria-label={labels.employeeFilter} onChange={(event) => { setEmployeeId(event.target.value); setPage(1) }} searchable searchPlaceholder={labels.searchPlaceholder} value={employeeId}>
            <option value="">{labels.allEmployees}</option>
            {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.label} · {employee.employeeNumber}</option>)}
          </DropdownSelect>
        </label>
      </div>
    </Surface>

    {state === 'loading' ? <EmptyState description={labels.loadingProfiles} icon={<BriefcaseBusiness />} title={labels.loadingProfiles} /> : state === 'error' ? <EmptyState description={labels.loadError} icon={<BriefcaseBusiness />} title={labels.loadError} /> : initial.length === 0 ? <EmptyState description={labels.managerReadOnlyHint} icon={<BriefcaseBusiness />} title={labels.empty} /> : visible.length === 0 ? <EmptyState description={labels.noResults} icon={<Search />} title={labels.noResults} /> : <div className="grid gap-5 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.8fr)]">
      <Surface className="p-3" variant="subtle">
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.profiles}</p>
          <Badge>{visible.length}</Badge>
        </div>
        <nav aria-label={labels.profiles} className="space-y-2">
          {pageItems.map((item) => {
            const id = profileKey(item)
            const isSelected = id === selectedId
            return <Button aria-pressed={isSelected} className="w-full justify-start text-left" key={id} onClick={() => selectProfile(id)} size="sm" type="button" variant={isSelected ? 'primary' : 'secondary'}>
              <span className="min-w-0"><span className="block truncate font-semibold">{item.profile.job_code}</span><span className="mt-1 block truncate text-xs font-normal opacity-80">{item.profile.job_group_name}</span><span className="mt-1 flex items-center gap-1 text-xs font-normal opacity-80"><Users aria-hidden="true" />{labels.employeeCount.replace('{count}', String(item.employees.length))}</span></span>
            </Button>
          })}
        </nav>
        <div className="mt-3"><Pagination ariaLabel={labels.paginationAriaLabel} currentPage={page} nextLabel={labels.nextPage} onPageChange={setPage} previousLabel={labels.previousPage} totalPages={totalPages} /></div>
      </Surface>
      {selectedSummary ? <div className="min-w-0 space-y-5">
        <Surface className="p-4 sm:p-5">
          <SectionHeader description={labels.employeeContext} title={`${selectedSummary.profile.job_code} · ${selectedSummary.profile.job_group_name}`} />
          {selectedSummary.employees.length > 0 ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{selectedSummary.employees.map((employee) => <li className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle px-3 py-2 text-sm" key={employee.id}><span className="min-w-0 truncate font-medium">{employee.label}</span><Badge>{employee.employeeNumber}</Badge></li>)}</ul> : <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Users aria-hidden="true" />{labels.noEmployees}</p>}
        </Surface>
        {!detailIsCurrent ? <EmptyState description={labels.profileDetailsLoading} title={labels.profileDetailsLoading} /> : detailResult?.failed ? <EmptyState description={labels.loadError} title={labels.loadError} /> : detailResult?.profile ? <TalentReadOnlyProfile labels={readOnlyLabels} profile={toReadOnlyProfile(detailResult.profile)} /> : null}
      </div> : <EmptyState description={labels.selectProfile} title={labels.selectProfile} />}
    </div>}
  </section>
}

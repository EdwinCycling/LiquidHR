'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { SectionHeader } from '@/components/patterns/section-header'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { TalentEmployeeCapabilityRecords } from '@/components/talent/talent-employee-capability-records'
import { TalentWorkforceViewer } from '@/components/talent/talent-workforce-viewer'
import type { TalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'
import type { TalentTeamMatrixRow } from '@/lib/talent/team-model'

type AreaId = 'employees' | 'profiles' | 'skills' | 'develop'

export type TalentWorkforceEmployee = Pick<TalentTeamMatrixRow, 'employeeId' | 'employeeNumber' | 'employeeLabel' | 'jobTitle' | 'departmentName'>

type EmployeeDirectoryLabels = {
  title: string
  description: string
  search: string
  searchPlaceholder: string
  employeeNumber: string
  job: string
  department: string
  employeeCount: string
  selectEmployee: string
  selectedEmployee: string
  openEmployee: string
  teamMatrix: string
  noEmployees: string
  noResults: string
  loadError: string
  loading: string
  paginationAriaLabel: string
  previousPage: string
  nextPage: string
}

type DevelopmentLabels = {
  title: string
  description: string
  selectedEmployee: string
  noEmployeeSelected: string
  currentJob: string
  department: string
  comparisonTitle: string
  comparisonDescription: string
  openComparison: string
  roleExplorerTitle: string
  roleExplorerDescription: string
  openRoleExplorer: string
}

export type TalentWorkforceOverviewLabels = {
  tabsAriaLabel: string
  previousTab: string
  nextTab: string
  employeesTab: string
  profilesTab: string
  skillsEvidenceTab: string
  compareDevelopTab: string
  employeeDirectory: EmployeeDirectoryLabels
  development: DevelopmentLabels
  profileLabels: Parameters<typeof TalentWorkforceViewer>[0]['labels']
  recordLabels: Parameters<typeof TalentEmployeeCapabilityRecords>[0]['labels']
  manageProfiles: string
  manageSkills: string
}

type Props = {
  canTeam: boolean
  canCompare: boolean
  canManage: boolean
  initialArea?: string
  initialEmployeeId?: string
  labels: TalentWorkforceOverviewLabels
}

function resolveArea(value: string | null | undefined, allowed: readonly AreaId[], fallback: AreaId): AreaId {
  return allowed.find((area) => area === value) ?? fallback
}

function countLabel(template: string, count: number): string {
  return template.replace('{count}', String(count))
}

function EmployeeDirectory({ selectedEmployeeId, onSelect, labels }: {
  selectedEmployeeId: string | null
  onSelect: (employee: TalentWorkforceEmployee) => void
  labels: EmployeeDirectoryLabels
}) {
  const [query, setQuery] = useState('')
  const [employees, setEmployees] = useState<TalentWorkforceEmployee[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 25
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId) ?? null

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ includeCapabilities: 'false', offset: String((page - 1) * pageSize), limit: String(pageSize) })
    if (normalizedQuery) params.set('q', normalizedQuery)
    const timeout = window.setTimeout(() => {
      setState('loading')
      void fetch(`/api/talent/team-matrix?${params.toString()}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error('TALENT_TEAM_READ_FAILED')
        const payload = await response.json() as { data: { rows: TalentWorkforceEmployee[]; totalCount?: number } }
        if (controller.signal.aborted) return
        setEmployees(payload.data.rows)
        setTotalCount(payload.data.totalCount ?? payload.data.rows.length)
        setState('ready')
      }).catch(() => { if (!controller.signal.aborted) setState('error') })
    }, normalizedQuery ? 250 : 0)
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [normalizedQuery, page])

  useEffect(() => { if (selectedEmployee) onSelect(selectedEmployee) }, [onSelect, selectedEmployee])

  return <section className="space-y-4">
    <Surface className="p-4 sm:p-5">
      <SectionHeader actions={<Badge tone="info">{countLabel(labels.employeeCount, totalCount)}</Badge>} description={labels.description} title={labels.title} />
      <label className="mt-4 grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
        <span>{labels.search}</span>
        <TextInput aria-label={labels.search} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={labels.searchPlaceholder} value={query} />
      </label>
    </Surface>

    {state === 'loading' ? <EmptyState className="border-dashed" description={labels.loading} title={labels.loading} /> : state === 'error' ? <EmptyState className="border-dashed" description={labels.loadError} title={labels.loadError} /> : employees.length === 0 ? <EmptyState className="border-dashed" description={labels.noEmployees} title={labels.noEmployees} /> : <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
      <Surface className="min-w-0 p-3 sm:p-4">
        <ul aria-label={labels.title} className="max-h-[34rem] divide-y divide-border-subtle overflow-y-auto">
          {employees.map((employee) => {
            const selected = employee.employeeId === selectedEmployeeId
            return <li key={employee.employeeId}>
              <button aria-pressed={selected} className={`w-full rounded-[var(--radius-control)] px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-raised'}`} onClick={() => onSelect(employee)} type="button">
                <span className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 break-words font-semibold">{employee.employeeLabel}</span><Badge className="shrink-0" tone="neutral">{employee.employeeNumber}</Badge></span>
                <span className="mt-1 block break-words text-sm text-muted-foreground">{employee.jobTitle ?? '—'} · {employee.departmentName ?? '—'}</span>
              </button>
            </li>
          })}
        </ul>
        <div className="mt-3"><Pagination ariaLabel={labels.paginationAriaLabel} currentPage={page} nextLabel={labels.nextPage} onPageChange={setPage} previousLabel={labels.previousPage} totalPages={Math.ceil(totalCount / pageSize)} /></div>
      </Surface>

      {selectedEmployee ? <Surface className="min-w-0 p-4 sm:p-5">
        <SectionHeader description={labels.selectedEmployee} title={selectedEmployee.employeeLabel} />
        <dl className="mt-4 grid gap-3 border-y border-border-subtle py-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
          <div><dt className="text-xs text-muted-foreground">{labels.employeeNumber}</dt><dd className="mt-1 font-medium">{selectedEmployee.employeeNumber}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.job}</dt><dd className="mt-1 break-words font-medium">{selectedEmployee.jobTitle ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{labels.department}</dt><dd className="mt-1 break-words font-medium">{selectedEmployee.departmentName ?? '—'}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link aria-label={`${labels.openEmployee}: ${selectedEmployee.employeeLabel}`} className={buttonClasses({ size: 'sm' })} href={`/employees/${selectedEmployee.employeeId}?tab=overview`} prefetch={false}>{labels.openEmployee}</Link>
          <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/workforce/talent/team">{labels.teamMatrix}</Link>
        </div>
      </Surface> : <EmptyState className="border-dashed" description={labels.selectEmployee} title={labels.selectEmployee} />}
    </div>}
  </section>
}

function DevelopmentHub({ employee, employeeId, labels }: { employee: TalentWorkforceEmployee | null; employeeId: string | null; labels: DevelopmentLabels }) {
  const selectedId = employee?.employeeId ?? employeeId
  const employeeQuery = selectedId ? `?employeeId=${encodeURIComponent(selectedId)}` : ''

  return <section className="space-y-4">
    <SectionHeader description={labels.description} title={labels.title} />
    {employee ? <Surface className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5" variant="subtle">
      <div><p className="text-xs text-muted-foreground">{labels.selectedEmployee}</p><p className="mt-1 break-words font-semibold">{employee.employeeLabel}</p><p className="mt-1 text-sm text-muted-foreground">{employee.employeeNumber}</p></div>
      <div><p className="text-xs text-muted-foreground">{labels.currentJob}</p><p className="mt-1 break-words font-semibold">{employee.jobTitle ?? '—'}</p></div>
      <div><p className="text-xs text-muted-foreground">{labels.department}</p><p className="mt-1 break-words font-semibold">{employee.departmentName ?? '—'}</p></div>
    </Surface> : <p className="rounded-[var(--radius-control)] border border-dashed border-border-subtle p-4 text-sm text-muted-foreground">{labels.noEmployeeSelected}</p>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Surface className="flex min-w-0 flex-col items-start gap-4 p-4 sm:p-5">
        <div><h3 className="text-lg font-semibold">{labels.comparisonTitle}</h3><p className="mt-2 text-sm text-muted-foreground">{labels.comparisonDescription}</p></div>
        <Link className={buttonClasses({ size: 'sm' })} href={`/workforce/talent/comparison${employeeQuery}`}>{labels.openComparison}</Link>
      </Surface>
      <Surface className="flex min-w-0 flex-col items-start gap-4 p-4 sm:p-5">
        <div><h3 className="text-lg font-semibold">{labels.roleExplorerTitle}</h3><p className="mt-2 text-sm text-muted-foreground">{labels.roleExplorerDescription}</p></div>
        <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={`/workforce/talent/role-explorer${employeeQuery}`}>{labels.openRoleExplorer}</Link>
      </Surface>
    </div>
  </section>
}

export function TalentWorkforceOverview({ canTeam, canCompare, canManage, initialArea, initialEmployeeId, labels }: Props) {
  const allowedAreas = useMemo<AreaId[]>(() => [
    ...(canTeam ? ['employees' as const] : []),
    'profiles',
    'skills',
    ...(canCompare ? ['develop' as const] : []),
  ], [canCompare, canTeam])
  const fallbackArea: AreaId = canTeam ? 'employees' : 'profiles'
  const [activeArea, setActiveArea] = useState<AreaId>(() => resolveArea(initialArea, allowedAreas, fallbackArea))
  const [selectedEmployee, setSelectedEmployee] = useState<TalentWorkforceEmployee | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(canTeam ? initialEmployeeId ?? null : null)
  const [records, setRecords] = useState<TalentEmployeeCapabilityRecord[]>([])
  const [recordState, setRecordState] = useState<'idle' | 'ready' | 'error'>('idle')
  const recordsRequested = useRef(false)
  const onSelectEmployee = useCallback((employee: TalentWorkforceEmployee) => {
    setSelectedEmployee(employee)
    setSelectedEmployeeId(employee.employeeId)
  }, [])
  const tabs = [
    ...(canTeam ? [{ id: 'employees' as const, label: labels.employeesTab }] : []),
    { id: 'profiles' as const, label: labels.profilesTab },
    { id: 'skills' as const, label: labels.skillsEvidenceTab },
    ...(canCompare ? [{ id: 'develop' as const, label: labels.compareDevelopTab }] : []),
  ]

  useEffect(() => {
    if (activeArea !== 'skills' || recordsRequested.current) return
    const controller = new AbortController()
    let completed = false
    recordsRequested.current = true
    void fetch('/api/talent/capability-records', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('TALENT_EMPLOYEE_CAPABILITY_READ_FAILED')
      const payload = await response.json() as { data: TalentEmployeeCapabilityRecord[] }
      if (controller.signal.aborted) return
      completed = true
      setRecords(payload.data)
      setRecordState('ready')
    }).catch(() => { if (!controller.signal.aborted) { completed = true; setRecordState('error') } })
    return () => {
      controller.abort()
      if (!completed) recordsRequested.current = false
    }
  }, [activeArea])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('area', activeArea)
    if (canTeam && selectedEmployeeId) url.searchParams.set('employeeId', selectedEmployeeId)
    else url.searchParams.delete('employeeId')
    const nextUrl = `${url.pathname}?${url.searchParams.toString()}${url.hash}`
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) window.history.replaceState(window.history.state, '', nextUrl)
  }, [activeArea, canTeam, selectedEmployeeId])

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveArea(resolveArea(params.get('area'), allowedAreas, fallbackArea))
      const requestedEmployeeId = params.get('employeeId')
      setSelectedEmployeeId(canTeam && requestedEmployeeId ? requestedEmployeeId : null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [allowedAreas, canTeam, fallbackArea])

  return <section className="mt-6 min-w-0">
    <ScrollableTabs ariaLabel={labels.tabsAriaLabel} contentProps={{ role: 'tablist' }} leftLabel={labels.previousTab} rightLabel={labels.nextTab}>
      {tabs.map((tab) => <TabButton aria-controls={activeArea === tab.id ? `talent-workforce-panel-${tab.id}` : undefined} id={`talent-workforce-tab-${tab.id}`} active={activeArea === tab.id} key={tab.id} onClick={() => setActiveArea(tab.id)}>{tab.label}</TabButton>)}
    </ScrollableTabs>

    {activeArea === 'employees' && canTeam ? <div aria-labelledby="talent-workforce-tab-employees" className="mt-5 min-w-0" id="talent-workforce-panel-employees" role="tabpanel" tabIndex={0}>
      <EmployeeDirectory labels={labels.employeeDirectory} onSelect={onSelectEmployee} selectedEmployeeId={selectedEmployeeId} />
    </div> : null}

    {activeArea === 'profiles' ? <div aria-labelledby="talent-workforce-tab-profiles" className="mt-5 min-w-0" id="talent-workforce-panel-profiles" role="tabpanel" tabIndex={0}>
      {canManage ? <div className="mb-4 flex justify-end"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/talent">{labels.manageProfiles}</Link></div> : null}
      <TalentWorkforceViewer labels={labels.profileLabels} />
    </div> : null}

    {activeArea === 'skills' ? <div aria-labelledby="talent-workforce-tab-skills" className="mt-5 min-w-0" id="talent-workforce-panel-skills" role="tabpanel" tabIndex={0}>
      {canManage ? <div className="mb-4 flex justify-end"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/talent">{labels.manageSkills}</Link></div> : null}
      {recordState === 'idle' ? <EmptyState description={labels.profileLabels.loadingProfiles} title={labels.profileLabels.loadingProfiles} /> : <TalentEmployeeCapabilityRecords initial={records} labels={labels.recordLabels} mode="manager" state={recordState === 'error' ? 'error' : 'ready'} />}
    </div> : null}

    {activeArea === 'develop' && canCompare ? <div aria-labelledby="talent-workforce-tab-develop" className="mt-5 min-w-0" id="talent-workforce-panel-develop" role="tabpanel" tabIndex={0}>
      <DevelopmentHub employee={selectedEmployee} employeeId={selectedEmployeeId} labels={labels.development} />
    </div> : null}
  </section>
}

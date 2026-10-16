'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { SectionHeader } from '@/components/patterns/section-header'
import { buttonClasses } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { TalentEmployeeCapabilityRecords } from '@/components/talent/talent-employee-capability-records'
import { TalentWorkforceViewer } from '@/components/talent/talent-workforce-viewer'
import type { TalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'
import type { TalentWorkforceProfile } from '@/lib/talent/service'
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
  employees: TalentWorkforceEmployee[]
  employeeState: 'ready' | 'error'
  profiles: TalentWorkforceProfile[]
  profileState: 'ready' | 'error'
  records: TalentEmployeeCapabilityRecord[]
  recordState: 'ready' | 'error'
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

function EmployeeDirectory({ employees, employeeState, selectedEmployeeId, onSelect, labels }: {
  employees: TalentWorkforceEmployee[]
  employeeState: 'ready' | 'error'
  selectedEmployeeId: string | null
  onSelect: (employeeId: string | null) => void
  labels: EmployeeDirectoryLabels
}) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
  const visibleEmployees = useMemo(() => employees.filter((employee) => [employee.employeeLabel, employee.employeeNumber, employee.jobTitle ?? '', employee.departmentName ?? '']
    .some((value) => value.toLocaleLowerCase('nl-NL').includes(normalizedQuery))), [employees, normalizedQuery])
  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId) ?? null

  return <section className="space-y-4">
    <Surface className="p-4 sm:p-5">
      <SectionHeader actions={<Badge tone="info">{countLabel(labels.employeeCount, employees.length)}</Badge>} description={labels.description} title={labels.title} />
      <label className="mt-4 grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
        <span>{labels.search}</span>
        <TextInput aria-label={labels.search} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} value={query} />
      </label>
    </Surface>

    {employeeState === 'error' ? <EmptyState className="border-dashed" description={labels.loadError} title={labels.loadError} /> : employees.length === 0 ? <EmptyState className="border-dashed" description={labels.noEmployees} title={labels.noEmployees} /> : <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]">
      <Surface className="min-w-0 p-3 sm:p-4">
        {visibleEmployees.length > 0 ? <ul aria-label={labels.title} className="max-h-[34rem] divide-y divide-border-subtle overflow-y-auto">
          {visibleEmployees.map((employee) => {
            const selected = employee.employeeId === selectedEmployeeId
            return <li key={employee.employeeId}>
              <button aria-pressed={selected} className={`w-full rounded-[var(--radius-control)] px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${selected ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-raised'}`} onClick={() => onSelect(employee.employeeId)} type="button">
                <span className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 break-words font-semibold">{employee.employeeLabel}</span><Badge className="shrink-0" tone="neutral">{employee.employeeNumber}</Badge></span>
                <span className="mt-1 block break-words text-sm text-muted-foreground">{employee.jobTitle ?? '—'} · {employee.departmentName ?? '—'}</span>
              </button>
            </li>
          })}
        </ul> : <EmptyState className="border-0 px-3 py-8" description={labels.noResults} title={labels.noResults} />}
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

function DevelopmentHub({ employee, labels }: { employee: TalentWorkforceEmployee | null; labels: DevelopmentLabels }) {
  const employeeQuery = employee ? `?employeeId=${encodeURIComponent(employee.employeeId)}` : ''

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

export function TalentWorkforceOverview({ employees, employeeState, profiles, profileState, records, recordState, canTeam, canCompare, canManage, initialArea, initialEmployeeId, labels }: Props) {
  const allowedAreas = useMemo<AreaId[]>(() => [
    ...(canTeam ? ['employees' as const] : []),
    'profiles',
    'skills',
    ...(canCompare ? ['develop' as const] : []),
  ], [canCompare, canTeam])
  const fallbackArea: AreaId = canTeam ? 'employees' : 'profiles'
  const [activeArea, setActiveArea] = useState<AreaId>(() => resolveArea(initialArea, allowedAreas, fallbackArea))
  const validEmployeeId = canTeam && employees.some((employee) => employee.employeeId === initialEmployeeId) ? initialEmployeeId ?? null : null
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(validEmployeeId)
  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId) ?? null
  const tabs = [
    ...(canTeam ? [{ id: 'employees' as const, label: labels.employeesTab }] : []),
    { id: 'profiles' as const, label: labels.profilesTab },
    { id: 'skills' as const, label: labels.skillsEvidenceTab },
    ...(canCompare ? [{ id: 'develop' as const, label: labels.compareDevelopTab }] : []),
  ]

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
      setSelectedEmployeeId(canTeam && employees.some((employee) => employee.employeeId === requestedEmployeeId) ? requestedEmployeeId : null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [allowedAreas, canTeam, employees, fallbackArea])

  const viewerLabels = labels.profileLabels
  const recordLabels = labels.recordLabels

  return <section className="mt-6 min-w-0">
    <ScrollableTabs ariaLabel={labels.tabsAriaLabel} contentProps={{ role: 'tablist' }} leftLabel={labels.previousTab} rightLabel={labels.nextTab}>
      {tabs.map((tab) => <TabButton aria-controls={`talent-workforce-panel-${tab.id}`} id={`talent-workforce-tab-${tab.id}`} active={activeArea === tab.id} key={tab.id} onClick={() => setActiveArea(tab.id)}>{tab.label}</TabButton>)}
    </ScrollableTabs>

    {canTeam ? <div aria-labelledby="talent-workforce-tab-employees" className="mt-5 min-w-0" hidden={activeArea !== 'employees'} id="talent-workforce-panel-employees" role="tabpanel" tabIndex={0}>
      <EmployeeDirectory employeeState={employeeState} employees={employees} labels={labels.employeeDirectory} onSelect={setSelectedEmployeeId} selectedEmployeeId={selectedEmployeeId} />
    </div> : null}

    <div aria-labelledby="talent-workforce-tab-profiles" className="mt-5 min-w-0" hidden={activeArea !== 'profiles'} id="talent-workforce-panel-profiles" role="tabpanel" tabIndex={0}>
      {canManage ? <div className="mb-4 flex justify-end"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/talent">{labels.manageProfiles}</Link></div> : null}
      <TalentWorkforceViewer initial={profiles} state={profileState} labels={viewerLabels} />
    </div>

    <div aria-labelledby="talent-workforce-tab-skills" className="mt-5 min-w-0" hidden={activeArea !== 'skills'} id="talent-workforce-panel-skills" role="tabpanel" tabIndex={0}>
      {canManage ? <div className="mb-4 flex justify-end"><Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href="/settings/talent">{labels.manageSkills}</Link></div> : null}
      <TalentEmployeeCapabilityRecords initial={records} labels={recordLabels} mode="manager" state={recordState} />
    </div>

    {canCompare ? <div aria-labelledby="talent-workforce-tab-develop" className="mt-5 min-w-0" hidden={activeArea !== 'develop'} id="talent-workforce-panel-develop" role="tabpanel" tabIndex={0}>
      <DevelopmentHub employee={selectedEmployee} labels={labels.development} />
    </div> : null}
  </section>
}

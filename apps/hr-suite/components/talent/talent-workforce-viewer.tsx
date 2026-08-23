'use client'

import { BriefcaseBusiness, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { filterTalentWorkforceProfiles, talentWorkforceProfileKey, uniqueTalentWorkforceEmployees } from '@/lib/talent/overview-utils'
import type { TalentWorkforceProfile } from '@/lib/talent/service'
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

export function TalentWorkforceViewer({ initial, labels, state = 'ready' }: { initial: TalentWorkforceProfile[]; labels: Labels; state?: 'ready' | 'error' }) {
  const [query, setQuery] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [selectedId, setSelectedId] = useState(initial[0] ? talentWorkforceProfileKey(initial[0]) : null)
  const employeeOptions = useMemo(() => uniqueTalentWorkforceEmployees(initial), [initial])

  useEffect(() => {
    const readUrlSelection = () => {
      const value = new URLSearchParams(window.location.search).get('profile')
      if (value && initial.some((item) => talentWorkforceProfileKey(item) === value)) setSelectedId(value)
    }
    readUrlSelection()
    window.addEventListener('popstate', readUrlSelection)
    return () => window.removeEventListener('popstate', readUrlSelection)
  }, [initial])

  const visible = useMemo(() => filterTalentWorkforceProfiles(initial, query, employeeId), [employeeId, initial, query])

  const selected = visible.find((item) => talentWorkforceProfileKey(item) === selectedId) ?? visible[0]
  const readOnlyLabels: TalentReadOnlyProfileLabels = labels

  function selectProfile(id: string) {
    setSelectedId(id)
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
        <TextInput aria-label={labels.search} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} value={query} />
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-muted-foreground">
          <span>{labels.employeeFilter}</span>
          <DropdownSelect aria-label={labels.employeeFilter} onChange={(event) => setEmployeeId(event.target.value)} searchable searchPlaceholder={labels.searchPlaceholder} value={employeeId}>
            <option value="">{labels.allEmployees}</option>
            {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.label} · {employee.employeeNumber}</option>)}
          </DropdownSelect>
        </label>
      </div>
    </Surface>

    {state === 'error' ? <EmptyState description={labels.loadError} icon={<BriefcaseBusiness />} title={labels.loadError} /> : initial.length === 0 ? <EmptyState description={labels.managerReadOnlyHint} icon={<BriefcaseBusiness />} title={labels.empty} /> : visible.length === 0 ? <EmptyState description={labels.noResults} icon={<Search />} title={labels.noResults} /> : <div className="grid gap-5 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.8fr)]">
      <Surface className="p-3" variant="subtle">
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels.profiles}</p>
          <Badge>{visible.length}</Badge>
        </div>
        <nav aria-label={labels.profiles} className="space-y-2">
          {visible.map((item) => {
            const isSelected = talentWorkforceProfileKey(item) === (selected ? talentWorkforceProfileKey(selected) : null)
            return <Button aria-pressed={isSelected} className="w-full justify-start text-left" key={talentWorkforceProfileKey(item)} onClick={() => selectProfile(talentWorkforceProfileKey(item))} size="sm" type="button" variant={isSelected ? 'primary' : 'secondary'}>
              <span className="min-w-0"><span className="block truncate font-semibold">{item.profile.job_code}</span><span className="mt-1 block truncate text-xs font-normal opacity-80">{item.profile.job_group_name}</span><span className="mt-1 flex items-center gap-1 text-xs font-normal opacity-80"><Users aria-hidden="true" />{labels.employeeCount.replace('{count}', String(item.employees.length))}</span></span>
            </Button>
          })}
        </nav>
      </Surface>
      {selected ? <div className="min-w-0 space-y-5">
        <Surface className="p-4 sm:p-5">
          <SectionHeader description={labels.employeeContext} title={`${selected.profile.job_code} · ${selected.profile.job_group_name}`} />
          {selected.employees.length > 0 ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{selected.employees.map((employee) => <li className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle px-3 py-2 text-sm" key={employee.id}><span className="min-w-0 truncate font-medium">{employee.label}</span><Badge>{employee.employeeNumber}</Badge></li>)}</ul> : <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Users aria-hidden="true" />{labels.noEmployees}</p>}
        </Surface>
        <TalentReadOnlyProfile labels={readOnlyLabels} profile={toReadOnlyProfile(selected)} />
      </div> : <EmptyState description={labels.selectProfile} title={labels.selectProfile} />}
    </div>}
  </section>
}

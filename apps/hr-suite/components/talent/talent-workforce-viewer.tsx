'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
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

export function TalentWorkforceViewer({ initial, labels }: { initial: TalentWorkforceProfile[]; labels: Labels }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initial[0]?.profile.job_profile_id ?? null)
  const normalizedQuery = query.trim().toLocaleLowerCase('nl-NL')
  const visible = useMemo(() => initial.filter((item) => {
    if (!normalizedQuery) return true
    const profile = item.profile
    return [profile.job_code, profile.job_group_name, profile.job_family_name, profile.seniority_name, profile.summary]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase('nl-NL').includes(normalizedQuery))
  }), [initial, normalizedQuery])
  const selected = visible.find((item) => item.profile.job_profile_id === selectedId) ?? visible[0]
  const readOnlyLabels: TalentReadOnlyProfileLabels = labels

  return <div className="mt-6 space-y-5">
    <div className="rounded-2xl border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold">{labels.profiles}</p><p className="mt-1 text-sm text-muted-foreground">{labels.managerReadOnlyHint}</p></div>
        <span className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-medium">{visible.length} / {initial.length}</span>
      </div>
      <label className="relative mt-4 block"><span className="sr-only">{labels.search}</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label={labels.search} className="form-field pl-9" onChange={(event) => setQuery(event.target.value)} placeholder={labels.searchPlaceholder} value={query} /></label>
    </div>

    {initial.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.empty}</p> : visible.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.noResults}</p> : <div className="grid gap-5 xl:grid-cols-[minmax(15rem,0.75fr)_minmax(0,1.75fr)]">
      <nav aria-label={labels.profiles} className="space-y-2 rounded-2xl border bg-surface p-3 shadow-sm">
        {visible.map((item) => { const isSelected = item.profile.job_profile_id === selected?.profile.job_profile_id; return <button aria-pressed={isSelected} className={`w-full rounded-xl border p-4 text-left transition ${isSelected ? 'border-primary/40 bg-primary/5 shadow-sm' : 'bg-background hover:border-primary/30'}`} key={item.profile.job_profile_id} onClick={() => setSelectedId(item.profile.job_profile_id)} type="button"><span className="block text-sm font-semibold">{item.profile.job_code}</span><span className="mt-1 block text-sm">{item.profile.job_group_name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.profile.seniority_name ?? labels.notAvailable}</span></button> })}
      </nav>
      {selected ? <TalentReadOnlyProfile labels={readOnlyLabels} profile={toReadOnlyProfile(selected)} /> : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.selectProfile}</p>}
    </div>}
  </div>
}

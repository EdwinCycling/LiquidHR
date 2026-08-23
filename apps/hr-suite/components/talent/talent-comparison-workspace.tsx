'use client'

import Link from 'next/link'
import { CheckCircle2, CircleAlert, CircleHelp, FileWarning, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { FormField } from '@/components/patterns/form-field'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { TalentComparisonOutcome, TalentComparisonRequirement, TalentComparisonWorkspace as TalentComparisonWorkspaceData } from '@/lib/talent/comparison-service'

type Labels = {
  title: string
  subtitle: string
  employee: string
  employeeNumber: string
  profile: string
  profileVersion: string
  capability: string
  typeCompetency: string
  typeSkill: string
  typeKnowledge: string
  typeLanguage: string
  typeCertificate: string
  required: string
  important: string
  optional: string
  sourceSelf: string
  sourceHr: string
  sourceManager: string
  sourceImported: string
  chooseEmployee: string
  chooseProfile: string
  search: string
  compare: string
  empty: string
  noEmployees: string
  noProfiles: string
  noRequirements: string
  requirements: string
  target: string
  current: string
  requirementType: string
  rationale: string
  match: string
  gap: string
  missingEvidence: string
  unknown: string
  sourceVersion: string
  sourceRecord: string
  noSourceRecord: string
  sourceType: string
  validity: string
  noCurrentRecord: string
  jobGroup: string
  currentJob: string
  currentScope: string
  asOf: string
  openEmployee: string
  openProfile: string
}

function outcomeLabel(outcome: TalentComparisonOutcome, labels: Labels): string {
  if (outcome === 'MATCH') return labels.match
  if (outcome === 'GAP') return labels.gap
  if (outcome === 'MISSING_EVIDENCE') return labels.missingEvidence
  return labels.unknown
}

function outcomeTone(outcome: TalentComparisonOutcome): BadgeTone {
  if (outcome === 'MATCH') return 'success'
  if (outcome === 'GAP') return 'danger'
  if (outcome === 'MISSING_EVIDENCE') return 'warning'
  return 'neutral'
}

function OutcomeIcon({ outcome }: { outcome: TalentComparisonOutcome }) {
  if (outcome === 'MATCH') return <CheckCircle2 aria-hidden="true" />
  if (outcome === 'GAP') return <CircleAlert aria-hidden="true" />
  if (outcome === 'MISSING_EVIDENCE') return <FileWarning aria-hidden="true" />
  return <CircleHelp aria-hidden="true" />
}

function OutcomeBadge({ labels, outcome, withIcon = true }: { labels: Labels; outcome: TalentComparisonOutcome; withIcon?: boolean }) {
  return <Badge className="gap-1.5 [&>svg]:size-3.5 [&>svg]:shrink-0" tone={outcomeTone(outcome)}>{withIcon ? <OutcomeIcon outcome={outcome} /> : null}{outcomeLabel(outcome, labels)}</Badge>
}

function targetValue(requirement: TalentComparisonRequirement): string {
  return [requirement.targetLevelCode, requirement.languageLevel].filter(Boolean).join(' · ') || '—'
}

function currentValue(requirement: TalentComparisonRequirement, labels: Labels): string {
  return [requirement.currentLevelCode, requirement.currentLanguageLevel].filter(Boolean).join(' · ') || labels.noCurrentRecord
}

function validityValue(requirement: TalentComparisonRequirement, labels: Labels): string {
  if (!requirement.validFrom) return labels.noCurrentRecord
  return `${requirement.validFrom}${requirement.validUntil ? ` → ${requirement.validUntil}` : ''}`
}

function capabilityTypeValue(requirement: TalentComparisonRequirement, labels: Labels): string {
  if (requirement.capabilityType === 'COMPETENCY') return labels.typeCompetency
  if (requirement.capabilityType === 'SKILL') return labels.typeSkill
  if (requirement.capabilityType === 'KNOWLEDGE') return labels.typeKnowledge
  if (requirement.capabilityType === 'LANGUAGE') return labels.typeLanguage
  if (requirement.capabilityType === 'CERTIFICATE') return labels.typeCertificate
  return labels.unknown
}

function requirementTypeValue(requirement: TalentComparisonRequirement, labels: Labels): string {
  if (requirement.requirementType === 'REQUIRED') return labels.required
  if (requirement.requirementType === 'IMPORTANT') return labels.important
  if (requirement.requirementType === 'OPTIONAL') return labels.optional
  return labels.unknown
}

function sourceTypeValue(requirement: TalentComparisonRequirement, labels: Labels): string | null {
  if (!requirement.sourceType) return null
  if (requirement.sourceType === 'SELF') return labels.sourceSelf
  if (requirement.sourceType === 'HR') return labels.sourceHr
  if (requirement.sourceType === 'MANAGER') return labels.sourceManager
  if (requirement.sourceType === 'IMPORTED') return labels.sourceImported
  return labels.unknown
}

export function TalentComparisonWorkspace({ initial, labels, action, profileHref }: { initial: TalentComparisonWorkspaceData; labels: Labels; action: string; profileHref: string }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial.selectedEmployeeId ?? '')
  const [selectedProfileVersionId, setSelectedProfileVersionId] = useState(initial.selectedProfileVersionId ?? '')
  const comparison = initial.comparison

  const statusCounts = useMemo(() => {
    const counts: Record<TalentComparisonOutcome, number> = { MATCH: 0, GAP: 0, MISSING_EVIDENCE: 0, UNKNOWN: 0 }
    for (const requirement of comparison?.requirements ?? []) counts[requirement.outcome] += 1
    return counts
  }, [comparison?.requirements])

  const noEmployees = initial.employees.length === 0
  const noProfiles = initial.profiles.length === 0

  return <section className="mt-6 min-w-0 space-y-6">
    <Surface className="p-4 sm:p-5" variant="subtle">
      <form action={action} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end" method="get">
        <FormField control={<DropdownSelect aria-label={labels.employee} disabled={noEmployees} name="employeeId" onChange={(event) => setSelectedEmployeeId(event.target.value)} placeholder={labels.chooseEmployee} searchable searchPlaceholder={labels.search} value={selectedEmployeeId}>{initial.employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeLabel} · {employee.employeeNumber}</option>)}</DropdownSelect>} label={labels.employee} />
        <FormField control={<DropdownSelect aria-label={labels.profile} disabled={noProfiles} name="profileVersionId" onChange={(event) => setSelectedProfileVersionId(event.target.value)} placeholder={labels.chooseProfile} searchable searchPlaceholder={labels.search} value={selectedProfileVersionId}>{initial.profiles.map((profile) => <option key={profile.profileVersionId} value={profile.profileVersionId}>{profile.jobCode} · v{profile.profileVersion}{profile.jobGroupName ? ` · ${profile.jobGroupName}` : ''}</option>)}</DropdownSelect>} label={labels.profile} />
        <Button className="w-full lg:w-auto" disabled={!selectedEmployeeId || !selectedProfileVersionId} type="submit">{labels.compare}</Button>
      </form>
      <div className="mt-4 flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span>{labels.currentScope}: <strong className="font-semibold text-foreground tabular-nums">{initial.employees.length}</strong></span>
        <span>{labels.asOf}: <time dateTime={initial.asOf}>{initial.asOf}</time></span>
      </div>
    </Surface>

    {noEmployees || noProfiles ? <EmptyState description={labels.empty} icon={<UserRound />} title={noEmployees ? labels.noEmployees : labels.noProfiles} /> : !comparison ? <EmptyState description={labels.chooseProfile} title={labels.empty} /> : <div className="min-w-0 space-y-6">
      <Surface className="p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.employee}</p>
            <h2 className="mt-1 break-words text-xl font-semibold" id="comparison-result-title"><Link className="rounded-sm underline decoration-border underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:decoration-primary" href={`/employees/${comparison.employee.employeeId}?tab=overview`} aria-label={`${labels.openEmployee}: ${comparison.employee.employeeLabel}`}>{comparison.employee.employeeLabel}</Link></h2>
            <p className="mt-2 break-words text-sm text-muted-foreground">{labels.employeeNumber}: {comparison.employee.employeeNumber} · {labels.currentJob}: {comparison.employee.jobTitle ?? '—'}</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <Badge tone="info">{labels.profileVersion}: v{comparison.profile.profileVersion}</Badge>
            <Link className="rounded-sm text-sm font-medium text-primary underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:underline" href={profileHref} aria-label={`${labels.openProfile}: ${comparison.profile.jobCode}`}>{comparison.profile.jobCode}</Link>
          </div>
        </div>
        <dl className="mt-5 grid min-w-0 gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.profile}</dt><dd className="mt-1 break-words font-medium">{comparison.profile.jobCode}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.sourceVersion}</dt><dd className="mt-1 break-words font-medium">v{comparison.sourceVersion} · {comparison.profile.profileVersionId}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.jobGroup}</dt><dd className="mt-1 break-words font-medium">{comparison.profile.jobGroupName ?? '—'}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">{labels.currentScope}</dt><dd className="mt-1 font-medium tabular-nums">{initial.employees.length}</dd></div>
        </dl>
        <div aria-label={labels.requirements} className="mt-5 flex min-w-0 flex-wrap gap-2">
          {(['MATCH', 'GAP', 'MISSING_EVIDENCE', 'UNKNOWN'] as const).map((outcome) => <Badge key={outcome} tone={outcomeTone(outcome)}>{outcomeLabel(outcome, labels)}: {statusCounts[outcome]}</Badge>)}
        </div>
      </Surface>

      <Surface className="min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-semibold">{labels.requirements}</h3>
          <p className="text-sm text-muted-foreground">{comparison.profile.jobCode} · v{comparison.profile.profileVersion} · {comparison.profile.jobGroupName ?? '—'}</p>
        </div>
        {comparison.requirements.length === 0 ? <EmptyState className="mt-5 border-0 px-0" title={labels.noRequirements} /> : <>
          <div className="mt-5 divide-y divide-subtle md:hidden">
            {comparison.requirements.map((requirement) => <article className="space-y-3 py-4 first:pt-0 last:pb-0" key={requirement.requirementId}>
              <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-semibold">{requirement.capabilityName}</h4><p className="mt-1 break-words text-xs text-muted-foreground">{requirement.capabilityCode} · {capabilityTypeValue(requirement, labels)}</p></div><OutcomeBadge labels={labels} outcome={requirement.outcome} /></div>
              <dl className="grid min-w-0 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">{labels.target}</dt><dd className="mt-1 break-words">{targetValue(requirement)} · {requirementTypeValue(requirement, labels)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{labels.current}</dt><dd className="mt-1 break-words">{currentValue(requirement, labels)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{labels.sourceRecord}</dt><dd className="mt-1 break-all font-mono text-xs">{requirement.sourceRecordId ?? labels.noSourceRecord}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{labels.validity}</dt><dd className="mt-1 break-words">{validityValue(requirement, labels)}</dd></div>
              </dl>
              {sourceTypeValue(requirement, labels) ? <p className="text-xs text-muted-foreground">{labels.sourceType}: {sourceTypeValue(requirement, labels)}</p> : null}
              {requirement.rationale ? <p className="break-words text-sm text-muted-foreground"><span className="font-medium text-foreground">{labels.rationale}:</span> {requirement.rationale}</p> : null}
            </article>)}
          </div>
          <div className="mt-5 hidden min-w-0 md:block">
            <DataTableShell caption={labels.requirements} stickyHeader>
                <thead className="bg-surface text-xs uppercase tracking-[0.06em] text-muted-foreground"><tr><th className="px-3 py-3" scope="col">{labels.capability}</th><th className="px-3 py-3" scope="col">{labels.target}</th><th className="px-3 py-3" scope="col">{labels.current}</th><th className="px-3 py-3" scope="col">{labels.requirements}</th><th className="px-3 py-3" scope="col">{labels.sourceRecord}</th><th className="px-3 py-3" scope="col">{labels.validity}</th></tr></thead>
                <tbody className="divide-y divide-subtle">{comparison.requirements.map((requirement) => <tr key={requirement.requirementId}>
                  <th className="max-w-[15rem] px-3 py-3 align-top font-medium" scope="row"><span className="block break-words">{requirement.capabilityName}</span><span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{requirement.capabilityCode} · {capabilityTypeValue(requirement, labels)}</span></th>
                  <td className="max-w-[12rem] px-3 py-3 align-top"><span className="block break-words">{targetValue(requirement)}</span><span className="mt-1 block break-words text-xs text-muted-foreground">{labels.requirementType}: {requirementTypeValue(requirement, labels)}</span></td>
                  <td className="max-w-[12rem] px-3 py-3 align-top break-words">{currentValue(requirement, labels)}</td>
                  <td className="max-w-[13rem] px-3 py-3 align-top"><OutcomeBadge labels={labels} outcome={requirement.outcome} />{requirement.rationale ? <p className="mt-2 break-words text-xs text-muted-foreground"><span className="font-medium text-foreground">{labels.rationale}:</span> {requirement.rationale}</p> : null}</td>
                  <td className="max-w-[13rem] px-3 py-3 align-top"><span className="block break-all font-mono text-xs">{requirement.sourceRecordId ?? labels.noSourceRecord}</span>{sourceTypeValue(requirement, labels) ? <span className="mt-1 block break-words text-xs text-muted-foreground">{labels.sourceType}: {sourceTypeValue(requirement, labels)}</span> : null}</td>
                  <td className="max-w-[12rem] px-3 py-3 align-top break-words">{validityValue(requirement, labels)}</td>
                </tr>)}</tbody>
            </DataTableShell>
          </div>
        </>}
      </Surface>
    </div>}
  </section>
}

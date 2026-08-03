'use client'

import type { Json } from '@scope/db'
import { SettingsAccordion } from '@/components/settings/settings-accordion'

export type TalentReadOnlyProfile = {
  id: string
  jobCode: string
  groupCode: string
  groupName: string
  familyName: string | null
  seniorityName: string | null
  status: string
  validFrom: string
  validUntil: string | null
  purpose: string | null
  summary: string | null
  organizationalContext: string | null
  tasks: Json | null
  responsibilities: Json | null
  resultAreas: Json | null
  requirements: Array<{
    id: string
    capabilityCode: string
    capabilityName: string
    capabilityType: string
    requirementType: string
    targetLevelCode: string | null
    targetLevelName: string | null
    languageLevel: string | null
    rationale: string | null
  }>
}

export type TalentReadOnlyProfileLabels = {
  profileDetails: string
  profileContent: string
  requirements: string
  purpose: string
  summary: string
  organizationalContext: string
  tasks: string
  responsibilities: string
  resultAreas: string
  capabilityType: string
  required: string
  important: string
  optional: string
  targetLevel: string
  languageLevel: string
  rationale: string
  noContent: string
  noRequirements: string
  readOnly: string
  active: string
  validFrom: string
  validUntil: string
  family: string
  seniority: string
  notAvailable: string
}

function toList(value: Json | null): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (typeof value === 'string') return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  return []
}

function requirementLabel(type: string, labels: TalentReadOnlyProfileLabels): string {
  if (type === 'REQUIRED') return labels.required
  if (type === 'IMPORTANT') return labels.important
  return labels.optional
}

function ContentList({ value, emptyLabel }: { value: Json | null; emptyLabel: string }) {
  const items = toList(value)
  return items.length > 0
    ? <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    : <p className="text-sm text-muted-foreground">{emptyLabel}</p>
}

export function TalentReadOnlyProfile({ profile, labels }: { profile: TalentReadOnlyProfile; labels: TalentReadOnlyProfileLabels }) {
  return <article className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">{profile.jobCode}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{profile.groupName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{profile.groupCode}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1 font-medium">{labels.family}: {profile.familyName ?? labels.notAvailable}</span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium">{labels.seniority}: {profile.seniorityName ?? labels.notAvailable}</span>
        </div>
      </div>
      <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{labels.active}</span>
    </header>

    <dl className="grid gap-4 border-b py-5 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">{labels.validFrom}</dt><dd className="mt-1 font-medium">{profile.validFrom || labels.notAvailable}</dd></div>
      <div><dt className="text-muted-foreground">{labels.validUntil}</dt><dd className="mt-1 font-medium">{profile.validUntil ?? labels.notAvailable}</dd></div>
    </dl>

    <div className="mt-5">
      <SettingsAccordion initialOpen="content" sections={[
        {
          id: 'content',
          title: labels.profileContent,
          children: <div className="space-y-6">
            {profile.purpose ? <section><h3 className="text-sm font-semibold">{labels.purpose}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{profile.purpose}</p></section> : null}
            {profile.summary ? <section><h3 className="text-sm font-semibold">{labels.summary}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{profile.summary}</p></section> : null}
            {profile.organizationalContext ? <section><h3 className="text-sm font-semibold">{labels.organizationalContext}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{profile.organizationalContext}</p></section> : null}
            <div className="grid gap-6 md:grid-cols-3">
              <section><h3 className="mb-2 text-sm font-semibold">{labels.tasks}</h3><ContentList emptyLabel={labels.noContent} value={profile.tasks} /></section>
              <section><h3 className="mb-2 text-sm font-semibold">{labels.responsibilities}</h3><ContentList emptyLabel={labels.noContent} value={profile.responsibilities} /></section>
              <section><h3 className="mb-2 text-sm font-semibold">{labels.resultAreas}</h3><ContentList emptyLabel={labels.noContent} value={profile.resultAreas} /></section>
            </div>
          </div>,
        },
        {
          id: 'requirements',
          title: `${labels.requirements} (${profile.requirements.length})`,
          children: profile.requirements.length > 0
            ? <div className="space-y-3">{profile.requirements.map((requirement) => <div className="rounded-xl border bg-background p-4" key={requirement.id}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{requirement.capabilityName}</p><p className="mt-1 text-xs text-muted-foreground">{requirement.capabilityCode} · {requirement.capabilityType || labels.notAvailable}</p></div><span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-primary">{requirementLabel(requirement.requirementType, labels)}</span></div>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">{requirement.targetLevelName || requirement.targetLevelCode ? <div><dt className="text-muted-foreground">{labels.targetLevel}</dt><dd className="mt-1 font-medium">{[requirement.targetLevelCode, requirement.targetLevelName].filter(Boolean).join(' · ')}</dd></div> : null}{requirement.languageLevel ? <div><dt className="text-muted-foreground">{labels.languageLevel}</dt><dd className="mt-1 font-medium">{requirement.languageLevel}</dd></div> : null}{requirement.rationale ? <div className="sm:col-span-2"><dt className="text-muted-foreground">{labels.rationale}</dt><dd className="mt-1 text-muted-foreground">{requirement.rationale}</dd></div> : null}</dl>
            </div>)}</div>
            : <p className="text-sm text-muted-foreground">{labels.noRequirements}</p>,
        },
      ]} />
    </div>
    <p className="mt-5 text-xs text-muted-foreground">{labels.readOnly}</p>
  </article>
}

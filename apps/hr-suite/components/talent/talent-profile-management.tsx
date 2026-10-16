'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { listTalentFoundation, listTalentProfileCreateOptions, listTalentProfileManagement } from '@/lib/talent/service'

type Profiles = Awaited<ReturnType<typeof listTalentProfileManagement>>
type CreateOptions = Awaited<ReturnType<typeof listTalentProfileCreateOptions>>
type Foundation = Awaited<ReturnType<typeof listTalentFoundation>>
type Profile = Profiles[number]
type Version = Profile['versions'][number]
type Requirement = Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>>['requirements'][string][number]
type Level = Foundation['levels'][number]

interface Labels {
  profiles: string
  search: string
  all: string
  noResults: string
  empty: string
  library: string
  framework: string
  management: string
  dashboard: string
  counts: string
  recentChanges: string
  attention: string
  draftAttention: string
  missingActive: string
  functions: string
  capabilities: string
  activeProfiles: string
  draftVersions: string
  versions: string
  profile: string
  job: string
  group: string
  family: string
  seniority: string
  status: string
  active: string
  inactive: string
  draft: string
  current: string
  planned: string
  readOnly: string
  newVersion: string
  copyVersion: string
  save: string
  saved: string
  failed: string
  purpose: string
  summary: string
  organizationalContext: string
  tasks: string
  responsibilities: string
  resultAreas: string
  versionHistory: string
  validFrom: string
  validUntil: string
  activate: string
  activeDateHint: string
  requirements: string
  addRequirement: string
  capability: string
  importance: string
  required: string
  important: string
  optional: string
  targetLevel: string
  languageLevel: string
  rationale: string
  remove: string
  noRequirements: string
  profileRequired: string
  profileCreateOpen: string
  profileCreateTitle: string
  profileCreateDescription: string
  profileCreateSelectJob: string
  profileCreateEmployees: string
  profileCreateNoEmployees: string
  profileCreatePurpose: string
  profileCreateSummary: string
  profileCreateUnavailable: string
  profileCreateRefreshFailed: string
  profileCreateCancel: string
}

function listText(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join('\n') : ''
}

function listValue(value: string): string[] { return value.split('\n').map((item) => item.trim()).filter(Boolean) }

function versionLabel(version: Version, labels: Labels): string {
  const date = version.valid_from ? new Date(`${version.valid_from}T00:00:00`).toLocaleDateString('nl-NL') : labels.draft
  return `${date} · ${version.status === 'DRAFT' ? labels.draft : version.status === 'ACTIVE' ? labels.active : labels.inactive}`
}

function statusLabel(status: string, labels: Labels): string {
  return status === 'DRAFT' ? labels.draft : status === 'ACTIVE' ? labels.active : labels.inactive
}

export function TalentProfileManagement({ initial, foundation, createOptions, labels }: { initial: Profiles; foundation: Foundation; createOptions: CreateOptions; labels: Labels }) {
  const [profiles, setProfiles] = useState(initial)
  const [profileOptions, setProfileOptions] = useState(createOptions)
  const [createOpen, setCreateOpen] = useState(false)
  const [createJobId, setCreateJobId] = useState(createOptions[0]?.jobId ?? '')
  const [createPurpose, setCreatePurpose] = useState('')
  const [createSummary, setCreateSummary] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState(initial[0]?.profile.id ?? '')
  const [editor, setEditor] = useState<Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>> | null>(null)
  const [versionId, setVersionId] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [requirementDraft, setRequirementDraft] = useState({ capabilityId: '', requirementType: 'REQUIRED', targetLevelId: '', languageLevel: '', rationale: '' })

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('nl-NL')
    return profiles.filter((item) => !query || [item.job.code, item.group?.name ?? '', item.family?.name ?? '', item.seniority?.name ?? ''].some((value) => value.toLocaleLowerCase('nl-NL').includes(query)))
  }, [profiles, search])
  const selected = profiles.find((item) => item.profile.id === selectedProfileId) ?? visibleProfiles[0]
  const selectedCreateOption = profileOptions.find((item) => item.jobId === createJobId)
  const selectedVersion = editor?.versions.find((version) => version.id === versionId) ?? editor?.versions.find((version) => version.status === 'DRAFT') ?? editor?.versions[0]
  const selectedRequirements = selectedVersion ? editor?.requirements[selectedVersion.id] ?? [] : []
  const activeCount = profiles.reduce((count, item) => count + item.versions.filter((version) => version.status === 'ACTIVE' && version.valid_from && (!version.valid_until || version.valid_until > new Date().toISOString().slice(0, 10))).length, 0)
  const draftCount = profiles.reduce((count, item) => count + item.versions.filter((version) => version.status === 'DRAFT').length, 0)
  const missingActiveCount = profiles.filter((item) => !item.versions.some((version) => version.status === 'ACTIVE' && version.valid_from)).length

  async function loadProfile(profileId: string) {
    setSelectedProfileId(profileId)
    setMessage(null)
    const response = await fetch(`/api/talent/job-profiles/${profileId}`, { cache: 'no-store' })
    if (!response.ok) { setMessage(labels.failed); return }
    const payload = await response.json() as { data: Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>> }
    setEditor(payload.data)
    setVersionId(payload.data.versions.find((version) => version.status === 'DRAFT')?.id ?? payload.data.versions[0]?.id ?? '')
  }

  async function refresh(profileId = selectedProfileId): Promise<boolean> {
    const [profilesResponse, editorResponse, optionsResponse] = await Promise.all([
      fetch('/api/talent/job-profiles', { cache: 'no-store' }),
      profileId ? fetch(`/api/talent/job-profiles/${profileId}`, { cache: 'no-store' }) : Promise.resolve(null),
      fetch('/api/talent/job-profiles/options', { cache: 'no-store' }),
    ])
    if (!profilesResponse.ok || !optionsResponse.ok || (editorResponse && !editorResponse.ok)) { setMessage(labels.failed); return false }
    const profilePayload = await profilesResponse.json() as { data: Profiles }
    const optionsPayload = await optionsResponse.json() as { data: CreateOptions }
    setProfiles(profilePayload.data)
    setProfileOptions(optionsPayload.data)
    if (profileId) setSelectedProfileId(profileId)
    if (editorResponse) {
      const editorPayload = await editorResponse.json() as { data: Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>> }
      setEditor(editorPayload.data)
      setVersionId((current) => editorPayload.data.versions.some((version) => version.id === current) ? current : editorPayload.data.versions.find((version) => version.status === 'DRAFT')?.id ?? editorPayload.data.versions[0]?.id ?? '')
    }
    return true
  }

  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(url, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      if (!response.ok) { setMessage(labels.failed); return null }
      setMessage(labels.saved)
      return response
    } catch {
      setMessage(labels.failed)
      return null
    } finally {
      setSaving(false)
    }
  }

  async function saveVersion(version: Version) {
    if (version.status !== 'DRAFT') return
    const body = {
      updatedAt: version.updated_at,
      validFrom: version.valid_from,
      validUntil: version.valid_until,
      purpose: version.purpose,
      summary: version.summary,
      organizationalContext: version.organizational_context,
      tasks: listValue(listText(version.tasks)),
      responsibilities: listValue(listText(version.responsibilities)),
      resultAreas: listValue(listText(version.result_areas)),
    }
    if (await request(`/api/talent/profile-versions/${version.id}`, 'PATCH', body)) await refresh()
  }

  async function copyVersion() {
    if (!selected || !selectedVersion) return
    if (await request(`/api/talent/job-profiles/${selected.profile.id}/versions`, 'POST', { sourceVersionId: selectedVersion.id })) await refresh()
  }

  async function activateVersion() {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return
    if (await request(`/api/talent/profile-versions/${selectedVersion.id}/activate`, 'POST', { validFrom: selectedVersion.valid_from, validUntil: selectedVersion.valid_until, updatedAt: selectedVersion.updated_at })) await refresh()
  }

  async function addRequirement() {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT' || !requirementDraft.capabilityId) return
    if (await request(`/api/talent/profile-versions/${selectedVersion.id}/requirements`, 'POST', {
      capabilityId: requirementDraft.capabilityId,
      requirementType: requirementDraft.requirementType,
      targetLevelId: requirementDraft.targetLevelId || null,
      languageLevel: requirementDraft.languageLevel || null,
      rationale: requirementDraft.rationale || null,
      sortOrder: selectedRequirements.length + 1,
    })) {
      setRequirementDraft({ capabilityId: '', requirementType: 'REQUIRED', targetLevelId: '', languageLevel: '', rationale: '' })
      await refresh()
    }
  }

  async function saveRequirement(requirement: Requirement) {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return
    if (await request(`/api/talent/profile-requirements/${requirement.id}`, 'PATCH', { requirementType: requirement.requirement_type, targetLevelId: requirement.target_level_id, languageLevel: requirement.language_level, rationale: requirement.rationale, sortOrder: requirement.sort_order })) await refresh()
  }

  async function removeRequirement(requirementId: string) {
    if (await request(`/api/talent/profile-requirements/${requirementId}`, 'DELETE')) await refresh()
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createJobId) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/talent/job-profiles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobId: createJobId, purpose: createPurpose.trim() || null, summary: createSummary.trim() || null }) })
      if (!response.ok) { setMessage(labels.failed); return }
      const payload = await response.json() as { data: { id: string } }
      const refreshed = await refresh(payload.data.id)
      setCreateOpen(false)
      setCreatePurpose('')
      setCreateSummary('')
      setCreateJobId('')
      setMessage(refreshed ? labels.saved : labels.profileCreateRefreshFailed)
    } catch {
      setMessage(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 border-b border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">{labels.dashboard}</p><h2 className="text-xl font-semibold">{labels.profiles}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.profileCreateDescription}</p></div><Button disabled={profileOptions.length === 0 || saving} onClick={() => { setMessage(null); setCreateJobId(profileOptions[0]?.jobId ?? ''); setCreateOpen(true) }} size="sm" type="button"><Plus aria-hidden="true" />{labels.profileCreateOpen}</Button></div>
    {profileOptions.length === 0 ? <p className="text-sm text-muted-foreground">{labels.profileCreateUnavailable}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {[['functions', profiles.length], ['capabilities', foundation.capabilities.length], ['activeProfiles', activeCount], ['draftVersions', draftCount], ['missingActive', missingActiveCount], ['versions', profiles.reduce((count, item) => count + item.versions.length, 0)]].map(([key, value]) => <article className="rounded-2xl border bg-surface p-4 shadow-sm" key={key as string}><p className="text-sm font-medium text-foreground">{labels[key as keyof Labels]}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><p className="eyebrow">{labels.library}</p><h2 className="mt-1 text-lg font-semibold">{labels.capabilities}</h2><p className="mt-2 text-sm text-muted-foreground">{foundation.capabilities.length}</p></section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><p className="eyebrow">{labels.framework}</p><h2 className="mt-1 text-lg font-semibold">{labels.functions}</h2><p className="mt-2 text-sm text-muted-foreground">{profiles.length}</p></section>
      <section className="rounded-2xl border bg-surface p-5 shadow-sm"><p className="eyebrow">{labels.management}</p><h2 className="mt-1 text-lg font-semibold">{labels.attention}</h2><p className="mt-2 text-sm text-muted-foreground">{missingActiveCount > 0 ? `${missingActiveCount} · ${labels.missingActive}` : labels.profileRequired}</p></section>
    </div>
    {missingActiveCount > 0 || draftCount > 0 ? <aside className="rounded-2xl border border-dashed bg-muted/30 p-5" aria-label={labels.attention}><h2 className="font-semibold">{labels.attention}</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{missingActiveCount > 0 ? <li>{missingActiveCount} {labels.missingActive}</li> : null}{draftCount > 0 ? <li>{draftCount} {labels.draftAttention}</li> : null}</ul></aside> : null}
    <section className="grid gap-5 lg:grid-cols-[minmax(18rem,24rem)_1fr]">
      <div className="rounded-2xl border bg-surface p-4 shadow-sm"><label className="grid gap-1 text-sm font-medium">{labels.search}<input className="form-field" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="mt-4 divide-y rounded-xl border">{visibleProfiles.map((item) => <button className={`block w-full p-4 text-left transition hover:bg-muted/50 ${item.profile.id === selected?.profile.id ? 'bg-muted/60' : ''}`} key={item.profile.id} onClick={() => void loadProfile(item.profile.id)} type="button"><div className="flex items-start justify-between gap-3"><span className="font-semibold">{item.job.code}</span><span className="text-xs text-muted-foreground">{item.versions.length} {labels.versions}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.group?.name ?? labels.empty}{item.seniority ? ` · ${item.seniority.name}` : ''}</p></button>)}{visibleProfiles.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{labels.noResults}</p> : null}</div></div>
      {selected && editor && selectedVersion ? <div className="space-y-5 rounded-2xl border bg-surface p-5 shadow-sm"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{labels.profile}</p><h2 className="text-2xl font-semibold">{selected.job.code}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.group?.name ?? labels.empty} · {selected.family?.name ?? labels.empty} · {selected.seniority?.name ?? labels.empty}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{statusLabel(selectedVersion.status, labels)}</span>{selectedVersion.status === 'DRAFT' ? <><button className="button-secondary inline-flex items-center gap-2" disabled={saving} onClick={() => void copyVersion()} type="button"><Copy size={15} />{labels.copyVersion}</button><button className="button-primary inline-flex items-center gap-2" disabled={saving} onClick={() => void activateVersion()} type="button"><CheckCircle2 size={15} />{labels.activate}</button></> : null}</div></header>
        <div className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{labels.versionHistory}</h3><select aria-label={labels.versionHistory} className="form-field max-w-xs" value={selectedVersion.id} onChange={(event) => setVersionId(event.target.value)}>{editor.versions.map((version) => <option key={version.id} value={version.id}>{versionLabel(version, labels)}</option>)}</select></div><p className="mt-2 text-sm text-muted-foreground">{selectedVersion.status === 'DRAFT' ? labels.profileRequired : labels.readOnly}</p></div>
        <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-medium">{labels.validFrom}<input className="form-field" disabled={selectedVersion.status !== 'DRAFT'} type="date" value={selectedVersion.valid_from ?? ''} onChange={(event) => setEditor((current) => current ? { ...current, versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, valid_from: event.target.value || null } : version) } : current)} /></label><label className="grid gap-1 text-sm font-medium">{labels.validUntil}<input className="form-field" disabled={selectedVersion.status !== 'DRAFT'} type="date" value={selectedVersion.valid_until ?? ''} onChange={(event) => setEditor((current) => current ? { ...current, versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, valid_until: event.target.value || null } : version) } : current)} /></label><label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.purpose}<textarea className="form-field min-h-20" disabled={selectedVersion.status !== 'DRAFT'} value={selectedVersion.purpose ?? ''} onChange={(event) => setEditor((current) => current ? { ...current, versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, purpose: event.target.value } : version) } : current)} /></label><label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.summary}<textarea className="form-field min-h-20" disabled={selectedVersion.status !== 'DRAFT'} value={selectedVersion.summary ?? ''} onChange={(event) => setEditor((current) => current ? { ...current, versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, summary: event.target.value } : version) } : current)} /></label><label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.organizationalContext}<textarea className="form-field min-h-20" disabled={selectedVersion.status !== 'DRAFT'} value={selectedVersion.organizational_context ?? ''} onChange={(event) => setEditor((current) => current ? { ...current, versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, organizational_context: event.target.value } : version) } : current)} /></label>{[['tasks', labels.tasks], ['responsibilities', labels.responsibilities], ['result_areas', labels.resultAreas]].map(([key, label]) => <label className="grid gap-1 text-sm font-medium" key={key as string}>{label}<textarea className="form-field min-h-28" disabled={selectedVersion.status !== 'DRAFT'} value={listText(selectedVersion[key as 'tasks' | 'responsibilities' | 'result_areas'])} onChange={(event) => setEditor((current) => current ? { ...current, versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, [key as string]: listValue(event.target.value) } : version) } : current)} /></label>)}</div>
        {selectedVersion.status === 'DRAFT' ? <button className="button-primary inline-flex items-center gap-2" disabled={saving} onClick={() => void saveVersion(selectedVersion)} type="button"><Save size={15} />{labels.save}</button> : null}
        <section className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{labels.requirements}</h3><span className="text-sm text-muted-foreground">{selectedRequirements.length}</span></div>{selectedRequirements.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.noRequirements}</p> : <div className="mt-3 space-y-3">{selectedRequirements.map((requirement) => <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(10rem,1fr)_10rem_minmax(10rem,1fr)_auto] md:items-end" key={requirement.id}><div><p className="font-medium">{requirement.capability?.name ?? labels.empty}</p><p className="text-xs text-muted-foreground">{requirement.capability?.capability_type ?? ''}</p></div><label className="grid gap-1 text-xs font-medium">{labels.importance}<select className="form-field" disabled={selectedVersion.status !== 'DRAFT'} value={requirement.requirement_type} onChange={(event) => setEditor((current) => current ? { ...current, requirements: { ...current.requirements, [selectedVersion.id]: current.requirements[selectedVersion.id].map((item) => item.id === requirement.id ? { ...item, requirement_type: event.target.value } : item) } } : current)}><option value="REQUIRED">{labels.required}</option><option value="IMPORTANT">{labels.important}</option><option value="OPTIONAL">{labels.optional}</option></select></label><label className="grid gap-1 text-xs font-medium">{labels.rationale}<input className="form-field" disabled={selectedVersion.status !== 'DRAFT'} value={requirement.rationale ?? ''} onChange={(event) => setEditor((current) => current ? { ...current, requirements: { ...current.requirements, [selectedVersion.id]: current.requirements[selectedVersion.id].map((item) => item.id === requirement.id ? { ...item, rationale: event.target.value } : item) } } : current)} /></label>{selectedVersion.status === 'DRAFT' ? <div className="flex gap-2"><button aria-label={`${labels.save}: ${requirement.capability?.name ?? labels.capability}`} className="button-secondary px-2" disabled={saving} onClick={() => void saveRequirement(requirement)} type="button"><Save size={15} /></button><button aria-label={`${labels.remove}: ${requirement.capability?.name ?? labels.capability}`} className="button-secondary px-2 text-destructive" disabled={saving} onClick={() => void removeRequirement(requirement.id)} type="button"><Trash2 size={15} /></button></div> : null}</div>)}</div>}{selectedVersion.status === 'DRAFT' ? <div className="mt-4 grid gap-2 rounded-lg bg-muted/40 p-3 md:grid-cols-5"><label className="grid gap-1 text-xs font-medium md:col-span-2">{labels.capability}<select className="form-field" value={requirementDraft.capabilityId} onChange={(event) => setRequirementDraft((current) => ({ ...current, capabilityId: event.target.value }))}><option value="">{labels.all}</option>{foundation.capabilities.filter((capability) => capability.status === 'ACTIVE' && !selectedRequirements.some((requirement) => requirement.capability_id === capability.id)).map((capability) => <option key={capability.id} value={capability.id}>{capability.name}</option>)}</select></label><label className="grid gap-1 text-xs font-medium">{labels.importance}<select className="form-field" value={requirementDraft.requirementType} onChange={(event) => setRequirementDraft((current) => ({ ...current, requirementType: event.target.value }))}><option value="REQUIRED">{labels.required}</option><option value="IMPORTANT">{labels.important}</option><option value="OPTIONAL">{labels.optional}</option></select></label><label className="grid gap-1 text-xs font-medium">{labels.targetLevel}<select className="form-field" value={requirementDraft.targetLevelId} onChange={(event) => setRequirementDraft((current) => ({ ...current, targetLevelId: event.target.value }))}><option value="">{labels.all}</option>{foundation.levels.map((level: Level) => <option key={level.id} value={level.id}>{level.code} · {level.name}</option>)}</select></label><button className="button-secondary inline-flex items-center justify-center gap-2" disabled={saving || !requirementDraft.capabilityId} onClick={() => void addRequirement()} type="button"><Plus size={15} />{labels.addRequirement}</button></div> : null}</section>
        {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      </div> : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{labels.empty}</p>}
    </section>
  <Dialog closeLabel={labels.profileCreateCancel} description={labels.profileCreateDescription} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={saving} onClick={() => setCreateOpen(false)} size="sm" type="button" variant="secondary">{labels.profileCreateCancel}</Button><Button disabled={!createJobId || saving} form="talent-profile-create-form" loading={saving} size="sm" type="submit">{labels.profileCreateOpen}</Button></div>} onOpenChange={(open) => { if (!saving) setCreateOpen(open) }} open={createOpen} panelClassName="max-w-2xl" title={labels.profileCreateTitle}>
      <form className="grid gap-4" id="talent-profile-create-form" onSubmit={(event) => void createProfile(event)}>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.job}</span><DropdownSelect aria-label={labels.job} onChange={(event) => setCreateJobId(event.target.value)} searchable searchPlaceholder={labels.search} value={createJobId}><option value="">{labels.profileCreateSelectJob}</option>{profileOptions.map((option) => <option key={option.jobId} value={option.jobId}>{option.jobCode}{option.groupName ? ' · ' + option.groupName : ''}{option.seniorityName ? ' · ' + option.seniorityName : ''}</option>)}</DropdownSelect></label>
        {selectedCreateOption ? <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><h3 className="text-sm font-semibold">{labels.profileCreateEmployees}</h3>{selectedCreateOption.employees.length > 0 ? <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{selectedCreateOption.employees.map((employee) => <li key={employee.id}>{employee.label} · {employee.employeeNumber}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{labels.profileCreateNoEmployees}</p>}</div> : null}
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.profileCreatePurpose}</span><textarea className="form-field min-h-20" maxLength={4000} onChange={(event) => setCreatePurpose(event.target.value)} value={createPurpose} /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.profileCreateSummary}</span><textarea className="form-field min-h-20" maxLength={4000} onChange={(event) => setCreateSummary(event.target.value)} value={createSummary} /></label>
        {message ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      </form>
    </Dialog>
  </div>
}

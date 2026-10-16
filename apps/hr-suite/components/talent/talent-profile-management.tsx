'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Json } from '@scope/db'
import { AlertCircle, CheckCircle2, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { ScrollableTabs, TabButton } from '@/components/patterns/scrollable-tabs'
import { getProfileActivationIssues, getProfileVersionPeriodState } from '@/lib/talent/profile-management'
import type { listTalentFoundation, listTalentProfileCreateOptions, listTalentProfileManagement, getTalentProfileDashboard } from '@/lib/talent/service'

type Profiles = Awaited<ReturnType<typeof listTalentProfileManagement>>
type CreateOptions = Awaited<ReturnType<typeof listTalentProfileCreateOptions>>
type Foundation = Awaited<ReturnType<typeof listTalentFoundation>>
type Dashboard = Awaited<ReturnType<typeof getTalentProfileDashboard>>
type Profile = Profiles[number]
type Version = Profile['versions'][number]
type Requirement = Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>>['requirements'][string][number]
type Level = Foundation['levels'][number]
type ProfileTabId = 'general' | 'competencies' | 'skills' | 'knowledge' | 'languages' | 'certificates' | 'tasks' | 'responsibilities' | 'resultAreas' | 'history'
type ProfileFilter = 'all' | 'active' | 'draft' | 'missing' | 'invalid'

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
  invalidActiveReferences: string
  levelModelStatus: string
  seniorityCount: string
  auditUnavailable: string
  noRecentChanges: string
  activityAction: string
  activityObject: string
  activityActor: string
  activityCreate: string
  activityUpdate: string
  activityDelete: string
  activityActivate: string
  activityStatusTransition: string
  unknownObject: string
  profilesFilter: string
  filterActive: string
  filterDraft: string
  filterMissing: string
  filterInvalid: string
  unprofiledJobs: string
  versions: string
  version: string
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
  versionConflict: string
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
  certificateDetails: string
  rationale: string
  remove: string
  noRequirements: string
  noAvailableCapabilities: string
  selectCapability: string
  selectLevel: string
  selectLanguageLevel: string
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
  profileSections: string
  previousTab: string
  nextTab: string
  tabGeneral: string
  tabCompetencies: string
  tabSkills: string
  tabKnowledge: string
  tabLanguages: string
  tabCertificates: string
  tabTasks: string
  tabResponsibilities: string
  tabResultAreas: string
  tabHistory: string
  activationTitle: string
  activationDescription: string
  activationChecklist: string
  activationDateCheck: string
  activationPeriodCheck: string
  activationRequirementsCheck: string
  activationUnsavedCheck: string
  activationComplete: string
  activationIncomplete: string
  activationNeedsCorrection: string
  activationExistingVersion: string
  activationNoExistingVersion: string
  activationConfirm: string
  activationCancel: string
  activationBlocked: string
}

const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

function listText(value: unknown): string {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join('\n') : ''
}

function listValue(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function statusLabel(status: string, labels: Labels): string {
  return status === 'DRAFT' ? labels.draft : status === 'ACTIVE' ? labels.active : labels.inactive
}

function periodLabel(version: Version, labels: Labels, today: string): string {
  const state = getProfileVersionPeriodState(version, today)
  if (state === 'DRAFT') return labels.draft
  if (state === 'CURRENT') return labels.current
  if (state === 'PLANNED') return labels.planned
  return labels.inactive
}

function versionLabel(version: Version, labels: Labels, today: string): string {
  const start = version.valid_from ?? labels.draft
  return 'v' + version.version_number + ' · ' + start + ' · ' + periodLabel(version, labels, today)
}

function certificateDetailsText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('details' in value)) return ''
  return typeof value.details === 'string' ? value.details : ''
}

function isJsonValue(value: unknown): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  return typeof value === 'object' && Object.values(value).every(isJsonValue)
}

function withCertificateDetails(value: unknown, details: string): Json | null {
  const result: Record<string, Json> = {}
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, current] of Object.entries(value)) {
      if (isJsonValue(current)) result[key] = current
    }
  }
  if (details.trim()) result.details = details.trim()
  else delete result.details
  return Object.keys(result).length > 0 ? result : null
}

function actionLabel(action: string, labels: Labels): string {
  switch (action.toLocaleUpperCase('en-US')) {
    case 'CREATE': return labels.activityCreate
    case 'UPDATE': return labels.activityUpdate
    case 'DELETE': return labels.activityDelete
    case 'ACTIVATE': return labels.activityActivate
    case 'STATUS_TRANSITION': return labels.activityStatusTransition
    default: return action
  }
}

function entityLabel(entityName: string, labels: Labels): string {
  switch (entityName) {
    case 'job_profiles': return labels.profile
    case 'job_profile_versions': return labels.versionHistory
    case 'job_profile_capability_requirements': return labels.requirements
    default: return labels.unknownObject
  }
}

export function TalentProfileManagement({ initial, foundation, createOptions, dashboard: initialDashboard, labels }: {
  initial: Profiles
  foundation: Foundation
  createOptions: CreateOptions
  dashboard: Dashboard
  labels: Labels
}) {
  const [profiles, setProfiles] = useState(initial)
  const [profileOptions, setProfileOptions] = useState(createOptions)
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [createOpen, setCreateOpen] = useState(false)
  const [createJobId, setCreateJobId] = useState(createOptions[0]?.jobId ?? '')
  const [createPurpose, setCreatePurpose] = useState('')
  const [createSummary, setCreateSummary] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState(initial[0]?.profile.id ?? '')
  const [editor, setEditor] = useState<Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>> | null>(null)
  const [versionId, setVersionId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProfileFilter>('all')
  const [activeTab, setActiveTab] = useState<ProfileTabId>('general')
  const [activationOpen, setActivationOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dirtyRequirementIds, setDirtyRequirementIds] = useState<Set<string>>(new Set())
  const [requirementDraft, setRequirementDraft] = useState({
    capabilityId: '',
    requirementType: 'REQUIRED',
    targetLevelId: '',
    languageLevel: '',
    certificateDetails: '',
    rationale: '',
  })

  const today = new Date().toISOString().slice(0, 10)
  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return profiles.filter((item) => {
      const hasCurrent = item.versions.some((version) => getProfileVersionPeriodState(version, today) === 'CURRENT')
      const hasDraft = item.versions.some((version) => version.status === 'DRAFT')
      const matchesFilter = filter === 'all'
        || (filter === 'active' && hasCurrent)
        || (filter === 'draft' && hasDraft)
        || (filter === 'missing' && !hasCurrent)
        || (filter === 'invalid' && dashboard.invalidProfileIds.includes(item.profile.id))
      const matchesSearch = !query || [item.job.code, item.group?.name ?? '', item.family?.name ?? '', item.seniority?.name ?? '']
        .some((value) => value.toLocaleLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [dashboard.invalidProfileIds, filter, profiles, search, today])

  const visibleProfileOptions = filter === 'missing'
    ? profileOptions.filter((item) => {
      const query = search.trim().toLocaleLowerCase()
      return !query || [item.jobCode, item.groupName ?? '', item.seniorityName ?? ''].some((value) => value.toLocaleLowerCase().includes(query))
    })
    : []
  const selected = visibleProfiles.find((item) => item.profile.id === selectedProfileId) ?? visibleProfiles[0]
  const selectedProfileKey = selected?.profile.id ?? null
  const selectedCreateOption = profileOptions.find((item) => item.jobId === createJobId)
  const activeEditor = selected && editor?.profile.id === selected.profile.id ? editor : null

  useEffect(() => {
    if (!selectedProfileKey) return
    const controller = new AbortController()
    let current = true
    async function loadSelectedProfile() {
      try {
        const response = await fetch('/api/talent/job-profiles/' + selectedProfileKey, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('TALENT_PROFILE_EDITOR_READ_FAILED')
        const payload = await response.json() as { data: Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>> }
        if (!current) return
        setEditor(payload.data)
        setVersionId(payload.data.versions.find((version) => version.status === 'DRAFT')?.id ?? payload.data.versions[0]?.id ?? '')
        setDirtyRequirementIds(new Set())
        setMessage(null)
      } catch {
        if (current) setMessage(labels.failed)
      }
    }
    void loadSelectedProfile()
    return () => {
      current = false
      controller.abort()
    }
  }, [labels.failed, selectedProfileKey])
  const selectedVersion = activeEditor?.versions.find((version) => version.id === versionId)
    ?? activeEditor?.versions.find((version) => version.status === 'DRAFT')
    ?? activeEditor?.versions[0]
  const selectedRequirements = selectedVersion && activeEditor ? activeEditor.requirements[selectedVersion.id] ?? [] : []
  const activeCount = profiles.filter((item) => item.versions.some((version) => getProfileVersionPeriodState(version, today) === 'CURRENT')).length
  const draftCount = profiles.reduce((count, item) => count + item.versions.filter((version) => version.status === 'DRAFT').length, 0)
  const missingActiveCount = profiles.filter((item) => !item.versions.some((version) => getProfileVersionPeriodState(version, today) === 'CURRENT')).length + profileOptions.length
  const invalidProfileCount = dashboard.invalidProfileIds.length
  const activeLevelModel = foundation.models.find((model) => model.status === 'ACTIVE')
  const selectedCapabilityType = activeTab === 'competencies' ? 'COMPETENCY'
    : activeTab === 'skills' ? 'SKILL'
      : activeTab === 'knowledge' ? 'KNOWLEDGE'
        : activeTab === 'languages' ? 'LANGUAGE'
          : activeTab === 'certificates' ? 'CERTIFICATE'
            : null
  const capabilityReferences = foundation.capabilities.map((capability) => ({
    id: capability.id,
    capability_type: capability.capability_type,
    status: capability.status,
  }))
  const activationIssues = selectedVersion
    ? getProfileActivationIssues({
      validFrom: selectedVersion.valid_from,
      validUntil: selectedVersion.valid_until,
      requirements: selectedRequirements,
      capabilities: capabilityReferences,
      levelIds: new Set(foundation.levels.map((level) => level.id)),
    })
    : []
  const activationHasRequirementIssues = activationIssues.some((issue) => Boolean(issue.requirementId))
  const activationCanProceed = selectedVersion?.status === 'DRAFT'
    && activationIssues.length === 0
    && dirtyRequirementIds.size === 0
  const existingVersionAtStart = selected && selectedVersion?.valid_from
    ? selected.versions.find((version) => version.status === 'ACTIVE'
      && version.id !== selectedVersion.id
      && (!version.valid_from || version.valid_from <= (selectedVersion.valid_from ?? ''))
      && (!version.valid_until || version.valid_until > (selectedVersion.valid_from ?? '')))
    : undefined
  const tabs: { id: ProfileTabId; label: string }[] = [
    { id: 'general', label: labels.tabGeneral },
    { id: 'competencies', label: labels.tabCompetencies },
    { id: 'skills', label: labels.tabSkills },
    { id: 'knowledge', label: labels.tabKnowledge },
    { id: 'languages', label: labels.tabLanguages },
    { id: 'certificates', label: labels.tabCertificates },
    { id: 'tasks', label: labels.tabTasks },
    { id: 'responsibilities', label: labels.tabResponsibilities },
    { id: 'resultAreas', label: labels.tabResultAreas },
    { id: 'history', label: labels.tabHistory },
  ]

  function applyFilter(nextFilter: ProfileFilter) {
    setFilter(nextFilter)
    setSearch('')
    setSelectedProfileId('')
    setEditor(null)
    setVersionId('')
    setActiveTab('general')
  }

  function updateSelectedVersion(patch: Partial<Version>) {
    if (!selectedVersion) return
    setEditor((current) => current ? {
      ...current,
      versions: current.versions.map((version) => version.id === selectedVersion.id ? { ...version, ...patch } : version),
    } : current)
  }

  function updateRequirement(requirementId: string, patch: Partial<Requirement>) {
    if (!selectedVersion) return
    setEditor((current) => current ? {
      ...current,
      requirements: {
        ...current.requirements,
        [selectedVersion.id]: (current.requirements[selectedVersion.id] ?? []).map((requirement) => requirement.id === requirementId
          ? { ...requirement, ...patch }
          : requirement),
      },
    } : current)
    setDirtyRequirementIds((current) => new Set(current).add(requirementId))
  }

  function loadProfile(profileId: string) {
    setSelectedProfileId(profileId)
    setVersionId('')
    setActiveTab('general')
    setDirtyRequirementIds(new Set())
    setMessage(null)
  }

  async function refresh(profileId = selectedProfileId): Promise<boolean> {
    const [profilesResponse, editorResponse, optionsResponse, dashboardResponse] = await Promise.all([
      fetch('/api/talent/job-profiles', { cache: 'no-store' }),
      profileId ? fetch('/api/talent/job-profiles/' + profileId, { cache: 'no-store' }) : Promise.resolve(null),
      fetch('/api/talent/job-profiles/options', { cache: 'no-store' }),
      fetch('/api/talent/job-profiles/dashboard', { cache: 'no-store' }),
    ])
    if (!profilesResponse.ok || !optionsResponse.ok || !dashboardResponse.ok || (editorResponse && !editorResponse.ok)) {
      setMessage(labels.failed)
      return false
    }
    const profilePayload = await profilesResponse.json() as { data: Profiles }
    const optionsPayload = await optionsResponse.json() as { data: CreateOptions }
    const dashboardPayload = await dashboardResponse.json() as { data: Dashboard }
    setProfiles(profilePayload.data)
    setProfileOptions(optionsPayload.data)
    setDashboard(dashboardPayload.data)
    setDirtyRequirementIds(new Set())
    if (profileId) setSelectedProfileId(profileId)
    if (editorResponse) {
      const editorPayload = await editorResponse.json() as { data: Awaited<ReturnType<typeof import('@/lib/talent/service').getTalentProfileEditor>> }
      setEditor(editorPayload.data)
      setVersionId((current) => editorPayload.data.versions.some((version) => version.id === current)
        ? current
        : editorPayload.data.versions.find((version) => version.status === 'DRAFT')?.id ?? editorPayload.data.versions[0]?.id ?? '')
    }
    return true
  }

  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!response.ok) {
        setMessage(response.status === 409 ? labels.versionConflict : response.status === 422 ? labels.activationBlocked : labels.failed)
        if (response.status === 409 && selectedProfileId) await refresh(selectedProfileId)
        return null
      }
      setMessage(labels.saved)
      return response
    } catch {
      setMessage(labels.failed)
      return null
    } finally {
      setSaving(false)
    }
  }

  function versionUpdateBody(version: Version) {
    return {
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
  }

  async function saveVersion(version: Version) {
    if (version.status !== 'DRAFT') return
    if (await request('/api/talent/profile-versions/' + version.id, 'PATCH', versionUpdateBody(version))) await refresh()
  }

  async function copyVersion() {
    if (!selected || !selectedVersion || activeEditor?.versions.some((version) => version.status === 'DRAFT')) return
    const response = await request('/api/talent/job-profiles/' + selected.profile.id + '/versions', 'POST', { sourceVersionId: selectedVersion.id })
    if (response) {
      await refresh()
      setActiveTab('general')
    }
  }

  async function activateVersion() {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT' || !activationCanProceed) return
    const saved = await request('/api/talent/profile-versions/' + selectedVersion.id, 'PATCH', versionUpdateBody(selectedVersion))
    if (!saved) return
    const savedPayload = await saved.json() as { data: Version }
    const activated = await request('/api/talent/profile-versions/' + selectedVersion.id + '/activate', 'POST', {
      validFrom: selectedVersion.valid_from,
      validUntil: selectedVersion.valid_until,
      updatedAt: savedPayload.data.updated_at,
    })
    if (activated) {
      setActivationOpen(false)
      await refresh()
    }
  }

  function clearRequirementDirty(requirementId: string) {
    setDirtyRequirementIds((current) => {
      const next = new Set(current)
      next.delete(requirementId)
      return next
    })
  }

  async function addRequirement() {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT' || !requirementDraft.capabilityId) return
    const capability = foundation.capabilities.find((item) => item.id === requirementDraft.capabilityId)
    const response = await request('/api/talent/profile-versions/' + selectedVersion.id + '/requirements', 'POST', {
      capabilityId: requirementDraft.capabilityId,
      requirementType: requirementDraft.requirementType,
      targetLevelId: capability && ['COMPETENCY', 'SKILL', 'KNOWLEDGE'].includes(capability.capability_type) ? requirementDraft.targetLevelId || null : null,
      languageLevel: capability?.capability_type === 'LANGUAGE' ? requirementDraft.languageLevel || null : null,
      certificateDetails: capability?.capability_type === 'CERTIFICATE'
        ? (requirementDraft.certificateDetails.trim() ? { details: requirementDraft.certificateDetails.trim() } : null)
        : null,
      rationale: requirementDraft.rationale || null,
      sortOrder: selectedRequirements.length + 1,
    })
    if (response) {
      setRequirementDraft({ capabilityId: '', requirementType: 'REQUIRED', targetLevelId: '', languageLevel: '', certificateDetails: '', rationale: '' })
      await refresh()
    }
  }

  async function saveRequirement(requirement: Requirement) {
    if (!selectedVersion || selectedVersion.status !== 'DRAFT') return
    const response = await request('/api/talent/profile-requirements/' + requirement.id, 'PATCH', {
      capabilityId: requirement.capability_id,
      requirementType: requirement.requirement_type,
      targetLevelId: requirement.target_level_id,
      languageLevel: requirement.language_level,
      certificateDetails: withCertificateDetails(requirement.certificate_details, certificateDetailsText(requirement.certificate_details)),
      rationale: requirement.rationale,
      sortOrder: requirement.sort_order,
    })
    if (response) {
      clearRequirementDirty(requirement.id)
      await refresh()
    }
  }

  async function removeRequirement(requirementId: string) {
    if (await request('/api/talent/profile-requirements/' + requirementId, 'DELETE')) await refresh()
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!createJobId) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/talent/job-profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jobId: createJobId, purpose: createPurpose.trim() || null, summary: createSummary.trim() || null }),
      })
      if (!response.ok) {
        setMessage(response.status === 409 ? labels.versionConflict : labels.failed)
        return
      }
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

  function openCreateProfile(jobId: string) {
    setMessage(null)
    setCreateJobId(jobId)
    setCreateOpen(true)
  }

  function selectTab(tab: ProfileTabId) {
    setActiveTab(tab)
    if (['competencies', 'skills', 'knowledge', 'languages', 'certificates'].includes(tab)) {
      setRequirementDraft({ capabilityId: '', requirementType: 'REQUIRED', targetLevelId: '', languageLevel: '', certificateDetails: '', rationale: '' })
    }
  }

  function activationCheck(label: string, complete: boolean) {
    return <li className="flex items-start gap-2 text-sm">
      {complete
        ? <CheckCircle2 aria-label={labels.activationComplete} className="mt-0.5 size-4 shrink-0 text-foreground" />
        : <AlertCircle aria-label={labels.activationIncomplete} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span>{label}</span>
    </li>
  }

  function renderRequirementTarget(requirement: Requirement) {
    const capabilityType = requirement.capability?.capability_type
    if (capabilityType === 'LANGUAGE') {
      return <label className="grid gap-1 text-xs font-medium">
        {labels.languageLevel}
        <DropdownSelect aria-label={labels.languageLevel} disabled={selectedVersion?.status !== 'DRAFT'} onChange={(event) => updateRequirement(requirement.id, { language_level: event.target.value || null })} searchable searchPlaceholder={labels.search} value={requirement.language_level ?? ''}>
          <option value="">{labels.selectLanguageLevel}</option>
          {cefrLevels.map((level) => <option key={level} value={level}>{level}</option>)}
        </DropdownSelect>
      </label>
    }
    if (capabilityType === 'CERTIFICATE') {
      return <label className="grid gap-1 text-xs font-medium">
        {labels.certificateDetails}
        <textarea className="form-field min-h-16" disabled={selectedVersion?.status !== 'DRAFT'} onChange={(event) => updateRequirement(requirement.id, { certificate_details: withCertificateDetails(requirement.certificate_details, event.target.value) })} value={certificateDetailsText(requirement.certificate_details)} />
      </label>
    }
    if (capabilityType === 'COMPETENCY' || capabilityType === 'SKILL' || capabilityType === 'KNOWLEDGE') {
      return <label className="grid gap-1 text-xs font-medium">
        {labels.targetLevel}
        <DropdownSelect aria-label={labels.targetLevel} disabled={selectedVersion?.status !== 'DRAFT'} onChange={(event) => updateRequirement(requirement.id, { target_level_id: event.target.value || null })} searchable searchPlaceholder={labels.search} value={requirement.target_level_id ?? ''}>
          <option value="">{labels.selectLevel}</option>
          {foundation.levels.map((level: Level) => <option key={level.id} value={level.id}>{level.code} · {level.name}</option>)}
        </DropdownSelect>
      </label>
    }
    return <p className="text-xs text-muted-foreground">{labels.activationNeedsCorrection}</p>
  }

  function renderCapabilityRequirements(capabilityType: string) {
    const requirements = selectedRequirements.filter((requirement) => requirement.capability?.capability_type === capabilityType)
    const availableCapabilities = foundation.capabilities.filter((capability) => capability.status === 'ACTIVE'
      && capability.capability_type === capabilityType
      && !selectedRequirements.some((requirement) => requirement.capability_id === capability.id))
    const selectedCapability = foundation.capabilities.find((capability) => capability.id === requirementDraft.capabilityId)
    const showLevel = selectedCapability && ['COMPETENCY', 'SKILL', 'KNOWLEDGE'].includes(selectedCapability.capability_type)
    const showLanguage = selectedCapability?.capability_type === 'LANGUAGE'
    const showCertificate = selectedCapability?.capability_type === 'CERTIFICATE'

    return <section className="space-y-4" aria-label={labels.requirements}>
      {requirements.length === 0
        ? <p className="text-sm text-muted-foreground">{labels.noRequirements}</p>
        : <div className="divide-y divide-border-subtle border-y border-border-subtle">
          {requirements.map((requirement) => <div className="grid gap-3 py-4 lg:grid-cols-[minmax(9rem,1fr)_10rem_minmax(12rem,1fr)_minmax(12rem,1.3fr)_auto]" key={requirement.id}>
            <div className="min-w-0">
              <p className="font-medium">{requirement.capability?.name ?? labels.empty}</p>
              <p className="text-xs text-muted-foreground">{requirement.capability?.capability_type ?? ''}</p>
            </div>
            <label className="grid gap-1 text-xs font-medium">
              {labels.importance}
              <DropdownSelect aria-label={labels.importance} disabled={selectedVersion?.status !== 'DRAFT'} onChange={(event) => updateRequirement(requirement.id, { requirement_type: event.target.value })} searchable searchPlaceholder={labels.search} value={requirement.requirement_type}>
                <option value="REQUIRED">{labels.required}</option>
                <option value="IMPORTANT">{labels.important}</option>
                <option value="OPTIONAL">{labels.optional}</option>
              </DropdownSelect>
            </label>
            {renderRequirementTarget(requirement)}
            <label className="grid gap-1 text-xs font-medium">
              {labels.rationale}
              <input className="form-field" disabled={selectedVersion?.status !== 'DRAFT'} onChange={(event) => updateRequirement(requirement.id, { rationale: event.target.value || null })} value={requirement.rationale ?? ''} />
            </label>
            {selectedVersion?.status === 'DRAFT'
              ? <div className="flex items-end gap-2">
                <Button aria-label={labels.save + ': ' + (requirement.capability?.name ?? labels.capability)} disabled={saving || !dirtyRequirementIds.has(requirement.id)} onClick={() => void saveRequirement(requirement)} size="sm" type="button" variant="secondary"><Save aria-hidden="true" size={15} /></Button>
                <Button aria-label={labels.remove + ': ' + (requirement.capability?.name ?? labels.capability)} disabled={saving} onClick={() => void removeRequirement(requirement.id)} size="sm" type="button" variant="secondary"><Trash2 aria-hidden="true" size={15} /></Button>
              </div>
              : null}
          </div>)}
        </div>}
      {selectedVersion?.status === 'DRAFT'
        ? <div className="space-y-3 border-t border-border-subtle pt-4">
          {availableCapabilities.length > 0
            ? <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                {labels.capability}
                <DropdownSelect aria-label={labels.capability} onChange={(event) => {
                  const capability = foundation.capabilities.find((item) => item.id === event.target.value)
                  setRequirementDraft((current) => ({
                    ...current,
                    capabilityId: event.target.value,
                    targetLevelId: '',
                    languageLevel: capability?.language_cefr ?? '',
                    certificateDetails: '',
                  }))
                }} searchable searchPlaceholder={labels.search} value={requirementDraft.capabilityId}>
                  <option value="">{labels.selectCapability}</option>
                  {availableCapabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.code} · {capability.name}</option>)}
                </DropdownSelect>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                {labels.importance}
                <DropdownSelect aria-label={labels.importance} onChange={(event) => setRequirementDraft((current) => ({ ...current, requirementType: event.target.value }))} searchable searchPlaceholder={labels.search} value={requirementDraft.requirementType}>
                  <option value="REQUIRED">{labels.required}</option>
                  <option value="IMPORTANT">{labels.important}</option>
                  <option value="OPTIONAL">{labels.optional}</option>
                </DropdownSelect>
              </label>
              {showLevel
                ? <label className="grid gap-1 text-sm font-medium">
                  {labels.targetLevel}
                  <DropdownSelect aria-label={labels.targetLevel} onChange={(event) => setRequirementDraft((current) => ({ ...current, targetLevelId: event.target.value }))} searchable searchPlaceholder={labels.search} value={requirementDraft.targetLevelId}>
                    <option value="">{labels.selectLevel}</option>
                    {foundation.levels.map((level: Level) => <option key={level.id} value={level.id}>{level.code} · {level.name}</option>)}
                  </DropdownSelect>
                </label>
                : null}
              {showLanguage
                ? <label className="grid gap-1 text-sm font-medium">
                  {labels.languageLevel}
                  <DropdownSelect aria-label={labels.languageLevel} onChange={(event) => setRequirementDraft((current) => ({ ...current, languageLevel: event.target.value }))} searchable searchPlaceholder={labels.search} value={requirementDraft.languageLevel}>
                    <option value="">{labels.selectLanguageLevel}</option>
                    {cefrLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </DropdownSelect>
                </label>
                : null}
              {showCertificate
                ? <label className="grid gap-1 text-sm font-medium md:col-span-2">
                  {labels.certificateDetails}
                  <textarea className="form-field min-h-16" onChange={(event) => setRequirementDraft((current) => ({ ...current, certificateDetails: event.target.value }))} value={requirementDraft.certificateDetails} />
                </label>
                : null}
              <label className="grid gap-1 text-sm font-medium">
                {labels.rationale}
                <input className="form-field" onChange={(event) => setRequirementDraft((current) => ({ ...current, rationale: event.target.value }))} value={requirementDraft.rationale} />
              </label>
              <div className="flex items-end">
                <Button disabled={saving || !requirementDraft.capabilityId} onClick={() => void addRequirement()} size="sm" type="button"><Plus aria-hidden="true" size={15} />{labels.addRequirement}</Button>
              </div>
            </div>
            : <p className="text-sm text-muted-foreground">{labels.noAvailableCapabilities}</p>}
        </div>
        : null}
    </section>
  }

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow">{labels.dashboard}</p>
        <h2 className="text-xl font-semibold">{labels.profiles}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{labels.profileCreateDescription}</p>
      </div>
      <Button disabled={profileOptions.length === 0 || saving} onClick={() => openCreateProfile(profileOptions[0]?.jobId ?? '')} size="sm" type="button"><Plus aria-hidden="true" />{labels.profileCreateOpen}</Button>
    </header>

    {profileOptions.length === 0 && profiles.length === 0 ? <p className="text-sm text-muted-foreground">{labels.profileCreateUnavailable}</p> : null}

    <div aria-label={labels.counts} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <button aria-label={labels.functions + ': ' + profiles.length} className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => applyFilter('all')} type="button">
        <span className="block text-sm font-medium">{labels.functions}</span><span className="mt-2 block text-2xl font-semibold">{profiles.length}</span>
      </button>
      <button aria-label={labels.activeProfiles + ': ' + activeCount} className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => applyFilter('active')} type="button">
        <span className="block text-sm font-medium">{labels.activeProfiles}</span><span className="mt-2 block text-2xl font-semibold">{activeCount}</span>
      </button>
      <button aria-label={labels.draftVersions + ': ' + draftCount} className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => applyFilter('draft')} type="button">
        <span className="block text-sm font-medium">{labels.draftVersions}</span><span className="mt-2 block text-2xl font-semibold">{draftCount}</span>
      </button>
      <button aria-label={labels.missingActive + ': ' + missingActiveCount} className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => applyFilter('missing')} type="button">
        <span className="block text-sm font-medium">{labels.missingActive}</span><span className="mt-2 block text-2xl font-semibold">{missingActiveCount}</span>
      </button>
      <button aria-label={labels.invalidActiveReferences + ': ' + invalidProfileCount} className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => applyFilter('invalid')} type="button">
        <span className="block text-sm font-medium">{labels.invalidActiveReferences}</span><span className="mt-2 block text-2xl font-semibold">{invalidProfileCount}</span>
      </button>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <Surface className="p-4"><p className="text-sm font-medium">{labels.capabilities}</p><p className="mt-2 text-2xl font-semibold">{foundation.capabilities.length}</p></Surface>
      <Surface className="p-4"><p className="text-sm font-medium">{labels.seniorityCount}</p><p className="mt-2 text-2xl font-semibold">{foundation.seniorities.length}</p></Surface>
      <Surface className="p-4"><p className="text-sm font-medium">{labels.levelModelStatus}</p><p className="mt-2 text-sm font-semibold">{activeLevelModel ? labels.active : foundation.models.length > 0 ? labels.inactive : labels.empty}</p></Surface>
    </div>

    <section aria-label={labels.recentChanges} className="space-y-3">
      <h3 className="text-lg font-semibold">{labels.recentChanges}</h3>
      {dashboard.auditStatus !== 'available'
        ? <p className="text-sm text-muted-foreground">{labels.auditUnavailable}</p>
        : dashboard.recentChanges.length === 0
          ? <p className="text-sm text-muted-foreground">{labels.noRecentChanges}</p>
          : <div className="overflow-x-auto border-y border-border-subtle">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead><tr className="border-b border-border-subtle text-muted-foreground"><th className="py-2 pr-4 font-medium">{labels.activityObject}</th><th className="py-2 pr-4 font-medium">{labels.activityAction}</th><th className="py-2 pr-4 font-medium">{labels.activityActor}</th><th className="py-2 font-medium">{labels.recentChanges}</th></tr></thead>
              <tbody>{dashboard.recentChanges.map((change) => <tr className="border-b border-border-subtle last:border-0" key={change.id}>
                <td className="py-2 pr-4">{change.objectName || change.entityId} <span className="text-muted-foreground">· {entityLabel(change.entityName, labels)}</span></td>
                <td className="py-2 pr-4">{actionLabel(change.action, labels)}</td>
                <td className="py-2 pr-4">{change.actorUserId ? change.actorUserId.slice(0, 8) : labels.empty}</td>
                <td className="py-2">{change.createdAt}</td>
              </tr>)}</tbody>
            </table>
          </div>}
    </section>

    {(missingActiveCount > 0 || draftCount > 0) ? <aside className="border-l-2 border-border pl-4" aria-label={labels.attention}>
      <h3 className="font-semibold">{labels.attention}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {missingActiveCount > 0 ? <li>{missingActiveCount} · {labels.missingActive}</li> : null}
        {draftCount > 0 ? <li>{draftCount} · {labels.draftAttention}</li> : null}
      </ul>
    </aside> : null}

    <section className="grid gap-5 lg:grid-cols-[minmax(18rem,24rem)_1fr]" id="talent-profile-list">
      <Surface className="min-w-0 p-4">
        <label className="grid gap-1 text-sm font-medium">{labels.search}<input className="form-field" onChange={(event) => setSearch(event.target.value)} type="search" value={search} /></label>
        <div aria-label={labels.profilesFilter} className="mt-3 flex flex-wrap gap-2">
          {[
            { id: 'all' as const, label: labels.all },
            { id: 'active' as const, label: labels.filterActive },
            { id: 'draft' as const, label: labels.filterDraft },
            { id: 'missing' as const, label: labels.filterMissing },
            { id: 'invalid' as const, label: labels.filterInvalid },
          ].map((option) => <Button aria-pressed={filter === option.id} key={option.id} onClick={() => applyFilter(option.id)} size="sm" type="button" variant={filter === option.id ? 'primary' : 'secondary'}>{option.label}</Button>)}
        </div>
        <div className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
          {visibleProfiles.map((item) => <button aria-pressed={item.profile.id === selected?.profile.id} className={'block w-full p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus ' + (item.profile.id === selected?.profile.id ? 'bg-surface-subtle' : '')} key={item.profile.id} onClick={() => void loadProfile(item.profile.id)} type="button">
            <div className="flex items-start justify-between gap-3"><span className="font-semibold">{item.job.code}</span><span className="text-xs text-muted-foreground">{item.versions.length} {labels.versions}</span></div>
            <p className="mt-1 text-sm text-muted-foreground">{item.group?.name ?? labels.empty}{item.seniority ? ' · ' + item.seniority.name : ''}</p>
          </button>)}
          {visibleProfiles.length === 0 && visibleProfileOptions.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{labels.noResults}</p> : null}
        </div>
        {visibleProfileOptions.length > 0
          ? <section aria-label={labels.unprofiledJobs} className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold">{labels.unprofiledJobs}</h3>
            <ul className="divide-y divide-border-subtle border-y border-border-subtle">
              {visibleProfileOptions.map((option) => <li className="flex items-center justify-between gap-3 py-3" key={option.jobId}>
                <span className="min-w-0 text-sm"><span className="font-medium">{option.jobCode}</span>{option.groupName ? ' · ' + option.groupName : ''}</span>
                <Button onClick={() => openCreateProfile(option.jobId)} size="sm" type="button" variant="secondary">{labels.profileCreateOpen}</Button>
              </li>)}
            </ul>
          </section>
          : null}
      </Surface>

      {selected && activeEditor && selectedVersion
        ? <Surface className="min-w-0 space-y-5 p-5">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">{labels.profile}</p>
              <h2 className="text-2xl font-semibold">{selected.job.code}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{[selected.group?.name, selected.family?.name, selected.seniority?.name].filter((value): value is string => Boolean(value)).join(' · ') || labels.empty}</p>
              <p className="mt-2 text-sm text-muted-foreground">{labels.validFrom}: {selectedVersion.valid_from ?? labels.empty}{selectedVersion.valid_until ? ' · ' + labels.validUntil + ': ' + selectedVersion.valid_until : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{statusLabel(selectedVersion.status, labels)} · {periodLabel(selectedVersion, labels, today)}</span>
              {!activeEditor.versions.some((version) => version.status === 'DRAFT')
                ? <Button disabled={saving} onClick={() => void copyVersion()} size="sm" type="button" variant="secondary"><Copy aria-hidden="true" size={15} />{labels.newVersion}</Button>
                : null}
              {selectedVersion.status === 'DRAFT'
                ? <Button disabled={saving} onClick={() => setActivationOpen(true)} size="sm" type="button"><CheckCircle2 aria-hidden="true" size={15} />{labels.activate}</Button>
                : null}
            </div>
          </header>

          <p className="text-sm text-muted-foreground">{selectedVersion.status === 'DRAFT' ? labels.profileRequired : labels.readOnly}</p>

          <ScrollableTabs ariaLabel={labels.profileSections} leftLabel={labels.previousTab} rightLabel={labels.nextTab} contentProps={{ role: 'tablist' }}>
            {tabs.map((tab) => <TabButton aria-controls={'profile-panel-' + tab.id} id={'profile-tab-' + tab.id} active={activeTab === tab.id} key={tab.id} onClick={() => selectTab(tab.id)}>{tab.label}</TabButton>)}
          </ScrollableTabs>

          <div aria-labelledby={'profile-tab-' + activeTab} className="min-w-0" id={'profile-panel-' + activeTab} role="tabpanel" tabIndex={0}>
            {activeTab === 'general'
              ? <div className="space-y-5">
                <p className="text-sm text-muted-foreground">{labels.activeDateHint}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium">{labels.validFrom}<input className="form-field" disabled={selectedVersion.status !== 'DRAFT'} onChange={(event) => updateSelectedVersion({ valid_from: event.target.value || null })} type="date" value={selectedVersion.valid_from ?? ''} /></label>
                  <label className="grid gap-1 text-sm font-medium">{labels.validUntil}<input className="form-field" disabled={selectedVersion.status !== 'DRAFT'} onChange={(event) => updateSelectedVersion({ valid_until: event.target.value || null })} type="date" value={selectedVersion.valid_until ?? ''} /></label>
                  <label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.purpose}<textarea className="form-field min-h-20" disabled={selectedVersion.status !== 'DRAFT'} onChange={(event) => updateSelectedVersion({ purpose: event.target.value })} value={selectedVersion.purpose ?? ''} /></label>
                  <label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.summary}<textarea className="form-field min-h-20" disabled={selectedVersion.status !== 'DRAFT'} onChange={(event) => updateSelectedVersion({ summary: event.target.value })} value={selectedVersion.summary ?? ''} /></label>
                  <label className="grid gap-1 text-sm font-medium md:col-span-2">{labels.organizationalContext}<textarea className="form-field min-h-20" disabled={selectedVersion.status !== 'DRAFT'} onChange={(event) => updateSelectedVersion({ organizational_context: event.target.value })} value={selectedVersion.organizational_context ?? ''} /></label>
                </div>
                {selectedVersion.status === 'DRAFT' ? <Button disabled={saving} onClick={() => void saveVersion(selectedVersion)} size="sm" type="button" variant="secondary"><Save aria-hidden="true" size={15} />{labels.save}</Button> : null}
              </div>
              : null}

            {selectedCapabilityType ? renderCapabilityRequirements(selectedCapabilityType) : null}

            {activeTab === 'tasks' || activeTab === 'responsibilities' || activeTab === 'resultAreas'
              ? <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{labels.profileRequired}</p>
                <label className="grid gap-1 text-sm font-medium">
                  {activeTab === 'tasks' ? labels.tasks : activeTab === 'responsibilities' ? labels.responsibilities : labels.resultAreas}
                  <textarea className="form-field min-h-56" disabled={selectedVersion.status !== 'DRAFT'} onChange={(event) => {
                    if (activeTab === 'tasks') updateSelectedVersion({ tasks: listValue(event.target.value) })
                    else if (activeTab === 'responsibilities') updateSelectedVersion({ responsibilities: listValue(event.target.value) })
                    else updateSelectedVersion({ result_areas: listValue(event.target.value) })
                  }} value={activeTab === 'tasks' ? listText(selectedVersion.tasks) : activeTab === 'responsibilities' ? listText(selectedVersion.responsibilities) : listText(selectedVersion.result_areas)} />
                </label>
                {selectedVersion.status === 'DRAFT' ? <Button disabled={saving} onClick={() => void saveVersion(selectedVersion)} size="sm" type="button" variant="secondary"><Save aria-hidden="true" size={15} />{labels.save}</Button> : null}
              </div>
              : null}

            {activeTab === 'history'
              ? <section aria-label={labels.versionHistory} className="space-y-3">
                <h3 className="font-semibold">{labels.versionHistory}</h3>
                <ul className="divide-y divide-border-subtle border-y border-border-subtle">
                  {activeEditor.versions.map((version) => <li key={version.id}>
                    <button aria-pressed={version.id === selectedVersion.id} className="flex w-full flex-col gap-1 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus sm:flex-row sm:items-center sm:justify-between" onClick={() => {
                      setVersionId(version.id)
                      setActiveTab('general')
                    }} type="button">
                      <span className="font-medium">{versionLabel(version, labels, today)}</span>
                      <span className="text-sm text-muted-foreground">{version.valid_until ? labels.validUntil + ': ' + version.valid_until : labels.validFrom + ': ' + (version.valid_from ?? labels.empty)}</span>
                    </button>
                  </li>)}
                </ul>
              </section>
              : null}
          </div>

          {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
        </Surface>
        : <p className="rounded-[var(--radius-surface)] border border-dashed border-border p-6 text-sm text-muted-foreground">{selected ? labels.profileRequired : labels.empty}</p>}
    </section>

    <Dialog closeLabel={labels.profileCreateCancel} description={labels.profileCreateDescription} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button disabled={saving} onClick={() => setCreateOpen(false)} size="sm" type="button" variant="secondary">{labels.profileCreateCancel}</Button>
      <Button disabled={!createJobId || saving} form="talent-profile-create-form" loading={saving} size="sm" type="submit">{labels.profileCreateOpen}</Button>
    </div>} onOpenChange={(open) => { if (!saving) setCreateOpen(open) }} open={createOpen} panelClassName="max-w-2xl" title={labels.profileCreateTitle}>
      <form className="grid gap-4" id="talent-profile-create-form" onSubmit={(event) => void createProfile(event)}>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.job}</span><DropdownSelect aria-label={labels.job} onChange={(event) => setCreateJobId(event.target.value)} searchable searchPlaceholder={labels.search} value={createJobId}>
          <option value="">{labels.profileCreateSelectJob}</option>
          {profileOptions.map((option) => <option key={option.jobId} value={option.jobId}>{option.jobCode}{option.groupName ? ' · ' + option.groupName : ''}{option.seniorityName ? ' · ' + option.seniorityName : ''}</option>)}
        </DropdownSelect></label>
        {selectedCreateOption ? <div className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle p-3">
          <h3 className="text-sm font-semibold">{labels.profileCreateEmployees}</h3>
          {selectedCreateOption.employees.length > 0
            ? <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{selectedCreateOption.employees.map((employee) => <li key={employee.id}>{employee.label} · {employee.employeeNumber}</li>)}</ul>
            : <p className="mt-2 text-sm text-muted-foreground">{labels.profileCreateNoEmployees}</p>}
        </div> : null}
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.profileCreatePurpose}</span><textarea className="form-field min-h-20" maxLength={4000} onChange={(event) => setCreatePurpose(event.target.value)} value={createPurpose} /></label>
        <label className="grid gap-1.5 text-sm font-medium"><span>{labels.profileCreateSummary}</span><textarea className="form-field min-h-20" maxLength={4000} onChange={(event) => setCreateSummary(event.target.value)} value={createSummary} /></label>
        {message ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      </form>
    </Dialog>

    <Dialog closeLabel={labels.activationCancel} description={labels.activationDescription} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button disabled={saving} onClick={() => setActivationOpen(false)} size="sm" type="button" variant="secondary">{labels.activationCancel}</Button>
      <Button disabled={!activationCanProceed || saving} loading={saving} onClick={() => void activateVersion()} size="sm" type="button">{labels.activationConfirm}</Button>
    </div>} onOpenChange={(open) => { if (!saving) setActivationOpen(open) }} open={activationOpen} panelClassName="max-w-2xl" title={labels.activationTitle}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{labels.activationDescription}</p>
        <h3 className="font-semibold">{labels.activationChecklist}</h3>
        <ul className="space-y-2">
          {activationCheck(labels.activationDateCheck, !activationIssues.some((issue) => issue.code === 'DATE_REQUIRED'))}
          {activationCheck(labels.activationPeriodCheck, !activationIssues.some((issue) => issue.code === 'DATE_RANGE_INVALID'))}
          {activationCheck(labels.activationRequirementsCheck, !activationHasRequirementIssues)}
          {activationCheck(labels.activationUnsavedCheck, dirtyRequirementIds.size === 0)}
        </ul>
        {activationIssues.length > 0 || dirtyRequirementIds.size > 0 ? <p className="text-sm text-muted-foreground">{labels.activationNeedsCorrection}</p> : null}
        <div className="border-t border-border-subtle pt-4">
          <p className="text-sm">{existingVersionAtStart ? labels.activationExistingVersion : labels.activationNoExistingVersion}</p>
          <p className="mt-1 text-sm text-muted-foreground">{labels.validFrom}: {selectedVersion?.valid_from ?? labels.empty}</p>
        </div>
      </div>
    </Dialog>
  </div>
}

'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { SettingsAccordion } from '@/components/settings/settings-accordion'
import { TalentEmployeeCapabilityRecords } from '@/components/talent/talent-employee-capability-records'
import { TalentFoundationManager } from '@/components/talent/talent-foundation-manager'
import { TalentNotificationPanel } from '@/components/talent/talent-notification-panel'
import { TalentProfileManagement } from '@/components/talent/talent-profile-management'
import type { TalentEmployeeCapabilityOptions, TalentEmployeeCapabilityRecord, listTalentEmployeeCapabilityRecords, getTalentEmployeeCapabilityOptions } from '@/lib/talent/employee-capability-service'
import type { listTalentFoundation, listTalentProfileManagement } from '@/lib/talent/service'

type Foundation = Awaited<ReturnType<typeof listTalentFoundation>>
type Profiles = Awaited<ReturnType<typeof listTalentProfileManagement>>
type Records = Awaited<ReturnType<typeof listTalentEmployeeCapabilityRecords>>
type Options = Awaited<ReturnType<typeof getTalentEmployeeCapabilityOptions>>
type LoadedSection = 'profiles' | 'records' | 'foundation'
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'failed'
type FoundationLabels = Parameters<typeof TalentFoundationManager>[0]['labels']
type ProfileLabels = Parameters<typeof TalentProfileManagement>[0]['labels']
type RecordLabels = Parameters<typeof TalentEmployeeCapabilityRecords>[0]['labels']
type NotificationLabels = Parameters<typeof TalentNotificationPanel>[0]['labels']

type WorkspaceState = {
  status: Record<LoadedSection, LoadStatus>
  foundation: Foundation | null
  profiles: Profiles | null
  records: Records | null
  options: Options | null
}

export type TalentManagementWorkspaceLabels = {
  startTitle: string
  startDescription: string
  startNavigationTitle: string
  profilesSection: string
  profilesDescription: string
  recordsSection: string
  recordsDescription: string
  foundationSection: string
  foundationDescription: string
  loading: string
  loadFailed: string
  assessmentTitle: string
  teamMatrixTitle: string
  comparisonTitle: string
  roleExplorerTitle: string
  importTitle: string
  goalTitle: string
  reportTitle: string
  foundation: FoundationLabels
  profiles: ProfileLabels
  records: RecordLabels
  notifications: NotificationLabels
}

const initialState: WorkspaceState = {
  status: { profiles: 'idle', records: 'idle', foundation: 'idle' },
  foundation: null,
  profiles: null,
  records: null,
  options: null,
}

function loadMessage(status: LoadStatus, labels: TalentManagementWorkspaceLabels) {
  if (status === 'loading') return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{labels.loading}</p>
  if (status === 'failed') return <p className="rounded-xl border border-dashed border-destructive/40 p-5 text-sm text-destructive">{labels.loadFailed}</p>
  return null
}

export function TalentManagementWorkspace({ labels }: { labels: TalentManagementWorkspaceLabels }) {
  const [state, setState] = useState<WorkspaceState>(initialState)
  const loadingSections = useRef(new Set<LoadedSection>())

  async function loadSection(section: LoadedSection) {
    const alreadyLoaded = section === 'profiles'
      ? Boolean(state.profiles && state.foundation)
      : section === 'records'
        ? Boolean(state.records && state.options)
        : Boolean(state.foundation)
    if (alreadyLoaded || loadingSections.current.has(section)) return
    loadingSections.current.add(section)
    setState((current) => ({ ...current, status: { ...current.status, [section]: 'loading' } }))
    try {
      if (section === 'profiles') {
        const [foundationResponse, profilesResponse] = await Promise.all([
          fetch('/api/talent', { cache: 'no-store' }),
          fetch('/api/talent/job-profiles', { cache: 'no-store' }),
        ])
        if (!foundationResponse.ok || !profilesResponse.ok) throw new Error('TALENT_PROFILE_MANAGEMENT_READ_FAILED')
        const foundationPayload = await foundationResponse.json() as { data: Foundation }
        const profilesPayload = await profilesResponse.json() as { data: Profiles }
        setState((current) => ({ ...current, foundation: foundationPayload.data, profiles: profilesPayload.data, status: { ...current.status, foundation: 'loaded', profiles: 'loaded' } }))
        return
      }
      if (section === 'records') {
        const optionsResponse = await fetch('/api/talent/capability-records', { method: 'OPTIONS', cache: 'no-store' })
        if (!optionsResponse.ok) throw new Error('TALENT_EMPLOYEE_CAPABILITY_OPTIONS_FAILED')
        const optionsPayload = await optionsResponse.json() as { data: TalentEmployeeCapabilityOptions }
        const recordsResponse = await fetch('/api/talent/capability-records', { cache: 'no-store' })
        if (!recordsResponse.ok) throw new Error('TALENT_EMPLOYEE_CAPABILITY_READ_FAILED')
        const recordsPayload = await recordsResponse.json() as { data: TalentEmployeeCapabilityRecord[] }
        setState((current) => ({ ...current, records: recordsPayload.data, options: optionsPayload.data, status: { ...current.status, records: 'loaded' } }))
        return
      }
      const response = await fetch('/api/talent', { cache: 'no-store' })
      if (!response.ok) throw new Error('TALENT_READ_FAILED')
      const payload = await response.json() as { data: Foundation }
      setState((current) => ({ ...current, foundation: payload.data, status: { ...current.status, foundation: 'loaded' } }))
    } catch {
      setState((current) => ({ ...current, status: { ...current.status, [section]: 'failed' } }))
    } finally {
      loadingSections.current.delete(section)
    }
  }

  function handleOpenChange(sectionId: string | null) {
    if (sectionId === 'profiles' || sectionId === 'records' || sectionId === 'foundation') void loadSection(sectionId)
  }

  function renderProfiles() {
    const status = state.status.profiles
    if (status !== 'loaded' || !state.profiles || !state.foundation) return loadMessage(status, labels)
    return <div className="space-y-4"><p className="text-sm text-muted-foreground">{labels.profilesDescription}</p><TalentProfileManagement foundation={state.foundation} initial={state.profiles} labels={labels.profiles} /></div>
  }

  function renderRecords() {
    const status = state.status.records
    if (status !== 'loaded' || !state.records || !state.options) return loadMessage(status, labels)
    return <div className="space-y-4"><p className="text-sm text-muted-foreground">{labels.recordsDescription}</p><TalentEmployeeCapabilityRecords mode="admin" initial={state.records} labels={labels.records} options={state.options} /></div>
  }

  function renderFoundation() {
    const status = state.status.foundation
    if (status !== 'loaded' || !state.foundation) return loadMessage(status, labels)
    return <div className="space-y-4"><p className="text-sm text-muted-foreground">{labels.foundationDescription}</p><TalentFoundationManager initial={state.foundation} labels={labels.foundation} /></div>
  }

  return <SettingsAccordion initialOpen="start" onOpenChange={handleOpenChange} sections={[
    { id: 'start', title: labels.startTitle, children: <div className="space-y-5"><p className="text-sm text-muted-foreground">{labels.startDescription}</p><nav aria-label={labels.startNavigationTitle} className="flex flex-wrap gap-2"><Link className="button-secondary" href="/settings/talent/assessments">{labels.assessmentTitle}</Link><Link className="button-secondary" href="/settings/talent/team">{labels.teamMatrixTitle}</Link><Link className="button-secondary" href="/settings/talent/comparison">{labels.comparisonTitle}</Link><Link className="button-secondary" href="/settings/talent/role-explorer">{labels.roleExplorerTitle}</Link><Link className="button-secondary" href="/settings/talent/import">{labels.importTitle}</Link><Link className="button-secondary" href="/settings/talent/goals">{labels.goalTitle}</Link><Link className="button-secondary" href="/settings/talent/reports">{labels.reportTitle}</Link></nav><TalentNotificationPanel labels={labels.notifications} /></div> },
    { id: 'profiles', title: labels.profilesSection, children: renderProfiles() },
    { id: 'records', title: labels.recordsSection, children: renderRecords() },
    { id: 'foundation', title: labels.foundationSection, children: renderFoundation() },
  ]} />
}

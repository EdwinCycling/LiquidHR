'use client'

import { useState, type ComponentType } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { StartPageTeamAiData } from '@/lib/ai/team-scope'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { TeamLiveVoiceLabels } from './team-live-voice'
import type { StartPageLabels } from './start-page'

export interface TeamAiWindowProps {
  data: StartPageTeamAiData
  labels: StartPageLabels
  locale: Locale
}

type TeamLiveVoiceProps = {
  contextName: string
  departmentId?: string
  enabled: boolean
  labels: TeamLiveVoiceLabels
  locale: Locale
}

export function TeamAiWindow({ data, labels, locale }: TeamAiWindowProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(data.departmentId ?? '')
  const [Voice, setVoice] = useState<ComponentType<TeamLiveVoiceProps> | null>(null)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voiceLoadFailed, setVoiceLoadFailed] = useState(false)
  const selectedDepartment = data.departments.find((department) => department.id === selectedDepartmentId)
  const selectedMemberCount = selectedDepartment?.memberCount ?? 0
  const contextName = data.mode === 'DIRECT_TEAM' ? data.contextName ?? labels.teamAiDirectScope : selectedDepartment?.name ?? labels.teamAiDepartmentScope
  const teamVoiceLabels: TeamLiveVoiceLabels = {
    title: labels.teamAiTitle,
    description: labels.teamAiDescription,
    start: labels.teamAiStart,
    stop: labels.teamAiClose,
    connecting: labels.teamAiConnecting,
    listening: labels.teamAiListening,
    speaking: labels.teamAiSpeaking,
    processing: labels.teamAiProcessing,
    microphoneDenied: labels.teamAiDisabled,
    connectionFailed: labels.teamAiDisabled,
    disabled: labels.teamAiDisabled,
    toolFailed: labels.teamAiDisabled,
    mute: labels.teamAiMute,
    unmute: labels.teamAiUnmute,
    muted: labels.teamAiPaused,
    elapsed: labels.teamAiElapsed,
    paused: labels.teamAiPaused,
    inputLevel: labels.teamAiInputLevel,
    inputMuted: labels.teamAiInputMuted,
    closing: labels.teamAiClose,
    privacy: labels.teamAiPrivacy,
    scope: labels.teamAiScope,
    summaryTitle: labels.teamAiSummaryTitle,
    summaryDescription: labels.teamAiSummaryDescription,
    summaryDefaultTitle: labels.teamAiSummaryDefaultTitle,
    summaryTitleLabel: labels.teamAiSummaryTitleLabel,
    summaryBodyLabel: labels.teamAiSummaryBodyLabel,
    summarySave: labels.teamAiSummarySave,
    summarySaving: labels.teamAiSummarySaving,
    summarySaved: labels.teamAiSummarySaved,
    summaryFailed: labels.teamAiSummaryFailed,
    close: labels.teamAiClose,
  }
  const canStart = data.mode === 'DIRECT_TEAM' ? data.totalMemberCount > 0 : selectedMemberCount > 0
  const selectedDepartmentIsEmpty = data.mode === 'DEPARTMENT_SELECTION' && Boolean(selectedDepartmentId) && selectedMemberCount === 0

  async function loadVoice(): Promise<void> {
    if (Voice || voiceLoading) return
    setVoiceLoading(true)
    setVoiceLoadFailed(false)
    try {
      const voiceChunk = await import('./team-live-voice')
      setVoice(() => voiceChunk.TeamLiveVoice)
    } catch {
      setVoiceLoadFailed(true)
    } finally {
      setVoiceLoading(false)
    }
  }

  return <section aria-labelledby="startpage-team-ai-title" className="mt-6 overflow-hidden rounded-[var(--radius-surface)] border bg-surface" data-testid="startpage-team-ai">
    <header className="border-b bg-accent/45 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{labels.teamAiTitle}</p><h2 className="mt-1 text-lg font-semibold" id="startpage-team-ai-title">{contextName}</h2></div><Badge tone="info">GPT-Live</Badge></div><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.teamAiDescription}</p></header>
    <div className="grid gap-5 p-5 sm:p-6">
      {data.mode === 'DEPARTMENT_SELECTION' ? <label className="grid gap-1.5 text-sm font-medium" htmlFor="startpage-team-ai-department">{labels.teamAiDepartmentLabel}<DropdownSelect aria-label={labels.teamAiDepartmentLabel} id="startpage-team-ai-department" onChange={(event) => setSelectedDepartmentId(event.target.value)} placeholder={labels.teamAiSelectPlaceholder} searchable searchPlaceholder={labels.teamAiSelectPlaceholder} value={selectedDepartmentId}><option disabled value="">{labels.teamAiSelectPlaceholder}</option>{data.departments.map((department) => <option disabled={department.memberCount === 0} key={department.id} value={department.id}>{department.name}</option>)}</DropdownSelect></label> : null}
      {data.mode === 'DIRECT_TEAM' ? <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{labels.teamAiMemberPreview}</p><p className="mt-1 text-sm font-semibold">{labels.teamAiMembers.replace('{count}', String(data.totalMemberCount))}</p><ul className="mt-3 flex flex-wrap gap-2">{data.members.slice(0, 8).map((member) => <li className="rounded-full border bg-surface-subtle px-3 py-1 text-xs text-muted-foreground" key={member.employeeId}>{member.employeeName}</li>)}</ul></div> : null}
      {data.voiceEnabled && data.aiEnabled && canStart ? Voice
        ? <div id="startpage-team-ai-voice"><Voice contextName={contextName} departmentId={data.mode === 'DEPARTMENT_SELECTION' ? selectedDepartmentId : undefined} enabled={canStart} labels={teamVoiceLabels} locale={locale} /></div>
        : <div className="grid justify-items-start gap-2"><button aria-busy={voiceLoading || undefined} className={buttonClasses({ variant: 'secondary' })} disabled={voiceLoading} onClick={() => void loadVoice()} type="button">{voiceLoadFailed ? labels.teamAiRetry : labels.teamAiOpenVoice}</button>{voiceLoading ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{labels.teamAiVoiceLoading}</p> : null}{voiceLoadFailed ? <p className="text-sm text-destructive" role="alert">{labels.teamAiVoiceLoadFailed}</p> : null}</div>
        : <p className="text-sm text-muted-foreground">{selectedDepartmentIsEmpty ? labels.teamAiNoActiveMembers : data.mode === 'DEPARTMENT_SELECTION' && !canStart ? labels.teamAiDepartmentScope : labels.teamAiDisabled}</p>}
      {data.mode === 'DEPARTMENT_SELECTION' && data.departments.length === 0 ? <p className="text-sm text-muted-foreground">{labels.teamAiNoDepartments}</p> : null}
    </div>
  </section>
}

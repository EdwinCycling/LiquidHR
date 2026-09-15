'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FormActions } from '@/components/patterns/form-actions'
import { FormField } from '@/components/patterns/form-field'
import { Surface } from '@/components/ui/surface'
import { Switch } from '@/components/ui/switch'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import {
  AI_SETTINGS_CAPABILITY_CODES,
  AI_SETTINGS_ROLE_CODES,
  AI_SUPPORTED_VOICE_IDS,
  type AiSettingsCapabilityCode,
  type AiSettingsRoleCode,
} from '@/lib/ai/settings-contracts'
import type { AiGroupSettingsInput } from '@/lib/ai/settings-service'

type Labels = {
  generalTitle: string
  generalDescription: string
  aiEnabled: string
  aiEnabledDescription: string
  voiceEnabled: string
  voiceEnabledDescription: string
  contextsTitle: string
  contextsDescription: string
  employeeAiEnabled: string
  employeeAiEnabledDescription: string
  teamAiEnabled: string
  teamAiEnabledDescription: string
  rolesTitle: string
  rolesDescription: string
  roleAi: string
  roleVoice: string
  capabilitiesTitle: string
  capabilitiesDescription: string
  qualityTitle: string
  qualityDescription: string
  qualityProfile: string
  qualityEfficient: string
  qualityBalanced: string
  qualityInDepth: string
  style: string
  styleNeutral: string
  styleBusiness: string
  styleCoaching: string
  answerLength: string
  answerShort: string
  answerNormal: string
  answerDetailed: string
  voice: string
  voiceAlloy: string
  voiceAsh: string
  voiceBallad: string
  voiceCoral: string
  voiceEcho: string
  voiceSage: string
  voiceShimmer: string
  voiceVerse: string
  maxVoiceSessionSeconds: string
  maxVoiceSessionSecondsDescription: string
  summaryTitle: string
  summaryDescription: string
  endSummaryEnabled: string
  employeeNoteSaveEnabled: string
  teamLogbookSaveEnabled: string
  privacyTitle: string
  privacyDescription: string
  save: string
  cancel: string
  saving: string
  saved: string
  failed: string
  invalid: string
  roles: Record<AiSettingsRoleCode, string>
  capabilities: Record<AiSettingsCapabilityCode, string>
}

type BooleanKey = 'aiEnabled' | 'voiceEnabled' | 'employeeAiEnabled' | 'teamAiEnabled' | 'endSummaryEnabled' | 'employeeNoteSaveEnabled' | 'teamLogbookSaveEnabled'

type VoiceLabelKey = 'voiceAlloy' | 'voiceAsh' | 'voiceBallad' | 'voiceCoral' | 'voiceEcho' | 'voiceSage' | 'voiceShimmer' | 'voiceVerse'

const VOICE_LABEL_KEYS: Record<(typeof AI_SUPPORTED_VOICE_IDS)[number], VoiceLabelKey> = {
  alloy: 'voiceAlloy',
  ash: 'voiceAsh',
  ballad: 'voiceBallad',
  coral: 'voiceCoral',
  echo: 'voiceEcho',
  sage: 'voiceSage',
  shimmer: 'voiceShimmer',
  verse: 'voiceVerse',
}

export function AiSettingsForm({ initial, labels }: { initial: AiGroupSettingsInput; labels: Labels }) {
  const router = useRouter()
  const [settings, setSettings] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')

  function updateBoolean(key: BooleanKey, value: boolean): void {
    setSettings((current) => ({ ...current, [key]: value }))
    setStatus('idle')
  }

  function updateRole(role: AiSettingsRoleCode, key: 'aiEnabled' | 'voiceEnabled', value: boolean): void {
    setSettings((current) => ({ ...current, rolePolicies: { ...current.rolePolicies, [role]: { ...current.rolePolicies[role], [key]: value } } }))
    setStatus('idle')
  }

  function updateCapability(capability: AiSettingsCapabilityCode, value: boolean): void {
    setSettings((current) => ({ ...current, capabilities: { ...current.capabilities, [capability]: value } }))
    setStatus('idle')
  }

  async function save(): Promise<void> {
    setStatus('saving')
    const response = await fetch('/api/settings/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => null)
    if (response?.ok) {
      setStatus('saved')
      router.refresh()
    } else {
      setStatus('failed')
    }
  }

  return <form className="max-w-5xl space-y-6" onSubmit={(event) => { event.preventDefault(); void save() }}>
    <Surface className="p-5">
      <h2 className="font-semibold">{labels.generalTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.generalDescription}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Switch checked={settings.aiEnabled} description={labels.aiEnabledDescription} label={labels.aiEnabled} onCheckedChange={(value) => updateBoolean('aiEnabled', value)} />
        <Switch checked={settings.voiceEnabled} description={labels.voiceEnabledDescription} label={labels.voiceEnabled} onCheckedChange={(value) => updateBoolean('voiceEnabled', value)} />
      </div>
    </Surface>

    <Surface className="p-5">
      <h2 className="font-semibold">{labels.contextsTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.contextsDescription}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Switch checked={settings.employeeAiEnabled} description={labels.employeeAiEnabledDescription} label={labels.employeeAiEnabled} onCheckedChange={(value) => updateBoolean('employeeAiEnabled', value)} />
        <Switch checked={settings.teamAiEnabled} description={labels.teamAiEnabledDescription} label={labels.teamAiEnabled} onCheckedChange={(value) => updateBoolean('teamAiEnabled', value)} />
      </div>
    </Surface>

    <Surface className="p-5">
      <h2 className="font-semibold">{labels.rolesTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.rolesDescription}</p>
      <div className="mt-5 overflow-x-auto rounded-[var(--radius-control)] border border-border">
        <div className="min-w-[34rem]">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] gap-3 border-b border-border-subtle bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"><span /> <span>{labels.roleAi}</span> <span>{labels.roleVoice}</span></div>
          {AI_SETTINGS_ROLE_CODES.map((role) => <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0" key={role}><span className="text-sm font-medium">{labels.roles[role]}</span><Switch aria-label={`${labels.roleAi}: ${labels.roles[role]}`} checked={settings.rolePolicies[role].aiEnabled} onCheckedChange={(value) => updateRole(role, 'aiEnabled', value)} /><Switch aria-label={`${labels.roleVoice}: ${labels.roles[role]}`} checked={settings.rolePolicies[role].voiceEnabled} onCheckedChange={(value) => updateRole(role, 'voiceEnabled', value)} /></div>)}
        </div>
      </div>
    </Surface>

    <Surface className="p-5">
      <h2 className="font-semibold">{labels.capabilitiesTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.capabilitiesDescription}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {AI_SETTINGS_CAPABILITY_CODES.map((capability) => <Switch checked={settings.capabilities[capability]} key={capability} label={labels.capabilities[capability]} onCheckedChange={(value) => updateCapability(capability, value)} />)}
      </div>
    </Surface>

    <Surface className="p-5">
      <h2 className="font-semibold">{labels.qualityTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.qualityDescription}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormField control={<DropdownSelect aria-label={labels.qualityProfile} onChange={(event) => { setSettings((current) => ({ ...current, qualityProfile: event.target.value as AiGroupSettingsInput['qualityProfile'] })); setStatus('idle') }} value={settings.qualityProfile}><option value="EFFICIENT">{labels.qualityEfficient}</option><option value="BALANCED">{labels.qualityBalanced}</option><option value="IN_DEPTH">{labels.qualityInDepth}</option></DropdownSelect>} label={labels.qualityProfile} />
        <FormField control={<DropdownSelect aria-label={labels.style} onChange={(event) => { setSettings((current) => ({ ...current, conversationStyle: event.target.value as AiGroupSettingsInput['conversationStyle'] })); setStatus('idle') }} value={settings.conversationStyle}><option value="NEUTRAL">{labels.styleNeutral}</option><option value="BUSINESS">{labels.styleBusiness}</option><option value="COACHING">{labels.styleCoaching}</option></DropdownSelect>} label={labels.style} />
        <FormField control={<DropdownSelect aria-label={labels.answerLength} onChange={(event) => { setSettings((current) => ({ ...current, answerLength: event.target.value as AiGroupSettingsInput['answerLength'] })); setStatus('idle') }} value={settings.answerLength}><option value="SHORT">{labels.answerShort}</option><option value="NORMAL">{labels.answerNormal}</option><option value="DETAILED">{labels.answerDetailed}</option></DropdownSelect>} label={labels.answerLength} />
        <FormField control={<DropdownSelect aria-label={labels.voice} onChange={(event) => { setSettings((current) => ({ ...current, voiceId: event.target.value as AiGroupSettingsInput['voiceId'] })); setStatus('idle') }} value={settings.voiceId}>{AI_SUPPORTED_VOICE_IDS.map((voice) => <option key={voice} value={voice}>{labels[VOICE_LABEL_KEYS[voice]]}</option>)}</DropdownSelect>} label={labels.voice} />
        <FormField className="md:col-span-2" control={<TextInput inputMode="numeric" max={3_600} min={30} onChange={(event) => { const value = Number(event.target.value); setSettings((current) => ({ ...current, maxVoiceSessionSeconds: Number.isFinite(value) ? value : 0 })); setStatus('idle') }} step={30} type="number" value={settings.maxVoiceSessionSeconds} />} description={labels.maxVoiceSessionSecondsDescription} label={labels.maxVoiceSessionSeconds} />
      </div>
    </Surface>

    <Surface className="p-5">
      <h2 className="font-semibold">{labels.summaryTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.summaryDescription}</p>
      <div className="mt-5 grid gap-4">
        <Switch checked={settings.endSummaryEnabled} label={labels.endSummaryEnabled} onCheckedChange={(value) => updateBoolean('endSummaryEnabled', value)} />
        <Switch checked={settings.employeeNoteSaveEnabled} label={labels.employeeNoteSaveEnabled} onCheckedChange={(value) => updateBoolean('employeeNoteSaveEnabled', value)} />
        <Switch checked={settings.teamLogbookSaveEnabled} label={labels.teamLogbookSaveEnabled} onCheckedChange={(value) => updateBoolean('teamLogbookSaveEnabled', value)} />
      </div>
    </Surface>

    <Surface className="border-primary/25 bg-accent/30 p-5">
      <h2 className="font-semibold">{labels.privacyTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.privacyDescription}</p>
    </Surface>

    <p aria-live="polite" className={`min-h-5 text-sm ${status === 'failed' ? 'text-destructive' : status === 'saved' ? 'text-success' : ''}`} role={status === 'failed' ? 'alert' : 'status'}>{status === 'saved' ? labels.saved : status === 'failed' ? labels.failed : status === 'saving' ? labels.saving : ''}</p>
    <FormActions cancelLabel={labels.cancel} onCancel={() => { setSettings(initial); setStatus('idle') }} saveLabel={labels.save} saving={status === 'saving'} sticky />
  </form>
}

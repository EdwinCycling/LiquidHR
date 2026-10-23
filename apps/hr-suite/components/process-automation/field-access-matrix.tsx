'use client'

import { resolveStepFieldAccessMode } from '@/lib/process-automation/field-access'
import type { FieldAccessMode, FieldDefinition, ParticipantDefinition, ProcessStep } from '@/lib/process-automation/definition-schemas'

export interface FieldAccessMatrixLabels {
  readonly title: string
  readonly description: string
  readonly selectStep: string
  readonly noSteps: string
  readonly field: string
  readonly participant: string
  readonly hidden: string
  readonly read: string
  readonly writeOptional: string
  readonly writeRequired: string
  readonly conditionalRequiredWarning: string
  readonly participantLimitWarning: string
}

interface FieldAccessMatrixProps {
  readonly fields: readonly FieldDefinition[]
  readonly steps: readonly ProcessStep[]
  readonly participants: readonly ParticipantDefinition[]
  readonly selectedStepKey: string
  readonly editing: boolean
  readonly language: 'nl' | 'en'
  readonly labels: FieldAccessMatrixLabels
  readonly onStepChange: (stepKey: string) => void
  readonly onModeChange: (fieldKey: string, stepKey: string, participantKey: string, mode: FieldAccessMode) => void
}

const modes: readonly FieldAccessMode[] = ['HIDDEN', 'READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED']

function localized(value: Readonly<Record<string, string>>, language: 'nl' | 'en'): string {
  return value[language] ?? value.nl ?? ''
}

function modeLabel(mode: FieldAccessMode, labels: FieldAccessMatrixLabels): string {
  if (mode === 'HIDDEN') return labels.hidden
  if (mode === 'READ') return labels.read
  if (mode === 'WRITE_OPTIONAL') return labels.writeOptional
  return labels.writeRequired
}

export function FieldAccessMatrix({
  fields,
  steps,
  participants,
  selectedStepKey,
  editing,
  language,
  labels,
  onStepChange,
  onModeChange,
}: FieldAccessMatrixProps) {
  const selectedStep = steps.find((step) => step.key === selectedStepKey) ?? steps[0]
  const participant = selectedStep?.participantKey
    ? participants.find((candidate) => candidate.key === selectedStep.participantKey)
    : undefined
  const participantLabel = participant ? localized(participant.label, language) : labels.participant

  function selectFor(field: FieldDefinition, device: 'desktop' | 'mobile') {
    const id = 'field-access-' + device + '-' + field.key
    const participantMode = field.access.find((rule) => rule.participantKey === selectedStep?.participantKey)?.mode ?? 'HIDDEN'
    const configuredMode = field.stepAccess?.find((rule) => rule.stepKey === selectedStep?.key && rule.participantKey === selectedStep?.participantKey)?.mode
    const mode = selectedStep?.participantKey
      ? resolveStepFieldAccessMode(field, selectedStep.participantKey, selectedStep.key)
      : 'HIDDEN'
    const selectedMode = configuredMode ?? mode
    const modeRank: Readonly<Record<FieldAccessMode, number>> = { HIDDEN: 0, READ: 1, WRITE_OPTIONAL: 2, WRITE_REQUIRED: 2 }
    const exceedsParticipantLimit = configuredMode !== undefined && modeRank[configuredMode] > modeRank[participantMode]
    const label = localized(field.label, language)
    return <label className="grid min-w-0 gap-1 text-sm font-medium" htmlFor={id}>
      <span className="sr-only">{label} · {participantLabel}</span>
      <select
        aria-label={label + ' · ' + participantLabel}
        className="w-full min-w-0 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
        disabled={!editing || !selectedStep?.participantKey}
        id={id}
        onChange={(event) => {
          if (selectedStep?.participantKey) onModeChange(field.key, selectedStep.key, selectedStep.participantKey, event.target.value as FieldAccessMode)
        }}
        value={selectedMode}
      >
        {modes.map((candidate) => <option key={candidate} value={candidate}>{modeLabel(candidate, labels)}</option>)}
      </select>
      {exceedsParticipantLimit
        ? <span className="text-xs font-normal text-destructive" role="alert">{labels.participantLimitWarning}</span>
        : null}
      {field.requiredCondition && selectedMode === 'WRITE_REQUIRED'
        ? <span className="text-xs font-normal text-destructive" role="alert">{labels.conditionalRequiredWarning}</span>
        : null}
    </label>
  }

  return <section aria-labelledby="field-access-matrix-title" className="mt-6 min-w-0 rounded-[var(--radius-card)] border border-border bg-surface p-4">
    <div className="mb-4">
      <h4 className="text-base font-semibold" id="field-access-matrix-title">{labels.title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
    </div>
    {steps.length === 0
      ? <p className="text-sm text-muted-foreground">{labels.noSteps}</p>
      : <>
        <label className="block max-w-xl text-sm font-medium" htmlFor="field-access-step">
          {labels.selectStep}
          <select className="mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary" aria-label={labels.selectStep} id="field-access-step" onChange={(event) => onStepChange(event.target.value)} value={selectedStep?.key ?? ''}>
            {steps.map((step) => <option key={step.key} value={step.key}>{localized(step.title, language)}{step.participantKey ? ' · ' + (participants.find((candidate) => candidate.key === step.participantKey)?.label[language] ?? '') : ''}</option>)}
          </select>
        </label>
        {!participant
          ? <p className="mt-3 text-sm text-destructive" role="alert">{labels.noSteps}</p>
          : <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">{labels.title}</caption>
                <thead><tr className="border-b border-border text-muted-foreground"><th className="w-1/2 px-3 py-2">{labels.field}</th><th className="px-3 py-2">{participantLabel}</th></tr></thead>
                <tbody>{fields.map((field) => <tr className="border-b border-border last:border-0" key={field.key}>
                  <th className="break-words px-3 py-3 font-medium">{localized(field.label, language)}</th>
                  <td className="px-3 py-2">{selectFor(field, 'desktop')}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 md:hidden">
              {fields.map((field) => <article className="min-w-0 rounded-[var(--radius-control)] border border-border p-3" key={field.key}>
                <h5 className="break-words text-sm font-semibold">{localized(field.label, language)}</h5>
                <p className="mt-1 text-xs text-muted-foreground">{participantLabel}</p>
                <div className="mt-3">{selectFor(field, 'mobile')}</div>
              </article>)}
            </div>
          </>}
      </>}
  </section>
}

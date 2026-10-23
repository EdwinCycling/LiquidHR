'use client'

import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowRight, CornerUpLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  ParticipantDefinition,
  ProcessAction,
  ProcessDefinitionDraft,
  ProcessStep,
  ProcessStepType,
  ProcessTransition,
} from '@/lib/process-automation/definition-schemas'
import type { StudioIssue } from '@/lib/process-automation/studio-service'

type EditableStepType = Extract<ProcessStepType, 'FORM' | 'DECISION' | 'END'>
type BuiltInRole = 'employee' | 'manager' | 'hr-team'

export interface ProcessFlowEditorLabels {
  readonly stepList: string
  readonly stepLibrary: string
  readonly stepName: string
  readonly stepType: string
  readonly stepTypeLabels: Readonly<Record<EditableStepType, string>>
  readonly stepTypeLabelsNl: Readonly<Record<EditableStepType, string>>
  readonly stepTypeLabelsEn: Readonly<Record<EditableStepType, string>>
  readonly responsible: string
  readonly responsibleMissing: string
  readonly addResponsible: string
  readonly roleLabels: Readonly<Record<BuiltInRole, string>>
  readonly roleLabelsNl: Readonly<Record<BuiltInRole, string>>
  readonly roleLabelsEn: Readonly<Record<BuiltInRole, string>>
  readonly roleDescriptions: Readonly<Record<BuiltInRole, string>>
  readonly form: string
  readonly noForms: string
  readonly noFormsHelp: string
  readonly addStep: string
  readonly selectStep: string
  readonly addStepHelp: string
  readonly emptyFlow: string
  readonly emptyFlowHelp: string
  readonly selectedStep: string
  readonly properties: string
  readonly steps: string
  readonly stepLabel: string
  readonly routeTitle: string
  readonly addRoute: string
  readonly addRouteHelp: string
  readonly routeAction: string
  readonly routeDestination: string
  readonly routeLabel: string
  readonly removeRoute: string
  readonly noRoutes: string
  readonly noDestination: string
  readonly advanced: string
  readonly technicalKey: string
  readonly terminalOutcome: string
  readonly terminalOutcomes: Readonly<Record<'COMPLETED' | 'REJECTED' | 'CANCELLED', string>>
  readonly terminalOutcomesNl: Readonly<Record<'COMPLETED' | 'REJECTED' | 'CANCELLED', string>>
  readonly terminalOutcomesEn: Readonly<Record<'COMPLETED' | 'REJECTED' | 'CANCELLED', string>>
  readonly actionLabels: Readonly<Record<ProcessAction, string>>
  readonly actionLabelsNl: Readonly<Record<ProcessAction, string>>
  readonly actionLabelsEn: Readonly<Record<ProcessAction, string>>
  readonly connectionLabel: string
  readonly stepNeedsAttention: string
  readonly stepIssueCount: string
  readonly conditionalRoute: string
  readonly formCreationFollowUp: string
  readonly startStep: string
  readonly noSelection: string
  readonly unsupportedTypeHelp: string
}

interface ProcessFlowEditorProps {
  readonly draft: ProcessDefinitionDraft
  readonly issues: readonly StudioIssue[]
  readonly activeStepKey: string
  readonly editing: boolean
  readonly labels: ProcessFlowEditorLabels
  readonly onSelectStep: (stepKey: string) => void
  readonly onChangeDraft: (updater: (current: ProcessDefinitionDraft) => ProcessDefinitionDraft) => void
  readonly onOpenForms: () => void
}

const stepTypeOptions: readonly EditableStepType[] = ['FORM', 'DECISION', 'END']

const transitionActions: Readonly<Record<EditableStepType, readonly ProcessAction[]>> = {
  FORM: ['SUBMIT', 'COMPLETE', 'REQUEST_CHANGES', 'CANCEL'],
  DECISION: ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'CANCEL'],
  END: [],
}

function localizedLabel(value: { readonly nl?: string; readonly en?: string } | undefined, fallback: string): string {
  return value?.nl?.trim() || value?.en?.trim() || fallback
}

function uniqueKey(base: string, used: ReadonlySet<string>): string {
  let key = base
  let suffix = 2
  while (used.has(key)) {
    key = `${base}-${suffix}`
    suffix += 1
  }
  return key
}

function nextStepKey(type: EditableStepType, draft: ProcessDefinitionDraft): string {
  const base = type === 'FORM' ? 'form-step' : type === 'DECISION' ? 'decision' : 'end'
  return uniqueKey(base, new Set(draft.steps.map((step) => step.key)))
}

function newStep(type: EditableStepType, key: string, labels: ProcessFlowEditorLabels): ProcessStep {
  const titleNl = type === 'FORM'
    ? labels.stepTypeLabelsNl.FORM
    : type === 'DECISION'
      ? labels.stepTypeLabelsNl.DECISION
      : labels.terminalOutcomesNl.COMPLETED
  const titleEn = type === 'FORM'
    ? labels.stepTypeLabelsEn.FORM
    : type === 'DECISION'
      ? labels.stepTypeLabelsEn.DECISION
      : labels.terminalOutcomesEn.COMPLETED
  return {
    key,
    type,
    title: { nl: titleNl, en: titleEn },
    allowedActions: type === 'FORM' ? ['SUBMIT'] : type === 'DECISION' ? ['APPROVE'] : [],
    ...(type === 'END' ? { terminalOutcome: 'COMPLETED' as const } : {}),
  }
}

function participantForRole(role: BuiltInRole, existing: readonly ParticipantDefinition[], labels: ProcessFlowEditorLabels): ParticipantDefinition {
  const key = uniqueKey(role, new Set(existing.map((participant) => participant.key)))
  const label = { nl: labels.roleLabelsNl[role], en: labels.roleLabelsEn[role] }
  if (role === 'employee') {
    return {
      key,
      label,
      selector: { type: 'INITIATOR', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
      assignmentMode: 'EXACTLY_ONE',
      permission: 'self:process-instance:start',
    }
  }
  if (role === 'manager') {
    return {
      key,
      label,
      selector: { type: 'DIRECT_MANAGER_OF_SUBJECT', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
      assignmentMode: 'EXACTLY_ONE',
      permission: 'process-task:act',
    }
  }
  return {
    key,
    label,
    selector: {
      type: 'PERMISSION_WORK_QUEUE',
      permission: 'process-task:act',
      queueKey: 'hr-processes',
      resolutionDatePolicy: 'STEP_ACTIVATED_AT',
    },
    assignmentMode: 'ANY_ONE',
    permission: 'process-task:act',
  }
}

function stepIndexForIssue(issue: StudioIssue, index: number): boolean {
  return issue.path[0] === 'steps' && issue.path[1] === index
}

function transitionIndexForIssue(issue: StudioIssue, index: number): boolean {
  return issue.path[0] === 'transitions' && issue.path[1] === index
}

function isEditableStepType(type: ProcessStepType): type is EditableStepType {
  return type === 'FORM' || type === 'DECISION' || type === 'END'
}

function participantMatchesRole(participant: ParticipantDefinition, role: BuiltInRole): boolean {
  if (role === 'employee') return participant.selector.type === 'INITIATOR' || participant.selector.type === 'SUBJECT_EMPLOYEE'
  if (role === 'manager') return participant.selector.type === 'DIRECT_MANAGER_OF_SUBJECT'
  return participant.selector.type === 'PERMISSION_WORK_QUEUE' || participant.selector.type === 'PROCESS_OWNER_QUEUE'
}

export function ProcessFlowEditor({
  draft,
  issues,
  activeStepKey,
  editing,
  labels,
  onSelectStep,
  onChangeDraft,
  onOpenForms,
}: ProcessFlowEditorProps) {
  const [newStepType, setNewStepType] = useState<EditableStepType>('FORM')
  const [newRouteAction, setNewRouteAction] = useState<ProcessAction>('SUBMIT')
  const [newRouteTarget, setNewRouteTarget] = useState('')
  const selectedStep = draft.steps.find((step) => step.key === activeStepKey) ?? draft.steps[0] ?? null
  const selectedParticipant = selectedStep?.participantKey
    ? draft.participants.find((participant) => participant.key === selectedStep.participantKey)
    : undefined
  const selectedStepType = selectedStep && isEditableStepType(selectedStep.type) ? selectedStep.type : null
  const availableRouteActions = selectedStepType && selectedStepType !== 'END'
    ? transitionActions[selectedStepType].filter((action) => !draft.transitions.some((transition) => transition.fromStepKey === selectedStep.key && transition.action === action))
    : []
  const routeActionValue = availableRouteActions.includes(newRouteAction) ? newRouteAction : availableRouteActions[0] ?? ''
  const availableRouteTargets = selectedStep ? draft.steps.filter((step) => step.key !== selectedStep.key) : []
  const routeTargetValue = availableRouteTargets.some((step) => step.key === newRouteTarget) ? newRouteTarget : availableRouteTargets[0]?.key ?? selectedStep?.key ?? ''

  function addStep(): void {
    const key = nextStepKey(newStepType, draft)
    const step = newStep(newStepType, key, labels)
    onChangeDraft((current) => ({
      ...current,
      startStepKey: current.steps.length === 0 ? key : current.startStepKey,
      steps: [...current.steps, step],
    }))
    onSelectStep(key)
  }

  function updateStep(stepKey: string, updater: (step: ProcessStep) => ProcessStep): void {
    onChangeDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => step.key === stepKey ? updater(step) : step),
    }))
  }

  function updateRoute(transitionKey: string, updater: (transition: ProcessTransition) => ProcessTransition): void {
    if (!selectedStep) return
    onChangeDraft((current) => {
      const transitions = current.transitions.map((transition) => transition.key === transitionKey ? updater(transition) : transition)
      const allowedActions = [...new Set(transitions.filter((transition) => transition.fromStepKey === selectedStep.key).map((transition) => transition.action))]
      return {
        ...current,
        transitions,
        steps: current.steps.map((step) => step.key === selectedStep.key ? { ...step, allowedActions } : step),
      }
    })
  }

  function addResponsible(role: BuiltInRole): void {
    if (!selectedStep) return
    onChangeDraft((current) => {
      const participant = participantForRole(role, current.participants, labels)
      return {
        ...current,
        participants: [...current.participants, participant],
        steps: current.steps.map((step) => step.key === selectedStep.key ? { ...step, participantKey: participant.key } : step),
      }
    })
  }

  function addRoute(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const targetStepKey = availableRouteTargets.some((step) => step.key === newRouteTarget)
      ? newRouteTarget
      : availableRouteTargets[0]?.key ?? ''
    if (!selectedStep || !targetStepKey || !isEditableStepType(selectedStep.type) || selectedStep.type === 'END') return
    const allowed = transitionActions[selectedStep.type]
    const used = draft.transitions.filter((transition) => transition.fromStepKey === selectedStep.key).map((transition) => transition.action)
    const action = allowed.includes(newRouteAction) && !used.includes(newRouteAction)
      ? newRouteAction
      : allowed.find((candidate) => !used.includes(candidate))
    if (!action) return
    const label = { nl: labels.actionLabelsNl[action], en: labels.actionLabelsEn[action] }
    const key = uniqueKey(`${selectedStep.key}-${action.toLowerCase().replaceAll('_', '-')}`, new Set(draft.transitions.map((transition) => transition.key)))
    onChangeDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => step.key === selectedStep.key
        ? { ...step, allowedActions: [...new Set([...step.allowedActions, action])] }
        : step),
      transitions: [...current.transitions, {
        key,
        fromStepKey: selectedStep.key,
        toStepKey: targetStepKey,
        action,
        kind: action === 'REQUEST_CHANGES' ? 'RECOVERY' : 'FORWARD',
        label,
      }],
    }))
  }

  function updateRouteAction(transitionKey: string, action: ProcessAction): void {
    updateRoute(transitionKey, (transition) => ({
      ...transition,
      action,
      kind: action === 'REQUEST_CHANGES' ? 'RECOVERY' : 'FORWARD',
      label: (transition.label.nl.trim() === '' || transition.label.nl === labels.actionLabelsNl[transition.action])
        && (transition.label.en?.trim() === undefined || transition.label.en.trim() === '' || transition.label.en === labels.actionLabelsEn[transition.action])
        ? { nl: labels.actionLabelsNl[action], en: labels.actionLabelsEn[action] }
        : transition.label,
    }))
  }

  function removeRoute(transitionKey: string): void {
    if (!selectedStep) return
    onChangeDraft((current) => {
      const transitions = current.transitions.filter((transition) => transition.key !== transitionKey)
      const allowedActions = [...new Set(transitions.filter((transition) => transition.fromStepKey === selectedStep.key).map((transition) => transition.action))]
      return {
        ...current,
        transitions,
        steps: current.steps.map((step) => step.key === selectedStep.key ? { ...step, allowedActions } : step),
      }
    })
  }

  function participantSummary(participant: ParticipantDefinition | undefined): string {
    if (!participant) return labels.responsibleMissing
    if (participant.selector.type === 'INITIATOR' || participant.selector.type === 'SUBJECT_EMPLOYEE') return labels.roleLabels.employee
    if (participant.selector.type === 'DIRECT_MANAGER_OF_SUBJECT') return labels.roleLabels.manager
    if (participant.selector.type === 'PERMISSION_WORK_QUEUE' || participant.selector.type === 'PROCESS_OWNER_QUEUE') return labels.roleLabels['hr-team']
    return localizedLabel(participant.label, labels.responsibleMissing)
  }

  function selectForm(stepKey: string, formKey: string): void {
    updateStep(stepKey, (step) => ({ ...step, formKey: formKey || undefined }))
  }

  return (
    <section aria-labelledby="process-flow-title" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{labels.stepLibrary}</p>
          <h3 className="mt-1 text-xl font-semibold" id="process-flow-title">{labels.stepList}</h3>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">{draft.steps.length} {labels.steps}</span>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(160px,0.55fr)_minmax(280px,1.1fr)_minmax(290px,1fr)]">
        <aside aria-label={labels.stepLibrary} className="h-fit rounded-xl border bg-background p-3">
          <label className="block text-sm font-semibold" htmlFor="process-step-type">{labels.selectStep}
            <select className="mt-2 w-full rounded-lg border bg-surface px-3 py-2 font-normal" disabled={!editing} id="process-step-type" onChange={(event) => setNewStepType(event.target.value as EditableStepType)} value={newStepType}>
              {stepTypeOptions.map((type) => <option key={type} value={type}>{labels.stepTypeLabels[type]}</option>)}
            </select>
          </label>
          <Button className="mt-3 w-full" disabled={!editing} onClick={addStep} size="sm" type="button" variant="primary"><Plus aria-hidden="true" size={15} />{labels.addStep}</Button>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{labels.addStepHelp}</p>
        </aside>

        <div aria-label={labels.stepList} className="min-w-0">
          {draft.steps.length === 0 ? (
            <div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center">
              <div><p className="font-semibold">{labels.emptyFlow}</p><p className="mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{labels.emptyFlowHelp}</p></div>
            </div>
          ) : (
            <ol aria-label={labels.steps} className="space-y-0">
              {draft.steps.map((step, index) => {
                const stepIssues = issues.filter((issue) => stepIndexForIssue(issue, index))
                const outgoing = draft.transitions.map((transition, transitionIndex) => ({ transition, transitionIndex }))
                  .filter(({ transition }) => transition.fromStepKey === step.key)
                const owner = participantSummary(draft.participants.find((participant) => participant.key === step.participantKey))
                const selected = selectedStep?.key === step.key
                return (
                  <li className="relative pb-4 pl-8 last:pb-0" key={step.key}>
                    {index < draft.steps.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-7 border-l-2 border-border" /> : null}
                    <span aria-hidden="true" className={`absolute left-0 top-2 grid size-6 place-items-center rounded-full border text-[11px] font-semibold ${step.key === draft.startStepKey ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>{index + 1}</span>
                    <article className={`rounded-xl border bg-background p-3 ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
                      <button aria-current={selected ? 'step' : undefined} aria-label={`${labels.stepLabel} ${index + 1}: ${localizedLabel(step.title, labels.stepTypeLabels[step.type as EditableStepType] ?? step.key)}`} className="w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onSelectStep(step.key)} type="button">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">{labels.stepTypeLabels[step.type as EditableStepType] ?? labels.stepLabel}</span>
                          {step.key === draft.startStepKey ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">{labels.startStep}</span> : null}
                          {stepIssues.length > 0 ? <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] font-semibold text-destructive">{labels.stepNeedsAttention}</span> : null}
                        </span>
                        <span className="mt-1 block font-semibold">{localizedLabel(step.title, labels.stepTypeLabels[step.type as EditableStepType] ?? step.key)}</span>
                        <span className="mt-2 block text-xs text-muted-foreground">{labels.responsible}: {step.type === 'END' ? labels.terminalOutcomes[step.terminalOutcome ?? 'COMPLETED'] : owner}</span>
                        {step.formKey ? <span className="mt-1 block text-xs text-muted-foreground">{labels.form}: {localizedLabel(draft.forms.find((form) => form.key === step.formKey)?.title, labels.formCreationFollowUp)}</span> : null}
                      </button>
                      {outgoing.length > 0 ? <ul aria-label={`${labels.connectionLabel}: ${localizedLabel(step.title, labels.stepLabel)}`} className="mt-3 grid gap-2 border-t pt-3">
                        {outgoing.map(({ transition, transitionIndex }) => {
                          const target = draft.steps.find((candidate) => candidate.key === transition.toStepKey)
                          const routeHasIssue = issues.some((issue) => transitionIndexForIssue(issue, transitionIndex))
                          return (
                            <li key={transition.key}>
                              <button className={`flex w-full min-w-0 items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary ${routeHasIssue ? 'border-destructive/50' : 'border-border hover:border-primary/50'}`} onClick={() => target ? onSelectStep(target.key) : onSelectStep(step.key)} type="button">
                                {transition.kind === 'RECOVERY' ? <CornerUpLeft aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={14} /> : <ArrowRight aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={14} />}
                                <span className="min-w-0 flex-1"><span className="block font-semibold">{localizedLabel(transition.label, labels.actionLabels[transition.action])}</span><span className="mt-0.5 block truncate text-muted-foreground">{target ? localizedLabel(target.title, labels.stepLabel) : labels.noDestination}</span></span>
                              </button>
                            </li>
                          )
                        })}
                      </ul> : <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{labels.noRoutes}</p>}
                    </article>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <aside aria-label={labels.properties} className="min-w-0 rounded-xl border bg-background p-4">
          {selectedStep ? <>
            <div className="flex items-start justify-between gap-2">
              <div><p className="eyebrow">{labels.selectedStep}</p><h4 className="mt-1 text-lg font-semibold">{localizedLabel(selectedStep.title, labels.stepLabel)}</h4></div>
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">{labels.stepTypeLabels[selectedStep.type as EditableStepType] ?? labels.stepLabel}</span>
            </div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold" htmlFor="process-step-title-nl">{labels.stepName}
                <input className="mt-1 w-full rounded-lg border bg-surface px-3 py-2 font-normal" disabled={!editing || !selectedStepType} id="process-step-title-nl" onChange={(event) => updateStep(selectedStep.key, (step) => ({ ...step, title: { ...step.title, nl: event.target.value } }))} required value={selectedStep.title.nl ?? ''} />
              </label>

              {!selectedStepType ? <p className="rounded-lg border border-dashed p-3 text-xs leading-5 text-muted-foreground">{labels.unsupportedTypeHelp}</p> : null}
              {selectedStepType && selectedStepType !== 'END' ? <>
                <label className="block text-sm font-semibold" htmlFor="process-step-owner">{labels.responsible}
                  <select className="mt-1 w-full rounded-lg border bg-surface px-3 py-2 font-normal" disabled={!editing || draft.participants.length === 0} id="process-step-owner" onChange={(event) => updateStep(selectedStep.key, (step) => ({ ...step, participantKey: event.target.value || undefined }))} value={selectedStep.participantKey ?? ''}>
                    <option value="">{labels.responsibleMissing}</option>
                    {draft.participants.map((participant) => <option key={participant.key} value={participant.key}>{participantSummary(participant)}</option>)}
                  </select>
                </label>
                <details className="rounded-lg border px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-semibold">{labels.addResponsible}</summary>
                  <div className="mt-3 grid gap-2">
                    {(['employee', 'manager', 'hr-team'] as const).filter((role) => !draft.participants.some((participant) => participantMatchesRole(participant, role))).map((role) => <Button disabled={!editing} key={role} onClick={() => addResponsible(role)} size="sm" type="button" variant="secondary">{labels.roleLabels[role]}<span className="ml-2 font-normal text-muted-foreground">{labels.roleDescriptions[role]}</span></Button>)}
                  </div>
                </details>
                {selectedStep.type !== 'END' ? <>
                  <label className="block text-sm font-semibold" htmlFor="process-step-form">{labels.form}
                    <select className="mt-1 w-full rounded-lg border bg-surface px-3 py-2 font-normal" disabled={!editing || draft.forms.length === 0} id="process-step-form" onChange={(event) => selectForm(selectedStep.key, event.target.value)} value={selectedStep.formKey ?? ''}>
                      <option value="">{labels.noForms}</option>
                      {draft.forms.map((form) => <option key={form.key} value={form.key}>{localizedLabel(form.title, form.key)}</option>)}
                    </select>
                  </label>
                  {draft.forms.length === 0 ? <div className="rounded-lg border border-dashed p-3 text-xs leading-5 text-muted-foreground"><p>{labels.noFormsHelp}</p><Button className="mt-2" onClick={onOpenForms} size="sm" type="button" variant="secondary">{labels.form}</Button></div> : null}
                </> : null}
              </> : selectedStepType === 'END' ? <label className="block text-sm font-semibold" htmlFor="process-terminal-outcome">{labels.terminalOutcome}
                <select className="mt-1 w-full rounded-lg border bg-surface px-3 py-2 font-normal" disabled={!editing} id="process-terminal-outcome" onChange={(event) => updateStep(selectedStep.key, (step) => ({ ...step, terminalOutcome: event.target.value as ProcessStep['terminalOutcome'] }))} value={selectedStep.terminalOutcome ?? 'COMPLETED'}>
                  {(['COMPLETED', 'REJECTED', 'CANCELLED'] as const).map((outcome) => <option key={outcome} value={outcome}>{labels.terminalOutcomes[outcome]}</option>)}
                </select>
              </label> : null}

              {selectedStepType && selectedStepType !== 'END' ? <section aria-labelledby="process-routes-title" className="border-t pt-4">
                <h5 className="font-semibold" id="process-routes-title">{labels.routeTitle}</h5>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{labels.addRouteHelp}</p>
                {draft.transitions.filter((transition) => transition.fromStepKey === selectedStep.key).map((transition) => {
                  const transitionIndex = draft.transitions.findIndex((candidate) => candidate.key === transition.key)
                  const routeIssues = issues.filter((issue) => transitionIndexForIssue(issue, transitionIndex))
                  const usedByOtherRoutes = new Set(draft.transitions.filter((candidate) => candidate.fromStepKey === selectedStep.key && candidate.key !== transition.key).map((candidate) => candidate.action))
                  const allowed = transitionActions[selectedStepType].filter((action) => !usedByOtherRoutes.has(action))
                  return <article className={`mt-3 rounded-lg border p-3 ${routeIssues.length > 0 ? 'border-destructive/50' : ''}`} key={transition.key}>
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{localizedLabel(transition.label, labels.actionLabels[transition.action])} <ArrowDown aria-hidden="true" className="inline text-muted-foreground" size={14} /> {localizedLabel(draft.steps.find((step) => step.key === transition.toStepKey)?.title, labels.noDestination)}</p><Button aria-label={`${labels.removeRoute}: ${localizedLabel(transition.label, labels.actionLabels[transition.action])}`} disabled={!editing} onClick={() => removeRoute(transition.key)} size="sm" type="button" variant="ghost">×</Button></div>
                    <div className="mt-3 grid gap-3">
                      <label className="text-xs font-semibold" htmlFor={`route-action-${transition.key}`}>{labels.routeAction}
                        <select className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 text-sm font-normal" disabled={!editing} id={`route-action-${transition.key}`} onChange={(event) => updateRouteAction(transition.key, event.target.value as ProcessAction)} value={transition.action}>
                          {allowed.map((action) => <option key={action} value={action}>{labels.actionLabels[action]}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold" htmlFor={`route-target-${transition.key}`}>{labels.routeDestination}
                        <select className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 text-sm font-normal" disabled={!editing} id={`route-target-${transition.key}`} onChange={(event) => updateRoute(transition.key, (current) => ({ ...current, toStepKey: event.target.value }))} value={transition.toStepKey}>
                          {draft.steps.map((step) => <option key={step.key} value={step.key}>{localizedLabel(step.title, labels.stepLabel)}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold" htmlFor={`route-label-${transition.key}`}>{labels.routeLabel}
                        <input className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 text-sm font-normal" disabled={!editing} id={`route-label-${transition.key}`} onChange={(event) => updateRoute(transition.key, (current) => ({ ...current, label: { ...current.label, nl: event.target.value } }))} required value={transition.label.nl ?? ''} />
                      </label>
                    </div>
                    {transition.kind === 'RECOVERY' ? <p className="mt-2 text-xs text-muted-foreground">{labels.conditionalRoute}</p> : null}
                    {routeIssues.length > 0 ? <p className="mt-2 text-xs font-semibold text-destructive" role="status">{labels.stepIssueCount.replace('{count}', String(routeIssues.length))}</p> : null}
                    <details className="mt-3 border-t pt-2 text-xs">
                      <summary className="cursor-pointer font-semibold">{labels.advanced}</summary>
                      <label className="mt-2 block font-semibold" htmlFor={`route-label-en-${transition.key}`}>{labels.routeLabel} · EN
                        <input className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 font-normal" disabled={!editing} id={`route-label-en-${transition.key}`} onChange={(event) => updateRoute(transition.key, (current) => ({ ...current, label: { ...current.label, en: event.target.value } }))} required value={transition.label.en ?? ''} />
                      </label>
                      <p className="mt-2 break-all font-mono text-muted-foreground">{labels.technicalKey}: {transition.key}</p>
                      {transition.condition ? <p className="mt-1 text-muted-foreground">{labels.conditionalRoute}</p> : null}
                    </details>
                  </article>
                })}
                {draft.steps.length < 2 ? <p className="mt-3 text-xs text-muted-foreground">{labels.noDestination}</p> : <form className="mt-3 grid gap-2 rounded-lg border border-dashed p-3" onSubmit={addRoute}>
                  <label className="text-xs font-semibold" htmlFor="new-route-action">{labels.routeAction}
                    <select className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 text-sm font-normal" disabled={!editing || availableRouteActions.length === 0} id="new-route-action" onChange={(event) => setNewRouteAction(event.target.value as ProcessAction)} value={routeActionValue}>
                      {availableRouteActions.map((action) => <option key={action} value={action}>{labels.actionLabels[action]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold" htmlFor="new-route-destination">{labels.routeDestination}
                    <select className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 text-sm font-normal" disabled={!editing} id="new-route-destination" onChange={(event) => setNewRouteTarget(event.target.value)} value={routeTargetValue}>
                      {availableRouteTargets.map((step) => <option key={step.key} value={step.key}>{localizedLabel(step.title, labels.stepLabel)}</option>)}
                      <option value={selectedStep.key}>{localizedLabel(selectedStep.title, labels.stepLabel)}</option>
                    </select>
                  </label>
                  <Button className="justify-self-start" disabled={!editing || availableRouteActions.length === 0} size="sm" type="submit" variant="secondary"><Plus aria-hidden="true" size={14} />{labels.addRoute}</Button>
                </form>}
              </section> : null}

              <details className="border-t pt-3 text-xs">
                <summary className="cursor-pointer font-semibold">{labels.advanced}</summary>
                <dl className="mt-3 grid gap-2">
                  <div><dt className="text-muted-foreground">{labels.technicalKey}</dt><dd className="mt-1 break-all font-mono">{selectedStep.key}</dd></div>
                  <div><dt className="text-muted-foreground">{labels.stepType}</dt><dd className="mt-1 font-mono">{selectedStep.type}</dd></div>
                  {selectedParticipant ? <div><dt className="text-muted-foreground">{labels.responsible}</dt><dd className="mt-1 break-all font-mono">{selectedParticipant.selector.type} · {selectedParticipant.permission}</dd></div> : null}
                  {selectedStep.type === 'FORM' && selectedStep.formKey ? <div><dt className="text-muted-foreground">{labels.form}</dt><dd className="mt-1 break-all font-mono">{selectedStep.formKey}</dd></div> : null}
                  {selectedStepType ? <label className="block font-semibold" htmlFor="process-step-title-en">{labels.stepName} · EN
                    <input className="mt-1 w-full rounded-md border bg-surface px-2.5 py-2 font-normal" disabled={!editing} id="process-step-title-en" onChange={(event) => updateStep(selectedStep.key, (step) => ({ ...step, title: { ...step.title, en: event.target.value } }))} required value={selectedStep.title.en ?? ''} />
                  </label> : null}
                </dl>
              </details>
            </div>
          </> : <div className="grid min-h-40 place-items-center text-center text-sm text-muted-foreground">{labels.noSelection}</div>}
          {selectedStep && issues.filter((issue) => stepIndexForIssue(issue, draft.steps.findIndex((step) => step.key === selectedStep.key))).length > 0 ? <p className="mt-4 rounded-lg border border-destructive/40 p-3 text-xs text-destructive" role="status">{labels.stepIssueCount.replace('{count}', String(issues.filter((issue) => stepIndexForIssue(issue, draft.steps.findIndex((step) => step.key === selectedStep.key))).length))}</p> : null}
        </aside>
      </div>
    </section>
  )
}

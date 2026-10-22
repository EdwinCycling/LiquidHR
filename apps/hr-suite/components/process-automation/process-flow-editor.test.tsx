// @vitest-environment happy-dom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { ProcessFlowEditor, type ProcessFlowEditorLabels } from './process-flow-editor'
import { createEmptyStudioDraft, createTrainingRequestExampleDraft } from '@/lib/process-automation/studio-draft-factories'
import type { ProcessDefinitionDraft } from '@/lib/process-automation/definition-schemas'

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })

const labels: ProcessFlowEditorLabels = {
  stepList: 'Procesflow',
  stepLibrary: 'Stap toevoegen',
  stepName: 'Naam van de stap',
  stepType: 'Soort stap',
  stepTypeLabels: { FORM: 'Invullen', DECISION: 'Beslissing', END: 'Einde' },
  stepTypeLabelsNl: { FORM: 'Invullen', DECISION: 'Beslissing', END: 'Einde' },
  stepTypeLabelsEn: { FORM: 'Fill out', DECISION: 'Decision', END: 'End' },
  responsible: 'Verantwoordelijke',
  responsibleMissing: 'Kies een verantwoordelijke',
  addResponsible: 'Voeg een rol toe',
  roleLabels: { employee: 'Medewerker', manager: 'Manager', 'hr-team': 'HR-team' },
  roleLabelsNl: { employee: 'Medewerker', manager: 'Manager', 'hr-team': 'HR-team' },
  roleLabelsEn: { employee: 'Employee', manager: 'Manager', 'hr-team': 'HR team' },
  roleDescriptions: { employee: 'Aanvrager', manager: 'Directe manager', 'hr-team': 'Bevoegd HR-team' },
  form: 'Formulier',
  noForms: 'Geen formulier gekozen',
  noFormsHelp: 'Koppel een bestaand formulier.',
  addStep: 'Stap toevoegen',
  moveStepUp: 'Stap omhoog',
  moveStepDown: 'Stap omlaag',
  removeStep: 'Stap verwijderen',
  removeStepTitle: 'Stap verwijderen?',
  removeStepDescription: 'Verwijder {step}.',
  confirmRemoveStep: 'Verwijder stap',
  cancelRemoveStep: 'Annuleren',
  selectStep: 'Type nieuwe stap',
  addStepHelp: 'Kies een type stap.',
  emptyFlow: 'Deze procesflow is leeg',
  emptyFlowHelp: 'Voeg een stap toe.',
  selectedStep: 'Geselecteerde stap',
  properties: 'Eigenschappen',
  steps: 'stappen',
  stepLabel: 'Stap',
  routeTitle: 'Overgangen',
  addRoute: 'Overgang toevoegen',
  addRouteHelp: 'Kies actie en bestemming.',
  routeAction: 'Actie',
  routeDestination: 'Volgende stap',
  routeLabel: 'Tekst voor de actie',
  removeRoute: 'Overgang verwijderen',
  noRoutes: 'Nog geen volgende stap ingesteld.',
  noDestination: 'Voeg een andere stap toe.',
  advanced: 'Geavanceerd',
  technicalKey: 'Technische sleutel',
  terminalOutcome: 'Resultaat',
  terminalOutcomes: { COMPLETED: 'Afgerond', REJECTED: 'Afgewezen', CANCELLED: 'Geannuleerd' },
  terminalOutcomesNl: { COMPLETED: 'Afgerond', REJECTED: 'Afgewezen', CANCELLED: 'Geannuleerd' },
  terminalOutcomesEn: { COMPLETED: 'Completed', REJECTED: 'Declined', CANCELLED: 'Cancelled' },
  actionLabels: { SUBMIT: 'Indienen', APPROVE: 'Goedkeuren', REJECT: 'Afwijzen', REQUEST_CHANGES: 'Wijzigingen vragen', ACKNOWLEDGE: 'Bevestigen', COMPLETE: 'Afronden', CANCEL: 'Annuleren' },
  actionLabelsNl: { SUBMIT: 'Indienen', APPROVE: 'Goedkeuren', REJECT: 'Afwijzen', REQUEST_CHANGES: 'Wijzigingen vragen', ACKNOWLEDGE: 'Bevestigen', COMPLETE: 'Afronden', CANCEL: 'Annuleren' },
  actionLabelsEn: { SUBMIT: 'Submit', APPROVE: 'Approve', REJECT: 'Reject', REQUEST_CHANGES: 'Request changes', ACKNOWLEDGE: 'Acknowledge', COMPLETE: 'Complete', CANCEL: 'Cancel' },
  connectionLabel: 'Verbindingen',
  stepNeedsAttention: 'Onvolledig',
  stepIssueCount: '{count} controles nodig',
  conditionalRoute: 'Terugroute voor wijzigingen.',
  formCreationFollowUp: 'Nog geen formulier gekoppeld.',
  startStep: 'Start',
  noSelection: 'Selecteer een stap.',
  unsupportedTypeHelp: 'Dit technische type is alleen-lezen.',
}

interface MountedFlow {
  readonly container: HTMLDivElement
  readonly getDraft: () => ProcessDefinitionDraft
  readonly unmount: () => void
}

function mountFlow(initialDraft: ProcessDefinitionDraft, editing = true): MountedFlow {
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  let currentDraft = initialDraft

  function Harness() {
    const [draft, setDraft] = useState(initialDraft)
    const [activeStepKey, setActiveStepKey] = useState(initialDraft.startStepKey)
    currentDraft = draft
    return createElement(ProcessFlowEditor, {
      activeStepKey,
      draft,
      editing,
      issues: [],
      labels,
      onChangeDraft: (update) => setDraft(update),
      onOpenForms: () => undefined,
      onSelectStep: setActiveStepKey,
    })
  }

  act(() => root.render(createElement(Harness)))
  return {
    container,
    getDraft: () => currentDraft,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function clickButton(container: HTMLElement, label: string): void {
  const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(label))
  if (!button) throw new Error(`Button not found: ${label}`)
  act(() => button.click())
}

async function flushUiEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function changeSelect(container: HTMLElement, id: string, value: string): void {
  const select = container.querySelector<HTMLSelectElement>(`#${id}`)
  if (!select) throw new Error(`Select not found: ${id}`)
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function changeInput(container: HTMLElement, id: string, value: string): void {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)
  if (!input) throw new Error(`Input not found: ${id}`)
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

let mounted: MountedFlow | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('ProcessFlowEditor', () => {
  it('shows a truly empty start and lets an HR editor add a step and a typed responsible role', () => {
    mounted = mountFlow(createEmptyStudioDraft({ key: 'empty-request', title: { nl: 'Leeg verzoek', en: 'Empty request' }, description: { nl: 'Start zonder stappen.', en: 'Start without steps.' } }))

    expect(mounted.container.textContent).toContain(labels.emptyFlow)
    expect(mounted.container.textContent).not.toContain('Interne overplaatsing')
    expect(mounted.container.querySelector('[class*="2xl:grid-cols-"]')).not.toBeNull()

    clickButton(mounted.container, labels.addStep)
    expect(mounted.getDraft().steps).toHaveLength(1)
    expect(mounted.getDraft().startStepKey).toBe(mounted.getDraft().steps[0].key)
    expect(mounted.getDraft().steps[0].title).toEqual({ nl: 'Invullen', en: 'Fill out' })

    const roleDetails = [...mounted.container.querySelectorAll('summary')].find((summary) => summary.textContent === labels.addResponsible)
    expect(roleDetails).toBeDefined()
    act(() => roleDetails?.click())
    clickButton(mounted.container, labels.roleLabels.employee)

    expect(mounted.getDraft().participants).toHaveLength(1)
    expect(mounted.getDraft().steps[0].participantKey).toBe(mounted.getDraft().participants[0].key)
    expect(mounted.getDraft().participants[0].label).toEqual({ nl: 'Medewerker', en: 'Employee' })
    expect(mounted.container.querySelector('#process-step-owner')?.textContent).toContain(labels.roleLabels.employee)

    changeSelect(mounted.container, 'process-step-type', 'END')
    clickButton(mounted.container, labels.addStep)
    const firstStepButton = [...mounted.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Stap 1: Invullen')
    expect(firstStepButton).toBeDefined()
    act(() => firstStepButton?.click())
    changeSelect(mounted.container, 'new-route-action', 'COMPLETE')
    clickButton(mounted.container, labels.addRoute)

    expect(mounted.getDraft().transitions).toHaveLength(1)
    expect(mounted.getDraft().transitions[0]).toMatchObject({
      action: 'COMPLETE',
      toStepKey: mounted.getDraft().steps[1].key,
      kind: 'FORWARD',
      label: { nl: 'Afronden', en: 'Complete' },
    })
  })

  it('lets the editor relink a form, change an owner, and edit a recovery route destination and label', () => {
    const example = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    const linkedForm = { ...example.forms[0], key: 'training-request-review', title: { nl: 'Opleidingsgegevens', en: 'Training details' } }
    const initialDraft: ProcessDefinitionDraft = { ...example, forms: [...example.forms, linkedForm] }
    mounted = mountFlow(initialDraft)

    const managerCard = [...mounted.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Stap 2: Manager beoordeelt')
    expect(managerCard).toBeDefined()
    act(() => managerCard?.click())
    changeSelect(mounted.container, 'process-step-form', linkedForm.key)
    expect(mounted.getDraft().steps.find((step) => step.key === 'manager-review')?.formKey).toBe(linkedForm.key)

    changeSelect(mounted.container, 'process-step-owner', 'hr-team')
    expect(mounted.getDraft().steps.find((step) => step.key === 'manager-review')?.participantKey).toBe('hr-team')

    changeSelect(mounted.container, 'route-target-manager-changes', 'hr-processing')
    changeInput(mounted.container, 'route-label-manager-changes', 'Aanvraag aanvullen')
    expect(mounted.getDraft().transitions.find((transition) => transition.key === 'manager-changes')).toMatchObject({
      toStepKey: 'hr-processing',
      label: { nl: 'Aanvraag aanvullen' },
      kind: 'RECOVERY',
    })
    expect(mounted.container.querySelector(`ul[aria-label^="${labels.connectionLabel}"]`)).not.toBeNull()
  })

  it('lets the editor reorder and remove a step with its routes and repairs the start when needed', async () => {
    const example = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    mounted = mountFlow(example)

    const managerCard = [...mounted.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Stap 2: Manager beoordeelt')
    expect(managerCard).toBeDefined()
    act(() => managerCard?.click())
    clickButton(mounted.container, labels.moveStepUp)
    expect(mounted.getDraft().steps.map((step) => step.key).slice(0, 2)).toEqual(['manager-review', 'employee-request'])
    expect(mounted.getDraft().startStepKey).toBe('employee-request')

    clickButton(mounted.container, labels.removeStep)
    await flushUiEffects()
    expect(document.body.textContent).toContain(labels.removeStepTitle)
    clickButton(document.body, labels.confirmRemoveStep)
    await flushUiEffects()
    expect(mounted.getDraft().steps.some((step) => step.key === 'manager-review')).toBe(false)
    expect(mounted.getDraft().transitions.every((transition) => transition.fromStepKey !== 'manager-review' && transition.toStepKey !== 'manager-review')).toBe(true)
    expect(mounted.getDraft().startStepKey).toBe('employee-request')
    expect(mounted.getDraft().steps.find((step) => step.key === 'employee-request')?.allowedActions).not.toContain('SUBMIT')

    const selectedCard = mounted.container.querySelector('button[aria-current="step"]')
    expect(selectedCard?.getAttribute('aria-label')).toMatch(/^Stap 1:/)
    clickButton(mounted.container, labels.removeStep)
    await flushUiEffects()
    clickButton(document.body, labels.confirmRemoveStep)
    await flushUiEffects()
    expect(mounted.getDraft().startStepKey).toBe('hr-processing')
  })
})

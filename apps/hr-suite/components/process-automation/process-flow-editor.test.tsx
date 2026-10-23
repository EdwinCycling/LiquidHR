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
  technicalKey: 'Interne referentie',
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
  conditionIfTrue: 'Als ja',
  conditionOtherwise: 'Anders',
  language: 'nl',
  conditionEditor: {
    title: 'Wanneer geldt deze route?', add: 'Voorwaarde toevoegen', edit: 'Bewerken', remove: 'Regel verwijderen', field: 'Formulierveld', operator: 'Vergelijking', value: 'Waarde', whenTrue: 'Als ja', otherwise: 'Anders', save: 'Regel opslaan', cancel: 'Annuleren', invalidValue: 'Vul een geldige waarde in voor dit veldtype.', invalidDestination: 'Kies voor beide uitkomsten een bestaande stap.', missingField: 'Deze regel gebruikt een veld of opbouw die de eenvoudige editor niet kan invullen.', missingDestination: 'Stap niet gevonden', pairInvalid: 'Deze voorwaarde heeft geen geldige ja- en nee-route.', yes: 'Ja', no: 'Nee', addValue: 'Waarde toevoegen', removeValue: 'Waarde verwijderen',
    operatorLabels: { equals: 'is gelijk aan', notEquals: 'is niet gelijk aan', greaterThan: 'is hoger dan', lessThan: 'is lager dan', in: 'is een van', notIn: 'is geen van', isEmpty: 'is leeg', isNotEmpty: 'is ingevuld' },
  },
  formCreationFollowUp: 'Nog geen formulier gekoppeld.',
  startStep: 'Start',
  noSelection: 'Selecteer een stap.',
  unsupportedTypeHelp: 'Dit technische type is alleen-lezen.',
  sla: 'Deadline',
  slaOptions: { NONE: 'Geen deadline', MINUTES: 'Minuten', HOURS: 'Uren', DAYS: 'Kalenderdagen', WORKDAYS: 'Werkdagen' },
  slaAmount: 'Aantal',
  slaInvalidAmount: 'Vul minimaal 1 in.',
  slaTiming: 'De termijn begint na activering en toewijzing.',
  slaSummary: 'Deze stap moet binnen {amount} {unit} worden afgerond.',
  slaWorkdaysBlocked: 'Er is geen proceskalender gekoppeld.',
  slaUnitLabels: { MINUTES: { singular: 'minuut', plural: 'minuten' }, HOURS: { singular: 'uur', plural: 'uur' }, DAYS: { singular: 'kalenderdag', plural: 'kalenderdagen' } },
  slaNotifications: 'Herinneringen en escalaties',
  slaNotificationsHelp: 'Meldingen worden als in-app herinnering verstuurd.',
  slaNoDeadlineReminders: 'Kies eerst een deadline.',
  slaNoResponsibleForReminders: 'Wijs eerst een verantwoordelijke toe.',
  slaBeforeDeadline: 'Herinnering vooraf',
  slaBeforeDeadlineOptions: { NONE: 'Geen herinnering vooraf', ONE_HOUR: '1 uur vooraf', TWENTY_FOUR_HOURS: '24 uur vooraf' },
  slaAtDeadline: 'Herinnering op de deadline',
  slaAtDeadlineOptions: { YES: 'Ja', NO: 'Nee' },
  slaOnBreach: 'Als de deadline is verstreken',
  slaBreachOptions: { NOTIFY: 'Herinner de verantwoordelijke', ESCALATE: 'Escaleren', BLOCK: 'Markeren voor beheer' },
  slaEscalationParticipant: 'Melding naar',
  slaEscalationParticipantPlaceholder: 'Kies een verantwoordelijke',
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

function chooseDropdown(container: HTMLElement, id: string, label: string): void {
  const trigger = container.querySelector<HTMLButtonElement>(`#${id}`)
  if (!trigger) throw new Error(`Dropdown not found: ${id}`)
  act(() => trigger.click())
  const option = [...document.querySelectorAll<HTMLButtonElement>('[role=option]')].find((candidate) => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Dropdown option not found: ${label}`)
  act(() => option.click())
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
  it('configures an accessible hour deadline, validates its amount, and blocks working days without a calendar', () => {
    mounted = mountFlow(createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } }))

    const noDeadline = mounted.container.querySelector<HTMLInputElement>('input[type="radio"][value="NONE"]')
    const workdays = mounted.container.querySelector<HTMLInputElement>('input[type="radio"][value="WORKDAYS"]')
    expect(noDeadline?.checked).toBe(true)
    expect(workdays?.disabled).toBe(true)
    expect(workdays?.getAttribute('aria-describedby')).toBeTruthy()
    expect(mounted.container.textContent).toContain(labels.slaNoDeadlineReminders)

    const hours = mounted.container.querySelector<HTMLInputElement>('input[type="radio"][value="HOURS"]')
    if (!hours) throw new Error('Hours option not found')
    act(() => hours.click())
    changeInput(mounted.container, 'process-step-sla-amount', '3')

    expect(mounted.getDraft().steps[0]?.sla).toMatchObject({ duration: { amount: 3, unit: 'HOURS' }, businessDays: false })
    expect(mounted.container.textContent).toContain('Deze stap moet binnen 3 uur worden afgerond.')

    const oneHourBefore = mounted.container.querySelector<HTMLInputElement>('input[type="radio"][value="ONE_HOUR"]')
    const noAtDeadline = mounted.container.querySelector<HTMLInputElement>('input[type="radio"][value="NO"]')
    if (!oneHourBefore || !noAtDeadline) throw new Error('Reminder choices not found')
    act(() => oneHourBefore.click())
    act(() => noAtDeadline.click())
    expect(mounted.getDraft().steps[0]?.sla?.notifications).toEqual({ beforeDeadline: 'ONE_HOUR', atDeadline: false })
    expect(mounted.container.querySelector('#process-step-sla-on-breach')).not.toBeNull()

    changeInput(mounted.container, 'process-step-sla-amount', '0')
    expect(mounted.container.querySelector('#process-step-sla-amount')?.getAttribute('aria-invalid')).toBe('true')
    expect(mounted.container.textContent).toContain(labels.slaInvalidAmount)

    const reset = mounted.container.querySelector<HTMLInputElement>('input[type="radio"][value="NONE"]')
    if (!reset) throw new Error('No-deadline option not found')
    act(() => reset.click())
    expect(mounted.getDraft().steps[0]?.sla).toBeUndefined()
  })

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

  it('builds and removes a typed yes-or-otherwise route pair', () => {
    const example = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    example.steps = example.steps.map((step) => step.key === 'hr-processing'
      ? { ...step, title: { ...step.title, nl: 'Extra HR-beoordeling', en: 'Additional HR review' } }
      : step.key === 'manager-review'
        ? { ...step, title: { ...step.title, nl: 'Normale afhandeling', en: 'Normal handling' } }
        : step)
    mounted = mountFlow(example)

    clickButton(mounted.container, labels.conditionEditor.add)
    expect(mounted.container.querySelector('[role=alert]')?.textContent).toBe(labels.conditionEditor.invalidValue)
    chooseDropdown(mounted.container, 'condition-employee-request-field', 'Wat zijn de verwachte kosten?')
    chooseDropdown(mounted.container, 'condition-employee-request-operator', labels.conditionEditor.operatorLabels.greaterThan)
    changeInput(mounted.container, 'condition-employee-request-value', '1000')
    chooseDropdown(mounted.container, 'condition-yes-employee-request', 'Extra HR-beoordeling')
    chooseDropdown(mounted.container, 'condition-otherwise-employee-request', 'Normale afhandeling')
    clickButton(mounted.container, labels.conditionEditor.save)

    const yesRoute = mounted.getDraft().transitions.find((route) => route.condition?.operator === 'greaterThan')
    const otherwiseRoute = mounted.getDraft().transitions.find((route) => route.condition?.operator === 'not')
    expect(yesRoute).toMatchObject({ action: 'SUBMIT', toStepKey: 'hr-processing', condition: { operator: 'greaterThan', left: { kind: 'FIELD', fieldKey: 'training-expected-cost' }, right: { kind: 'LITERAL', value: 1000 } } })
    expect(otherwiseRoute).toMatchObject({ action: 'SUBMIT', toStepKey: 'manager-review', condition: { operator: 'not', condition: yesRoute?.condition } })
    expect(mounted.container.textContent).toContain('1.000,00')
    expect(mounted.container.textContent).toContain('Als ja: Extra HR-beoordeling')
    expect(mounted.container.textContent).toContain('Anders: Normale afhandeling')

    clickButton(mounted.container, labels.conditionEditor.remove)
    expect(mounted.getDraft().transitions.filter((route) => route.fromStepKey === 'employee-request')).toHaveLength(1)
    expect(mounted.getDraft().transitions.find((route) => route.key === 'request-submit')?.condition).toBeUndefined()
  })
  it('lets the HR Admin choose which existing action receives a condition', () => {
    mounted = mountFlow(createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } }))
    const managerCard = [...mounted.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Stap 2: Manager beoordeelt')
    if (!managerCard) throw new Error('Manager step not found')
    act(() => managerCard.click())
    clickButton(mounted.container, labels.conditionEditor.add)
    chooseDropdown(mounted.container, 'condition-action-manager-review', labels.actionLabels.REJECT)
    chooseDropdown(mounted.container, 'condition-manager-review-field', 'Wat zijn de verwachte kosten?')
    chooseDropdown(mounted.container, 'condition-manager-review-operator', labels.conditionEditor.operatorLabels.greaterThan)
    changeInput(mounted.container, 'condition-manager-review-value', '1000')
    chooseDropdown(mounted.container, 'condition-yes-manager-review', 'HR verwerkt de aanvraag')
    chooseDropdown(mounted.container, 'condition-otherwise-manager-review', 'Afgewezen')
    clickButton(mounted.container, labels.conditionEditor.save)

    expect(mounted.getDraft().transitions.find((route) => route.key === 'manager-reject')?.condition).toMatchObject({ operator: 'greaterThan' })
    expect(mounted.getDraft().transitions.find((route) => route.key === 'manager-reject')?.action).toBe('REJECT')
    expect(mounted.getDraft().transitions.find((route) => route.key === 'manager-approve')?.condition).toBeUndefined()
    expect(mounted.getDraft().transitions.find((route) => route.key === 'manager-changes')?.kind).toBe('RECOVERY')
  })
  it('shows every existing yes-or-otherwise pair and leaves other actions unchanged', () => {
    const example = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    const condition = { operator: 'greaterThan' as const, left: { kind: 'FIELD' as const, fieldKey: 'training-expected-cost' }, right: { kind: 'LITERAL' as const, value: 1000 } }
    const reject = example.transitions.find((route) => route.key === 'manager-reject')
    if (!reject) throw new Error('Reject route not found')
    example.transitions = example.transitions.map((route) => route.key === 'manager-approve' ? { ...route, condition } : route)
    example.transitions.push({ ...example.transitions.find((route) => route.key === 'manager-approve')!, key: 'manager-approve-otherwise', toStepKey: 'hr-processing', condition: { operator: 'not', condition } })
    example.transitions = example.transitions.map((route) => route.key === 'manager-reject' ? { ...route, condition } : route)
    example.transitions.push({ ...reject, key: 'manager-reject-otherwise', toStepKey: 'hr-processing', condition: { operator: 'not', condition } })
    mounted = mountFlow(example)
    const managerCard = [...mounted.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Stap 2: Manager beoordeelt')
    if (!managerCard) throw new Error('Manager step not found')
    act(() => managerCard.click())

    const ruleCards = mounted.container.querySelectorAll('[aria-label="Wanneer geldt deze route?"] li')
    expect(ruleCards).toHaveLength(2)
    expect(mounted.container.textContent).toContain('Goedkeuren')
    expect(mounted.container.textContent).toContain('Afwijzen')
    expect(mounted.container.textContent).toContain('Als ja: HR verwerkt de aanvraag')
    expect(mounted.container.textContent).toContain('Als ja: Afgewezen')
  })
  it('surfaces an unmatched route to a deleted step and lets the admin remove that broken route', () => {
    const example = createTrainingRequestExampleDraft({ key: 'opleiding-aanvragen', title: { nl: 'Opleidingsaanvraag', en: 'Training request' }, description: { nl: 'Aanvraag en beoordeling.', en: 'Request and review.' } })
    const condition = { operator: 'greaterThan' as const, left: { kind: 'FIELD' as const, fieldKey: 'training-expected-cost' }, right: { kind: 'LITERAL' as const, value: 1000 } }
    example.transitions = example.transitions.map((route) => route.key === 'manager-approve' ? { ...route, toStepKey: 'removed-step', condition } : route)
    mounted = mountFlow(example)
    const managerCard = [...mounted.container.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Stap 2: Manager beoordeelt')
    if (!managerCard) throw new Error('Manager step not found')
    act(() => managerCard.click())

    expect(mounted.container.textContent).toContain(labels.conditionEditor.pairInvalid)
    expect(mounted.container.textContent).toContain(labels.conditionEditor.missingDestination)
    clickButton(mounted.container, labels.conditionEditor.remove)
    expect(mounted.getDraft().transitions.some((route) => route.key === 'manager-approve')).toBe(false)
    expect(mounted.getDraft().transitions.some((route) => route.key === 'manager-reject')).toBe(true)
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

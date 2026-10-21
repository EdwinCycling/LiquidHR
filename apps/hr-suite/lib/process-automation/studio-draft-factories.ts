import type { ProcessDefinitionDraft } from './definition-schemas'

export interface StudioDraftIdentity {
  readonly key: string
  readonly title: { readonly nl: string; readonly en: string }
  readonly description: { readonly nl: string; readonly en: string }
}

const localized = (nl: string, en = nl) => ({ nl, en })

export function createEmptyStudioDraft(identity: StudioDraftIdentity): ProcessDefinitionDraft {
  return {
    schemaVersion: 1,
    key: identity.key,
    status: 'DRAFT',
    title: localized(identity.title.nl, identity.title.en),
    description: localized(identity.description.nl, identity.description.en),
    enabledLanguages: ['nl', 'en'],
    startStepKey: 'start',
    participants: [],
    forms: [],
    steps: [],
    transitions: [],
  }
}

export function createTrainingRequestExampleDraft(identity: StudioDraftIdentity): ProcessDefinitionDraft {
  const employee = 'employee'
  const manager = 'manager'
  const hrTeam = 'hr-team'
  const requestForm = 'training-request'
  const fieldAccess = [
    { participantKey: employee, mode: 'WRITE_REQUIRED' as const },
    { participantKey: manager, mode: 'READ' as const },
    { participantKey: hrTeam, mode: 'READ' as const },
  ]

  return {
    schemaVersion: 1,
    key: identity.key,
    status: 'DRAFT',
    title: localized(identity.title.nl, identity.title.en),
    description: localized(identity.description.nl, identity.description.en),
    enabledLanguages: ['nl', 'en'],
    startStepKey: 'employee-request',
    participants: [
      {
        key: employee,
        label: localized('Medewerker', 'Employee'),
        selector: { type: 'INITIATOR', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
        assignmentMode: 'EXACTLY_ONE',
        permission: 'self:process-instance:start',
      },
      {
        key: manager,
        label: localized('Manager van de medewerker', 'Employee manager'),
        selector: { type: 'DIRECT_MANAGER_OF_SUBJECT', resolutionDatePolicy: 'STEP_ACTIVATED_AT' },
        assignmentMode: 'EXACTLY_ONE',
        permission: 'process-task:act',
      },
      {
        key: hrTeam,
        label: localized('HR-team', 'HR team'),
        selector: {
          type: 'PERMISSION_WORK_QUEUE',
          permission: 'process-task:act',
          queueKey: 'hr-processes',
          resolutionDatePolicy: 'STEP_ACTIVATED_AT',
        },
        assignmentMode: 'ANY_ONE',
        permission: 'process-task:act',
      },
    ],
    forms: [
      {
        key: requestForm,
        version: 1,
        title: localized('Opleidingsaanvraag', 'Training request'),
        description: localized('Een voorbeeldformulier zonder domeinmutaties.', 'An example form with no domain writes.'),
        sections: [
          {
            key: 'request-details',
            title: localized('Aanvraag', 'Request'),
            fields: [
              {
                key: 'training-name',
                label: localized('Welke opleiding wil je volgen?', 'Which training would you like to take?'),
                type: 'SHORT_TEXT',
                binding: { kind: 'PROCESS_ONLY' },
                access: fieldAccess,
              },
              {
                key: 'training-reason',
                label: localized('Waarom past deze opleiding bij je werk?', 'How is this training relevant to your work?'),
                type: 'LONG_TEXT',
                binding: { kind: 'PROCESS_ONLY' },
                access: fieldAccess,
              },
            ],
          },
        ],
      },
    ],
    steps: [
      {
        key: 'employee-request',
        type: 'FORM',
        title: localized('Opleiding aanvragen', 'Request training'),
        participantKey: employee,
        formKey: requestForm,
        allowedActions: ['SUBMIT'],
      },
      {
        key: 'manager-review',
        type: 'DECISION',
        title: localized('Manager beoordeelt', 'Manager reviews'),
        participantKey: manager,
        formKey: requestForm,
        allowedActions: ['APPROVE', 'REJECT', 'REQUEST_CHANGES'],
      },
      {
        key: 'hr-processing',
        type: 'FORM',
        title: localized('HR verwerkt de aanvraag', 'HR processes the request'),
        participantKey: hrTeam,
        formKey: requestForm,
        allowedActions: ['COMPLETE'],
      },
      {
        key: 'completed',
        type: 'END',
        title: localized('Afgerond', 'Completed'),
        allowedActions: [],
        terminalOutcome: 'COMPLETED',
      },
      {
        key: 'rejected',
        type: 'END',
        title: localized('Afgewezen', 'Declined'),
        allowedActions: [],
        terminalOutcome: 'REJECTED',
      },
    ],
    transitions: [
      { key: 'request-submit', fromStepKey: 'employee-request', toStepKey: 'manager-review', action: 'SUBMIT', kind: 'FORWARD', label: localized('Aanvraag indienen', 'Submit request') },
      { key: 'manager-approve', fromStepKey: 'manager-review', toStepKey: 'hr-processing', action: 'APPROVE', kind: 'FORWARD', label: localized('Goedkeuren', 'Approve') },
      { key: 'manager-reject', fromStepKey: 'manager-review', toStepKey: 'rejected', action: 'REJECT', kind: 'FORWARD', label: localized('Afwijzen', 'Decline') },
      { key: 'manager-changes', fromStepKey: 'manager-review', toStepKey: 'employee-request', action: 'REQUEST_CHANGES', kind: 'RECOVERY', label: localized('Wijzigingen vragen', 'Request changes') },
      { key: 'hr-complete', fromStepKey: 'hr-processing', toStepKey: 'completed', action: 'COMPLETE', kind: 'FORWARD', label: localized('Afronden', 'Complete') },
    ],
  }
}

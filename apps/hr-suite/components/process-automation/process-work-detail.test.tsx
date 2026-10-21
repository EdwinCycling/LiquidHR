import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { FormProjection } from '@/lib/process-automation/form-runtime'
import type { ProcessWorkDetail, ProcessWorkExperience } from '@/lib/process-automation/work-service'
import { ProcessWorkDetailView, type ProcessWorkDetailLabels } from './process-work-detail'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = new Proxy({} as ProcessWorkDetailLabels, {
  get: (_target, property: string | symbol) => property === 'changeRequests' ? 'Gevraagde aanpassingen' : ({
    process: 'Proces', subject: 'Medewerker', step: 'Stap', status: 'Status', assignment: 'Toewijzing', assignmentMode: 'Modus', assignmentSource: 'Bron', assignmentDate: 'Bepaald op', assignmentRole: 'Verantwoordelijke', progress: 'Voortgang', timeline: 'Historie', form: 'Formulier', output: 'Uitvoer', deadline: 'Deadline', overdue: 'Over tijd', availableAt: 'Beschikbaar vanaf', claimedBy: 'Geclaimd door', unassigned: 'Niet toegewezen', claim: 'Claimen', release: 'Vrijgeven', reassign: 'Opnieuw toewijzen', reResolve: 'Opnieuw bepalen', reassignEmployee: 'Nieuwe medewerker', reassignSubmit: 'Toewijzen', assignmentOptionsEmpty: 'Geen kandidaten', backToWork: 'Terug naar Werk', action: 'Actie uitvoeren', success: 'Verwerkt', stale: 'Verouderd', denied: 'Geen toegang', blocked: 'Geblokkeerd', errorClaimRace: 'Al geclaimd', errorStale: 'Intussen gewijzigd', errorDenied: 'Niet toegestaan', errorBlocked: 'Geblokkeerd', errorGeneric: 'Niet gelukt', unknown: 'Onbekend', download: 'Downloaden', downloadUnavailable: 'Niet beschikbaar', outputPending: 'Wordt gemaakt', outputAvailable: 'Beschikbaar', outputFailed: 'Mislukt', operations: 'Technische status', lastAttempt: 'Laatste poging', recovery: 'Herstel', retry: 'Herstellen', actionSubmit: 'Indienen', actionApprove: 'Goedkeuren', actionReject: 'Afwijzen', actionRequestChanges: 'Wijzigingen vragen', actionAcknowledge: 'Bevestigen', actionComplete: 'Afronden', actionCancel: 'Annuleren', formCurrentValue: 'Huidige waarde', formNewValue: 'Nieuwe waarde', formSaving: 'Opslaan', formSaved: 'Opgeslagen', formSaveError: 'Opslaan mislukt', formStale: 'Verouderd', formSave: 'Opslaan', formErrorSummary: 'Controleer velden', formRequired: 'Verplicht', formInvalid: 'Ongeldig', formReadOnly: 'Alleen lezen', formNoValue: 'Geen waarde', formBooleanTrue: 'Ja', formBooleanFalse: 'Nee', formReferenceSearch: 'Zoeken', formReferenceLoading: 'Laden', formReferenceNoOptions: 'Geen resultaten', formScrollHint: 'Meer velden', documentDownload: 'Document openen', documentChecksum: 'Controle', documentAcknowledgementRequired: 'Bevestig', requesterAudience: 'Jouw aanvraag', requesterSaveExplanation: 'Concept', requesterDraftSave: 'Concept bewaren', requesterFinalSubmit: 'Definitief indienen', requesterActionNeeded: 'Jouw actie is nodig', requesterWaitingForRole: 'Bij {role}', requesterResponsible: 'Verantwoordelijke', requesterYou: 'Jij', requesterManager: 'Manager', requesterHr: 'HR', requesterInProgress: 'In behandeling', requesterCompleted: 'Afgerond', requesterRejected: 'Afgewezen', requesterChangesRequested: 'Aanvulling gevraagd', requesterTakeAction: 'Aanvraag openen', statusOpen: 'Open', statusClaimed: 'In behandeling', statusBlocked: 'Geblokkeerd', statusCompleted: 'Afgerond', statusCancelled: 'Geannuleerd', statusExpired: 'Verlopen', statusWaiting: 'Wacht op anderen', statusInProgress: 'In behandeling', statusChangesRequested: 'Aanvulling gevraagd', statusRejected: 'Afgewezen', statusUnknown: 'Onbekend', assignmentReason: 'Waarom deze taak', assignmentReasonManager: 'Je bent de manager van deze medewerker.', assignmentReasonHr: 'Deze taak is aan je HR-rol toegewezen.', assignmentReasonEmployee: 'Je hebt deze aanvraag gestart.', assignmentReasonGeneral: 'Deze stap hoort bij de rol {role}.', progressStepCompleted: 'Afgerond', progressStepCurrent: 'Huidige stap', progressStepUpcoming: 'Komt hierna', progressStepEnded: 'Afgesloten', workActionNeeded: 'Deze taak hoort bij {role}; je kunt de stap nu behandelen.', workWaitingForRole: 'Deze stap hoort bij {role}. Er is nu geen actie voor jou beschikbaar.', nextPossibleResults: 'Mogelijke vervolgstappen', conditionalResult: 'Afhankelijk van de aanvraag', historyStarted: 'Aanvraag gestart', historyStepActivated: 'Stap actief', historyAction: 'Actie vastgelegd', historyCompleted: 'Proces afgerond', historyRejected: 'Proces afgewezen', historyCancelled: 'Proces geannuleerd', historyResubmitted: 'Opnieuw ingediend', historyEmpty: 'Geen historie.', technicalDetails: 'Technische beheerinformatie', hrActionContext: 'De procesuitkomst wordt vastgelegd.', confirmAction: 'Weet je zeker dat je deze actie wilt uitvoeren?', requestChangesReason: 'Wat moet worden aangepast?', requestChangesReasonRequired: 'Geef een reden op.', requestChangesSubmit: 'Wijzigingen vragen', internalTransferPreview: 'Voorbeeld', internalTransferPreviewDescription: 'Preview', internalTransferCurrent: 'Huidig', internalTransferProposed: 'Voorgesteld', internalTransferDepartment: 'Afdeling', internalTransferJob: 'Functie', internalTransferManager: 'Manager', internalTransferBlockers: 'Blokkades', internalTransferWarnings: 'Aandachtspunten', internalTransferPreviewSuccess: 'Klaar', internalTransferPreviewWarning: 'Controleren', internalTransferPreviewBlocking: 'Geblokkeerd', internalTransferCommit: 'Bevestigen', internalTransferCommitConfirm: 'Bevestig', internalTransferCommitting: 'Bezig', internalTransferCommitFailed: 'Mislukt', internalTransferChanged: 'Gewijzigd', internalTransferNoSalary: 'Geen salaris', internalTransferLoading: 'Laden', internalTransferFailed: 'Mislukt',
  }[String(property)] ?? String(property)),
})

const detail: ProcessWorkDetail = {
  workItemId: '00000000-0000-4000-8000-000000000001', processInstanceId: '00000000-0000-4000-8000-000000000002', processDefinitionId: '00000000-0000-4000-8000-000000000003', processKey: 'training_request_v1', processTitle: 'Opleidingsaanvraag', processDescription: 'Een opleiding aanvragen.', subjectEmployeeId: '00000000-0000-4000-8000-000000000004', subjectName: 'Ada Lovelace', instanceStatus: 'RUNNING', currentStepKey: 'manager-review', instanceVersion: 2, startedAt: '2026-10-01T08:00:00.000Z', completedAt: null, correlationId: '00000000-0000-4000-8000-000000000005', stepKey: 'manager-review', stepTitle: 'Manager beoordeelt', participantKey: 'manager', assignmentMode: 'EXACTLY_ONE', assignmentExplanation: { roleCode: 'DIRECT_MANAGER', source: 'DIRECT_MANAGER_OF_SUBJECT' }, status: 'OPEN', expectedVersion: 2, stepExpectedVersion: 1, claimedByUserId: null, assigneeEmployeeId: null, claimedAt: null, availableAt: '2026-10-01T08:00:00.000Z', deadlineAt: null, isOverdue: false, canAct: true, canClaim: true, canRelease: false, canReassign: false, allowedActions: ['APPROVE', 'REJECT', 'REQUEST_CHANGES'], steps: [{ id: '00000000-0000-4000-8000-000000000006', stepKey: 'manager-review', status: 'ACTIVE', expectedVersion: 1, activatedAt: '2026-10-01T08:00:00.000Z', completedAt: null, deadlineAt: null }], workItems: [], timeline: [], businessType: 'P_MUTATION', businessCategory: 'GENERAL', businessStatus: 'OPEN', leaveRequestId: null, leaveRequest: null,
}

const experience: ProcessWorkExperience = {
  steps: [{ stepKey: 'manager-review', title: 'Manager beoordeelt' }, { stepKey: 'employee-update', title: 'Medewerker past aan' }],
  history: [
    { id: '00000000-0000-4000-8000-000000000007', eventType: 'PROCESS_STARTED', action: null, stepTitle: null, terminalOutcome: null, createdAt: '2026-10-01T08:00:00.000Z' },
    { id: '00000000-0000-4000-8000-000000000008', eventType: 'PROCESS_WORK_ITEM_ACTIONED', action: 'REQUEST_CHANGES', stepTitle: 'Manager beoordeelt', terminalOutcome: null, createdAt: '2026-10-02T08:00:00.000Z' },
    { id: '00000000-0000-4000-8000-000000000009', eventType: 'PROCESS_WORK_ITEM_ACTIONED', action: 'SUBMIT', stepTitle: 'Medewerker past aan', terminalOutcome: null, createdAt: '2026-10-03T08:00:00.000Z' },
  ],
  changeRequests: [{ id: '00000000-0000-4000-8000-000000000010', body: 'Pas de gewenste startdatum aan en voeg een kostenraming toe.', createdAt: '2026-10-02T08:00:00.000Z' }],
  nextRoutes: [
    { action: 'APPROVE', label: 'Goedkeuren', toStepTitle: 'HR verwerkt', terminalOutcome: null, isConditional: false },
    { action: 'REQUEST_CHANGES', label: 'Wijzigingen vragen', toStepTitle: 'Medewerker past aan', terminalOutcome: null, isConditional: false },
  ],
}

const form: FormProjection = {
  responseId: null,
  workItemId: detail.workItemId,
  processInstanceId: detail.processInstanceId,
  stepInstanceId: detail.steps[0]!.id,
  stepKey: detail.stepKey,
  participantKey: 'manager',
  formKey: 'training_request_form',
  formVersionId: '00000000-0000-4000-8000-000000000011',
  language: 'nl',
  status: 'IN_PROGRESS',
  revision: 0,
  expectedVersion: detail.expectedVersion,
  title: 'Opleidingsgegevens',
  description: 'Controleer de aanvraag.',
  sections: [{
    key: 'training',
    title: 'Opleiding',
    fields: [{ key: 'training_name', label: 'Naam opleiding', helpText: null, type: 'SHORT_TEXT', accessMode: 'WRITE_REQUIRED', required: true, options: [], currentValue: null, newValue: null }],
  }],
  summary: [],
  htmlSummary: '',
  availableLanguages: ['nl'],
}

describe('ProcessWorkDetailView', () => {
  it('maakt MSS-besluit, vervolg en herindiening begrijpelijk zonder technische codes of ids', () => {
    const markup = renderToStaticMarkup(createElement(ProcessWorkDetailView, {
      detail,
      experience,
      form: null,
      outputs: null,
      operations: null,
      locale: 'nl',
      labels,
      assignmentOptions: [],
      backHref: '/work?view=WORK',
    }))

    expect(markup).toContain('Opleidingsaanvraag')
    expect(markup).toContain('Manager beoordeelt')
    expect(markup).toContain('HR verwerkt')
    expect(markup).toContain('Waarom deze taak')
    expect(markup).toContain('Wijzigingen vragen')
    expect(markup).toContain('Gevraagde aanpassingen')
    expect(markup).toContain('Pas de gewenste startdatum aan en voeg een kostenraming toe.')
    expect(markup).toContain('Opnieuw ingediend')
    expect(markup).not.toContain('training_request_v1')
    expect(markup).not.toContain(detail.workItemId)
    expect(markup).not.toContain('PROCESS_WORK_ITEM_ACTIONED')
    expect(markup.match(/ui-button-primary/g)?.length).toBe(1)
  })

  it('embedt het dynamische formulier zonder tweede paginakop of interne scroll', () => {
    const markup = renderToStaticMarkup(createElement(ProcessWorkDetailView, {
      detail,
      experience,
      form,
      outputs: null,
      operations: null,
      locale: 'nl',
      labels,
      assignmentOptions: [],
      backHref: '/work?view=WORK',
    }))

    expect(markup.match(/<h1(?:\s|>)/g)?.length).toBe(1)
    expect(markup).toContain('<h2 class="mt-2 text-xl font-semibold tracking-tight">Opleidingsgegevens</h2>')
    expect(markup).toContain('Manager')
    expect(markup).toContain('Naam opleiding')
    expect(markup).toContain('button-secondary')
    expect(markup).not.toContain('training_request_form')
    expect(markup).not.toContain('max-h-[calc(100vh-14rem)]')
    expect(markup).not.toContain('overflow-y-auto')
  })

  it.each([
    { instanceStatus: 'CANCELLED', status: 'CANCELLED', businessStatus: 'CANCELLED', label: 'Geannuleerd' },
    { instanceStatus: 'RUNNING', status: 'EXPIRED', businessStatus: 'EXPIRED', label: 'Verlopen' },
    { instanceStatus: 'RUNNING', status: 'BLOCKED', businessStatus: 'BLOCKED', label: 'Geblokkeerd' },
  ])('toont een begrijpelijke aanvraagstatus voor $status', ({ instanceStatus, status, businessStatus, label }) => {
    const markup = renderToStaticMarkup(createElement(ProcessWorkDetailView, {
      detail: { ...detail, instanceStatus, status, businessStatus },
      experience,
      form: null,
      outputs: null,
      operations: null,
      locale: 'nl',
      labels,
      assignmentOptions: [],
      backHref: '/work?view=REQUESTS',
      isRequesterPresentation: true,
    }))

    expect(markup).toContain(label)
    expect(markup).not.toContain('In behandeling')
  })
  it('lekt onbekende engine-acties niet als zichtbare technische codes', () => {
    const markup = renderToStaticMarkup(createElement(ProcessWorkDetailView, {
      detail: { ...detail, allowedActions: ['UNRECOGNIZED_ENGINE_ACTION'] },
      experience,
      form: null,
      outputs: null,
      operations: null,
      locale: 'nl',
      labels,
      assignmentOptions: [],
      backHref: '/work?view=WORK',
    }))

    expect(markup).toContain('Onbekend')
    expect(markup).not.toContain('UNRECOGNIZED_ENGINE_ACTION')
  })
})

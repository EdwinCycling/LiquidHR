import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ProcessWorkItem, ProcessWorkList, ProcessWorkTabCounts } from '@/lib/process-automation/work-service'
import type { StartableProcess } from '@/lib/process-automation/start-catalog-service'
import { ProcessWorkWorkspace, type ProcessWorkspaceLabels } from './process-workspace'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const labels = new Proxy({} as ProcessWorkspaceLabels, {
  get: (_target, property: string | symbol) => ({
    workspaceTitle: 'Werk', workspaceDescription: 'Proceswerk in één overzicht.', tabsTodo: 'Te doen', tabsClaimed: 'Geclaimd', tabsWaiting: 'Wacht op anderen', tabsCompleted: 'Afgerond', tabsAll: 'Alles', searchPlaceholder: 'Zoek werk', statusFilter: 'Status', processFilter: 'Proces', administrationFilter: 'Administratie', applyFilters: 'Toepassen', statusAll: 'Alle statussen', statusOpen: 'Open', statusClaimed: 'Geclaimd', statusBlocked: 'Geblokkeerd', statusCompleted: 'Afgerond', statusCancelled: 'Geannuleerd', statusExpired: 'Verlopen', sort: 'Sorteren', sortNeedsAction: 'Actie nodig', sortDeadline: 'Deadline', columnsProcess: 'Proces', subject: 'Onderwerp', step: 'Stap', assignment: 'Toewijzing', status: 'Status', deadline: 'Deadline', actions: 'Acties', assignmentMode: 'Modus', assignmentSource: 'Bron', assignmentDate: 'Bepaald op', assignmentRole: 'Rol', assignmentAnyOne: 'Eén van de kandidaten', assignmentQueue: 'Werkqueue', assignmentDirect: 'Direct', assignmentScope: 'Scope', assignmentProcess: 'Proces', unknown: 'Onbekend', noItems: 'Geen werk', noItemsDescription: 'Pas je filters aan.', loading: 'Laden…', readError: 'Laden mislukt', denied: 'Geen toegang', blocked: 'Geblokkeerd', overdue: 'Over tijd', dueToday: 'Vandaag', currentPage: 'Op deze pagina', availableAt: 'Beschikbaar', claimedBy: 'Geclaimd door', unassigned: 'Niet toegewezen', open: 'Openen', totalItems: 'werkitems', allProcesses: 'Alle processen', allAdministrations: 'Alle administraties', resultsCount: '{from}–{to} van {count}', pageOf: 'Pagina {page} van {pages}', previous: 'Vorige', next: 'Volgende', startInternalTransfer: 'Interne overplaatsing starten', startDocumentAcknowledgement: 'Documentkennisname starten',
    myWork: 'Mijn werk', myRequests: 'Mijn aanvragen', statusWaiting: 'Wacht op manager', statusInProgress: 'In behandeling', statusChangesRequested: 'Wijziging gevraagd', statusRejected: 'Afgewezen', businessTypeFilter: 'Type', businessCategoryFilter: 'Categorie', businessType: 'Type', businessCategory: 'Categorie', allBusinessTypes: 'Alle typen', allBusinessCategories: 'Alle categorieën', businessTypePMutation: 'P-mutatie', businessTypeLeave: 'Verlof', businessTypeActualWork: 'Werkelijke uren', businessTypeOther: 'Overig', businessCategoryGeneral: 'Algemeen', businessCategoryInternalTransfer: 'Interne overplaatsing', businessCategoryDocumentAcknowledgement: 'Documentkennisname', businessCategoryLeaveRequest: 'Verlofaanvraag', businessCategoryActualWorkEntry: 'Urenregistratie', startLeaveRequest: 'Verlof aanvragen', nextResponsible: 'Volgende verantwoordelijke', responsibleYou: 'Jij', responsibleManager: 'Manager', responsibleHr: 'HR', newRequestTitle: 'Nieuwe aanvraag', newRequestDescription: 'Kies een proces.', processSteps: 'Verwachte stappen', processRoutes: 'Vervolgroutes', processResponsible: 'Verantwoordelijke', processStartStep: 'Eerste stap', processStart: 'Aanvraag starten', processStarting: 'Starten…', processCatalogEmpty: 'Geen processen beschikbaar.', processCatalogEmptyWithNativeStarters: 'Er zijn geen extra processen. Gebruik de beschikbare startknoppen bovenaan.', processCatalogLoadError: 'Laden mislukt.', processStartFailed: 'Starten mislukt.', processStartDenied: 'Geen toegang.', processStartUnavailable: 'Niet beschikbaar.',
  }[String(property)] ?? String(property)),
})

const item: ProcessWorkItem = {
  workItemId: '00000000-0000-4000-8000-000000000001', processInstanceId: '00000000-0000-4000-8000-000000000002', stepInstanceId: '00000000-0000-4000-8000-000000000003', processDefinitionId: '00000000-0000-4000-8000-000000000004', processKey: 'P10', processTitle: 'Documentkennisname', subjectEmployeeId: '00000000-0000-4000-8000-000000000005', subjectEmploymentId: null, subjectName: 'Ada Lovelace', stepKey: 'acknowledge', stepTitle: 'Bevestigen', participantKey: 'employee', assignmentMode: 'ANY_ONE', receivedVia: 'DIRECT', assignmentExplanation: { source: 'DIRECT', assignmentMode: 'ANY_ONE', roleCode: null, resolutionDate: null }, status: 'OPEN', instanceStatus: 'RUNNING', currentStepKey: 'acknowledge', instanceVersion: 1, expectedVersion: 1, claimedByUserId: null, assigneeEmployeeId: null, claimedAt: null, availableAt: '2026-08-26T08:00:00.000Z', deadlineAt: null, createdAt: '2026-08-26T08:00:00.000Z', updatedAt: '2026-08-26T08:00:00.000Z', canAct: true, canClaim: true, isOverdue: false, businessType: 'P_MUTATION', businessCategory: 'DOCUMENT_ACKNOWLEDGEMENT', businessStatus: 'OPEN', leaveRequestId: null,
}

const counts: ProcessWorkTabCounts = { TODO: 7, CLAIMED: 1, WAITING: 2, COMPLETED: 2, ALL: 12 }
const startableProcess: StartableProcess = {
  processDefinitionId: '00000000-0000-4000-8000-000000000009',
  title: { nl: 'Opleidingsaanvraag', en: 'Training request' },
  description: { nl: 'Vraag een opleiding aan.', en: 'Request training.' },
  steps: [
    { title: { nl: 'Opleiding aanvragen', en: 'Request training' }, responsibleRole: { nl: 'Medewerker', en: 'Employee' }, isStart: true },
    { title: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, responsibleRole: { nl: 'Manager', en: 'Manager' }, isStart: false },
  ],
  routes: [{ fromTitle: { nl: 'Manager beoordeelt', en: 'Manager reviews' }, label: { nl: 'Wijzigingen vragen', en: 'Request changes' }, toTitle: { nl: 'Medewerker aanpassen', en: 'Employee updates' } }],
}

function renderWorkspace(
  data: ProcessWorkList,
  page = 1,
  view: 'WORK' | 'REQUESTS' = 'WORK',
  extraStartableProcesses: readonly StartableProcess[] = [],
  extraProcessOptions: ReadonlyArray<{ id: string; key: string; title: string }> = [],
  includeDefaultStartableProcess = true,
): string {
  return renderToStaticMarkup(createElement(ProcessWorkWorkspace, {
    locale: 'nl',
    labels,
    data,
    options: {
      processes: [{ id: item.processDefinitionId, key: item.processKey, title: item.processTitle }, ...extraProcessOptions],
      administrations: [{ id: '00000000-0000-4000-8000-000000000006', code: 'NL', name: 'Nederland' }],
    },
    startableProcesses: [...(includeDefaultStartableProcess ? [startableProcess] : []), ...extraStartableProcesses],
    tabCounts: counts,
    view,
    tab: view === 'REQUESTS' ? 'ALL' : 'TODO',
    page,
    pageSize: 1,
    search: '',
    status: '',
    businessType: '',
    businessCategory: '',
    processDefinitionId: '',
    administrationId: '',
    sort: 'NEEDS_ACTION',
    canStartLeaveRequest: true,
    canStartInternalTransfer: true,
    canStartDocumentAcknowledgement: true,
  }))
}

describe('ProcessWorkWorkspace', () => {
  it('renders Foundation tabs, counts, filters and detail navigation for populated work', () => {
    const markup = renderWorkspace({ items: [item], total: 2, hasMore: true })

    expect(markup).toContain('Te doen')
    expect(markup).toContain('Geclaimd')
    expect(markup).toContain('12')
    expect(markup).toContain('Alle processen')
    expect(markup).toContain('href="/work/00000000-0000-4000-8000-000000000001"')
    expect(markup).toContain('Pagina 1 van 2')
    expect(markup).not.toContain('shadow-sm')
  })

  it('labels urgency counts as belonging to the current page', () => {
    const overdueItem = { ...item, deadlineAt: '2020-01-01T08:00:00.000Z', isOverdue: true }
    const markup = renderWorkspace({ items: [overdueItem], total: 30, hasMore: true })

    expect(markup).toContain('Op deze pagina: 1 Over tijd')
    expect(markup).not.toContain('30 Over tijd')
  })

  it('places a permission-filtered new request catalog inside My Requests without exposing process keys', () => {
    const markup = renderWorkspace({ items: [item], total: 1, hasMore: false }, 1, 'REQUESTS')

    expect(markup).toContain('Nieuwe aanvraag')
    expect(markup).toContain('Opleidingsaanvraag')
    expect(markup).toContain('Manager beoordeelt')
    expect(markup).toContain('Wijzigingen vragen')
    expect(markup).toContain('href="/work/00000000-0000-4000-8000-000000000001?view=REQUESTS"')
    expect(markup).toContain('href="/leave/request"')
    expect(markup).toContain('Verlof aanvragen')
    expect(markup).toContain('href="/work/new/internal-transfer"')
    expect(markup).toContain('Interne overplaatsing starten')
    expect(markup).toContain('Documentkennisname starten')
    expect(markup).toContain('href="/work/new/document-acknowledgement"')
    expect(markup).not.toContain('Er zijn geen extra processen. Gebruik de beschikbare startknoppen bovenaan.')
    expect(markup).not.toContain('>P10<')
    expect(markup).not.toContain('· P10')
  })

  it('keeps native process definitions on their existing typed request routes', () => {
    const duplicateInternalTransfer: StartableProcess = {
      ...startableProcess,
      processDefinitionId: '00000000-0000-4000-8000-000000000010',
      title: { nl: 'R5-TEST — Interne overplaatsing', en: 'R5-TEST — Interne overplaatsing' },
    }
    const duplicateDocumentAcknowledgement: StartableProcess = {
      ...startableProcess,
      processDefinitionId: '00000000-0000-4000-8000-000000000011',
      title: { nl: 'R5-TEST — Document bevestiging', en: 'R5-TEST — Document bevestiging' },
    }
    const duplicateLeaveRequest: StartableProcess = {
      ...startableProcess,
      processDefinitionId: '00000000-0000-4000-8000-000000000012',
      title: { nl: 'Verlofaanvraag', en: 'Leave request' },
    }
    const overdueTransferScenario: StartableProcess = {
      ...startableProcess,
      processDefinitionId: '00000000-0000-4000-8000-000000000013',
      title: { nl: 'R5-TEST — Overdue interne overplaatsing', en: 'R5-TEST — Overdue interne overplaatsing' },
    }

    const markup = renderWorkspace(
      { items: [item], total: 1, hasMore: false },
      1,
      'REQUESTS',
      [duplicateInternalTransfer, duplicateDocumentAcknowledgement, duplicateLeaveRequest, overdueTransferScenario],
      [
        { id: duplicateInternalTransfer.processDefinitionId, key: 'r5-test-internal-transfer', title: 'R5-TEST — Interne overplaatsing' },
        { id: duplicateDocumentAcknowledgement.processDefinitionId, key: 'r5-test-document-acknowledgement', title: 'R5-TEST — Document bevestiging' },
        { id: duplicateLeaveRequest.processDefinitionId, key: 'leave-request-v2', title: 'Verlofaanvraag' },
        { id: overdueTransferScenario.processDefinitionId, key: 'r5-test-overdue-transfer', title: 'R5-TEST — Overdue interne overplaatsing' },
      ],
    )

    expect(markup).toContain('Opleidingsaanvraag')
    expect(markup).not.toContain('<h3 class="text-lg font-semibold text-foreground">R5-TEST — Interne overplaatsing</h3>')
    expect(markup).not.toContain('<h3 class="text-lg font-semibold text-foreground">R5-TEST — Document bevestiging</h3>')
    expect(markup).not.toContain('<h3 class="text-lg font-semibold text-foreground">Verlofaanvraag</h3>')
    expect(markup).toContain('R5-TEST — Overdue interne overplaatsing')
    expect(markup.match(/href="\/work\/new\/internal-transfer"/g)).toHaveLength(1)
    expect(markup.match(/href="\/work\/new\/document-acknowledgement"/g)).toHaveLength(1)
    expect(markup.match(/href="\/leave\/request"/g)).toHaveLength(1)
  })

  it('explains that native start buttons remain available when no generic process can be started', () => {
    const markup = renderWorkspace(
      { items: [], total: 0, hasMore: false },
      1,
      'REQUESTS',
      [],
      [],
      false,
    )

    expect(markup).toContain('Er zijn geen extra processen. Gebruik de beschikbare startknoppen bovenaan.')
    expect(markup).toContain('href="/leave/request"')
    expect(markup).toContain('href="/work/new/internal-transfer"')
    expect(markup).toContain('href="/work/new/document-acknowledgement"')
  })

  it('renders an explicit no-results state', () => {
    const markup = renderWorkspace({ items: [], total: 0, hasMore: false })

    expect(markup).toContain('Geen werk')
    expect(markup).toContain('Pas je filters aan.')
    expect(markup).toContain('border-dashed')
  })
})

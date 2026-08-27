import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { ProcessWorkItem, ProcessWorkList, ProcessWorkTabCounts } from '@/lib/process-automation/work-service'
import { ProcessWorkWorkspace, type ProcessWorkspaceLabels } from './process-workspace'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const labels = new Proxy({} as ProcessWorkspaceLabels, {
  get: (_target, property: string | symbol) => ({
    workspaceTitle: 'Werk', workspaceDescription: 'Proceswerk in één overzicht.', tabsTodo: 'Te doen', tabsClaimed: 'Geclaimd', tabsWaiting: 'Wacht op anderen', tabsCompleted: 'Afgerond', tabsAll: 'Alles', searchPlaceholder: 'Zoek werk', statusFilter: 'Status', processFilter: 'Proces', administrationFilter: 'Administratie', applyFilters: 'Toepassen', statusAll: 'Alle statussen', statusOpen: 'Open', statusClaimed: 'Geclaimd', statusBlocked: 'Geblokkeerd', statusCompleted: 'Afgerond', statusCancelled: 'Geannuleerd', statusExpired: 'Verlopen', sort: 'Sorteren', sortNeedsAction: 'Actie nodig', sortDeadline: 'Deadline', columnsProcess: 'Proces', subject: 'Onderwerp', step: 'Stap', assignment: 'Toewijzing', status: 'Status', deadline: 'Deadline', actions: 'Acties', assignmentMode: 'Modus', assignmentSource: 'Bron', assignmentDate: 'Bepaald op', assignmentRole: 'Rol', assignmentAnyOne: 'Eén van de kandidaten', assignmentQueue: 'Werkqueue', assignmentDirect: 'Direct', assignmentScope: 'Scope', assignmentProcess: 'Proces', unknown: 'Onbekend', noItems: 'Geen werk', noItemsDescription: 'Pas je filters aan.', loading: 'Laden…', readError: 'Laden mislukt', denied: 'Geen toegang', blocked: 'Geblokkeerd', overdue: 'Over tijd', dueToday: 'Vandaag', availableAt: 'Beschikbaar', claimedBy: 'Geclaimd door', unassigned: 'Niet toegewezen', open: 'Openen', totalItems: 'werkitems', allProcesses: 'Alle processen', allAdministrations: 'Alle administraties', resultsCount: '{from}–{to} van {count}', pageOf: 'Pagina {page} van {pages}', previous: 'Vorige', next: 'Volgende', startInternalTransfer: 'Interne overplaatsing starten', startDocumentAcknowledgement: 'Documentkennisname starten',
  }[String(property)] ?? String(property)),
})

const item: ProcessWorkItem = {
  workItemId: '00000000-0000-4000-8000-000000000001', processInstanceId: '00000000-0000-4000-8000-000000000002', stepInstanceId: '00000000-0000-4000-8000-000000000003', processDefinitionId: '00000000-0000-4000-8000-000000000004', processKey: 'P10', processTitle: 'Documentkennisname', subjectEmployeeId: '00000000-0000-4000-8000-000000000005', subjectName: 'Ada Lovelace', stepKey: 'acknowledge', stepTitle: 'Bevestigen', participantKey: 'employee', assignmentMode: 'ANY_ONE', receivedVia: 'DIRECT', assignmentExplanation: { source: 'DIRECT', assignmentMode: 'ANY_ONE', roleCode: null, resolutionDate: null }, status: 'OPEN', instanceStatus: 'RUNNING', currentStepKey: 'acknowledge', instanceVersion: 1, expectedVersion: 1, claimedByUserId: null, assigneeEmployeeId: null, claimedAt: null, availableAt: '2026-08-26T08:00:00.000Z', deadlineAt: null, createdAt: '2026-08-26T08:00:00.000Z', updatedAt: '2026-08-26T08:00:00.000Z', canAct: true, canClaim: true, isOverdue: false,
}

const counts: ProcessWorkTabCounts = { TODO: 7, CLAIMED: 1, WAITING: 2, COMPLETED: 2, ALL: 12 }

function renderWorkspace(data: ProcessWorkList, page = 1): string {
  return renderToStaticMarkup(createElement(ProcessWorkWorkspace, { locale: 'nl', labels, data, options: { processes: [{ id: item.processDefinitionId, key: item.processKey, title: item.processTitle }], administrations: [{ id: '00000000-0000-4000-8000-000000000006', code: 'NL', name: 'Nederland' }] }, tabCounts: counts, tab: 'TODO', page, pageSize: 1, search: '', status: '', processDefinitionId: '', administrationId: '', sort: 'NEEDS_ACTION', canStartInternalTransfer: true, canStartDocumentAcknowledgement: true }))
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

  it('renders an explicit no-results state', () => {
    const markup = renderWorkspace({ items: [], total: 0, hasMore: false })

    expect(markup).toContain('Geen werk')
    expect(markup).toContain('Pas je filters aan.')
    expect(markup).toContain('border-dashed')
  })
})

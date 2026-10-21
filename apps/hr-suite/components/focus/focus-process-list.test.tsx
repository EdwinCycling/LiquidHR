import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FocusProcessList, type FocusProcessListLabels } from './focus-process-list'
import type { ProcessWorkList } from '@/lib/process-automation/work-service'

const labels: FocusProcessListLabels = {
  actionNeeded: 'Actie nodig', empty: 'Leeg', emptyRequests: 'Nog geen aanvragen', waiting: 'Wachten', statusOpen: 'Open', inProgress: 'In behandeling', completed: 'Afgerond', changesRequested: 'Aanvullen gevraagd', rejected: 'Afgewezen', cancelled: 'Geannuleerd', blocked: 'Geblokkeerd', expired: 'Verlopen', open: 'Openen', leave: 'Verlofaanvraag', work: 'Werkactie', request: 'Aanvraag', newRequest: 'Nieuwe aanvraag',
}

const work: ProcessWorkList = {
  items: [{
    workItemId: '00000000-0000-4000-8000-000000000001', processInstanceId: '00000000-0000-4000-8000-000000000002', stepInstanceId: '00000000-0000-4000-8000-000000000003', processDefinitionId: '00000000-0000-4000-8000-000000000004', processKey: 'leave-request-v1', processTitle: 'Verlofaanvraag', subjectEmployeeId: '00000000-0000-4000-8000-000000000005', subjectEmploymentId: '00000000-0000-4000-8000-000000000006', subjectName: 'Noah Test', stepKey: 'manager-approval', stepTitle: 'manager-approval', participantKey: 'manager', assignmentMode: 'EXACTLY_ONE', receivedVia: 'DIRECT', assignmentExplanation: { source: 'DIRECT' }, status: 'OPEN', instanceStatus: 'RUNNING', currentStepKey: 'manager-approval', instanceVersion: 1, expectedVersion: 1, claimedByUserId: null, assigneeEmployeeId: '00000000-0000-4000-8000-000000000007', claimedAt: null, availableAt: '2026-09-20T00:00:00.000Z', deadlineAt: null, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', canAct: true, canClaim: true, isOverdue: false, businessType: 'LEAVE', businessCategory: 'LEAVE_REQUEST', businessStatus: 'OPEN', leaveRequestId: '00000000-0000-4000-8000-000000000008',
  }], total: 1, hasMore: false,
}

describe('Focus process links', () => {
  it('uses the canonical Leave workflow detail route', () => {
    const markup = renderToStaticMarkup(<FocusProcessList data={work} labels={labels} locale="nl" manager />)

    expect(markup).toContain('/leave/requests/00000000-0000-4000-8000-000000000001')
    expect(markup).not.toContain('/process-runtime/00000000-0000-4000-8000-000000000001')
    expect(markup).not.toContain('returnTo=focus-work')
    expect(markup).not.toContain('/work?view=REQUESTS')
  })

  it('links employee requests to the existing request catalog and returns process details to Focus', () => {
    const empty: ProcessWorkList = { items: [], total: 0, hasMore: false }
    const emptyMarkup = renderToStaticMarkup(<FocusProcessList canStartNewRequest data={empty} labels={labels} locale="nl" />)
    expect(emptyMarkup).toContain('href="/work?view=REQUESTS&amp;returnTo=focus-requests"')
    expect(emptyMarkup).toContain(labels.emptyRequests)
    const readOnlyMarkup = renderToStaticMarkup(<FocusProcessList canStartNewRequest={false} data={empty} labels={labels} locale="nl" />)
    expect(readOnlyMarkup).not.toContain('/work?view=REQUESTS')

    const processItem = { ...work.items[0], businessType: 'P_MUTATION' as const, businessCategory: 'GENERAL' as const, leaveRequestId: null }
    const processMarkup = renderToStaticMarkup(<FocusProcessList data={{ ...work, items: [processItem] }} labels={labels} locale="nl" />)
    expect(processMarkup).toContain('/work/00000000-0000-4000-8000-000000000001?returnTo=focus-requests')
  })

  it('shows understandable terminal and change-request statuses instead of a generic in-progress label', () => {
    const items = [
      { ...work.items[0], businessType: 'P_MUTATION' as const, businessCategory: 'GENERAL' as const, businessStatus: 'CHANGES_REQUESTED' },
      { ...work.items[0], workItemId: '00000000-0000-4000-8000-000000000010', businessType: 'P_MUTATION' as const, businessCategory: 'GENERAL' as const, businessStatus: 'REJECTED', instanceStatus: 'REJECTED' as const },
      { ...work.items[0], workItemId: '00000000-0000-4000-8000-000000000011', businessType: 'P_MUTATION' as const, businessCategory: 'GENERAL' as const, businessStatus: 'CANCELLED', instanceStatus: 'CANCELLED' as const },
    ]
    const markup = renderToStaticMarkup(<FocusProcessList data={{ items, total: items.length, hasMore: false }} labels={labels} locale="nl" />)
    expect(markup.match(/Aanvullen gevraagd/g)).toHaveLength(1)
    expect(markup.match(/Afgewezen/g)).toHaveLength(1)
    expect(markup.match(/Geannuleerd/g)).toHaveLength(1)
    expect(markup).not.toContain('In behandeling')
  })
})

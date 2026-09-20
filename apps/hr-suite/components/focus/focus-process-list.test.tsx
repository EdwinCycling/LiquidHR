import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FocusProcessList, type FocusProcessListLabels } from './focus-process-list'
import type { ProcessWorkList } from '@/lib/process-automation/work-service'

const labels: FocusProcessListLabels = {
  actionNeeded: 'Actie nodig', empty: 'Leeg', waiting: 'Wachten', inProgress: 'In behandeling', completed: 'Afgerond', open: 'Openen', leave: 'Verlofaanvraag', work: 'Werkactie', request: 'Aanvraag',
}

const work: ProcessWorkList = {
  items: [{
    workItemId: '00000000-0000-4000-8000-000000000001', processInstanceId: '00000000-0000-4000-8000-000000000002', stepInstanceId: '00000000-0000-4000-8000-000000000003', processDefinitionId: '00000000-0000-4000-8000-000000000004', processKey: 'leave-request-v1', processTitle: 'Verlofaanvraag', subjectEmployeeId: '00000000-0000-4000-8000-000000000005', subjectEmploymentId: '00000000-0000-4000-8000-000000000006', subjectName: 'Noah Test', stepKey: 'manager-approval', stepTitle: 'manager-approval', participantKey: 'manager', assignmentMode: 'EXACTLY_ONE', receivedVia: 'DIRECT', assignmentExplanation: { source: 'DIRECT' }, status: 'OPEN', instanceStatus: 'RUNNING', currentStepKey: 'manager-approval', instanceVersion: 1, expectedVersion: 1, claimedByUserId: null, assigneeEmployeeId: '00000000-0000-4000-8000-000000000007', claimedAt: null, availableAt: '2026-09-20T00:00:00.000Z', deadlineAt: null, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', canAct: true, canClaim: true, isOverdue: false, businessType: 'LEAVE', businessCategory: 'LEAVE_REQUEST', businessStatus: 'OPEN', leaveRequestId: '00000000-0000-4000-8000-000000000008',
  }], total: 1, hasMore: false,
}

describe('Focus process links', () => {
  it('uses the canonical Leave workflow detail route', () => {
    const markup = renderToStaticMarkup(<FocusProcessList data={work} labels={labels} manager />)

    expect(markup).toContain('/leave/requests/00000000-0000-4000-8000-000000000001')
    expect(markup).not.toContain('/process-runtime/00000000-0000-4000-8000-000000000001')
  })
})

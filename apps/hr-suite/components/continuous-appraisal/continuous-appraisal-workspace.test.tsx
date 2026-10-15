import { describe, expect, it } from 'vitest'
import type { ContinuousAppraisalItem } from '@/lib/continuous-appraisal/service'
import { filterContinuousAppraisalItems } from './continuous-appraisal-workspace'

function item(overrides: Partial<ContinuousAppraisalItem> = {}): ContinuousAppraisalItem {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    employee_id: '00000000-0000-0000-0000-000000000010',
    manager_employee_id: '00000000-0000-0000-0000-000000000011',
    created_by_employee_id: '00000000-0000-0000-0000-000000000011',
    created_by_label: 'Manager One',
    created_by_avatar_url: null,
    owner_employee_id: '00000000-0000-0000-0000-000000000010',
    owner_label: 'Employee One',
    item_type: 'ACTION',
    goal_kind: null,
    feedback_direction: null,
    title: 'Opvolging klantgesprek',
    body: 'Plan een vervolgafspraak.',
    occurred_on: '2026-08-24',
    due_on: '2026-08-29',
    next_meeting_on: null,
    item_status: 'OPEN',
    priority: 'HIGH',
    version: 1,
    created_at: '2026-08-22T09:00:00.000Z',
    updated_at: '2026-08-22T09:00:00.000Z',
    comments: [],
    attachments: [],
    canEdit: true,
    canMarkDone: true,
    canMarkNotRelevant: true,
    canDelete: true,
    ...overrides,
  }
}

describe('Continuous Appraisal collection filtering', () => {
  it('combines type, status, owner, date and search filters without mutating the source order', () => {
    const older = item({ id: '00000000-0000-0000-0000-000000000002', occurred_on: '2026-08-23', item_status: 'DONE', title: 'Afgerond overleg' })
    const newer = item({ id: '00000000-0000-0000-0000-000000000003', occurred_on: '2026-08-25', title: 'Plan opvolging' })
    const source = [older, newer]

    const result = filterContinuousAppraisalItems(source, { fromDate: '2026-08-24', oldestFirst: false, owner: older.owner_employee_id ?? 'ALL', search: 'opvolging', status: 'OPEN', toDate: '2026-08-30', type: 'ACTION' })

    expect(result.map((entry) => entry.id)).toEqual([newer.id])
    expect(source.map((entry) => entry.id)).toEqual([older.id, newer.id])
  })

  it('keeps the timeline order explicit for newest and oldest views', () => {
    const first = item({ id: '00000000-0000-0000-0000-000000000004', occurred_on: '2026-08-23' })
    const second = item({ id: '00000000-0000-0000-0000-000000000005', occurred_on: '2026-08-25' })

    expect(filterContinuousAppraisalItems([first, second], { fromDate: '', oldestFirst: false, owner: 'ALL', search: '', status: 'ALL', toDate: '', type: 'ALL' }).map((entry) => entry.id)).toEqual([second.id, first.id])
    expect(filterContinuousAppraisalItems([first, second], { fromDate: '', oldestFirst: true, owner: 'ALL', search: '', status: 'ALL', toDate: '', type: 'ALL' }).map((entry) => entry.id)).toEqual([first.id, second.id])
  })

  it('keeps NOT_RELEVANT distinct from cancelled in status filters', () => {
    const notRelevant = item({ item_status: 'NOT_RELEVANT' })
    const cancelled = item({ id: '00000000-0000-0000-0000-000000000006', item_status: 'CANCELLED' })

    expect(filterContinuousAppraisalItems([notRelevant, cancelled], { fromDate: '', oldestFirst: false, owner: 'ALL', search: '', status: 'NOT_RELEVANT', toDate: '', type: 'ALL' })).toEqual([notRelevant])
    expect(filterContinuousAppraisalItems([notRelevant, cancelled], { fromDate: '', oldestFirst: false, owner: 'ALL', search: '', status: 'CANCELLED', toDate: '', type: 'ALL' })).toEqual([cancelled])
  })

  it('defines upcoming follow-up only from action deadlines, agreement dates, goals and next meeting dates', () => {
    const action = item({ due_on: '2026-10-20' })
    const agreement = item({ id: '00000000-0000-0000-0000-000000000007', item_type: 'AGREEMENT', item_status: 'OPEN', due_on: null, occurred_on: '2026-10-22' })
    const goal = item({ id: '00000000-0000-0000-0000-000000000008', item_type: 'GOAL', item_status: 'ACTIVE', due_on: '2026-10-25' })
    const meeting = item({ id: '00000000-0000-0000-0000-000000000009', item_type: 'MEETING_SUMMARY', item_status: 'ACTIVE', due_on: null, next_meeting_on: '2026-10-30' })
    const datedNote = item({ id: '00000000-0000-0000-0000-00000000000a', item_type: 'NOTE', item_status: 'ACTIVE', due_on: null, occurred_on: '2026-10-21' })

    const results = filterContinuousAppraisalItems([action, agreement, goal, meeting, datedNote], { asOf: '2026-10-14', fromDate: '', oldestFirst: false, owner: 'ALL', quickView: 'UPCOMING', search: '', status: 'ALL', toDate: '', type: 'ALL' })
    expect(results).toHaveLength(4)
    expect(results).not.toContain(datedNote)
  })
})

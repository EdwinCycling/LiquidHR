import { describe, expect, it } from 'vitest'
import { restrictStarPerformersEmployeeIds, selectLatestApprovedGridSignals } from './v2-service'

describe('star performers v2 grid signals', () => {
  it('selects the latest closed high/high signal and derives movement from the previous campaign', () => {
    const signals = selectLatestApprovedGridSignals(
      [
        { id: 'current', name: '2026 H2', status: 'CLOSED', closed_at: '2026-10-10T10:00:00.000Z', starts_on: '2026-09-01', previous_campaign_id: 'previous' },
        { id: 'previous', name: '2026 H1', status: 'ARCHIVED', closed_at: '2026-06-10T10:00:00.000Z', starts_on: '2026-05-01', previous_campaign_id: null },
      ],
      [
        { employee_id: 'employee-1', campaign_id: 'previous', performance_score: 'NORMAL', potential_score: 'NORMAL', grid_cell: 'NORMAL_NORMAL', status: 'CLOSED', updated_at: '2026-06-10T10:00:00.000Z' },
        { employee_id: 'employee-1', campaign_id: 'current', performance_score: 'HIGH', potential_score: 'HIGH', grid_cell: 'HIGH_HIGH', status: 'CLOSED', updated_at: '2026-10-10T10:00:00.000Z' },
        { employee_id: 'employee-2', campaign_id: 'current', performance_score: 'HIGH', potential_score: 'HIGH', grid_cell: 'HIGH_HIGH', status: 'SUBMITTED', updated_at: '2026-10-10T10:00:00.000Z' },
      ],
    )

    expect(signals.get('employee-1')).toMatchObject({ campaignId: 'current', isHighHigh: true, movement: 'UP' })
    expect(signals.has('employee-2')).toBe(false)
  })

  it('does not expose a draft campaign as an approved signal', () => {
    const signals = selectLatestApprovedGridSignals(
      [{ id: 'draft', name: 'Draft', status: 'DRAFT', closed_at: null, starts_on: '2026-10-01', previous_campaign_id: null }],
      [{ employee_id: 'employee-1', campaign_id: 'draft', performance_score: 'HIGH', potential_score: 'HIGH', grid_cell: 'HIGH_HIGH', status: 'CLOSED', updated_at: '2026-10-01T10:00:00.000Z' }],
    )

    expect(signals.size).toBe(0)
  })
})

describe('star performers manager scope', () => {
  it('intersects forged search results with the server-derived direct-team scope', () => {
    expect(restrictStarPerformersEmployeeIds(['outside-team', 'team-2'], ['team-1', 'team-2'])).toEqual(['team-2'])
    expect(restrictStarPerformersEmployeeIds(null, ['team-1', 'team-2'])).toEqual(['team-1', 'team-2'])
    expect(restrictStarPerformersEmployeeIds(['company-employee'], null)).toEqual(['company-employee'])
  })
})

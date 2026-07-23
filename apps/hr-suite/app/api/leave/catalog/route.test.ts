import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/leave/catalog', () => {
  it('weigert een verloftype zonder bijbehorende jaarlimiet vóór autorisatie', async () => {
    const response = await POST(new Request('https://example.test/api/leave/catalog', {
      method: 'POST',
      body: JSON.stringify({
        action: 'LEAVE_TYPE',
        name: 'Zorgverlof',
        colorCode: '#10b981',
        scope: 'OTHER',
        entitlementMode: 'ANNUAL_HOURS_CAP',
      }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LEAVE_INPUT_INVALID' })
  })
  it('weigert een opbouwregel zonder werkurentype bij gewerkte uren', async () => {
    const response = await POST(new Request('https://example.test/api/leave/catalog', {
      method: 'POST',
      body: JSON.stringify({
        action: 'ACCRUAL_RULE',
        leaveProfileId: 'profile-1',
        leaveTypeId: 'leave-1',
        validFrom: '2026-01-01',
        accrualBasis: 'WORKED_HOURS',
        accrualFrequency: 'YEARLY',
        accrualTiming: 'ARREARS',
        accrualRate: 0.083333,
        expirationMonths: 6,
        workHourTypeIds: [],
        pauseLeaveTypeIds: [],
      }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LEAVE_INPUT_INVALID' })
  })

  it('weigert een voorrangsregel met een niet-aaneengesloten volgorde', async () => {
    const response = await POST(new Request('https://example.test/api/leave/catalog', {
      method: 'POST',
      body: JSON.stringify({
        action: 'PRIORITY_RULE',
        leaveProfileId: 'profile-1',
        name: 'Vakantie',
        validFrom: '2026-01-01',
        items: [
          { leaveTypeId: 'leave-1', sortOrder: 1 },
          { leaveTypeId: 'leave-2', sortOrder: 3 },
        ],
      }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'LEAVE_INPUT_INVALID' })
  })
})

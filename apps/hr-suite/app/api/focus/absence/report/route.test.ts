import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthorizationContext, reportFocusEmployeeAbsence } = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
  reportFocusEmployeeAbsence: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext }))
vi.mock('@/lib/focus/act-as-token', () => ({ resolveFocusActAsSession: vi.fn() }))
vi.mock('@/lib/absence/service', () => ({
  AbsenceServiceError: class AbsenceServiceError extends Error { constructor(public readonly code: string, public readonly status = 500) { super(code) } },
  reportFocusEmployeeAbsence,
}))

import { POST } from './route'

const employeeId = '11111111-1111-4111-8111-111111111111'

describe('POST /api/focus/absence/report', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getRequestAuthorizationContext.mockResolvedValue({ context: { tenantId: 'tenant-a', hrGroupId: 'group-a', employeeId, permissions: ['self:absence:write'] }, supabase: {} })
    reportFocusEmployeeAbsence.mockResolvedValue('22222222-2222-4222-8222-222222222222')
  })

  it('rejects a crafted medical/free-text field before authentication or service work', async () => {
    const response = await POST(new Request('http://localhost/api/focus/absence/report', { method: 'POST', body: JSON.stringify({ employeeId, startDate: '2026-09-19', idempotencyKey: 'self-report-2026', diagnosis: 'griep' }) }))

    expect(response.status).toBe(400)
    expect(reportFocusEmployeeAbsence).not.toHaveBeenCalled()
  })

  it('rejects an expected return date because employee Focus is date-only', async () => {
    const response = await POST(new Request('http://localhost/api/focus/absence/report', { method: 'POST', body: JSON.stringify({ employeeId, startDate: '2026-09-19', expectedRecoveryOn: '2026-09-26', idempotencyKey: 'self-report-2026' }) }))

    expect(response.status).toBe(400)
    expect(reportFocusEmployeeAbsence).not.toHaveBeenCalled()
  })

  it('passes only the first sickness date to the pending self-report service', async () => {
    const response = await POST(new Request('http://localhost/api/focus/absence/report', { method: 'POST', body: JSON.stringify({ employeeId, startDate: '2026-09-19', idempotencyKey: 'self-report-2026' }) }))

    expect(response.status).toBe(201)
    expect(reportFocusEmployeeAbsence).toHaveBeenCalledWith(employeeId, { startDate: '2026-09-19', idempotencyKey: 'self-report-2026' }, expect.anything())
  })

  it('denies a direct call for another employee without a signed act-as session', async () => {
    const response = await POST(new Request('http://localhost/api/focus/absence/report', { method: 'POST', body: JSON.stringify({ employeeId: '33333333-3333-4333-8333-333333333333', startDate: '2026-09-19', idempotencyKey: 'self-report-2026' }) }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'ABSENCE_SELF_SERVICE_FORBIDDEN' })
    expect(reportFocusEmployeeAbsence).not.toHaveBeenCalled()
  })
})

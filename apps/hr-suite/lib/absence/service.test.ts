import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, getSelfPermissions, resolveLeaveEmployment, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSelfPermissions: vi.fn(),
  resolveLeaveEmployment: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  getSelfPermissions,
  requireAuthContext: vi.fn(),
  requireHrGroupId: vi.fn(),
  requirePermission: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/leave/employment-resolver', () => ({ resolveLeaveEmployment }))

import type { createClient as createServerClient } from '@/lib/supabase/server'
import { reportFocusEmployeeAbsence } from './service'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

const employeeId = '11111111-1111-4111-8111-111111111111'
const employmentId = '22222222-2222-4222-8222-222222222222'

describe('Focus employee absence reporting', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getSelfPermissions.mockResolvedValue(['self:absence:write'])
    resolveLeaveEmployment.mockResolvedValue({
      employment: { id: employmentId },
      options: [],
    })
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: '33333333-3333-4333-8333-333333333333', error: null })
    createClient.mockResolvedValue({ rpc, from: vi.fn() } as unknown as SupabaseServerClient)
  })

  it('reads the employee self-report setting through the scoped RPC before creating the case', async () => {
    const context = {
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      administrationId: null,
      userId: 'user-a',
      employeeId,
      activeRoles: ['EMPLOYEE'],
      permissions: ['self:absence:write'],
    }

    await expect(reportFocusEmployeeAbsence(employeeId, { startDate: '2026-09-20', idempotencyKey: 'self-report-2026' }, context)).resolves.toBe('33333333-3333-4333-8333-333333333333')

    expect(rpc).toHaveBeenNthCalledWith(1, 'get_employee_self_report_enabled', {
      requested_tenant_id: 'tenant-a',
      requested_hr_group_id: 'group-a',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'report_focus_employee_absence', expect.objectContaining({
      requested_employee_id: employeeId,
      requested_employment_id: employmentId,
      requested_start_date: '2026-09-20',
    }))
  })
})

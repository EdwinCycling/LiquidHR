import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireAnyPermission, requireHrGroupId } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAnyPermission: vi.fn(),
  requireHrGroupId: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError: class AuthorizationError extends Error { readonly status = 403 }, requireAnyPermission, requireHrGroupId, requirePermission: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { ActualWorkServiceError, saveActualWorkEntry } from './actual-work-service'

const employeeId = '11111111-1111-4111-8111-111111111111'
const employmentId = '22222222-2222-4222-8222-222222222222'
const typeId = '33333333-3333-4333-8333-333333333333'
const entryId = '44444444-4444-4444-8444-444444444444'

function queryResult(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'lt', 'gt', 'or']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({ data, error }))
  return chain
}

const employment = { id: employmentId, employee_id: employeeId, administration_id: '55555555-5555-4555-8555-555555555555', starts_on: '2024-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }
const savedEntry = { id: entryId, employee_id: employeeId, employment_id: employmentId, hours: 2.5 }

function configureAuth() {
  requireAnyPermission.mockResolvedValue({ tenantId: 'tenant-a', hrGroupId: 'group-a', employeeId, permissions: ['self:actual-work:write'] })
  requireHrGroupId.mockReturnValue('group-a')
  const rpc = vi.fn(async (): Promise<{ data: unknown; error: { message: string } | null }> => ({ data: savedEntry, error: null }))
  const supabase = {
    from: vi.fn(() => queryResult(employment)),
    rpc,
  }
  createClient.mockResolvedValue(supabase)
  return supabase
}

const createInput = {
  employeeId,
  employmentId,
  workHourTypeId: typeId,
  entryGranularity: 'DAY' as const,
  subjectPeriodStart: '2026-09-21',
  hours: '2.5000',
  note: 'Eigen registratie',
  correctionReason: null,
}

describe('Actual Work Employee self-service write boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authorizes an Employee create through the canonical RPC for the own employee', async () => {
    const supabase = configureAuth()

    await expect(saveActualWorkEntry(createInput)).resolves.toEqual(savedEntry)

    expect(requireAnyPermission).toHaveBeenCalledWith(['leave:write', 'self:actual-work:write'], employeeId)
    expect(supabase.rpc).toHaveBeenCalledWith('save_actual_work_entry', expect.objectContaining({
      requested_entry_id: null,
      requested_employee_id: employeeId,
      requested_employment_id: employmentId,
      requested_operation: 'CREATE',
    }))
  })

  it('authorizes an Employee correction for the same own entry and requires the reason', async () => {
    const supabase = configureAuth()

    await expect(saveActualWorkEntry({ ...createInput, entryId, hours: '3.2500', correctionReason: 'Correcte eindtijd' })).resolves.toEqual(savedEntry)

    expect(supabase.rpc).toHaveBeenCalledWith('save_actual_work_entry', expect.objectContaining({
      requested_entry_id: entryId,
      requested_operation: 'CORRECTION',
      requested_reason: 'Correcte eindtijd',
    }))
  })

  it('does not call the persistence boundary for a foreign employee or manager without HR write scope', async () => {
    const supabase = configureAuth()
    requireAnyPermission.mockRejectedValue(new Error('Je hebt onvoldoende rechten voor deze actie.'))

    await expect(saveActualWorkEntry({ ...createInput, employeeId: '66666666-6666-4666-8666-666666666666' })).rejects.toBeInstanceOf(Error)

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it.each(['ACTUAL_WORK_TYPE_NOT_ACTIVE', 'ACTUAL_WORK_FUTURE_NOT_ALLOWED', 'ACTUAL_WORK_PERIOD_CLOSED', 'ACTUAL_WORK_LEAVE_OVERLAP'])('propagates canonical server validation %s without a second write path', async (code) => {
    const supabase = configureAuth()
    supabase.rpc.mockResolvedValue({ data: null, error: { message: code } })

    await expect(saveActualWorkEntry(createInput)).rejects.toEqual(expect.objectContaining({ code, status: 400 }))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalled()
  })

  it('keeps schema-level correction validation before authentication and persistence', async () => {
    configureAuth()

    await expect(saveActualWorkEntry({ ...createInput, entryId, correctionReason: null })).rejects.toEqual(expect.objectContaining({ code: 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED' }))
    expect(requireAnyPermission).not.toHaveBeenCalled()
  })

  it('exposes the domain error type for server validation responses', () => {
    expect(new ActualWorkServiceError('ACTUAL_WORK_LEAVE_OVERLAP').status).toBe(400)
  })
})

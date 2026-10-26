import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireAnyPermission, requirePermission, requireHrGroupId } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAnyPermission: vi.fn(),
  requirePermission: vi.fn(),
  requireHrGroupId: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError: class AuthorizationError extends Error { readonly status = 403 }, requireAnyPermission, requirePermission, requireHrGroupId }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import {
  ActualWorkServiceError,
  getActualWorkPayrollProjectionsBatch,
  isValidActualWorkMonth,
  saveActualWorkEntry,
} from './actual-work-service'

const employeeId = '11111111-1111-4111-8111-111111111111'
const employmentId = '22222222-2222-4222-8222-222222222222'
const typeId = '33333333-3333-4333-8333-333333333333'
const entryId = '44444444-4444-4444-8444-444444444444'

function queryResult(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'lt', 'gt', 'or', 'in', 'range']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({ data, error }))
  chain.range = vi.fn(async () => ({ data, error }))
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

  it('rejects whitespace-only correction reasons before writing', async () => {
    const supabase = configureAuth()

    await expect(saveActualWorkEntry({ ...createInput, entryId, correctionReason: '   ' })).rejects.toEqual(expect.objectContaining({ code: 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED' }))
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('exposes the domain error type for server validation responses', () => {
    expect(new ActualWorkServiceError('ACTUAL_WORK_LEAVE_OVERLAP').status).toBe(400)
  })
})

describe('Actual Work month boundary', () => {
  it('accepts only canonical YYYY-MM values for direct report requests', () => {
    expect(isValidActualWorkMonth('2026-09')).toBe(true)
    expect(isValidActualWorkMonth('2026-9')).toBe(false)
    expect(isValidActualWorkMonth('2026-13')).toBe(false)
    expect(isValidActualWorkMonth('not-a-month')).toBe(false)
  })
})

describe('Actual Work payroll batch source read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authorizes each exact target and returns entries and types partitioned to each employment', async () => {
    const secondEmployeeId = '66666666-6666-4666-8666-666666666666'
    const secondEmploymentId = '77777777-7777-4777-8777-777777777777'
    const secondTypeId = '88888888-8888-4888-8888-888888888888'
    const period = { id: 'period-1', period_start: '2026-10-01', period_end: '2026-10-31', status: 'OPEN', updated_at: '2026-10-01T00:00:00Z' }
    const entries = [
      { id: 'entry-1', employee_id: employeeId, employment_id: employmentId, work_hour_type_id: typeId, work_date: '2026-10-03', entry_granularity: 'DAY', subject_period_start: '2026-10-03', subject_period_end: null, posting_period_start: '2026-10-01', hours: 2, status: 'APPROVED', approved_at: '2026-10-04T00:00:00Z', updated_at: '2026-10-04T00:00:00Z' },
      { id: 'entry-2', employee_id: secondEmployeeId, employment_id: secondEmploymentId, work_hour_type_id: secondTypeId, work_date: '2026-10-05', entry_granularity: 'DAY', subject_period_start: '2026-10-05', subject_period_end: null, posting_period_start: '2026-10-01', hours: 3, status: 'APPROVED', approved_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z' },
      { id: 'foreign-entry', employee_id: '99999999-9999-4999-8999-999999999999', employment_id: employmentId, work_hour_type_id: typeId, work_date: '2026-10-07', entry_granularity: 'DAY', subject_period_start: '2026-10-07', subject_period_end: null, posting_period_start: '2026-10-01', hours: 99, status: 'APPROVED', approved_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' },
    ]
    const types = [
      { id: typeId, code: 'OVERTIME', name: 'Overwerk', family: 'OVERTIME', valid_from: '2026-01-01', valid_until: null, approval_required: true, updated_at: '2026-01-01T00:00:00Z' },
      { id: secondTypeId, code: 'TRAVEL', name: 'Reistijd', family: 'TRAVEL', valid_from: '2026-01-01', valid_until: null, approval_required: false, updated_at: '2026-01-01T00:00:00Z' },
    ]
    requirePermission.mockImplementation(async (_permission: string, targetEmployeeId: string) => ({
      tenantId: 'tenant-a',
      hrGroupId: 'group-a',
      administrationId: 'admin-a',
      employeeId: targetEmployeeId,
    }))
    requireHrGroupId.mockReturnValue('group-a')
    const from = vi.fn((table: string) => queryResult(
      table === 'employment_work_hour_entries' ? entries
        : table === 'work_hour_types' ? types
          : ['actual_work_revisions', 'actual_work_payroll_releases', 'leave_type_overtime_work_hours', 'actual_work_payroll_mappings', 'leave_types'].includes(table) ? []
          : period,
    ))
    createClient.mockResolvedValue({ from })

    const result = await getActualWorkPayrollProjectionsBatch([
      { employeeId, employmentId, month: '2026-10' },
      { employeeId: secondEmployeeId, employmentId: secondEmploymentId, month: '2026-10' },
    ])

    expect(requirePermission).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)
    expect(result[0]?.entries.map((entry) => entry.id)).toEqual(['entry-1'])
    expect(result[0]?.types.map((type) => type.id)).toEqual([typeId])
    expect(result[1]?.entries.map((entry) => entry.id)).toEqual(['entry-2'])
    expect(result[1]?.types.map((type) => type.id)).toEqual([secondTypeId])
    expect(result.flatMap((projection) => projection.entries.map((entry) => entry.id)).sort()).toEqual(['entry-1', 'entry-2'])
    expect(result[0]?.entries[0]).not.toHaveProperty('employee_id')
    expect(from).toHaveBeenCalledTimes(7)
    expect(from).toHaveBeenCalledWith('actual_work_periods')
    expect(from).toHaveBeenCalledWith('employment_work_hour_entries')
    expect(from).toHaveBeenCalledWith('work_hour_types')
    const entriesQueryIndex = from.mock.calls.findIndex(([table]) => table === 'employment_work_hour_entries')
    const entriesQuery = from.mock.results[entriesQueryIndex]?.value as Record<string, ReturnType<typeof vi.fn>> | undefined
    expect(entriesQuery?.in).toHaveBeenCalledWith('employee_id', [employeeId, secondEmployeeId])
  })

  it('keeps 39 payroll work projections in bounded four-target read groups', async () => {
    const targets = Array.from({ length: 39 }, (_, index) => ({
      employeeId: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      employmentId: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      typeId: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      entryId: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }))
    const entries = targets.map((target) => ({
      id: target.entryId,
      employee_id: target.employeeId,
      employment_id: target.employmentId,
      work_hour_type_id: target.typeId,
      work_date: '2026-10-03',
      entry_granularity: 'DAY',
      subject_period_start: '2026-10-03',
      subject_period_end: null,
      posting_period_start: '2026-10-01',
      hours: 2,
      status: 'APPROVED',
      approved_at: '2026-10-04T00:00:00Z',
      updated_at: '2026-10-04T00:00:00Z',
    }))
    const types = targets.map((target) => ({
      id: target.typeId,
      code: 'WORK',
      name: 'Work',
      family: 'WORK',
      valid_from: '2026-01-01',
      valid_until: null,
      approval_required: true,
      updated_at: '2026-01-01T00:00:00Z',
    }))
    const period = { id: 'period-39', period_start: '2026-10-01', period_end: '2026-10-31', status: 'OPEN', updated_at: '2026-10-01T00:00:00Z' }
    requirePermission.mockImplementation(async (_permission: string, targetEmployeeId: string) => ({
      tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'admin-a', employeeId: targetEmployeeId,
    }))
    requireHrGroupId.mockReturnValue('group-a')
    const from = vi.fn((table: string) => queryResult(
      table === 'employment_work_hour_entries' ? entries
        : table === 'work_hour_types' ? types
          : ['actual_work_revisions', 'actual_work_payroll_releases', 'leave_type_overtime_work_hours', 'actual_work_payroll_mappings', 'leave_types'].includes(table) ? []
          : period,
    ))
    createClient.mockResolvedValue({ from })

    const result = await getActualWorkPayrollProjectionsBatch(targets.map(({ employeeId, employmentId }) => ({
      employeeId, employmentId, month: '2026-10',
    })))

    expect(requirePermission).toHaveBeenCalledTimes(39)
    expect(result).toHaveLength(39)
    expect(result.every((projection, index) => projection.entries[0]?.id === targets[index]?.entryId
      && projection.types[0]?.id === targets[index]?.typeId)).toBe(true)
    expect(from.mock.calls.filter(([table]) => table === 'actual_work_periods')).toHaveLength(1)
    expect(from.mock.calls.filter(([table]) => table === 'employment_work_hour_entries')).toHaveLength(10)
    expect(from.mock.calls.filter(([table]) => table === 'work_hour_types')).toHaveLength(10)
    expect(from.mock.calls.filter(([table]) => table === 'actual_work_revisions')).toHaveLength(10)
    expect(from.mock.calls.filter(([table]) => table === 'actual_work_payroll_releases')).toHaveLength(10)
    expect(from).toHaveBeenCalledTimes(61)
  })

  it('fails closed before source reads when authorized targets resolve to different tenant scopes', async () => {
    const secondEmployeeId = '66666666-6666-4666-8666-666666666666'
    const from = vi.fn(() => queryResult([], null))
    requirePermission.mockImplementation(async (_permission: string, targetEmployeeId: string) => ({
      tenantId: targetEmployeeId === employeeId ? 'tenant-a' : 'tenant-b',
      hrGroupId: 'group-a',
      administrationId: 'admin-a',
      employeeId: targetEmployeeId,
    }))
    requireHrGroupId.mockReturnValue('group-a')
    createClient.mockResolvedValue({ from })

    await expect(getActualWorkPayrollProjectionsBatch([
      { employeeId, employmentId, month: '2026-10' },
      { employeeId: secondEmployeeId, employmentId: '77777777-7777-4777-8777-777777777777', month: '2026-10' },
    ])).rejects.toMatchObject({ code: 'ACTUAL_WORK_EMPLOYMENT_NOT_FOUND', status: 404 })

    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a mixed-month batch before authorization or database reads', async () => {
    await expect(getActualWorkPayrollProjectionsBatch([
      { employeeId, employmentId, month: '2026-10' },
      { employeeId, employmentId: '77777777-7777-4777-8777-777777777777', month: '2026-09' },
    ])).rejects.toMatchObject({ code: 'ACTUAL_WORK_MONTH_INVALID' })
    expect(requirePermission).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })
})

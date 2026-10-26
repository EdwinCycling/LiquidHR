import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClient,
  requirePermission,
  requireHrGroupId,
  payrollAdministration,
  calendarPeriods,
  createPayrollRepository,
  createPayrollCalculationRepository,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  requireHrGroupId: vi.fn(),
  payrollAdministration: vi.fn(),
  calendarPeriods: vi.fn(),
  createPayrollRepository: vi.fn(() => ({ getPayrollAdministration: payrollAdministration })),
  createPayrollCalculationRepository: vi.fn(() => ({ listCalendarPeriods: calendarPeriods })),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error { readonly status = 403 },
  requirePermission,
  requireHrGroupId,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/payroll/repository', () => ({ createPayrollRepository }))
vi.mock('@/lib/payroll/calculation-repository', () => ({ createPayrollCalculationRepository }))

import { mutateActualWorkPayroll, previewActualWorkCsv } from './payroll-work-hours-service'

const firstEmployeeId = '11111111-1111-4111-8111-111111111111'
const secondEmployeeId = '22222222-2222-4222-8222-222222222222'
const firstEmploymentId = '33333333-3333-4333-8333-333333333333'
const secondEmploymentId = '44444444-4444-4444-8444-444444444444'
const workTypeId = '55555555-5555-4555-8555-555555555555'
const actualEntryId = '88888888-8888-4888-8888-888888888888'
const sourceEntries = new Map<string, { id: string; source_type: string }>()
const entryRows: Array<Record<string, unknown>> = []
let lastRpc: ReturnType<typeof vi.fn>

const employees = [
  { id: firstEmployeeId, employee_number: '1001' },
  { id: secondEmployeeId, employee_number: '1002' },
]
const workTypes = [{
  id: workTypeId,
  code: 'WORK',
  name: 'Gewone uren',
  family: 'WORK',
  entry_granularity: 'BOTH',
  is_active: true,
  valid_from: '2026-01-01',
  valid_until: '2026-10-31',
  updated_at: '2026-01-01T00:00:00.000Z',
  comment_required: false,
}]

function queryFor(table: string) {
  const filters = new Map<string, unknown>()
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'lt', 'gte', 'gt', 'or', 'in', 'neq']) {
    chain[method] = vi.fn((...args: unknown[]) => {
      if (method === 'eq' || method === 'in') filters.set(String(args[0]), args[1])
      return chain
    })
  }
  const data = () => {
    if (table === 'employees') {
      const numbers = filters.get('employee_number') as string[] | undefined
      return employees.filter((employee) => !numbers || numbers.includes(employee.employee_number))
    }
    if (table === 'work_hour_types') return workTypes
    if (table === 'employments') {
      const employeeId = filters.get('employee_id')
      const requestedId = filters.get('id')
      const rows = [
        { id: firstEmploymentId, employee_id: firstEmployeeId, administration_id: 'admin-a' },
        { id: secondEmploymentId, employee_id: secondEmployeeId, administration_id: 'admin-a' },
      ]
      return rows.filter((row) => row.employee_id === employeeId && (!requestedId || row.id === requestedId))
    }
    if (table === 'employment_work_hour_entries') {
      const sourceKey = filters.get('source_key')
      if (sourceKey) return sourceEntries.get(String(sourceKey)) ?? null
      const ids = filters.get('id') as string[] | undefined
      return entryRows.filter((entry) => !ids || ids.includes(String(entry.id)))
    }
    return []
  }
  chain.maybeSingle = vi.fn(async () => ({ data: data(), error: null }))
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: data(), error: null }).then(resolve, reject)
  return chain
}

function configureAdmin() {
  requirePermission.mockResolvedValue({
    tenantId: 'tenant-a',
    hrGroupId: 'group-a',
    administrationId: 'admin-a',
    userId: 'actor-a',
    activeRoles: ['HR_ADMIN'],
    permissions: ['salary:read', 'salary:write', 'leave:read', 'leave:write', 'employee:read'],
  })
  requireHrGroupId.mockReturnValue('group-a')
  const rpc = vi.fn(async (_functionName: string, args: Record<string, unknown>) => {
    const key = String(args.requested_source_key)
    const existing = sourceEntries.get(key)
    if (existing) return { data: { ...existing, status: 'PENDING' }, error: null }
    const saved = { id: `entry-${sourceEntries.size + 1}`, source_type: 'ACTUAL_WORK_CSV' }
    sourceEntries.set(key, saved)
    return { data: { ...saved, status: 'PENDING' }, error: null }
  })
  lastRpc = rpc
  const supabase = { from: vi.fn((table: string) => queryFor(table)), rpc }
  createClient.mockResolvedValue(supabase)
  return supabase
}

describe('Actual Work payroll CSV preview and confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    payrollAdministration.mockResolvedValue(null)
    calendarPeriods.mockResolvedValue([])
    sourceEntries.clear()
    entryRows.length = 0
    configureAdmin()
  })

  it('validates multiple employees and honors day-period validity at the inclusive end date', async () => {
    const csv = [
      'employeeNumber,workHourTypeCode,entryType,date,payrollPeriodStart,hours,description',
      '1001,WORK,DAY,2026-10-30,2026-10-01,8,"Dienst, dag"',
      '1002,WORK,DAY,2026-10-31,2026-10-01,4,Extra',
    ].join('\n')

    const result = await previewActualWorkCsv({ csv, confirm: false })

    expect(result.rows).toMatchObject([
      { rowNumber: 2, employeeNumber: '1001', valid: true, error: null, hours: '8', description: 'Dienst, dag' },
      { rowNumber: 3, employeeNumber: '1002', valid: true, error: null, hours: '4', description: 'Extra' },
    ])
  })

  it('marks duplicate rows in a single file and remains idempotent on a repeated confirmation', async () => {
    const csv = [
      'employeeNumber,workHourTypeCode,entryType,date,payrollPeriodStart,hours',
      '1001,WORK,DAY,2026-10-12,2026-10-01,8',
      '1001,WORK,DAY,2026-10-12,2026-10-01,8',
    ].join('\n')

    const preview = await previewActualWorkCsv({ csv, confirm: false })
    expect(preview.rows.map((row) => row.duplicate)).toEqual([false, true])

    const firstConfirmation = await previewActualWorkCsv({ csv, confirm: true })
    const secondConfirmation = await previewActualWorkCsv({ csv, confirm: true })

    expect(firstConfirmation.saved).toMatchObject([
      { rowNumber: 2, duplicate: false, status: 'PENDING' },
    ])
    expect(firstConfirmation.rows).toMatchObject([
      { rowNumber: 2, valid: true, duplicate: false },
      { rowNumber: 3, valid: false, duplicate: true },
    ])
    expect(secondConfirmation.saved?.every((row) => row.duplicate)).toBe(true)
    expect(sourceEntries.size).toBe(1)
    expect(lastRpc).toHaveBeenCalled()
  })

  it('rejects repeated source references with conflicting row data during preview', async () => {
    const csv = [
      'employeeNumber,workHourTypeCode,entryType,date,payrollPeriodStart,hours,sourceReference',
      '1001,WORK,DAY,2026-10-12,2026-10-01,8,weekly-42',
      '1001,WORK,DAY,2026-10-12,2026-10-01,6,weekly-42',
    ].join('\n')

    const result = await previewActualWorkCsv({ csv, confirm: false })

    expect(result.rows).toMatchObject([
      { valid: true, duplicate: false },
      { valid: false, duplicate: true, error: 'ACTUAL_WORK_CSV_SOURCE_REFERENCE_CONFLICT' },
    ])
  })

  it('rejects invalid employees, dates and quantities before any import RPC', async () => {
    const csv = [
      'employeeNumber,workHourTypeCode,entryType,date,payrollPeriodStart,hours',
      '9999,WORK,DAY,2026-10-12,2026-10-01,8',
      '1001,WORK,DAY,2026-02-30,2026-10-01,8',
      '1002,WORK,DAY,2026-10-13,2026-10-01,0',
    ].join('\n')

    const result = await previewActualWorkCsv({ csv, confirm: true })

    expect(result.rows).toMatchObject([
      { rowNumber: 2, valid: false, error: 'ACTUAL_WORK_CSV_EMPLOYEE_NOT_FOUND' },
      { rowNumber: 3, valid: false, error: 'ACTUAL_WORK_CSV_PERIOD_INVALID' },
      { rowNumber: 4, valid: false, error: 'ACTUAL_WORK_CSV_HOURS_INVALID' },
    ])
    expect(result.saved).toEqual([])
    expect(lastRpc).not.toHaveBeenCalled()
  })

  it('keeps malformed CSV rows in the preview and safely reports impossible day dates', async () => {
    const csv = [
      'employeeNumber,workHourTypeCode,entryType,date,payrollPeriodStart,hours',
      '1001,WORK,DAY,2026-02-30,2026-10-01,8',
      '1002,WORK,DAY,2026-10-12,2026-10-01,8,unexpected',
    ].join('\n')

    const result = await previewActualWorkCsv({ csv, confirm: false })

    expect(result.rows).toMatchObject([
      { rowNumber: 2, valid: false, error: 'ACTUAL_WORK_CSV_PERIOD_INVALID' },
      { rowNumber: 3, valid: false, error: 'ACTUAL_WORK_CSV_COLUMN_COUNT_INVALID' },
    ])
  })

  it('rejects a Manager role before reading any tenant data', async () => {
    const supabase = configureAdmin()
    requirePermission.mockResolvedValue({
      tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'admin-a', userId: 'actor-manager',
      activeRoles: ['MANAGER'], permissions: ['salary:read', 'leave:read', 'employee:read'],
    })

    await expect(previewActualWorkCsv({
      csv: 'employeeNumber,workHourTypeCode,payrollPeriodStart,hours\n1001,WORK,2026-10-01,8',
      confirm: false,
    })).rejects.toMatchObject({ status: 403 })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('rejects a premium mapping while the Payroll source has no dedicated premium component', async () => {
    const supabase = configureAdmin()

    await expect(mutateActualWorkPayroll({
      action: 'map',
      mapping: { workHourTypeId: workTypeId, processingTarget: 'PREMIUM', validFrom: '2026-10-01', factor: '0.4500' },
    })).rejects.toMatchObject({ code: 'ACTUAL_WORK_PAYROLL_COMPONENT_SOURCE_GAP', status: 409 })

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('refuses HR approval when the selected four-week Payroll period is closed', async () => {
    const supabase = configureAdmin()
    const payrollPeriodId = '66666666-6666-4666-8666-666666666666'
    payrollAdministration.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      displayName: 'Test',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    calendarPeriods.mockResolvedValue([{
      id: payrollPeriodId,
      period_year: 2026,
      period_month: null,
      period_number: 11,
      periodicity: 'FOUR_WEEKLY',
      period_kind: 'REGULAR',
      starts_on: '2026-12-21',
      ends_on: '2027-01-17',
      planned_payment_date: null,
      status: 'CLOSED',
    }])

    await expect(mutateActualWorkPayroll({
      action: 'approve',
      payrollPeriodId,
      entryIds: [workTypeId],
    })).rejects.toMatchObject({ code: 'ACTUAL_WORK_PAYROLL_PERIOD_CLOSED', status: 409 })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('approves a cross-year four-week entry against the selected Payroll calendar period ID', async () => {
    configureAdmin()
    const payrollPeriodId = '99999999-9999-4999-8999-999999999999'
    payrollAdministration.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      displayName: 'Test',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
    calendarPeriods.mockResolvedValue([{
      id: payrollPeriodId,
      period_year: 2026,
      period_month: null,
      period_number: 11,
      periodicity: 'FOUR_WEEKLY',
      period_kind: 'REGULAR',
      starts_on: '2026-12-21',
      ends_on: '2027-01-17',
      planned_payment_date: null,
      status: 'OPEN',
    }])
    entryRows.push({
      id: actualEntryId,
      tenant_id: 'tenant-a',
      hr_group_id: 'group-a',
      administration_id: 'admin-a',
      employee_id: firstEmployeeId,
      employment_id: firstEmploymentId,
      work_hour_type_id: workTypeId,
      entry_granularity: 'PERIOD',
      subject_period_start: '2026-12-28',
      subject_period_end: '2027-01-05',
      posting_period_start: '2026-12-01',
      hours: 24,
      status: 'PENDING',
      note: null,
    })
    lastRpc.mockResolvedValueOnce({ data: { ...entryRows[0], status: 'APPROVED' }, error: null })

    await expect(mutateActualWorkPayroll({
      action: 'approve',
      payrollPeriodId,
      entryIds: [actualEntryId],
    })).resolves.toMatchObject([{ id: actualEntryId, status: 'APPROVED' }])

    expect(lastRpc).toHaveBeenCalledWith('approve_actual_work_entry_for_payroll', {
      requested_tenant_id: 'tenant-a',
      requested_hr_group_id: 'group-a',
      requested_administration_id: 'admin-a',
      requested_entry_id: actualEntryId,
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireAccess, createRepository, inspectSource, calculateEmployee } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAccess: vi.fn(),
  createRepository: vi.fn(),
  inspectSource: vi.fn(),
  calculateEmployee: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('./component-library-access', () => ({ requireComponentLibraryAccess: requireAccess }))
vi.mock('./calculation-repository', () => ({ createPayrollCalculationRepository: createRepository }))
vi.mock('./employee-payroll-calculation-service', () => ({
  calculateEmployeePayroll: calculateEmployee,
  inspectEmployeePayrollSource: inspectSource,
}))

import { calculatePayrollProfessionalBatch } from './payroll-professional-run-service'

const tenantId = '10000000-0000-4000-8000-000000000001'
const hrGroupId = '10000000-0000-4000-8000-000000000002'
const administrationId = '10000000-0000-4000-8000-000000000003'
const payrollAdministrationId = '10000000-0000-4000-8000-000000000004'
const employeeIds = [
  '10000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000012',
]
const employmentIds = [
  '10000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000022',
]
const periodRow = {
  id: '10000000-0000-4000-8000-000000000031',
  payroll_administration_id: payrollAdministrationId,
  period_year: 2026,
  period_month: 10,
  starts_on: '2026-10-01',
  ends_on: '2026-10-31',
  status: 'OPEN',
} as const

function queryBuilder(result: unknown) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'is', 'lte', 'or', 'order', 'range', 'limit']) {
    query[method] = vi.fn(() => query)
  }
  query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  return query
}

function setRoster() {
  const employments = employmentIds.map((id, index) => ({
    id,
    employee_id: employeeIds[index],
    employment_number: `EMP-${index + 1}`,
    starts_on: '2024-01-01',
    ends_on: null,
    is_primary: true,
  }))
  const employees = employeeIds.map((id, index) => ({
    id,
    employee_number: `W-${index + 1}`,
    first_name: `Medewerker ${index + 1}`,
    birth_name_prefix: null,
    birth_name: null,
  }))
  createClient.mockResolvedValue({
    from: vi.fn((table: string) => table === 'employments'
      ? queryBuilder({ data: employments, count: employments.length, error: null })
      : queryBuilder({ data: employees, error: null })),
  })
}

describe('Payroll Professional multi-employee calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setRoster()
    requireAccess.mockResolvedValue({
      scope: { tenantId, hrGroupId, administrationId },
      administration: { id: payrollAdministrationId },
    })
    createRepository.mockReturnValue({ listPayrollPeriods: vi.fn().mockResolvedValue([periodRow]) })
    inspectSource.mockImplementation(async ({ employeeId, employmentId, period }) => ({
      employeeId,
      employmentId,
      period,
      eligibleForCalculation: employeeId === employeeIds[0],
      gaps: employeeId === employeeIds[0] ? [] : [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'TAX_PROFILE_MISSING' }],
    }))
    calculateEmployee.mockResolvedValue({
      status: 'INCOMPLETE',
      completeness: 'INCOMPLETE',
      employeeId: employeeIds[0],
      employmentId: employmentIds[0],
      period: { year: 2026, month: 10 },
      runId: '10000000-0000-4000-8000-000000000041',
      sourceSnapshotId: '10000000-0000-4000-8000-000000000042',
      inputSetId: '10000000-0000-4000-8000-000000000043',
      revision: 1,
      businessStatus: 'CONCEPT',
      sourceHash: 'a'.repeat(64),
      inputHash: 'b'.repeat(64),
      resultHash: 'c'.repeat(64),
      grossAmount: '4000.00',
      wageTaxAmount: '500.00',
      netAfterWageTax: '3500.00',
      gaps: [],
      incompleteComponents: ['PENSION_EMPLOYEE_ALLOCATION'],
      recoveryActions: [],
      previousRunId: null,
      changedSourceKeys: [],
      errorCode: null,
    })
  })

  it('calculates eligible employees and returns source gaps for blocked employees in the same batch', async () => {
    const result = await calculatePayrollProfessionalBatch({ periodKey: '2026-10', employmentIds })

    expect(result.message).toBe('partial')
    expect(result.items.map((item) => item.state)).toEqual(['SOURCE_GAP', 'INCOMPLETE'])
    expect(result.items[0]?.missingFields).toEqual([{ field: 'taxProfile', unsupported: false }])
    expect(result.items[1]?.remainingAfterWageTax).toBe('3500.00')
    expect(result.items[1]?.employerCosts).toBeNull()
    expect(result.items[1]?.incompleteComponents).toEqual(['PENSION_EMPLOYEE_ALLOCATION'])
    expect(calculateEmployee).toHaveBeenCalledTimes(1)
    expect(calculateEmployee).toHaveBeenCalledWith({
      employeeId: employeeIds[0], employmentId: employmentIds[0], period: { year: 2026, month: 10 },
    })
  })

  it('writes nothing when every selected employee has blocking source gaps', async () => {
    inspectSource.mockImplementation(async ({ employeeId, employmentId, period }) => ({
      employeeId,
      employmentId,
      period,
      eligibleForCalculation: false,
      gaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'TAX_PROFILE_MISSING' }],
    }))

    const result = await calculatePayrollProfessionalBatch({ periodKey: '2026-10', employmentIds })

    expect(result.message).toBe('sourceNotReady')
    expect(result.items).toHaveLength(2)
    expect(calculateEmployee).not.toHaveBeenCalled()
  })

  it('rejects an employment outside the selected administration before preflight or writes', async () => {
    const result = await calculatePayrollProfessionalBatch({
      periodKey: '2026-10',
      employmentIds: ['10000000-0000-4000-8000-000000000099'],
    })

    expect(result.message).toBe('scopeChanged')
    expect(inspectSource).not.toHaveBeenCalled()
    expect(calculateEmployee).not.toHaveBeenCalled()
  })
})

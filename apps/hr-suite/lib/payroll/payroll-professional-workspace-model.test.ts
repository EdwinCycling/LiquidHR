import { describe, expect, it } from 'vitest'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from './calculation-repository'
import type { PayrollPeriodRow, PayrollSourceSnapshotRow } from './database'
import type { PayrollCycleWorkItem } from './payroll-cycle-model'
import {
  projectPayrollProfessionalEmployees,
  type PayrollProfessionalRosterEmployee,
} from './payroll-professional-workspace-model'

const period = {
  id: '10000000-0000-4000-8000-000000000001',
  payroll_administration_id: '10000000-0000-4000-8000-000000000002',
  source_tenant_id: '10000000-0000-4000-8000-000000000003',
  source_hr_group_id: '10000000-0000-4000-8000-000000000004',
  source_administration_id: '10000000-0000-4000-8000-000000000005',
  period_year: 2026,
  period_month: 10,
  starts_on: '2026-10-01',
  ends_on: '2026-10-31',
  status: 'OPEN',
  created_at: '2026-10-01T00:00:00.000Z',
  created_by_user_id: null,
  updated_at: '2026-10-01T00:00:00.000Z',
  updated_by_user_id: null,
} satisfies PayrollPeriodRow

const roster: readonly PayrollProfessionalRosterEmployee[] = [
  {
    employeeId: '20000000-0000-4000-8000-000000000001',
    employmentId: '30000000-0000-4000-8000-000000000001',
    employeeNumber: 'W-001',
    employeeName: 'Nog Niet',
    employmentNumber: 'D-001',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
  },
  {
    employeeId: '20000000-0000-4000-8000-000000000002',
    employmentId: '30000000-0000-4000-8000-000000000002',
    employeeNumber: 'W-002',
    employeeName: 'Geblokkeerd',
    employmentNumber: 'D-002',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
  },
  {
    employeeId: '20000000-0000-4000-8000-000000000003',
    employmentId: '30000000-0000-4000-8000-000000000003',
    employeeNumber: 'W-003',
    employeeName: 'Concept Medewerker',
    employmentNumber: 'D-003',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
  },
  {
    employeeId: '20000000-0000-4000-8000-000000000004',
    employmentId: '30000000-0000-4000-8000-000000000004',
    employeeNumber: 'W-004',
    employeeName: 'Gecontroleerd',
    employmentNumber: 'D-004',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
  },
  {
    employeeId: '20000000-0000-4000-8000-000000000005',
    employmentId: '30000000-0000-4000-8000-000000000005',
    employeeNumber: 'W-005',
    employeeName: 'Definitief',
    employmentNumber: 'D-005',
    startsOn: '2024-01-01',
    endsOn: null,
    isPrimary: true,
  },
]

function sourceSnapshot(employee: PayrollProfessionalRosterEmployee, runId: string): PayrollSourceSnapshotRow {
  return {
    id: `${runId.slice(0, 8)}-0000-4000-8000-000000000010`,
    payroll_administration_id: period.payroll_administration_id,
    source_tenant_id: period.source_tenant_id,
    source_hr_group_id: period.source_hr_group_id,
    source_administration_id: period.source_administration_id,
    source_employee_id: employee.employeeId,
    source_employment_id: employee.employmentId,
    source_income_relationship_id: null,
    period_reference: '2026-10-01',
    source_payload: {},
    source_version_vector: {},
    source_hash: 'a'.repeat(64),
    created_at: '2026-10-10T10:00:00.000Z',
    created_by_user_id: null,
  }
}

function runSummary(employee: PayrollProfessionalRosterEmployee, runId: string, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED'): PayrollRunSummary {
  const createdAt = '2026-10-10T10:00:00.000Z'
  return {
    run: {
      id: runId,
      payroll_administration_id: period.payroll_administration_id,
      source_tenant_id: period.source_tenant_id,
      source_hr_group_id: period.source_hr_group_id,
      source_administration_id: period.source_administration_id,
      calculation_input_set_id: `${runId.slice(0, 8)}-0000-4000-8000-000000000011`,
      run_type: 'INDIVIDUAL_PAYROLL',
      status,
      started_at: createdAt,
      finished_at: createdAt,
      result_hash: status === 'SUCCEEDED' ? 'b'.repeat(64) : null,
      created_at: createdAt,
      created_by_user_id: null,
      updated_at: createdAt,
      updated_by_user_id: null,
    },
    inputSet: {
      id: `${runId.slice(0, 8)}-0000-4000-8000-000000000011`,
      payroll_administration_id: period.payroll_administration_id,
      source_tenant_id: period.source_tenant_id,
      source_hr_group_id: period.source_hr_group_id,
      source_administration_id: period.source_administration_id,
      source_snapshot_id: `${runId.slice(0, 8)}-0000-4000-8000-000000000010`,
      payroll_period_id: period.id,
      rule_package_composition_id: 'NL-PAYROLL-2026:2026.1',
      engine_version: 'test',
      input_hash: 'c'.repeat(64),
      created_at: createdAt,
      created_by_user_id: null,
    },
    sourceSnapshot: sourceSnapshot(employee, runId),
    payrollPeriod: period,
  }
}

function workItem(employee: PayrollProfessionalRosterEmployee, runId: string, businessStatus: 'CONCEPT' | 'REVIEWED' | 'FINALIZED'): PayrollCycleWorkItem {
  return {
    employeeId: employee.employeeId,
    employmentId: employee.employmentId,
    runId,
    technicalStatus: 'SUCCEEDED',
    businessStatus,
    revision: 1,
    previousRunId: null,
    sourceHash: 'a'.repeat(64),
    inputHash: 'c'.repeat(64),
    changedSourceKeys: [],
    sourceDriftKeys: [],
    inputChanged: false,
    stale: false,
    correctionSuccessorRequired: false,
    sourceGaps: [],
    sourceDiagnostics: [],
  }
}

function artifacts(summary: PayrollRunSummary, amounts: { readonly gross: string; readonly net: string; readonly employer: string }): PayrollCalculationArtifacts {
  return {
    ...summary,
    componentResults: [
      { component_key: 'gross_salary', amount: null, result_payload: { amount: amounts.gross } },
      { component_key: 'net_salary', amount: null, result_payload: { amount: amounts.net } },
      { component_key: 'total_employer_cost', amount: null, result_payload: { amount: amounts.employer } },
    ],
    trace: null,
    controls: [],
    goldenCase: null,
  } as unknown as PayrollCalculationArtifacts
}

describe('Payroll Professional workspace projection', () => {
  it('shows every roster employee, keeps blocked employees visible, and separates run statuses', () => {
    const conceptRun = runSummary(roster[2], '40000000-0000-4000-8000-000000000003')
    const reviewedRun = runSummary(roster[3], '40000000-0000-4000-8000-000000000004')
    const finalizedRun = runSummary(roster[4], '40000000-0000-4000-8000-000000000005')
    const projected = projectPayrollProfessionalEmployees({
      roster,
      workItems: [
        {
          ...workItem(roster[1], '', 'CONCEPT'),
          runId: null,
          businessStatus: null,
          technicalStatus: null,
          sourceGaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'TAX_PROFILE_MISSING' }],
        },
        workItem(roster[2], conceptRun.run.id, 'CONCEPT'),
        workItem(roster[3], reviewedRun.run.id, 'REVIEWED'),
        workItem(roster[4], finalizedRun.run.id, 'FINALIZED'),
      ],
      runs: [conceptRun, reviewedRun, finalizedRun],
      artifactsByRun: new Map([
        [conceptRun.run.id, artifacts(conceptRun, { gross: '4000.00', net: '3000.00', employer: '5000.00' })],
        [reviewedRun.run.id, artifacts(reviewedRun, { gross: '4500.00', net: '3300.00', employer: '5500.00' })],
        [finalizedRun.run.id, artifacts(finalizedRun, { gross: '5000.00', net: '3700.00', employer: '6000.00' })],
      ]),
      periodStatus: 'OPEN',
      canWrite: true,
    })

    expect(projected.employees).toHaveLength(5)
    expect(projected.employees.map((employee) => employee.status)).toEqual([
      'NOT_CALCULATED', 'BLOCKED', 'CONCEPT', 'REVIEWED', 'FINALIZED',
    ])
    expect(projected.employees[1]?.exceptions).toEqual([{
      kind: 'SOURCE_GAP', field: 'taxProfile', reasonCode: 'TAX_PROFILE_MISSING',
    }])
    expect(projected.employees[2]).toMatchObject({
      grossAmount: '4000.00',
      netAmount: '3000.00',
      employerCosts: '5000.00',
      canReview: true,
      canFinalize: false,
    })
    expect(projected.employees[3]?.canFinalize).toBe(true)
    expect(projected.employees[4]).toMatchObject({
      status: 'FINALIZED',
      canCalculate: false,
      canReview: false,
      canFinalize: false,
      canViewPayslip: true,
    })
    expect(projected.summary).toMatchObject({
      totalEmployees: 5,
      counts: { NOT_CALCULATED: 1, BLOCKED: 1, CONCEPT: 1, REVIEWED: 1, FINALIZED: 1 },
      grossTotal: '13500.00',
      netTotal: '10000.00',
      employerCostsTotal: '16500.00',
      employeesWithExceptions: 1,
      exceptionCount: 1,
    })
  })

  it('disables lifecycle actions for a closed period while retaining the finalized run', () => {
    const finalizedRun = runSummary(roster[4], '40000000-0000-4000-8000-000000000005')
    const projected = projectPayrollProfessionalEmployees({
      roster: [roster[4]],
      workItems: [workItem(roster[4], finalizedRun.run.id, 'FINALIZED')],
      runs: [finalizedRun],
      artifactsByRun: new Map([[finalizedRun.run.id, artifacts(finalizedRun, { gross: '5000.00', net: '3700.00', employer: '6000.00' })]]),
      periodStatus: 'CLOSED',
      canWrite: true,
    })

    expect(projected.employees[0]).toMatchObject({
      status: 'FINALIZED',
      canCalculate: false,
      canReview: false,
      canFinalize: false,
      canViewPayslip: true,
    })
  })

  it('allows stale concept runs to recalculate but withholds review and finalization', () => {
    const conceptRun = runSummary(roster[2], '40000000-0000-4000-8000-000000000003')
    const staleWorkItem = {
      ...workItem(roster[2], conceptRun.run.id, 'CONCEPT'),
      stale: true,
      sourceDriftKeys: ['contractualSalary'],
    }
    const projected = projectPayrollProfessionalEmployees({
      roster: [roster[2]],
      workItems: [staleWorkItem],
      runs: [conceptRun],
      artifactsByRun: new Map([[conceptRun.run.id, artifacts(conceptRun, { gross: '4000.00', net: '3000.00', employer: '5000.00' })]]),
      periodStatus: 'OPEN',
      canWrite: true,
    })

    expect(projected.employees[0]).toMatchObject({
      status: 'CONCEPT',
      stale: true,
      canCalculate: true,
      canReview: false,
      canFinalize: false,
    })
    expect(projected.employees[0]?.exceptions).toContainEqual({ kind: 'STALE', reasonCode: 'SOURCE_CHANGED_AFTER_SAVED_RUN' })
  })
})

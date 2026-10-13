import { describe, expect, it } from 'vitest'
import type {
  IndividualPayrollLifecycleEventRow,
  PayrollPeriodRow,
  PayrollSourceSnapshotRow,
} from './database'
import type { PayrollRunSummary } from './calculation-repository'
import { projectPayrollCycle } from './payroll-cycle-model'

const cycle = {
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

const snapshot = (id: string, hash: string, employeeId: string, employmentId: string, vector: Record<string, string>) => ({
  id,
  payroll_administration_id: cycle.payroll_administration_id,
  source_tenant_id: cycle.source_tenant_id,
  source_hr_group_id: cycle.source_hr_group_id,
  source_administration_id: cycle.source_administration_id,
  source_employee_id: employeeId,
  source_employment_id: employmentId,
  source_income_relationship_id: null,
  period_reference: '2026-10-01',
  source_payload: {},
  source_version_vector: vector,
  source_hash: hash,
  created_at: '2026-10-01T00:00:00.000Z',
  created_by_user_id: null,
}) satisfies PayrollSourceSnapshotRow

const run = (id: string, employeeId: string, employmentId: string, sourceHash: string, inputHash: string, createdAt: string, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED') => ({
  run: {
    id,
    payroll_administration_id: cycle.payroll_administration_id,
    source_tenant_id: cycle.source_tenant_id,
    source_hr_group_id: cycle.source_hr_group_id,
    source_administration_id: cycle.source_administration_id,
    calculation_input_set_id: `${id.slice(0, 8)}-0000-4000-8000-000000000001`,
    run_type: 'INDIVIDUAL_PAYROLL',
    status,
    started_at: createdAt,
    finished_at: createdAt,
    result_hash: status === 'SUCCEEDED' ? 'f'.repeat(64) : null,
    created_at: createdAt,
    created_by_user_id: null,
    updated_at: createdAt,
    updated_by_user_id: null,
  },
  inputSet: {
    id: `${id.slice(0, 8)}-0000-4000-8000-000000000001`,
    payroll_administration_id: cycle.payroll_administration_id,
    source_tenant_id: cycle.source_tenant_id,
    source_hr_group_id: cycle.source_hr_group_id,
    source_administration_id: cycle.source_administration_id,
    source_snapshot_id: `${id.slice(0, 8)}-0000-4000-8000-000000000002`,
    payroll_period_id: cycle.id,
    rule_package_composition_id: 'NL-PAYROLL-2026:2026.1',
    engine_version: 'payroll-engine-test',
    input_hash: inputHash,
    created_at: createdAt,
    created_by_user_id: null,
  },
  sourceSnapshot: snapshot(
    `${id.slice(0, 8)}-0000-4000-8000-000000000002`,
    sourceHash,
    employeeId,
    employmentId,
    { 'employment_salary:salary-1': createdAt },
  ),
  payrollPeriod: cycle,
}) satisfies PayrollRunSummary

const event = (
  id: string,
  runId: string,
  employmentId: string,
  revision: number,
  eventSequence: number,
  eventType: IndividualPayrollLifecycleEventRow['event_type'],
  sourceHash: string,
  inputHash: string,
  createdAt: string,
) => ({
  id,
  payroll_administration_id: cycle.payroll_administration_id,
  source_tenant_id: cycle.source_tenant_id,
  source_hr_group_id: cycle.source_hr_group_id,
  source_administration_id: cycle.source_administration_id,
  payroll_period_id: cycle.id,
  source_employment_id: employmentId,
  calculation_run_id: runId,
  revision,
  event_sequence: eventSequence,
  event_type: eventType,
  event_payload: { sourceHash, inputHash },
  created_at: createdAt,
  created_by_user_id: null,
}) satisfies IndividualPayrollLifecycleEventRow

describe('PayrollCycle projection', () => {
  it('keeps technical status separate from the latest existing business lifecycle event', () => {
    const calculation = run(
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      'a'.repeat(64),
      'b'.repeat(64),
      '2026-10-02T10:00:00.000Z',
    )
    const projected = projectPayrollCycle({
      cycle,
      runs: [calculation],
      lifecycleEventsByEmployment: {
        [calculation.sourceSnapshot.source_employment_id]: [
          event('50000000-0000-4000-8000-000000000001', calculation.run.id, calculation.sourceSnapshot.source_employment_id, 1, 1, 'CONCEPT', 'a'.repeat(64), 'b'.repeat(64), '2026-10-02T10:00:00.000Z'),
          event('50000000-0000-4000-8000-000000000002', calculation.run.id, calculation.sourceSnapshot.source_employment_id, 1, 2, 'REVIEWED', 'a'.repeat(64), 'b'.repeat(64), '2026-10-02T11:00:00.000Z'),
        ],
      },
    })

    expect(projected.workItems[0]).toMatchObject({
      runId: calculation.run.id,
      technicalStatus: 'SUCCEEDED',
      businessStatus: 'REVIEWED',
      revision: 1,
      stale: false,
    })
    expect(projected.calculationCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'CORE_FISCAL_PROFILE', status: 'SOURCE_GAP' }),
      expect.objectContaining({ category: 'PFZW_MONTHLY_ALLOCATION', status: 'SOURCE_GAP' }),
      expect.objectContaining({ category: 'CUMULATIVE_TAX', status: 'UNSUPPORTED' }),
    ]))
  })

  it('flags a late source change on a final result without changing its lifecycle or result', () => {
    const first = run(
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      'a'.repeat(64),
      'b'.repeat(64),
      '2026-10-02T10:00:00.000Z',
    )
    const second = run(
      '20000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      'c'.repeat(64),
      'd'.repeat(64),
      '2026-10-03T10:00:00.000Z',
    )
    const projected = projectPayrollCycle({
      cycle,
      runs: [first, second],
      lifecycleEventsByEmployment: {
        [second.sourceSnapshot.source_employment_id]: [
          event('50000000-0000-4000-8000-000000000001', first.run.id, first.sourceSnapshot.source_employment_id, 1, 3, 'FINALIZED', 'a'.repeat(64), 'b'.repeat(64), '2026-10-02T12:00:00.000Z'),
          event('50000000-0000-4000-8000-000000000002', second.run.id, second.sourceSnapshot.source_employment_id, 2, 1, 'CONCEPT', 'c'.repeat(64), 'd'.repeat(64), '2026-10-03T10:00:00.000Z'),
        ],
      },
      currentSourcesByEmployment: {
        [second.sourceSnapshot.source_employment_id]: {
          employeeId: second.sourceSnapshot.source_employee_id,
          sourceHash: 'e'.repeat(64),
          sourceVersionVector: { 'employment_salary:salary-1': '2026-10-04T10:00:00.000Z' },
          gaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' }],
        },
      },
    })

    expect(projected.workItems[0]).toMatchObject({
      runId: second.run.id,
      businessStatus: 'CONCEPT',
      revision: 2,
      previousRunId: first.run.id,
      inputChanged: true,
      changedSourceKeys: ['employment_salary:salary-1'],
      sourceDriftKeys: ['employment_salary:salary-1'],
      stale: true,
      correctionSuccessorRequired: false,
      sourceGaps: [{ field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' }],
    })
  })

  it('marks a changed finalized head as requiring an explicit correction successor', () => {
    const calculation = run(
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      'a'.repeat(64),
      'b'.repeat(64),
      '2026-10-02T10:00:00.000Z',
    )
    const projected = projectPayrollCycle({
      cycle,
      runs: [calculation],
      lifecycleEventsByEmployment: {
        [calculation.sourceSnapshot.source_employment_id]: [
          event('50000000-0000-4000-8000-000000000001', calculation.run.id, calculation.sourceSnapshot.source_employment_id, 1, 3, 'FINALIZED', 'a'.repeat(64), 'b'.repeat(64), '2026-10-02T12:00:00.000Z'),
        ],
      },
      currentSourcesByEmployment: {
        [calculation.sourceSnapshot.source_employment_id]: {
          employeeId: calculation.sourceSnapshot.source_employee_id,
          sourceHash: 'f'.repeat(64),
          sourceVersionVector: { 'employment_salary:salary-1': '2026-10-04T10:00:00.000Z' },
          gaps: [],
        },
      },
    })

    expect(projected.workItems[0]).toMatchObject({
      businessStatus: 'FINALIZED',
      stale: true,
      correctionSuccessorRequired: true,
    })
    expect(calculation.run.result_hash).toBe('f'.repeat(64))
  })
})

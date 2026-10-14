import { createHash, randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PayrollSourceProvider, PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import type { PayrollCalculationArtifacts, PayrollCalculationRepository } from './calculation-repository'
import type {
  GenericPayrollInputReferenceRow,
  IndividualPayrollLifecycleEventRow,
  PayrollCalculationInputSetRow,
  PayrollCalculationRunRow,
  PayrollComponentResultRow,
  PayrollControlRow,
  PayrollDatabase,
  PayrollJson,
  PayrollPeriodRow,
  PayrollSourceSnapshotRow,
} from './database'
import type { Payrun01Repository } from './payrun01-repository'
import type { PayrollScope } from './scope'
import {
  EmployeePayrollCalculationError,
  createEmployeePayrollCalculationService,
} from './employee-payroll-calculation-service'
import {
  LiquidHrPayrollSourceProvider,
  type PayrollSourceEmployment,
  type PayrollSourceIncomeRelationship,
  type PayrollSourceProviderDependencies,
  type PayrollSourceSalary,
  type PayrollSourceTimeline,
} from './source/liquid-hr-source-provider'

const scope: PayrollScope = {
  tenantId: '11000000-0000-4000-8000-000000000001',
  hrGroupId: '22000000-0000-4000-8000-000000000002',
  administrationId: '33000000-0000-4000-8000-000000000003',
}
const payrollAdminId = '44000000-0000-4000-8000-000000000004'
const actorId = '55000000-0000-4000-8000-000000000005'
const employeeId = '66000000-0000-4000-8000-000000000006'
const employmentId = '77000000-0000-4000-8000-000000000007'
const ikvId = '88000000-0000-4000-8000-000000000008'
const linkId = '99000000-0000-4000-8000-000000000009'
const taxProfileId = 'aa000000-0000-4000-8000-00000000000a'
const secondEmployeeId = 'bb000000-0000-4000-8000-00000000000b'
const secondEmploymentId = 'cc000000-0000-4000-8000-00000000000c'
const secondIncomeRelationshipId = 'dd000000-0000-4000-8000-00000000000d'
const secondIncomeLinkId = 'ee000000-0000-4000-8000-00000000000e'
const secondTaxProfileId = 'ff000000-0000-4000-8000-00000000000f'
const period = { year: 2026, month: 9 }
const runTime = '2026-10-01T12:00:00.000Z'

function id(): string {
  return randomUUID()
}

function sourceEmployment(): PayrollSourceEmployment {
  return {
    id: employmentId, tenant_id: scope.tenantId, hr_group_id: scope.hrGroupId,
    administration_id: scope.administrationId, employee_id: employeeId,
    starts_on: '2026-01-01', ends_on: null, record_status: 'CONFIRMED',
    employment_type: 'EMPLOYEE', contract_type: 'INDEFINITE', original_hire_date: '2026-01-01',
    seniority_date: '2026-01-01', updated_at: runTime, deleted_at: null,
  } as PayrollSourceEmployment
}

function monthlySalary(amount: number, updatedAt = runTime): PayrollSourceSalary {
  return {
    id: 'ab000000-0000-4000-8000-00000000000b', salary_basis: 'MANUAL', salary_route: 'MANUAL',
    payment_type: 'PERIODIC_FIXED', payment_frequency: 'MONTHLY', currency_code: 'EUR',
    fulltime_amount: amount, parttime_amount: amount, hourly_rate: null,
    salary_structure_id: null, salary_scale_id: null, salary_scale_step_id: null, salary_step_code: null,
    cao_scale_name: null, cao_step_name: null, salary_band_id: null,
    valid_from: '2026-01-01', valid_until: null, updated_at: updatedAt,
  } as PayrollSourceSalary
}

function linkedIncome(overrides: Partial<PayrollSourceIncomeRelationship> = {}): PayrollSourceIncomeRelationship {
  return {
    id: linkId, incomeRelationshipId: ikvId, validFrom: '2026-01-01', validUntil: null,
    linkUpdatedAt: runTime, reportingStatus: 'READY', startsOn: '2026-01-01', endsOn: null,
    incomeRelationshipUpdatedAt: runTime, ...overrides,
  }
}

function provider(overrides: {
  readonly amount?: () => number
  readonly salaryUpdatedAt?: () => string
  readonly scheduleHours?: () => number
  readonly fiscalTable?: string
  readonly incomeLinkId?: string
  readonly includeTaxProfile?: boolean
  readonly incomeStatus?: PayrollSourceIncomeRelationship['reportingStatus']
  readonly authorizedScope?: PayrollScope
} = {}): PayrollSourceProvider {
  const amount = overrides.amount ?? (() => 4000)
  const sourceDeps: PayrollSourceProviderDependencies = {
    authorize: vi.fn(async () => overrides.authorizedScope ?? scope),
    listEmployments: vi.fn(async () => [sourceEmployment()]),
    loadTimeline: vi.fn(async (): Promise<PayrollSourceTimeline> => ({
      employment: sourceEmployment(),
      salaries: [monthlySalary(amount(), overrides.salaryUpdatedAt?.() ?? runTime)],
      schedules: [{
        id: 'bc000000-0000-4000-8000-00000000000c', average_days_per_week: 5,
        average_hours_per_week: overrides.scheduleHours?.() ?? 40, fulltime_hours_per_week: 40, part_time_factor: 1,
        schedule_type: 'HOURS_PER_DAY', is_on_call: false, valid_from: '2026-01-01', valid_until: null, updated_at: runTime,
      }],
      contracts: [{
        id: 'cd000000-0000-4000-8000-00000000000d', labor_condition_set_id: 'de000000-0000-4000-8000-00000000000e',
        fulltime_hours_per_week: 40, starts_on: '2026-01-01', ends_on: null, updated_at: runTime,
      }],
      laborConditions: [{
        id: 'de000000-0000-4000-8000-00000000000e', condition_group: 'COMPANY',
        labor_condition_set_id: 'de000000-0000-4000-8000-00000000000e', valid_from: '2026-01-01', valid_until: null,
        updated_at: runTime,
        set: { id: 'de000000-0000-4000-8000-00000000000e', code: 'COMPANY', name: 'Company',
          standard_hours_per_week: 40, is_active: true, valid_from: '2026-01-01', updated_at: runTime },
      }],
    incomeRelationships: [linkedIncome({ id: overrides.incomeLinkId ?? linkId, reportingStatus: overrides.incomeStatus ?? 'READY' })],
      taxProfileProjection: {
        ageCategory: 'UNDER_AOW', ageSourceUpdatedAt: runTime, activeIncomeRelationshipCount: 1,
        incomeRelationshipLinkGap: false,
        incomeRelationships: [{ id: ikvId, updatedAt: runTime, reportingStatus: 'READY', startsOn: '2026-01-01', endsOn: null }],
        taxProfiles: overrides.includeTaxProfile === false ? [] : [{
          id: taxProfileId, employee_id: employeeId, employment_id: employmentId,
          income_relationship_id: ikvId, employment_income_relationship_id: linkId,
          residence_country_code: 'NL', wage_tax_table: overrides.fiscalTable ?? 'WHITE', herleiding_code: 'STD',
          time_period: 'MONTH', regular_wage_only: true, full_period_only: true, has_special_situation: false,
          payroll_tax_credit_applies: true, source_classification: 'EMPLOYEE_DECLARATION',
          source_reference: 'employee declaration reference', effective_from: '2026-01-01', effective_to: null,
          version_number: 1, supersedes_profile_id: null, confirmed_by_user_id: actorId,
          confirmed_at: runTime, created_at: runTime,
        }],
      },
    })),
    loadActualWork: vi.fn(async () => ({
      period: { id: 'ef000000-0000-4000-8000-00000000000f', period_start: '2026-09-01', period_end: '2026-10-01', status: 'CLOSED', updated_at: runTime },
      entries: [], types: [],
    } as never)),
    isEnabled: () => true,
    now: () => new Date(runTime),
    createId: id,
  }
  return new LiquidHrPayrollSourceProvider(sourceDeps)
}

function openPeriod(): PayrollPeriodRow {
  return {
    id: 'fa000000-0000-4000-8000-00000000000a', payroll_administration_id: payrollAdminId,
    source_tenant_id: scope.tenantId, source_hr_group_id: scope.hrGroupId, source_administration_id: scope.administrationId,
    period_year: 2026, period_month: 9, starts_on: '2026-09-01', ends_on: '2026-09-30', status: 'OPEN',
    created_at: runTime, created_by_user_id: actorId, updated_at: runTime, updated_by_user_id: actorId,
  }
}

function harness(options: Parameters<typeof provider>[0] = {}, sourceProviderOverride?: PayrollSourceProvider) {
  const snapshots = new Map<string, PayrollSourceSnapshotRow>()
  const inputs = new Map<string, PayrollCalculationInputSetRow>()
  const runs = new Map<string, PayrollCalculationRunRow>()
  const components = new Map<string, PayrollComponentResultRow[]>()
  const controls = new Map<string, PayrollControlRow[]>()
  const traces = new Map<string, NonNullable<PayrollCalculationArtifacts['trace']>>()
  const references = new Map<string, GenericPayrollInputReferenceRow>()
  const events: IndividualPayrollLifecycleEventRow[] = []
  const calcWrites: string[] = []

  const calculationRepository = {
    getPayrollPeriod: async () => openPeriod(),
    getOrCreateSourceSnapshot: async (_scope: PayrollScope, _admin: string, row: PayrollDatabase['public']['Tables']['source_snapshots']['Insert']) => {
      const stored = snapshots.get(row.id!) ?? ({ ...row, created_at: runTime } as PayrollSourceSnapshotRow)
      snapshots.set(stored.id, stored)
      return stored
    },
    getOrCreateCalculationInputSet: async (_scope: PayrollScope, _admin: string, row: PayrollDatabase['public']['Tables']['calculation_input_sets']['Insert']) => {
      const stored = inputs.get(row.id!) ?? ({ ...row, created_at: runTime } as PayrollCalculationInputSetRow)
      inputs.set(stored.id, stored)
      return stored
    },
    getOrCreateCalculationRun: async (_scope: PayrollScope, _admin: string, row: PayrollDatabase['public']['Tables']['calculation_runs']['Insert']) => {
      const old = runs.get(row.id!)
      if (old) return { run: old, created: false }
      const created = { ...row, created_at: runTime, updated_at: runTime, updated_by_user_id: actorId } as PayrollCalculationRunRow
      runs.set(created.id, created)
      calcWrites.push(created.id)
      return { run: created, created: true }
    },
    markCalculationRunRunning: async (_scope: PayrollScope, _admin: string, runId: string, _actor: string, startedAt: string) => {
      const run = runs.get(runId)!
      const updated = { ...run, status: 'RUNNING' as const, started_at: startedAt }
      runs.set(runId, updated)
      return updated
    },
    markCalculationRunFailed: async (_scope: PayrollScope, _admin: string, runId: string) => {
      const run = runs.get(runId)!
      const updated = { ...run, status: 'FAILED' as const }
      runs.set(runId, updated)
      return updated
    },
    insertComponentResults: async (_scope: PayrollScope, _admin: string, rows: readonly PayrollDatabase['public']['Tables']['component_results']['Insert'][]) => {
      const stored = rows.map((row) => ({ ...row, id: id(), created_at: runTime, amount: row.amount ?? null } as PayrollComponentResultRow))
      if (stored[0]) components.set(stored[0].calculation_run_id, stored)
      return stored
    },
    insertPayrollControls: async (_scope: PayrollScope, _admin: string, rows: readonly PayrollDatabase['public']['Tables']['payroll_controls']['Insert'][]) => {
      const stored = rows.map((row) => ({ ...row, id: id(), created_at: runTime } as PayrollControlRow))
      if (stored[0]) controls.set(stored[0].calculation_run_id, stored)
      return stored
    },
    insertCalculationTrace: async (_scope: PayrollScope, _admin: string, row: PayrollDatabase['public']['Tables']['calculation_traces']['Insert']) => {
      const stored = { ...row, id: id(), created_at: runTime } as NonNullable<PayrollCalculationArtifacts['trace']>
      traces.set(stored.calculation_run_id, stored)
      return stored
    },
    markCalculationRunSucceededWithConcept: async (
      _scope: PayrollScope, _admin: string, runId: string, periodId: string, sourceEmploymentId: string,
      actorUserId: string, finishedAt: string, resultHash: string, payload: PayrollJson,
    ) => {
      const run = runs.get(runId)!
      const updated = { ...run, status: 'SUCCEEDED' as const, finished_at: finishedAt, result_hash: resultHash }
      runs.set(runId, updated)
      events.push({
        id: id(), ...scopeCols(), payroll_period_id: periodId, source_employment_id: sourceEmploymentId,
        calculation_run_id: runId,
        revision: (events.filter((event) => event.source_employment_id === sourceEmploymentId).at(-1)?.revision ?? 0) + 1,
        event_sequence: 1, event_type: 'CONCEPT', event_payload: payload,
        created_at: finishedAt, created_by_user_id: actorUserId,
      })
      return updated
    },
    getLatestSyntheticArtifacts: async (
      _scope: PayrollScope, _admin: string, _composition?: string, runId?: string,
    ): Promise<PayrollCalculationArtifacts | null> => {
      const run = runId ? runs.get(runId) : [...runs.values()].at(-1)
      if (!run) return null
      const inputSet = inputs.get(run.calculation_input_set_id)
      const sourceSnapshot = inputSet ? snapshots.get(inputSet.source_snapshot_id) : null
      if (!inputSet || !sourceSnapshot) return null
      return {
        run, inputSet, sourceSnapshot, payrollPeriod: openPeriod(), componentResults: components.get(run.id) ?? [],
        trace: traces.get(run.id) ?? null, controls: controls.get(run.id) ?? [], goldenCase: null,
      }
    },
  } as unknown as PayrollCalculationRepository

  const lifecycleRepository = {
    getOrCreateGenericInputReference: async (_scope: PayrollScope, _admin: string, row: Omit<GenericPayrollInputReferenceRow, 'id' | 'created_at'>) => {
      const stored = references.get(row.calculation_input_set_id) ?? ({ ...row, id: id(), created_at: runTime } as GenericPayrollInputReferenceRow)
      references.set(row.calculation_input_set_id, stored)
      return stored
    },
    getGenericInputReference: async (_scope: PayrollScope, _admin: string, inputSetId: string) => references.get(inputSetId) ?? null,
    listLifecycleEvents: async (_scope: PayrollScope, _admin: string, _periodId: string, employment: string) => events.filter((event) => event.source_employment_id === employment),
    insertLifecycleEvent: async (_scope: PayrollScope, _admin: string, row: Omit<IndividualPayrollLifecycleEventRow, 'id' | 'created_at'>) => {
      const event = { ...row, id: id(), created_at: runTime } as IndividualPayrollLifecycleEventRow
      events.push(event)
      return event
    },
  } as unknown as Payrun01Repository

  function scopeCols() {
    return { payroll_administration_id: payrollAdminId, source_tenant_id: scope.tenantId, source_hr_group_id: scope.hrGroupId, source_administration_id: scope.administrationId }
  }
  const service = createEmployeePayrollCalculationService({
    requireAccess: async () => ({ scope, administration: { id: payrollAdminId, status: 'ACTIVE', capabilityEnabled: true }, actorUserId: actorId }),
    createCalculationRepository: () => calculationRepository,
    createLifecycleRepository: () => lifecycleRepository,
    sourceProvider: sourceProviderOverride ?? provider(options), enabled: () => true, now: () => new Date(runTime),
  })
  return { service, snapshots, inputs, runs, components, controls, traces, references, events, calcWrites, calculationRepository }
}

describe('Core-backed employee payroll calculation', () => {
  it('preflights source eligibility without writing payroll snapshots, runs, or results', async () => {
    const eligible = harness()
    const ready = await eligible.service.inspectEmployeePayrollSource({ employeeId, employmentId, period })
    expect(ready.eligibleForCalculation).toBe(true)
    expect(eligible.snapshots.size).toBe(0)
    expect(eligible.runs.size).toBe(0)
    expect(eligible.inputs.size).toBe(0)

    const missingFiscalProfile = harness({ includeTaxProfile: false })
    const blocked = await missingFiscalProfile.service.inspectEmployeePayrollSource({ employeeId, employmentId, period })
    expect(blocked.eligibleForCalculation).toBe(false)
    expect(blocked.gaps).toContainEqual(expect.objectContaining({ field: 'taxProfile', status: 'SOURCE_GAP' }))
    expect(missingFiscalProfile.snapshots.size).toBe(0)
    expect(missingFiscalProfile.runs.size).toBe(0)
    expect(missingFiscalProfile.inputs.size).toBe(0)
  })

  it('calculates a supported regular month, persists a concept, reuses retries, and creates a new revision after salary change', async () => {
    let salary = 4000
    let salaryUpdatedAt = runTime
    const state = harness({ amount: () => salary, salaryUpdatedAt: () => salaryUpdatedAt })
    const first = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    const retry = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })

    expect(first).toMatchObject({
      status: 'INCOMPLETE', completeness: 'INCOMPLETE', businessStatus: 'CONCEPT', revision: 1,
      grossAmount: '4000.00', wageTaxAmount: '818.67', netAfterWageTax: '3181.33',
    })
    expect(retry.runId).toBe(first.runId)
    expect(state.snapshots.size).toBe(1)
    expect(state.inputs.size).toBe(1)
    expect(state.components.get(first.runId!)?.map((row) => row.component_key)).toEqual(expect.arrayContaining([
      'gross_salary', 'wage_tax', 'net_salary',
    ]))
    expect(state.traces.has(first.runId!)).toBe(true)
    expect(state.calcWrites).toHaveLength(1)
    expect(state.references.has(first.inputSetId!)).toBe(true)
    expect(state.references.get(first.inputSetId!)).toMatchObject({
      core_source_contract_version: 'payroll-source-v4',
      source_version_vector: expect.objectContaining({ employee_tax_classification: expect.any(String) }),
      source_hash: first.sourceHash,
      input_hash: first.inputHash,
    })
    expect(state.controls.get(first.runId!)?.some((control) => control.control_key.includes('PENSION_EMPLOYEE_ALLOCATION'))).toBe(true)

    salary = 4400
    salaryUpdatedAt = '2026-10-01T13:00:00.000Z'
    const revised = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(revised).toMatchObject({ status: 'INCOMPLETE', businessStatus: 'CONCEPT', revision: 2, grossAmount: '4400.00' })
    expect(revised.runId).not.toBe(first.runId)
    expect(revised.previousRunId).toBe(first.runId)
    expect(revised.changedSourceKeys).toContain(`employment_salary:ab000000-0000-4000-8000-00000000000b`)
    expect(state.runs.size).toBe(2)
    expect(state.snapshots.size).toBe(2)
    expect(state.inputs.size).toBe(2)
    expect(state.events.map((event) => event.event_type)).toEqual(['CONCEPT', 'CONCEPT'])
  })

  it('keeps two employees in one payroll period on independent concept revisions and results', async () => {
    const firstProvider = provider()
    const firstSource = await firstProvider.getPayrollSourceSnapshot({ ...scope, employeeId, employmentId, payrollPeriod: period })
    const canonical = firstSource.canonicalSource as Record<string, unknown>
    const fiscalProfile = canonical.fiscalProfile as Record<string, unknown>
    const incomeRelationship = canonical.incomeRelationship as Record<string, unknown>
    const regularWage = canonical.regularWage as Record<string, unknown>
    const secondSource: PayrollSourceSnapshot = {
      ...firstSource,
      id: id(),
      sourceEmployeeId: secondEmployeeId,
      sourceEmploymentId: secondEmploymentId,
      sourceIncomeRelationshipId: secondIncomeRelationshipId,
      sourceHash: createHash('sha256').update(`${firstSource.sourceHash}:${secondEmployeeId}:${secondEmploymentId}`).digest('hex'),
      canonicalSource: {
        ...canonical,
        fiscalProfile: { ...fiscalProfile, id: secondTaxProfileId, incomeRelationshipId: secondIncomeRelationshipId },
        incomeRelationship: { ...incomeRelationship, id: secondIncomeRelationshipId, employmentIncomeRelationshipId: secondIncomeLinkId },
        regularWage: { ...regularWage, grossAmount: '5000.00' },
      },
      sourceVersionVector: {
        ...firstSource.sourceVersionVector,
        [`employment:${secondEmploymentId}`]: runTime,
        [`employment_salary:${secondEmploymentId}`]: runTime,
      },
    }
    const sourceProvider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: vi.fn(async (input) => {
        if (input.employeeId === employeeId && input.employmentId === employmentId) return firstSource
        if (input.employeeId === secondEmployeeId && input.employmentId === secondEmploymentId) return secondSource
        throw new Error('Unexpected employee scope')
      }),
    }
    const state = harness({}, sourceProvider)

    const first = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    const second = await state.service.calculateEmployeePayroll({ employeeId: secondEmployeeId, employmentId: secondEmploymentId, period })

    expect(first).toMatchObject({ businessStatus: 'CONCEPT', revision: 1, grossAmount: '4000.00' })
    expect(second).toMatchObject({ businessStatus: 'CONCEPT', revision: 1, grossAmount: '5000.00' })
    expect(second.runId).not.toBe(first.runId)
    expect(state.runs.size).toBe(2)
    expect(state.snapshots.size).toBe(2)
    expect(state.inputs.size).toBe(2)
    expect(state.events.map((event) => event.source_employment_id)).toEqual([employmentId, secondEmploymentId])
    expect(state.components.get(first.runId!)?.find((row) => row.component_key === 'gross_salary')?.amount).toBe('4000.00')
    expect(state.components.get(second.runId!)?.find((row) => row.component_key === 'gross_salary')?.amount).toBe('5000.00')
  })

  it('returns a concrete tax-profile source gap and persists no fabricated calculation', async () => {
    const state = harness({ includeTaxProfile: false })
    const result = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })

    expect(result.status).toBe('SOURCE_GAP')
    expect(result.gaps).toContainEqual(expect.objectContaining({ field: 'taxProfile', reasonCode: 'NO_CONFIRMED_FISCAL_PROFILE' }))
    expect(result.recoveryActions.join(' ')).toContain('HR Admin')
    expect(result.grossAmount).toBeNull()
    expect(state.runs.size).toBe(0)
    expect(state.snapshots.size).toBe(1)
    const persistedSnapshot = [...state.snapshots.values()][0]
    expect(result.sourceSnapshotId).toBe(persistedSnapshot?.id)
    expect(persistedSnapshot?.source_payload).toMatchObject({
      sourceGaps: [expect.objectContaining({ field: 'taxProfile', reasonCode: 'NO_CONFIRMED_FISCAL_PROFILE' })],
    })
  })

  it('revalidates Core source versions before saving the input reference and fails closed when they changed', async () => {
    const baseProvider = provider()
    let reads = 0
    const sourceProvider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: vi.fn(async (input) => {
        reads += 1
        const current = await baseProvider.getPayrollSourceSnapshot(input)
        return reads === 2
          ? { ...current, sourceHash: 'f'.repeat(64) }
          : current
      }),
    }
    const state = harness({}, sourceProvider)
    const result = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })

    expect(result.status).toBe('SOURCE_GAP')
    expect(result.gaps).toContainEqual(expect.objectContaining({
      field: 'sourceSnapshot', status: 'SOURCE_GAP', reasonCode: 'CORE_SOURCE_CHANGED_BEFORE_SAVE',
    }))
    expect(result.grossAmount).toBeNull()
    expect(state.inputs.size).toBe(0)
    expect(state.references.size).toBe(0)
    expect(state.runs.size).toBe(0)
    expect(state.calcWrites).toHaveLength(0)
    expect(reads).toBe(2)
  })

  it('does not persist a concept when Core source changes while the engine is calculating', async () => {
    const baseProvider = provider()
    let reads = 0
    const sourceProvider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: vi.fn(async (input) => {
        reads += 1
        const current = await baseProvider.getPayrollSourceSnapshot(input)
        return reads === 3
          ? { ...current, sourceVersionVector: { ...current.sourceVersionVector, late_core_update: 'new-version' } }
          : current
      }),
    }
    const state = harness({}, sourceProvider)
    const result = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })

    expect(result.status).toBe('SOURCE_GAP')
    expect(result.gaps).toContainEqual(expect.objectContaining({
      field: 'sourceSnapshot', status: 'SOURCE_GAP', reasonCode: 'CORE_SOURCE_CHANGED_BEFORE_SAVE',
    }))
    expect(state.runs.size).toBe(1)
    expect([...state.runs.values()][0]?.status).toBe('FAILED')
    expect(state.components.size).toBe(0)
    expect(state.controls.size).toBe(0)
    expect(state.traces.size).toBe(0)
    expect(state.events).toHaveLength(0)
    expect(reads).toBe(3)
  })

  it('rejects unsupported fiscal and IKV combinations before calculation', async () => {
    const unsupportedFiscal = harness({ fiscalTable: 'GREEN' })
    const fiscal = await unsupportedFiscal.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(fiscal.status).toBe('UNSUPPORTED')
    expect(fiscal.gaps).toContainEqual(expect.objectContaining({ reasonCode: 'FISCAL_PROFILE_COMBINATION_UNSUPPORTED' }))
    expect(unsupportedFiscal.runs.size).toBe(0)

    const invalidIkv = harness({ incomeStatus: 'DRAFT' })
    const ikv = await invalidIkv.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(ikv.status).toBe('UNSUPPORTED')
    expect(ikv.gaps).toContainEqual(expect.objectContaining({ reasonCode: 'CONTROL02_CONTRACT_PENDING' }))
    expect(invalidIkv.runs.size).toBe(0)

    const invalidLink = harness({ incomeLinkId: '8c000000-0000-4000-8000-00000000000c' })
    const link = await invalidLink.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(link.status).toBe('UNSUPPORTED')
    expect(link.gaps).toContainEqual(expect.objectContaining({ reasonCode: 'FISCAL_PROFILE_IKV_LINK_SOURCE_MISMATCH' }))
    expect(invalidLink.runs.size).toBe(0)

    const invalidSchedule = harness({ scheduleHours: () => 32 })
    const schedule = await invalidSchedule.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(schedule.status).toBe('UNSUPPORTED')
    expect(schedule.gaps).toContainEqual(expect.objectContaining({ reasonCode: 'SCHEDULE_HOURS_DO_NOT_RECONCILE_TO_PART_TIME_FACTOR' }))
    expect(invalidSchedule.runs.size).toBe(0)
  })

  it('requires explicit review, blocks incomplete finalization, and preserves a finalized historical result after source changes', async () => {
    let salary = 4000
    const state = harness({ amount: () => salary })
    const first = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    salary = 4400
    await expect(state.service.reviewEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! }))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_CHANGED_RECALCULATE_REQUIRED' })
    expect(state.events).toHaveLength(1)
    salary = 4000
    await expect(state.service.finalizeEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! }))
      .rejects.toMatchObject({ code: 'PAYROLL_LIFECYCLE_TRANSITION_INVALID' })
    await state.service.reviewEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! })
    await expect(state.service.finalizeEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! }))
      .rejects.toMatchObject({ code: 'PAYROLL_FINALIZATION_INCOMPLETE' })

    state.events.push({
      ...state.events[state.events.length - 1]!, event_sequence: 3, event_type: 'FINALIZED', created_at: '2026-10-01T12:05:00.000Z',
    })
    const savedAmount = state.components.get(first.runId!)?.find((row) => row.component_key === 'gross_salary')?.amount
    salary = 4400
    const correction = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(correction).toMatchObject({ status: 'CORRECTION_REQUIRED', businessStatus: 'FINALIZED', errorCode: 'PAYRUN01_SUCCESSOR_REQUIRES_FINALIZED_PREDECESSOR' })
    expect(state.runs.size).toBe(1)
    expect(state.components.get(first.runId!)?.find((row) => row.component_key === 'gross_salary')?.amount).toBe(savedAmount)
  })

  it('rejects a provider response outside the authenticated administration and an unauthorized actor', async () => {
    const otherScope = { ...scope, administrationId: 'fe000000-0000-4000-8000-00000000000e' }
    const crossAdministration = harness({ authorizedScope: otherScope })
    await expect(crossAdministration.service.calculateEmployeePayroll({ employeeId, employmentId, period }))
      .rejects.toMatchObject({ code: 'PAYROLL_SOURCE_SCOPE_FORBIDDEN' })
    expect(crossAdministration.runs.size).toBe(0)

    const denied = harness()
    const service = createEmployeePayrollCalculationService({
      requireAccess: async () => { throw new EmployeePayrollCalculationError('PAYROLL_ACCESS_FORBIDDEN', 403) },
      createCalculationRepository: () => denied.calculationRepository,
      createLifecycleRepository: () => ({}) as Payrun01Repository,
      sourceProvider: { getPayrollSourceSnapshot: vi.fn(async () => ({} as PayrollSourceSnapshot)) },
      enabled: () => true,
    })
    await expect(service.calculateEmployeePayroll({ employeeId, employmentId, period }))
      .rejects.toMatchObject({ code: 'PAYROLL_ACCESS_FORBIDDEN', status: 403 })
    expect(denied.runs.size).toBe(0)
  })
})

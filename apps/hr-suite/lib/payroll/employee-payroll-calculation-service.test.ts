import { createHash, randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { sha256, stableSerialize, type PayrollSourceProvider, type PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
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
  PAYROLL_ACCEPTANCE_SCENARIO_CODE,
  PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE,
} from './payroll-acceptance-scenario'
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
  readonly parttimeAmount?: number
  readonly partTimeFactor?: number
  readonly payrollTaxCreditApplies?: boolean
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
      salaries: [
        {
          ...monthlySalary(amount(), overrides.salaryUpdatedAt?.() ?? runTime),
          parttime_amount: overrides.parttimeAmount ?? amount(),
        },
      ],
      schedules: [{
        id: 'bc000000-0000-4000-8000-00000000000c', average_days_per_week: 5,
        average_hours_per_week: overrides.scheduleHours?.() ?? 40, fulltime_hours_per_week: 40,
        part_time_factor: overrides.partTimeFactor ?? 1,
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
        incomeRelationships: [{ id: ikvId, updatedAt: runTime, ikvNumber: 1, reportingStatus: 'READY', startsOn: '2026-01-01', endsOn: null }],
        taxProfiles: overrides.includeTaxProfile === false ? [] : [{
          id: taxProfileId, employee_id: employeeId, employment_id: employmentId,
          income_relationship_id: ikvId, employment_income_relationship_id: linkId,
          residence_country_code: 'NL', wage_tax_table: overrides.fiscalTable ?? 'WHITE', herleiding_code: 'STD',
          time_period: 'MONTH', regular_wage_only: true, full_period_only: true, has_special_situation: false,
          payroll_tax_credit_applies: overrides.payrollTaxCreditApplies ?? true,
          source_classification: 'EMPLOYEE_DECLARATION',
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

function payfullScenarioProvider(state: {
  variant: 'REGULAR' | 'VARIABLE'
  variableWage?: string
}): PayrollSourceProvider {
  const base = provider()
  return {
    getPayrollSourceSnapshot: async (input) => {
      const snapshot = await base.getPayrollSourceSnapshot(input)
      const source = snapshot.canonicalSource as Record<string, unknown>
      const originalFiscalProfile = source.fiscalProfile as Record<string, unknown>
      const originalPayrollOwned = (source.payrollOwned ?? {}) as Record<string, unknown>
      const originalAmounts = (originalPayrollOwned.amounts ?? {}) as Record<string, unknown>
      const originalControls = (originalPayrollOwned.controls ?? {}) as Record<string, unknown>
      const originalTaxProfile = (originalPayrollOwned.taxProfile ?? {}) as Record<string, unknown>
      const originalCumulatives = (originalPayrollOwned.cumulatives ?? {}) as Record<string, unknown>
      const originalRegularWage = (source.regularWage ?? {}) as Record<string, unknown>
      const code = state.variant === 'VARIABLE'
        ? PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE
        : PAYROLL_ACCEPTANCE_SCENARIO_CODE
      const variableWage = state.variant === 'VARIABLE' ? state.variableWage ?? '500.00' : '0.00'
      const assumptionsHash = 'e'.repeat(64)
      const configVersionId = '9a000000-0000-4000-8000-000000000009'
      const openingSnapshotId = '9b000000-0000-4000-8000-000000000009'
      const configHash = sha256(stableSerialize({
        schemaVersion: 'PAYFULL02_TEST_CALCULATION_CONFIG_V1',
        source: 'TEST_SETUP_PAYFULL_02',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        employeeId,
        employmentId,
      }))
      const openingBalanceValues = {
        effectiveFrom: '2026-01-01', effectiveTo: '2026-09-30', periodCount: 9,
        cumulativeBalances: { grossWageBeforePeriod: '36000.00', taxableWageBeforePeriod: '32000.00' },
        source: 'TEST_SETUP_PAYFULL_02 synthetic opening balances for the calculation-service fixture.',
      }
      const openingHash = sha256(stableSerialize(openingBalanceValues))
      const setupHash = sha256(stableSerialize({
        code: 'TEST_SETUP_PAYFULL_02', version: '1.0', configVersionId, configHash, openingSnapshotId, openingHash,
      }))
      const payrollOwned = {
        ...originalPayrollOwned,
        setup: {
          code: 'TEST_SETUP_PAYFULL_02', version: '1.0', sourceHash: setupHash,
          configVersionId, configHash,
        },
        openingBalance: {
          ...openingBalanceValues,
          sourceHash: openingHash, openingSnapshotId, openingHash,
        },
        amounts: {
          ...originalAmounts,
          variableRegularWage: variableWage,
          specialRewardWage: '0.00',
          netReimbursement: '45.00',
          netDeduction: '0.00',
          netCorrection: '0.00',
        },
        controls: {
          ...originalControls,
          sourceReady: true,
          employmentStartConsistent: true,
          ikvUnambiguous: true,
          salaryConsistent: true,
          hoursConsistent: true,
          normalHoursNotDuplicated: true,
          additionalHoursSupported: true,
          sourceFresh: true,
          compositionSupported: true,
          pensionRuleReady: true,
          socialWageCapClear: true,
          cumulativeContinuity: true,
          reservationContinuity: true,
          hashesConsistent: true,
          variableWageIsRegular: true,
          netReimbursementsTaxFree: true,
          netDeductionsAuthorized: true,
          specialRewardPensionable: false,
          specialRewardIncludedInHolidayReserve: false,
          specialRewardIncludedInYearEndReserve: false,
        },
        taxProfile: {
          ...originalTaxProfile,
          specialRewardAnnualWage: '0.00',
          specialRewardAnnualWageResolved: false,
        },
        pension: {
          monthlyFranchise: '0.00',
          monthlyMaximum: '11483.33',
          partTimeFactor: '1.0000',
          employeeRate: '10.00',
          employerRate: '15.00',
          active: true,
        },
        employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
        reserveRates: { holidayAllowance: '8.00', yearEnd: '0.00' },
        parameters: { annualSocialWageMaximum: '79409.00' },
        actualWorkProjection: { additionalHours: '0.0000', cashCompensatedHours: '0.0000' },
        fiscalBases: { wageTax: '4000.00', employeeInsurance: '4000.00', zvw: '4000.00' },
        cumulatives: {
          ...originalCumulatives,
          grossWageBeforePeriod: '0.00',
          holidayReserveBeforePeriod: '0.00',
          yearEndReserveBeforePeriod: '0.00',
          taxableWageBeforePeriod: '0.00',
          wageTaxBeforePeriod: '0.00',
          employeeInsuranceWageBeforePeriod: '0.00',
          zvwWageBeforePeriod: '0.00',
        },
      }
      const canonicalSource = {
        ...source,
        regularWage: {
          ...originalRegularWage,
          grossAmount: '4000.00',
          fulltimeMonthlyAmount: '4000.00',
          contractHoursPerWeek: '40',
          fulltimeHoursPerWeek: '40',
        },
        fiscalProfile: {
          ...originalFiscalProfile,
          status: 'TEST_SCENARIO',
          sourceClassification: 'PAYROLL_TEST_SCENARIO',
          sourceReferenceHash: assumptionsHash,
        },
        testScenario: {
          sourceClassification: 'PAYROLL_TEST_SCENARIO',
          code,
          version: '1',
          assumptionsHash,
        },
        payrollOwned,
      }
      const variantHash = createHash('sha256')
        .update(`${snapshot.sourceHash}:${code}:${variableWage}`)
        .digest('hex')
      return {
        ...snapshot,
        canonicalSource: canonicalSource as PayrollSourceSnapshot['canonicalSource'],
        sourceVersionVector: {
          ...snapshot.sourceVersionVector,
          [`payroll_test_scenario:${code}`]: `${code}:${variableWage}`,
        },
        sourceHash: variantHash,
      }
    },
  }
}

function openPeriod(): PayrollPeriodRow {
  return {
    id: 'fa000000-0000-4000-8000-00000000000a', payroll_administration_id: payrollAdminId,
    source_tenant_id: scope.tenantId, source_hr_group_id: scope.hrGroupId, source_administration_id: scope.administrationId,
    period_year: 2026, period_month: 9, starts_on: '2026-09-01', ends_on: '2026-09-30', status: 'OPEN',
    created_at: runTime, created_by_user_id: actorId, updated_at: runTime, updated_by_user_id: actorId,
  }
}

function harness(options: Parameters<typeof provider>[0] = {}, sourceProviderOverride?: PayrollSourceProvider, allowIsolatedTestScenario = false) {
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
    allowIsolatedTestScenario,
  })
  return { service, snapshots, inputs, runs, components, controls, traces, references, events, calcWrites, calculationRepository }
}

describe('Core-backed employee payroll calculation', () => {
  it('accepts a marked scenario profile only in the isolated calculation service', async () => {
    const base = provider()
    const scenarioProvider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: async (input) => {
        const snapshot = await base.getPayrollSourceSnapshot(input)
        const source = snapshot.canonicalSource as Record<string, unknown>
        const fiscalProfile = source.fiscalProfile as Record<string, unknown>
        return {
          ...snapshot,
          canonicalSource: {
            ...source,
            fiscalProfile: { ...fiscalProfile, status: 'TEST_SCENARIO', sourceClassification: 'PAYROLL_TEST_SCENARIO', sourceReferenceHash: 'assumptions-hash' },
            testScenario: { sourceClassification: 'PAYROLL_TEST_SCENARIO', assumptionsHash: 'assumptions-hash' },
          },
        }
      },
    }
    const input = { employeeId, employmentId, period }
    expect((await harness({}, scenarioProvider).service.inspectEmployeePayrollSource(input)).eligibleForCalculation).toBe(false)
    expect((await harness({}, scenarioProvider, true).service.inspectEmployeePayrollSource(input)).eligibleForCalculation).toBe(true)
    const mismatchedProvider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: async (sourceInput) => {
        const snapshot = await scenarioProvider.getPayrollSourceSnapshot(sourceInput)
        const source = snapshot.canonicalSource as Record<string, unknown>
        return { ...snapshot, canonicalSource: { ...source, testScenario: { sourceClassification: 'PAYROLL_TEST_SCENARIO', assumptionsHash: 'different-hash' } } }
      },
    }
    expect((await harness({}, mismatchedProvider, true).service.inspectEmployeePayrollSource(input)).eligibleForCalculation).toBe(false)
  })

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

  it.each([
    {
      missing: 'persisted Payroll Lab config',
      expected: 'PAYFULL02_CALCULATION_COMPONENTS',
      other: 'CUMULATIVE_WAGE_TAX',
      remove: 'config' as const,
    },
    {
      missing: 'persisted cumulative opening snapshot',
      expected: 'CUMULATIVE_WAGE_TAX',
      other: 'PAYFULL02_CALCULATION_COMPONENTS',
      remove: 'opening' as const,
    },
  ])('requires $missing provenance even when the source carries the PAYFULL02 scenario marker', async ({ expected, other, remove }) => {
    const completeProvider = payfullScenarioProvider({ variant: 'REGULAR' })
    const sourceProvider: PayrollSourceProvider = {
      getPayrollSourceSnapshot: async (input) => {
        const snapshot = await completeProvider.getPayrollSourceSnapshot(input)
        const source = snapshot.canonicalSource as Record<string, unknown>
        const payrollOwned = source.payrollOwned as Record<string, unknown>
        const setup = payrollOwned.setup as Record<string, unknown>
        const openingBalance = payrollOwned.openingBalance as Record<string, unknown>
        const incompleteSetup = remove === 'config'
          ? { ...setup, configVersionId: undefined, configHash: undefined }
          : setup
        const incompleteOpening = remove === 'opening'
          ? { ...openingBalance, openingSnapshotId: undefined, openingHash: undefined }
          : openingBalance
        return {
          ...snapshot,
          canonicalSource: {
            ...source,
            payrollOwned: {
              ...payrollOwned,
              setup: incompleteSetup,
              openingBalance: incompleteOpening,
            },
          } as PayrollSourceSnapshot['canonicalSource'],
        }
      },
    }
    const state = harness({}, sourceProvider, true)
    const result = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })

    expect(result).toMatchObject({ status: 'INCOMPLETE', completeness: 'INCOMPLETE' })
    expect(result.incompleteComponents).toContain(expected)
    expect(result.incompleteComponents).not.toContain(other)
    expect(state.runs.size).toBe(1)
  })

  it('requires a finalized regular predecessor before the variable-wage scenario can create a run', async () => {
    const state = harness({}, payfullScenarioProvider({ variant: 'VARIABLE' }), true)
    const result = await state.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
      requireFinalizedPredecessor: true,
    })

    expect(result).toMatchObject({
      status: 'CORRECTION_REQUIRED',
      errorCode: 'PAYFULL02_VARIABLE_REVISION_REQUIRES_FINALIZED_BASE',
    })
    expect(state.runs.size).toBe(0)
    expect(state.snapshots.size).toBe(0)
    expect(state.inputs.size).toBe(0)
    expect(state.calcWrites).toHaveLength(0)
  })

  it('does not accept a regular concept as the finalized predecessor for a variable-wage revision', async () => {
    const variant: { variant: 'REGULAR' | 'VARIABLE'; variableWage: string } = {
      variant: 'REGULAR', variableWage: '0.00',
    }
    const state = harness({}, payfullScenarioProvider(variant), true)
    const regular = await state.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_IMPLEMENTATION_VERSIONED_RECALCULATION',
    })
    variant.variant = 'VARIABLE'
    variant.variableWage = '500.00'

    const variable = await state.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
      requireFinalizedPredecessor: true,
    })

    expect(regular).toMatchObject({ businessStatus: 'CONCEPT', revision: 1 })
    expect(variable).toMatchObject({
      status: 'CORRECTION_REQUIRED',
      businessStatus: 'CONCEPT',
      revision: 1,
      errorCode: 'PAYFULL02_VARIABLE_REVISION_REQUIRES_FINALIZED_BASE',
    })
    expect(state.runs.size).toBe(1)
    expect(state.snapshots.size).toBe(1)
    expect(state.inputs.size).toBe(1)
    expect(state.calcWrites).toHaveLength(1)
    expect(state.events.map((event) => [event.revision, event.event_type])).toEqual([[1, 'CONCEPT']])
  })

  it('reuses only an exact variable-scenario retry and blocks mismatched input hashes or engine versions', async () => {
    const exactState = harness({}, payfullScenarioProvider({ variant: 'VARIABLE' }), true)
    const first = await exactState.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
    })
    const retry = await exactState.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
      requireFinalizedPredecessor: true,
    })

    expect(first).toMatchObject({ status: 'CALCULATED', completeness: 'COMPLETE', incompleteComponents: [] })
    expect(first.businessStatus).toBe('CONCEPT')
    expect(retry.runId).toBe(first.runId)
    expect(retry.inputHash).toBe(first.inputHash)
    expect(exactState.runs.size).toBe(1)
    expect(exactState.calcWrites).toHaveLength(1)

    const hashState = harness({}, payfullScenarioProvider({ variant: 'VARIABLE' }), true)
    const hashFirst = await hashState.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
    })
    const savedInput = hashState.inputs.get(hashFirst.inputSetId!)!
    hashState.inputs.set(savedInput.id, { ...savedInput, input_hash: 'f'.repeat(64) })
    const mismatchedHashRetry = await hashState.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
      requireFinalizedPredecessor: true,
    })

    expect(hashFirst.businessStatus).toBe('CONCEPT')
    expect(mismatchedHashRetry).toMatchObject({
      status: 'CORRECTION_REQUIRED',
      businessStatus: 'CONCEPT',
      errorCode: 'PAYFULL02_VARIABLE_REVISION_REQUIRES_FINALIZED_BASE',
    })
    expect(hashState.runs.size).toBe(1)
    expect(hashState.calcWrites).toHaveLength(1)

    const versionState = harness({}, payfullScenarioProvider({ variant: 'VARIABLE' }), true)
    const versionFirst = await versionState.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
    })
    const versionInput = versionState.inputs.get(versionFirst.inputSetId!)!
    versionState.inputs.set(versionInput.id, { ...versionInput, engine_version: 'PAYROLL_ENGINE_VERSION_OLD' })
    const staleVersionRetry = await versionState.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
      requireFinalizedPredecessor: true,
    })

    expect(staleVersionRetry).toMatchObject({
      status: 'CORRECTION_REQUIRED',
      businessStatus: 'CONCEPT',
      errorCode: 'PAYFULL02_VARIABLE_REVISION_REQUIRES_FINALIZED_BASE',
    })
    expect(versionState.runs.size).toBe(1)
    expect(versionState.calcWrites).toHaveLength(1)
  })

  it('creates a variable successor only after the regular predecessor is finalized and preserves its artifacts', async () => {
    const variant: { variant: 'REGULAR' | 'VARIABLE'; variableWage: string } = {
      variant: 'REGULAR', variableWage: '0.00',
    }
    const state = harness({}, payfullScenarioProvider(variant), true)
    const first = await state.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_IMPLEMENTATION_VERSIONED_RECALCULATION',
    })
    const previousComponents = structuredClone(state.components.get(first.runId!) ?? [])
    const previousHashes = {
      sourceHash: first.sourceHash,
      inputHash: first.inputHash,
      resultHash: first.resultHash,
    }
    const concept = state.events[0]!
    state.events.push({ ...concept, event_sequence: 2, event_type: 'REVIEWED', created_at: '2026-10-01T12:04:00.000Z' })
    state.events.push({ ...concept, event_sequence: 3, event_type: 'FINALIZED', created_at: '2026-10-01T12:05:00.000Z' })
    variant.variant = 'VARIABLE'
    variant.variableWage = '500.00'

    const revised = await state.service.calculateEmployeePayroll({
      employeeId, employmentId, period,
      successorReasonCode: 'PAYFULL02_VARIABLE_WAGE_TEST_REVISION',
      requireFinalizedPredecessor: true,
    })

    expect(revised).toMatchObject({
      businessStatus: 'CONCEPT',
      revision: 2,
      previousRunId: first.runId,
      grossAmount: '4500.00',
    })
    expect(revised.runId).not.toBe(first.runId)
    expect(state.runs.size).toBe(2)
    expect(state.components.get(first.runId!)).toEqual(previousComponents)
    expect(first).toMatchObject(previousHashes)
    expect(state.events.map((event) => [event.revision, event.event_type])).toEqual([
      [1, 'CONCEPT'], [1, 'REVIEWED'], [1, 'FINALIZED'], [2, 'CONCEPT'],
    ])
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
    expect(first.incompleteComponents).toEqual(expect.arrayContaining([
      'PENSION_EMPLOYEE_ALLOCATION', 'PENSION_EMPLOYER_ALLOCATION', 'EMPLOYER_SOCIAL_COSTS',
      'HOLIDAY_AND_YEAR_END_RESERVES', 'CUMULATIVE_WAGE_TAX', 'VARIABLE_AND_NON_REGULAR_WAGE',
    ]))
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

  it('matches the published 2026 white monthly table without tax credit for the proposed full-time wages', async () => {
    // Belastingdienst white monthly table 2026, Netherlands standard, under AOW, without tax credit.
    // Published rows: EUR 3,514.50 -> 1,261.33; EUR 3,532.50 -> 1,268.08.
    const cases = [
      { gross: 3517, wageTax: '1261.33', netAfterWageTax: '2255.67' },
      { gross: 3534, wageTax: '1268.08', netAfterWageTax: '2265.92' },
    ] as const

    for (const testCase of cases) {
      const state = harness({
        amount: () => testCase.gross,
        parttimeAmount: testCase.gross,
        payrollTaxCreditApplies: false,
      })
      const result = await state.service.calculateEmployeePayroll({ employeeId, employmentId, period })

      expect(result).toMatchObject({
        status: 'INCOMPLETE',
        grossAmount: testCase.gross.toFixed(2),
        wageTaxAmount: testCase.wageTax,
        netAfterWageTax: testCase.netAfterWageTax,
      })
    }
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

    const salaryMismatch = harness({
      amount: () => 3585,
      parttimeAmount: 3585,
      partTimeFactor: 0.95,
      scheduleHours: () => 38,
    })
    const mismatchedSalary = await salaryMismatch.service.calculateEmployeePayroll({ employeeId, employmentId, period })
    expect(mismatchedSalary.status).toBe('UNSUPPORTED')
    expect(mismatchedSalary.gaps).toContainEqual(expect.objectContaining({
      reasonCode: 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR',
    }))
    expect(salaryMismatch.runs.size).toBe(0)
  })

  it('blocks incomplete review and finalization, and preserves a finalized historical result after source changes', async () => {
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
    await expect(state.service.reviewEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! }))
      .rejects.toMatchObject({ code: 'PAYROLL_REVIEW_INCOMPLETE' })
    expect(state.events).toHaveLength(1)
    await expect(state.service.finalizeEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! }))
      .rejects.toMatchObject({ code: 'PAYROLL_LIFECYCLE_TRANSITION_INVALID' })

    state.events.push({
      ...state.events[0]!, event_sequence: 2, event_type: 'REVIEWED', created_at: '2026-10-01T12:04:00.000Z',
    })
    await expect(state.service.finalizeEmployeePayroll({ employeeId, employmentId, period, runId: first.runId! }))
      .rejects.toMatchObject({ code: 'PAYROLL_FINALIZATION_INCOMPLETE' })

    state.events.push({ ...state.events[1]!, event_sequence: 3, event_type: 'FINALIZED', created_at: '2026-10-01T12:05:00.000Z' })
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

import { describe, expect, it, vi } from 'vitest'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import {
  createPayrollAcceptanceScenarioSourceProvider,
  filterPayrollAcceptanceScenarioRuns,
  PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES,
  PAYROLL_ACCEPTANCE_SCENARIO_CODE,
  PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE,
  PAYROLL_ACCEPTANCE_VARIABLE_WAGE_AMOUNT,
  PayrollAcceptanceScenarioError,
} from './payroll-acceptance-scenario'

const first = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!
const tenantId = '07249eb9-545c-883b-b26b-d52f83b4f4a1'
const hrGroupId = '6ba6f1df-e376-40f2-abff-ffdf000172e1'
const administrationId = '2057f6ec-cd3e-3c28-9126-c41235d4ffae'
const incomeRelationshipId = 'a1111111-1111-4111-8111-111111111111'
const linkId = 'b2222222-2222-4222-8222-222222222222'

function snapshot(overrides: Partial<PayrollSourceSnapshot> = {}): PayrollSourceSnapshot {
  return {
    id: 'c3333333-3333-4333-8333-333333333333',
    sourceTenantId: tenantId,
    sourceHrGroupId: hrGroupId,
    sourceAdministrationId: administrationId,
    sourceEmployeeId: first.employeeId,
    sourceEmploymentId: first.employmentId,
    sourceIncomeRelationshipId: incomeRelationshipId,
    periodReference: { year: 2026, month: 10 },
    canonicalSource: {
      contract: { entries: [{ fulltimeHoursPerWeek: 40 }] },
      compensation: { entries: [{ paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', currencyCode: 'EUR', fulltimeAmount: 3517, parttimeAmount: 3517 }] },
      schedule: { entries: [{ averageHoursPerWeek: 40, fulltimeHoursPerWeek: 40, partTimeFactor: 1 }] },
      incomeRelationship: { id: incomeRelationshipId, employmentIncomeRelationshipId: linkId, reportingStatus: 'READY', status: 'LINKED' },
      fiscalProfile: { status: 'SOURCE_GAP', reasonCodes: ['NO_CONFIRMED_FISCAL_PROFILE', 'EMPLOYEE_BIRTH_DATE_REQUIRED_FOR_TAX_CLASSIFICATION'] },
    },
    sourceVersionVector: { 'employment:one': '2026-09-01T00:00:00.000Z' },
    sourceGaps: [
      { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_CONFIRMED_FISCAL_PROFILE' },
      { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'EMPLOYEE_BIRTH_DATE_REQUIRED_FOR_TAX_CLASSIFICATION' },
    ],
    sourceHash: 'd'.repeat(64),
    createdAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

const input = {
  tenantId,
  hrGroupId,
  administrationId,
  employeeId: first.employeeId,
  employmentId: first.employmentId,
  payrollPeriod: { year: 2026, month: 10 },
}

describe('Payroll acceptance scenario source adapter', () => {
  it('adds a hash-bound fictitious tax scenario only to the exact Mars source snapshot', async () => {
    const coreSnapshot = snapshot()
    const source = createPayrollAcceptanceScenarioSourceProvider({
      getPayrollSourceSnapshot: vi.fn(async () => coreSnapshot),
    })

    const result = await source.getPayrollSourceSnapshot(input)
    const canonical = result.canonicalSource as Record<string, unknown>
    const fiscalProfile = canonical.fiscalProfile as Record<string, unknown>
    const testScenario = canonical.testScenario as Record<string, unknown>
    const regularWage = canonical.regularWage as Record<string, unknown>
    const payrollOwned = canonical.payrollOwned as Record<string, unknown>
    const setup = payrollOwned.setup as Record<string, unknown>
    const openingBalance = payrollOwned.openingBalance as Record<string, unknown>

    expect(result.sourceHash).not.toBe(coreSnapshot.sourceHash)
    expect(result.sourceGaps).toEqual([])
    expect(result.sourceVersionVector[`payroll_test_scenario:${PAYROLL_ACCEPTANCE_SCENARIO_CODE}`]).toMatch(/^1:/)
    expect(fiscalProfile).toMatchObject({ status: 'TEST_SCENARIO', sourceClassification: 'PAYROLL_TEST_SCENARIO', payrollTaxCreditApplies: false })
    expect(testScenario).toMatchObject({
      code: PAYROLL_ACCEPTANCE_SCENARIO_CODE,
      sourceClassification: 'PAYROLL_TEST_SCENARIO',
      coreSourceHash: coreSnapshot.sourceHash,
      assumptions: { ageCategory: 'UNDER_AOW', wageTaxTable: 'WHITE', payrollTaxCreditApplies: false },
    })
    expect(regularWage).toMatchObject({ table: 'WHITE', grossAmount: '3517.00', payrollTaxCredit: false, incomeRelationshipCount: '1' })
    expect(setup).toMatchObject({ code: 'TEST_SETUP_PAYFULL_02', version: '1.0', validFrom: '2026-01-01', validTo: '2026-12-31' })
    expect(setup.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(openingBalance).toMatchObject({ effectiveFrom: '2026-01-01', effectiveTo: '2026-09-30', periodCount: 9 })
    expect(openingBalance.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(payrollOwned.pension).toMatchObject({ classification: 'SYNTHETIC_TEST_PLAN_NOT_EXTERNAL_FUND_CONTRACT', employeeRate: '10.00', employerRate: '15.00' })
    expect(JSON.stringify(canonical)).not.toContain('EMPLOYEE_DECLARATION')
    expect(JSON.stringify(canonical)).not.toMatch(/birth.?date|geboortedatum/i)
    expect((coreSnapshot.canonicalSource as Record<string, unknown>).fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
  })

  it('refuses an existing fiscal profile, an unsupported tax gap, and a source mismatch', async () => {
    for (const invalidSnapshot of [
      snapshot({ canonicalSource: { ...(snapshot().canonicalSource as Record<string, unknown>), fiscalProfile: { status: 'CONFIRMED' } } }),
      snapshot({ sourceGaps: [{ field: 'taxProfile', status: 'UNSUPPORTED', reasonCode: 'NL_2026_RULES_REQUIRE_UNDER_AOW_AGE' }] }),
      snapshot({ sourceAdministrationId: '99999999-9999-4999-8999-999999999999' }),
      snapshot({ sourceEmployeeId: '88888888-8888-4888-8888-888888888888' }),
    ]) {
      const source = createPayrollAcceptanceScenarioSourceProvider({ getPayrollSourceSnapshot: vi.fn(async () => invalidSnapshot) })
      await expect(source.getPayrollSourceSnapshot(input)).rejects.toMatchObject({ code: 'PAYROLL_ACCEPTANCE_SCENARIO_SOURCE_CHANGED' })
    }
  })

  it('adds the variable DEMO-001 amount as a separately hashed, regular-wage TEST revision', async () => {
    const regular = await createPayrollAcceptanceScenarioSourceProvider({
      getPayrollSourceSnapshot: vi.fn(async () => snapshot()),
    }).getPayrollSourceSnapshot(input)
    const variable = await createPayrollAcceptanceScenarioSourceProvider({
      getPayrollSourceSnapshot: vi.fn(async () => snapshot()),
    }, 'VARIABLE_BONUS_DEMO_001').getPayrollSourceSnapshot(input)
    const canonical = variable.canonicalSource as Record<string, unknown>
    const testScenario = canonical.testScenario as Record<string, unknown>
    const fiscalProfile = canonical.fiscalProfile as Record<string, unknown>
    const payrollOwned = canonical.payrollOwned as Record<string, unknown>
    const amounts = payrollOwned.amounts as Record<string, unknown>

    expect(variable.sourceHash).not.toBe(regular.sourceHash)
    expect(testScenario).toMatchObject({
      code: PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE,
      variant: 'VARIABLE_BONUS_DEMO_001',
      variableRegularWage: PAYROLL_ACCEPTANCE_VARIABLE_WAGE_AMOUNT,
      sourceClassification: 'PAYROLL_TEST_SCENARIO',
    })
    expect(fiscalProfile.scenarioCode).toBe(PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE)
    expect(amounts.variableRegularWage).toBe(PAYROLL_ACCEPTANCE_VARIABLE_WAGE_AMOUNT)
    expect(variable.sourceVersionVector[`payroll_test_scenario:${PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE}`]).toContain(':500.00')
  })

  it('does not allow the variable bonus revision for DEMO-002', async () => {
    const second = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[1]!
    const secondSource = snapshot()
    const secondCanonical = secondSource.canonicalSource as Record<string, unknown>
    const source = createPayrollAcceptanceScenarioSourceProvider({
      getPayrollSourceSnapshot: vi.fn(async () => snapshot({
        sourceEmployeeId: second.employeeId,
        sourceEmploymentId: second.employmentId,
        canonicalSource: {
          ...secondCanonical,
          compensation: { entries: [{ paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY', currencyCode: 'EUR', fulltimeAmount: 3534, parttimeAmount: 3534 }] },
          incomeRelationship: {
            ...(secondCanonical.incomeRelationship as Record<string, unknown>),
            id: incomeRelationshipId,
          },
        },
      })),
    }, 'VARIABLE_BONUS_DEMO_001')

    await expect(source.getPayrollSourceSnapshot({
      ...input,
      employeeId: second.employeeId,
      employmentId: second.employmentId,
    })).rejects.toMatchObject({ code: 'PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE' })
  })

  it('does not offer DEMO-005 or any other employee for the test scenario', async () => {
    const getPayrollSourceSnapshot = vi.fn(async () => snapshot())
    const source = createPayrollAcceptanceScenarioSourceProvider({ getPayrollSourceSnapshot })

    await expect(source.getPayrollSourceSnapshot({ ...input, employeeId: '6de31a0a-362a-55e4-5168-b2134f68132a', employmentId: '8ec508af-8277-7ab7-aa9a-081cc320177f' }))
      .rejects.toBeInstanceOf(PayrollAcceptanceScenarioError)
    expect(getPayrollSourceSnapshot).not.toHaveBeenCalled()
  })
})

describe('payroll acceptance scenario visibility', () => {
  it('removes only runs marked with the dedicated acceptance provenance', async () => {
    const summaries = [
      { run: { id: 'scenario-run' }, inputSet: { id: 'scenario-input' } },
      { run: { id: 'ordinary-run' }, inputSet: { id: 'ordinary-input' } },
      { run: { id: 'unreferenced-run' }, inputSet: { id: 'missing-input' } },
    ]
    const references = new Map([
      ['scenario-input', { input_reference_json: { testScenario: { sourceClassification: 'PAYROLL_TEST_SCENARIO', code: PAYROLL_ACCEPTANCE_SCENARIO_CODE } } }],
      ['ordinary-input', { input_reference_json: { sourceClassification: 'CORE_PAYROLL_SOURCE' } }],
    ])

    await expect(filterPayrollAcceptanceScenarioRuns(summaries, async (inputSetId) => references.get(inputSetId) ?? null))
      .resolves.toEqual(summaries.slice(1))
  })
})

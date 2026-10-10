import { describe, expect, it } from 'vitest'
import {
  FixedDecimal,
  buildCalculationInputs,
  calculatePayroll,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  createPayrun01RulePackage,
  PAYRUN01_RULE_REGISTRY,
  calculatePfzw2026Kinderopvang,
  PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
  PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION,
} from '@liquid-hr/payroll-rules-nl-2026'
import { derivePayrun01LisaOracle } from './payrun01-independent-oracle'

const lisaSnapshot: PayrollSourceSnapshot = {
  id: '10000000-0000-4000-8000-000000000001',
  sourceTenantId: '20000000-0000-4000-8000-000000000001',
  sourceHrGroupId: '30000000-0000-4000-8000-000000000001',
  sourceAdministrationId: '40000000-0000-4000-8000-000000000001',
  sourceEmployeeId: '50000000-0000-4000-8000-000000000001',
  sourceEmploymentId: '60000000-0000-4000-8000-000000000001',
  sourceIncomeRelationshipId: '70000000-0000-4000-8000-000000000001',
  periodReference: { year: 2026, month: 10 },
  canonicalSource: {
    regularWage: {
      fulltimeMonthlyAmount: '5500.00',
      contractHoursPerWeek: '40',
      fulltimeHoursPerWeek: '40',
      fiscalYear: '2026',
      table: 'WHITE',
      residence: 'NL',
      ageCategory: 'UNDER_AOW',
      herleiding: 'STD',
      timePeriod: 'MONTH',
      payrollTaxCredit: true,
      regularWage: true,
      fullPeriod: true,
      incomeRelationshipCount: '1',
      hasSpecialSituation: false,
    },
    payrollOwned: {
      actualWorkProjection: { additionalHours: '0.0000', cashCompensatedHours: '0.0000' },
      amounts: { employeePension: '0.00', employerPension: '0.00' },
      fiscalBases: { wageTax: '5500.00', employeeInsurance: '5500.00', zvw: '5500.00' },
      employerRates: { awf: '7.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
      reserveRates: { holidayAllowance: '8.00', yearEnd: '0.00' },
      controls: {
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
      },
      cumulatives: {
        grossWageBeforePeriod: '49500.00',
        holidayReserveBeforePeriod: '3960.00',
        yearEndReserveBeforePeriod: '0.00',
      },
    },
  },
  sourceVersionVector: { 'employment:60000000-0000-4000-8000-000000000001': '2026-09-01T00:00:00.000Z' },
  sourceGaps: [],
  sourceHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  createdAt: '2026-10-01T00:00:00.000Z',
}

function resultAmount(result: ReturnType<typeof calculatePayroll>, key: string): string | null {
  const row = result.resultRows.find((item) => item.key === key)
  return typeof row?.value === 'string' ? row.value : null
}

describe('PAYRUN01 composition on the shared NL-2026 payroll engine', () => {
  it('matches Lisa to the independent white-table oracle and computes configured costs and reserves', () => {
    const rulePackage = createPayrun01RulePackage('DEMO_COMPANY_TEST')
    const inputs = buildCalculationInputs(lisaSnapshot, rulePackage, {
      effectiveDate: '2026-10-01',
      scopeInstanceIds: {
        EMPLOYEE: lisaSnapshot.sourceEmployeeId,
        EMPLOYMENT: lisaSnapshot.sourceEmploymentId,
        INCOME_RELATIONSHIP: lisaSnapshot.sourceIncomeRelationshipId ?? '',
      },
      calculationContextHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    const result = calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
    const oracle = derivePayrun01LisaOracle('PAYROLL_TAX_CREDIT_APPLIED')

    expect(result.status).toBe('CALCULATED')
    expect(resultAmount(result, 'gross_salary')).toBe('5500.00')
    expect(resultAmount(result, 'contractual_salary')).toBe('5500.00')
    expect(resultAmount(result, 'wage_tax')).toBe(oracle.monthlyWithholding)
    expect(resultAmount(result, 'net_salary')).toBe(oracle.monthlyNetAfterWithholding)
    expect(resultAmount(result, 'employee_pension')).toBe('0.00')
    expect(resultAmount(result, 'employer_pension')).toBe('0.00')
    expect(resultAmount(result, 'employer_insurance')).toBe('1233.10')
    expect(resultAmount(result, 'holiday_allowance_reserve')).toBe('440.00')
    expect(resultAmount(result, 'year_end_reserve')).toBe('0.00')
    expect(resultAmount(result, 'cumulative_gross')).toBe('55000.00')
    expect(resultAmount(result, 'cumulative_holiday_reserve')).toBe('4400.00')
    expect(resultAmount(result, 'cumulative_year_end_reserve')).toBe('0.00')
    expect(resultAmount(result, 'total_employer_cost')).toBe('7173.10')
    expect(result.controls.every((control) => control.status === 'PASS')).toBe(true)
  })

  it('calculates TEST-only legacy pension assumptions with a visible warning and a new composition version', () => {
    const canonicalSource = structuredClone(lisaSnapshot.canonicalSource) as Record<string, unknown>
    const payrollOwned = canonicalSource.payrollOwned as Record<string, unknown>
    const controls = payrollOwned.controls as Record<string, unknown>
    controls.pensionRuleReady = false
    payrollOwned.amounts = { employeePension: '364.96', employerPension: '729.91' }
    payrollOwned.fiscalBases = { wageTax: '6385.04', employeeInsurance: '6385.04', zvw: '6385.04' }
    const snapshot: PayrollSourceSnapshot = {
      ...lisaSnapshot,
      canonicalSource: canonicalSource as typeof lisaSnapshot.canonicalSource,
    }
    const rulePackage = createPayrun01RulePackage('LEGACY_COMPANY_TEST', {
      pensionCompliance: 'TEST_ONLY_UNVERIFIED',
    })
    const inputs = buildCalculationInputs(snapshot, rulePackage, {
      effectiveDate: '2026-10-01',
      scopeInstanceIds: {
        EMPLOYEE: snapshot.sourceEmployeeId,
        EMPLOYMENT: snapshot.sourceEmploymentId,
        INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
      },
      calculationContextHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    })

    const result = calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
    const pensionControl = result.controls.find((control) => control.code === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')

    expect(result.status).toBe('CALCULATED')
    expect(resultAmount(result, 'employee_pension')).toBe('364.96')
    expect(resultAmount(result, 'employer_pension')).toBe('729.91')
    expect(pensionControl?.status).toBe('WARNING')
    expect(rulePackage.compositionId).toContain('PENSION-TEST-UNVERIFIED-2026.3')
    expect(rulePackage.controls.find((control) => control.code === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')?.severity).toBe('WARNING')
  })

  it('calculates eight ordinary-rate hours without representing the PFZW source gap as zero', () => {
    const canonicalSource = structuredClone(lisaSnapshot.canonicalSource) as Record<string, unknown>
    const regularWage = canonicalSource.regularWage as Record<string, unknown>
    const payrollOwned = canonicalSource.payrollOwned as Record<string, unknown>
    const controls = payrollOwned.controls as Record<string, unknown>
    regularWage.fulltimeMonthlyAmount = '3425.00'
    regularWage.contractHoursPerWeek = '32'
    regularWage.fulltimeHoursPerWeek = '36'
    payrollOwned.amounts = {}
    payrollOwned.fiscalBases = { wageTax: '3219.41', employeeInsurance: '3219.41', zvw: '3219.41' }
    payrollOwned.actualWorkProjection = { additionalHours: '8.0000', cashCompensatedHours: '8.0000' }
    payrollOwned.reserveRates = { holidayAllowance: '8.00', yearEnd: '8.00' }
    payrollOwned.cumulatives = {
      grossWageBeforePeriod: '3044.44',
      holidayReserveBeforePeriod: '243.56',
      yearEndReserveBeforePeriod: '243.56',
    }
    payrollOwned.pension = { status: 'EXCLUDED_SOURCE_GAP', reasonCode: 'PFZW_2026_MONTHLY_ALLOCATION_UNVERIFIED' }
    controls.pensionRuleReady = false
    const janCalculationSnapshot: PayrollSourceSnapshot = {
      ...lisaSnapshot,
      sourceEmployeeId: '50000000-0000-4000-8000-000000000002',
      sourceEmploymentId: '60000000-0000-4000-8000-000000000002',
      sourceIncomeRelationshipId: '70000000-0000-4000-8000-000000000002',
      canonicalSource: canonicalSource as typeof lisaSnapshot.canonicalSource,
      sourceVersionVector: { 'employment:60000000-0000-4000-8000-000000000002': '2026-09-01T00:00:00.000Z' },
    }
    const janPackage = createPayrun01RulePackage('KINDEROPVANG_TEST')
    const inputs = buildCalculationInputs(janCalculationSnapshot, janPackage, {
      effectiveDate: '2026-10-01',
      scopeInstanceIds: {
        EMPLOYEE: janCalculationSnapshot.sourceEmployeeId,
        EMPLOYMENT: janCalculationSnapshot.sourceEmploymentId,
        INCOME_RELATIONSHIP: janCalculationSnapshot.sourceIncomeRelationshipId ?? '',
      },
      calculationContextHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    })
    const result = calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
    const pensionControl = result.controls.find((control) => control.code === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')

    expect(result.status).toBe('CALCULATED')
    expect(resultAmount(result, 'contractual_salary')).toBe('3044.44')
    expect(resultAmount(result, 'additional_cash_amount')).toBe('174.97')
    expect(resultAmount(result, 'gross_salary')).toBe('3219.41')
    expect(resultAmount(result, 'taxable_wage')).toBe('3219.41')
    expect(resultAmount(result, 'wage_tax')).toBe('475.50')
    expect(resultAmount(result, 'net_salary')).toBe('2743.91')
    expect(resultAmount(result, 'employer_insurance')).toBe('721.79')
    expect(resultAmount(result, 'holiday_allowance_reserve')).toBe('257.55')
    expect(resultAmount(result, 'year_end_reserve')).toBe('257.55')
    expect(resultAmount(result, 'cumulative_gross')).toBe('6263.85')
    expect(resultAmount(result, 'cumulative_holiday_reserve')).toBe('501.11')
    expect(resultAmount(result, 'cumulative_year_end_reserve')).toBe('501.11')
    expect(resultAmount(result, 'total_employer_cost')).toBe('4456.30')
    expect(resultAmount(result, 'employee_pension')).toBeNull()
    expect(resultAmount(result, 'employer_pension')).toBeNull()
    expect(result.trace.find((step) => step.componentCode === 'PAYRUN01_ADDITIONAL_CASH_AMOUNT')?.outputs)
      .toMatchObject({ amount: { valueType: 'MONEY', value: '174.97' } })
    expect(result.trace.some((step) => step.componentCode === 'PAYRUN01_EMPLOYEE_PENSION' || step.componentCode === 'PAYRUN01_EMPLOYER_PENSION')).toBe(false)
    expect(pensionControl?.status).toBe('WARNING')
    expect(janPackage.controls.find((control) => control.code === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')?.severity).toBe('WARNING')
    expect(janPackage.metadata?.packageHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reduces the wage-tax base by an employee pension deduction before applying NL-2026 withholding', () => {
    const canonicalSource = structuredClone(lisaSnapshot.canonicalSource) as Record<string, unknown>
    const payrollOwned = canonicalSource.payrollOwned as Record<string, unknown>
    payrollOwned.amounts = { employeePension: '100.00', employerPension: '0.00' }
    payrollOwned.fiscalBases = { wageTax: '5400.00', employeeInsurance: '5400.00', zvw: '5400.00' }
    const pensionSnapshot: PayrollSourceSnapshot = { ...lisaSnapshot, canonicalSource: canonicalSource as typeof lisaSnapshot.canonicalSource }
    const inputs = buildCalculationInputs(pensionSnapshot, createPayrun01RulePackage('DEMO_COMPANY_TEST'), {
      effectiveDate: '2026-10-01',
      scopeInstanceIds: {
        EMPLOYEE: pensionSnapshot.sourceEmployeeId,
        EMPLOYMENT: pensionSnapshot.sourceEmploymentId,
        INCOME_RELATIONSHIP: pensionSnapshot.sourceIncomeRelationshipId ?? '',
      },
      calculationContextHash: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    })

    const result = calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
    const wageTax = result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')

    expect(result.status).toBe('CALCULATED')
    expect(resultAmount(result, 'gross_salary')).toBe('5500.00')
    expect(resultAmount(result, 'taxable_wage')).toBe('5400.00')
    expect(wageTax?.inputs).toEqual(expect.objectContaining({
      grossSalary: { valueType: 'MONEY', value: '5400.00' },
      taxableWage: { valueType: 'MONEY', value: '5400.00' },
    }))
    const wageTaxAmount = resultAmount(result, 'wage_tax')
    expect(wageTaxAmount).not.toBeNull()
    expect(resultAmount(result, 'net_salary')).toBe(
      FixedDecimal.parse('5500.00').subtract(FixedDecimal.parse(wageTaxAmount!)).subtract(FixedDecimal.parse('100.00')).toString(2),
    )
    expect(result.controls.every((control) => control.status === 'PASS')).toBe(true)
  })

  it('carries September and October PFZW deductions through tax, net and the employer-only cost path', () => {
    const pensionPackage = createPayrun01RulePackage('KINDEROPVANG_TEST', { pensionCalculation: 'INCLUDED' })
    const calculateScenario = (scenario: {
      readonly month: 9 | 10
      readonly additionalHours: string
      readonly gross: string
      readonly grossBeforePeriod: string
      readonly reserveBeforePeriod: string
    }) => {
      const pfzw = calculatePfzw2026Kinderopvang({
        period: { year: 2026, month: scenario.month },
        participationStatus: 'ASSUMED_FOR_PREVIEW',
        participationStartDate: '2026-09-01',
        participationEvidenceReference: 'synthetic Core assignment and labor-condition mapping',
        arrangementVersion: 'PFZW-2026-KINDEROPVANG-COMPOSITION-TEST',
        salaryBasisDate: '2026-09-01',
        salaryBasisSourceId: 'synthetic-salary-row-2026-09-01',
        salaryBasisSourceVersion: '2026-09-01',
        fullTimeMonthlySalary: '3425.00',
        monthlyPaymentsPerYear: 12,
        holidayAllowancePercent: '8',
        structuralYearEndAllowancePercent: '5.5',
        structuralYearEndAllowanceReferenceDate: '2025-12-31',
        structuralYearEndAllowanceEligibleAnnualBase: '41100',
        structuralYearEndAllowanceSourceReference: 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering',
        structuralYearEndAllowanceSourceVersion: 'Cao Kinderopvang 2025-2026 article 5.7; PFZW article 5.2.4',
        additionalStructuralSalaryComponents: [],
        contractHoursPerWeek: '32',
        fullTimeHoursPerWeek: '36',
        additionalWorkedHours: scenario.additionalHours,
        additionalHoursUpliftPercent: scenario.additionalHours === '0.0000' ? null : '11.2179487179',
        additionalHoursUpliftEvidence: scenario.additionalHours === '0.0000' ? 'NOT_APPLICABLE' : 'SYNTHETIC_TEST_ONLY_POLICY',
        additionalHoursUpliftSourceReference: scenario.additionalHours === '0.0000' ? null : 'https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantie; https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/verlofbudget; https://www.pfzw.nl/content/dam/pfzw/web/werkgevers/pensioenaangifte/2026_Handleiding-aanlevering-UPA-gegevens.pdf',
        additionalHoursUpliftSourceVersion: scenario.additionalHours === '0.0000' ? null : PFZW_2026_SYNTHETIC_TEST_EXTRA_HOURS_UPLIFT_VERSION,
        fullTimePeriodHours: '156.00',
        monthlyPayrollGross: scenario.gross,
        calculationPolicy: {
          status: 'SYNTHETIC_TEST_APPROVED',
          version: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
          sourceReference: 'SYNTHETIC_TEST_POLICY:PAY-RULE-002; annual share divided by 12 and separately rounded HALF_UP to cents; synthetic TEST acceptance only.',
          monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
          shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
        },
        sourceSnapshotId: `pfzw-${scenario.month}-composition-test`,
        sourceSnapshotHash: 'f'.repeat(64),
        inputSetId: `pfzw-${scenario.month}-input-test`,
        inputHash: 'e'.repeat(64),
      })
      expect(pfzw.status).toBe('PREVIEW_ONLY')
      expect(pfzw.reasonCodes).toContain('PFZW_PARTICIPATION_ASSUMED_FOR_PREVIEW')
      expect(pfzw.reasonCodes).not.toContain('PFZW_MONTHLY_CENT_ALLOCATION_POLICY_UNVERIFIED')
      if (scenario.additionalHours !== '0.0000') {
        expect(pfzw.reasonCodes).not.toContain('PFZW_ADDITIONAL_HOURS_UPLIFT_PROVISIONAL')
      }

      const canonicalSource = structuredClone(lisaSnapshot.canonicalSource) as Record<string, unknown>
      const regularWage = canonicalSource.regularWage as Record<string, unknown>
      const payrollOwned = canonicalSource.payrollOwned as Record<string, unknown>
      regularWage.fulltimeMonthlyAmount = '3425.00'
      regularWage.contractHoursPerWeek = '32'
      regularWage.fulltimeHoursPerWeek = '36'
      payrollOwned.amounts = {
        employeePension: pfzw.employeePremiumMonthly!,
        employerPension: pfzw.employerPremiumMonthly!,
      }
      payrollOwned.fiscalBases = pfzw.fiscalBases
      payrollOwned.actualWorkProjection = {
        additionalHours: scenario.additionalHours,
        cashCompensatedHours: scenario.additionalHours,
      }
      payrollOwned.reserveRates = { holidayAllowance: '8.00', yearEnd: '8.00' }
      payrollOwned.cumulatives = {
        grossWageBeforePeriod: scenario.grossBeforePeriod,
        holidayReserveBeforePeriod: scenario.reserveBeforePeriod,
        yearEndReserveBeforePeriod: scenario.reserveBeforePeriod,
      }
      const snapshot: PayrollSourceSnapshot = {
        ...lisaSnapshot,
        periodReference: { year: 2026, month: scenario.month },
        sourceEmployeeId: '50000000-0000-4000-8000-000000000003',
        sourceEmploymentId: '60000000-0000-4000-8000-000000000003',
        sourceIncomeRelationshipId: '70000000-0000-4000-8000-000000000003',
        canonicalSource: canonicalSource as typeof lisaSnapshot.canonicalSource,
        sourceVersionVector: { 'employment:60000000-0000-4000-8000-000000000003': '2026-09-01T00:00:00.000Z' },
      }
      const inputs = buildCalculationInputs(snapshot, pensionPackage, {
        effectiveDate: `2026-${String(scenario.month).padStart(2, '0')}-01`,
        scopeInstanceIds: {
          EMPLOYEE: snapshot.sourceEmployeeId,
          EMPLOYMENT: snapshot.sourceEmploymentId,
          INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
        },
        calculationContextHash: 'c'.repeat(64),
      })
      const result = calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
      const noEmployerSource = structuredClone(snapshot.canonicalSource) as Record<string, unknown>
      const noEmployerPayroll = noEmployerSource.payrollOwned as Record<string, unknown>
      const noEmployerAmounts = noEmployerPayroll.amounts as Record<string, unknown>
      noEmployerAmounts.employerPension = '0.00'
      const noEmployerSnapshot: PayrollSourceSnapshot = {
        ...snapshot,
        canonicalSource: noEmployerSource as typeof snapshot.canonicalSource,
      }
      const noEmployerInputs = buildCalculationInputs(noEmployerSnapshot, pensionPackage, {
        effectiveDate: `2026-${String(scenario.month).padStart(2, '0')}-01`,
        scopeInstanceIds: {
          EMPLOYEE: noEmployerSnapshot.sourceEmployeeId,
          EMPLOYMENT: noEmployerSnapshot.sourceEmploymentId,
          INCOME_RELATIONSHIP: noEmployerSnapshot.sourceIncomeRelationshipId ?? '',
        },
        calculationContextHash: 'c'.repeat(64),
      })
      return { pfzw, snapshot, result, noEmployerResult: calculatePayroll(noEmployerInputs, PAYRUN01_RULE_REGISTRY) }
    }
    const september = calculateScenario({
      month: 9, additionalHours: '0.0000', gross: '3044.44', grossBeforePeriod: '0.00', reserveBeforePeriod: '0.00',
    })
    const october = calculateScenario({
      month: 10, additionalHours: '8.0000', gross: '3219.41', grossBeforePeriod: '3044.44', reserveBeforePeriod: '243.56',
    })
    const amount = (calculation: ReturnType<typeof calculatePayroll>, key: string) => resultAmount(calculation, key)

    expect({
      september: {
        tax: amount(september.result, 'wage_tax'),
        net: amount(september.result, 'net_salary'),
        employerInsurance: amount(september.result, 'employer_insurance'),
        totalEmployerCost: amount(september.result, 'total_employer_cost'),
      },
      october: {
        tax: amount(october.result, 'wage_tax'),
        net: amount(october.result, 'net_salary'),
        employerInsurance: amount(october.result, 'employer_insurance'),
        holidayReserve: amount(october.result, 'holiday_allowance_reserve'),
        yearEndReserve: amount(october.result, 'year_end_reserve'),
        totalEmployerCost: amount(october.result, 'total_employer_cost'),
      },
    }).toEqual({
      september: {
        tax: '292.75',
        net: '2471.08',
        employerInsurance: '619.65',
        totalEmployerCost: '4434.00',
      },
      october: {
        tax: '356.00',
        net: '2564.77',
        employerInsurance: '654.84',
        holidayReserve: '257.55',
        yearEndReserve: '257.55',
        totalEmployerCost: '4690.30',
      },
    })

    expect(september.pfzw.employeePremiumMonthly).toBe('280.61')
    expect(september.pfzw.employerPremiumMonthly).toBe('282.79')
    expect(amount(september.result, 'taxable_wage')).toBe('2763.83')
    expect(september.result.status).toBe('CALCULATED')
    expect(amount(september.result, 'net_salary')).toBe(amount(september.noEmployerResult, 'net_salary'))
    expect(FixedDecimal.parse(amount(september.result, 'total_employer_cost')!)
      .subtract(FixedDecimal.parse(amount(september.noEmployerResult, 'total_employer_cost')!)).toString(2))
      .toBe('282.79')
    expect(october.pfzw.employeePremiumMonthly).toBe('298.64')
    expect(october.pfzw.employerPremiumMonthly).toBe('300.95')
    expect(october.pfzw.pensionableHours).toBe('147.57')
    expect(october.pfzw.finalPartTimeFactor).toBe('0.9460')
    expect(october.pfzw.pensionableBase).toBe('27780.24')
    expect(october.pfzw.fiscalBases).toEqual({ wageTax: '2920.77', employeeInsurance: '2920.77', zvw: '2920.77' })
    expect(amount(october.result, 'gross_salary')).toBe('3219.41')
    expect(amount(october.result, 'additional_cash_amount')).toBe('174.97')
    expect(amount(october.result, 'cumulative_gross')).toBe('6263.85')
    expect(amount(october.result, 'cumulative_holiday_reserve')).toBe('501.11')
    expect(amount(october.result, 'cumulative_year_end_reserve')).toBe('501.11')
    expect(amount(october.result, 'taxable_wage')).toBe('2920.77')
    expect(amount(october.result, 'employee_pension')).toBe('298.64')
    expect(amount(october.result, 'net_salary')).toBe(amount(october.noEmployerResult, 'net_salary'))
    expect(FixedDecimal.parse(amount(october.result, 'total_employer_cost')!)
      .subtract(FixedDecimal.parse(amount(october.noEmployerResult, 'total_employer_cost')!)).toString(2))
      .toBe('300.95')
    expect(october.result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')?.inputs).toEqual(expect.objectContaining({
      grossSalary: { valueType: 'MONEY', value: '2920.77' },
      taxableWage: { valueType: 'MONEY', value: '2920.77' },
    }))
    expect(october.result.controls.every((control) => control.status === 'PASS')).toBe(true)
  })
})

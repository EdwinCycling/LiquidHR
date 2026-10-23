import { describe, expect, it } from 'vitest'
import {
  buildCalculationInputs,
  calculatePayroll,
  sha256,
  stableSerialize,
  type PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import {
  calculatePfzw2026Kinderopvang,
  createPayrun01RulePackage,
  PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
  PAYRUN01_RULE_REGISTRY,
  type Pfzw2026CalculationInput,
} from '@liquid-hr/payroll-rules-nl-2026'
import { derivePayd1K2IndependentOracle } from './payrun01-k2-independent-oracle'

const employeeId = '79091d14-ef66-41fe-a2d5-92df108727e5'
const employmentId = 'd19bace9-bb97-4822-a462-eed22821ed05'
const sourceVersionVector = { [`employment:${employmentId}`]: '2026-09-01T00:00:00.000Z' }
const actualCoreGaps = [
  { field: 'coreAdministrationId', status: 'SOURCE_GAP', reasonCode: 'CORE_ADMINISTRATION_UUID_NOT_EXPOSED' },
  { field: 'salaryScaleStep', status: 'SOURCE_GAP', reasonCode: 'CORE_SALARY_SCALE_STEP_NOT_FOUND' },
  { field: 'salaryAmount', status: 'SOURCE_GAP', reasonCode: 'CORE_ACTIVE_SALARY_ROW_NOT_FOUND' },
] as const
const syntheticSubstitutions = {
  administration: 'SYNTHETIC-EMPLOYER-PAYD1-K2-02',
  salary: { scale: '6', step: '12', fullTimeMonthlySalary: '2819.00' },
  employerRates: { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
  openingCumulatives: { paWWPeriods: '2', paWWWage: '5027.56', paWWContribution: '5.03' },
}
const calculationContext = {
  caseId: 'PAYD1-K2-02-NOV-2026',
  period: { year: 2026, month: 11 },
  employeeId,
  employmentId,
  sourceVersionVector,
  actualCoreGaps,
  syntheticSubstitutions,
}
const calculationContextHash = sha256(stableSerialize(calculationContext))

function makeK2Snapshot(
  employeePension: string,
  employerPension: string,
  fiscalBase: string,
): PayrollSourceSnapshot {
  const canonicalSource = {
    caseProvenance: { actualCoreGaps, syntheticSubstitutions },
    regularWage: {
      fulltimeMonthlyAmount: '2819.00',
      contractHoursPerWeek: '32',
      fulltimeHoursPerWeek: '36',
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
      amounts: {
        employeePension,
        employerPension,
        fixedGrossSupplement: '8.00',
      },
      parameters: {
        allLevyRate: '0.10',
        allLevyPeriodMaximum: '6617.42',
      },
      taxProfile: { specialRewardAnnualWage: '30165.36', specialRewardAnnualWageResolved: true },
      fiscalBases: { wageTax: fiscalBase, employeeInsurance: fiscalBase, zvw: fiscalBase },
      employerRates: { awf: '2.74', aof: '6.27', wko: '0.50', whk: '1.81', zvw: '6.10' },
      reserveRates: { holidayAllowance: '8.00', yearEnd: '8.00' },
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
        pensionRuleReady: false,
        socialWageCapClear: true,
        cumulativeContinuity: true,
        reservationContinuity: true,
        hashesConsistent: true,
        specialRewardPensionable: false,
        specialRewardIncludedInHolidayReserve: false,
        specialRewardIncludedInYearEndReserve: false,
        fixedGrossSupplementReserveable: false,
        fixedGrossSupplementIncludedInWageTaxBase: true,
        fixedGrossSupplementIncludedInEmployeeInsuranceBase: true,
        fixedGrossSupplementIncludedInZvwBase: true,
        allLevyEligible: true,
      },
      cumulatives: {
        grossWageBeforePeriod: '5027.56',
        holidayReserveBeforePeriod: '400.92',
        yearEndReserveBeforePeriod: '400.92',
        allLevyPeriodsBefore: '2',
        allLevyWageBefore: '5027.56',
        allLevyContributionBefore: '5.03',
      },
    },
  }
  const snapshotIdentity = {
    id: 'PAYD1-K2-02-NOV-2026-SYNTHETIC-SNAPSHOT',
    sourceTenantId: 'SYNTHETIC-TENANT-PAYD1-K2-02',
    sourceHrGroupId: 'SYNTHETIC-HR-GROUP-PAYD1-K2-02',
    sourceAdministrationId: 'SYNTHETIC-EMPLOYER-PAYD1-K2-02',
    sourceEmployeeId: employeeId,
    sourceEmploymentId: employmentId,
    sourceIncomeRelationshipId: 'SYNTHETIC-INCOME-RELATIONSHIP-PAYD1-K2-02',
    periodReference: { year: 2026, month: 11 },
    sourceVersionVector,
  }
  return {
    ...snapshotIdentity,
    canonicalSource,
    sourceGaps: [],
    sourceHash: sha256(stableSerialize({ ...snapshotIdentity, canonicalSource })),
    createdAt: '2026-11-01T00:00:00.000Z',
  }
}

function calculateWithGenericFeatures(snapshot: PayrollSourceSnapshot) {
  const rulePackage = createPayrun01RulePackage('KINDEROPVANG_TEST', {
    supportClassifiedGrossSupplement: true,
    supportAllLevyDeduction: true,
  })
  const inputs = buildCalculationInputs(snapshot, rulePackage, {
    effectiveDate: '2026-11-01',
    scopeInstanceIds: {
      EMPLOYEE: snapshot.sourceEmployeeId,
      EMPLOYMENT: snapshot.sourceEmploymentId,
      INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
    },
    calculationContextHash,
  })
  return calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
}

describe('PAYD1 K2 synthetic November 2026 calculation', () => {
  it('runs the PFZW preview and shared PAYRUN01 graph without persistence', () => {
    const pfzwSourceContext = {
      caseId: 'PAYD1-K2-02-NOV-2026',
      core: {
        employeeId,
        employmentId,
        employmentStartDate: '2026-09-01',
        contractHoursPerWeek: '32',
        fullTimeHoursPerWeek: '36',
        coreAdministrationId: 'MISSING',
        salaryScale: 'MISSING',
        salaryStep: 'MISSING',
        salaryAmount: 'MISSING',
      },
      syntheticFixture: {
        employerId: 'SYNTHETIC-EMPLOYER-PAYD1-K2-02',
        salaryScale: '6',
        salaryStep: '12',
        fullTimeMonthlySalary: '2819.00',
      },
      officialSources: {
        cao: 'CAO Kinderopvang 2025-2026 §5.7 and table 2.4, effective 2026-09-01',
        pfzw: 'PFZW UPA 2026 v5.0 and Pensionreglement 2026',
      },
      sourceVersionVector,
      actualCoreGaps,
      syntheticSubstitutions,
    }
    const pfzwInput: Pfzw2026CalculationInput = {
      period: { year: 2026, month: 11 },
      participationStatus: 'SYNTHETIC_TEST_FIXTURE',
      participationStartDate: '2026-09-01',
      participationEvidenceReference: 'SYNTHETIC_TEST_FIXTURE:PAYD1-K2-02; Core assignment v1 is metadata only',
      arrangementVersion: 'bd735d71-1438-44c1-8b39-24a153395f4d; effective 2026-11-01',
      salaryBasisDate: '2026-09-01',
      salaryBasisSourceId: 'SYNTHETIC_CAO_2026_SCALE_6_STEP_12',
      salaryBasisSourceVersion: 'CAO-Kinderopvang-2025-2026-table-2.4-effective-2026-09-01',
      fullTimeMonthlySalary: '2819.00',
      monthlyPaymentsPerYear: 12,
      holidayAllowancePercent: '8.00',
      structuralYearEndAllowancePercent: '5.50',
      structuralYearEndAllowanceReferenceDate: '2025-12-31',
      structuralYearEndAllowanceEligibleAnnualBase: '33828.00',
      structuralYearEndAllowanceSourceReference: 'https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf; PFZW UPA 2026 manual v5.0',
      structuralYearEndAllowanceSourceVersion: 'CAO 2025-2026 §5.7; UPA 2026 v5.0 prior-year 31 December reference',
      additionalStructuralSalaryComponents: [],
      contractHoursPerWeek: '32',
      fullTimeHoursPerWeek: '36',
      additionalWorkedHours: '0.0000',
      additionalHoursUpliftPercent: null,
      additionalHoursUpliftEvidence: 'NOT_APPLICABLE',
      additionalHoursUpliftSourceReference: null,
      additionalHoursUpliftSourceVersion: null,
      fullTimePeriodHours: '156.00',
      monthlyPayrollGross: '2513.78',
      calculationPolicy: {
        status: 'SYNTHETIC_TEST_APPROVED',
        version: PFZW_2026_MONTHLY_ALLOCATION_TEST_APPROVED_VERSION,
        sourceReference: 'SYNTHETIC_TEST_POLICY:PAY-RULE-002; annual share divided by 12, each share HALF_UP to cents; arithmetic only',
        monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
        shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
      },
      sourceSnapshotId: 'PAYD1-K2-02-NOV-2026-SYNTHETIC-SNAPSHOT',
      sourceSnapshotHash: sha256(stableSerialize(pfzwSourceContext)),
      inputSetId: 'PAYD1-K2-02-NOV-2026-SYNTHETIC-INPUTS',
    }
    const pfzw = calculatePfzw2026Kinderopvang({
      ...pfzwInput,
      inputHash: sha256(stableSerialize(pfzwInput)),
    })

    expect(pfzw.status).toBe('CALCULATED')
    expect(pfzw.reasonCodes).toEqual([])

    const snapshot = makeK2Snapshot(
      pfzw.employeePremiumMonthly!,
      pfzw.employerPremiumMonthly!,
      pfzw.fiscalBases.wageTax!,
    )
    const rulePackage = createPayrun01RulePackage('KINDEROPVANG_TEST', {
      pensionCalculation: 'INCLUDED',
      pensionCompliance: 'TEST_ONLY_UNVERIFIED',
      supportClassifiedGrossSupplement: true,
      supportAllLevyDeduction: true,
    })
    const inputs = buildCalculationInputs(snapshot, rulePackage, {
      effectiveDate: '2026-11-01',
      scopeInstanceIds: {
        EMPLOYEE: employeeId,
        EMPLOYMENT: employmentId,
        INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '',
      },
      calculationContextHash,
    })
    const result = calculatePayroll(inputs, PAYRUN01_RULE_REGISTRY)
    const independent = derivePayd1K2IndependentOracle()

    expect(result.status).toBe('CALCULATED')
    expect(snapshot.sourceVersionVector).toEqual(sourceVersionVector)
    expect(snapshot.canonicalSource).toMatchObject({ caseProvenance: { actualCoreGaps, syntheticSubstitutions } })
    expect(snapshot.sourceGaps).toEqual([])
    expect(calculationContext).toMatchObject({ employeeId, employmentId, sourceVersionVector, actualCoreGaps, syntheticSubstitutions })
    expect(result.trace.some((step) => step.nodeIdentity?.scopeInstanceId === 'SYNTHETIC-INCOME-RELATIONSHIP-PAYD1-K2-02')).toBe(true)
    const trace = result.trace
      .filter((step) => [
        'PAYRUN01_CONTRACTUAL_SALARY',
        'PAYRUN01_FIXED_GROSS_SUPPLEMENT',
        'NL_REGULAR_WAGE',
        'PAYRUN01_CLASSIFIED_RESERVE_BASE',
        'PAYRUN01_ALL_LEVY_DEDUCTION',
        'PAYRUN01_WAGE_TAX_BASE_AFTER_ALL_LEVY',
        'PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY',
        'PAYRUN01_ZVW_BASE_AFTER_ALL_LEVY',
        'NL_WAGE_TAX',
        'PAYRUN01_AWF_COST',
        'PAYRUN01_AOF_COST',
        'PAYRUN01_WKO_COST',
        'PAYRUN01_WHK_COST',
        'PAYRUN01_ZVW_COST',
        'PAYRUN01_EMPLOYER_INSURANCE',
        'PAYRUN01_HOLIDAY_RESERVE',
        'PAYRUN01_YEAR_END_RESERVE',
        'PAYRUN01_NET_PAY',
        'PAYRUN01_TOTAL_EMPLOYER_COST',
      ].includes(step.componentCode))
      .map((step) => ({ code: step.componentCode, inputs: step.inputs, outputs: step.outputs }))
    const traceOutput = (componentCode: string, outputName: string): unknown =>
      result.trace.find((step) => step.componentCode === componentCode)?.outputs[outputName]?.value ?? null

    expect(Object.fromEntries(trace.map((step) => [
      step.code,
      Object.fromEntries(Object.entries(step.outputs).map(([name, value]) => [name, value.value])),
    ]))).toEqual({
      PAYRUN01_FIXED_GROSS_SUPPLEMENT: { amount: '8.00' },
      PAYRUN01_CONTRACTUAL_SALARY: { amount: '2505.78' },
      NL_REGULAR_WAGE: { grossSalary: '2513.78' },
      PAYRUN01_ALL_LEVY_DEDUCTION: { amount: '2.51', contributionBase: '2513.78' },
      PAYRUN01_AWF_COST: { amount: '63.28' },
      PAYRUN01_AOF_COST: { amount: '144.81' },
      PAYRUN01_WKO_COST: { amount: '11.55' },
      PAYRUN01_WHK_COST: { amount: '41.80' },
      PAYRUN01_ZVW_COST: { amount: '140.88' },
      PAYRUN01_CLASSIFIED_RESERVE_BASE: { amount: '2505.78' },
      PAYRUN01_EMPLOYEE_INSURANCE_BASE_AFTER_ALL_LEVY: { amount: '2309.53' },
      PAYRUN01_HOLIDAY_RESERVE: { amount: '200.46' },
      PAYRUN01_WAGE_TAX_BASE_AFTER_ALL_LEVY: { amount: '2309.53' },
      NL_WAGE_TAX: { wageTax: '120.92' },
      PAYRUN01_NET_PAY: { amount: '2188.61' },
      PAYRUN01_YEAR_END_RESERVE: { amount: '200.46' },
      PAYRUN01_ZVW_BASE_AFTER_ALL_LEVY: { amount: '2309.53' },
      PAYRUN01_EMPLOYER_INSURANCE: { amount: '402.32' },
      PAYRUN01_TOTAL_EMPLOYER_COST: { amount: '3520.32' },
    })
    expect({
      contractualSalary: result.resultRows.find((row) => row.key === 'contractual_salary')?.value,
      gross: result.resultRows.find((row) => row.key === 'gross_salary')?.value,
      pensionBase: pfzw.pensionableBase,
      fixedGrossSupplement: result.resultRows.find((row) => row.key === 'fixed_gross_supplement')?.value,
      allLevyBase: result.resultRows.find((row) => row.key === 'all_levy_contribution_base')?.value,
      allLevyDeduction: result.resultRows.find((row) => row.key === 'all_levy_deduction')?.value,
      employeePension: result.resultRows.find((row) => row.key === 'employee_pension')?.value,
      employerPension: result.resultRows.find((row) => row.key === 'employer_pension')?.value,
      taxBase: result.resultRows.find((row) => row.key === 'taxable_wage')?.value,
      tax: result.resultRows.find((row) => row.key === 'wage_tax')?.value,
      net: result.resultRows.find((row) => row.key === 'net_salary')?.value,
      employerInsurance: result.resultRows.find((row) => row.key === 'employer_insurance')?.value,
      holidayReserve: result.resultRows.find((row) => row.key === 'holiday_allowance_reserve')?.value,
      yearEndReserve: result.resultRows.find((row) => row.key === 'year_end_reserve')?.value,
      employerCosts: result.resultRows.find((row) => row.key === 'total_employer_cost')?.value,
    }).toEqual({
      contractualSalary: '2505.78',
      gross: '2513.78',
      pensionBase: '18766.46',
      fixedGrossSupplement: '8.00',
      allLevyBase: '2513.78',
      allLevyDeduction: '2.51',
      employeePension: '201.74',
      employerPension: '203.30',
      taxBase: '2309.53',
      tax: '120.92',
      net: '2188.61',
      employerInsurance: '402.32',
      holidayReserve: '200.46',
      yearEndReserve: '200.46',
      employerCosts: '3520.32',
    })
    expect({
      contractualSalary: traceOutput('PAYRUN01_CONTRACTUAL_SALARY', 'amount'),
      gross: traceOutput('NL_REGULAR_WAGE', 'grossSalary'),
      pensionableBase: pfzw.pensionableBase,
      employeePension: result.resultRows.find((row) => row.key === 'employee_pension')?.value,
      employerPension: result.resultRows.find((row) => row.key === 'employer_pension')?.value,
      paww: traceOutput('PAYRUN01_ALL_LEVY_DEDUCTION', 'amount'),
      fiscalWage: result.resultRows.find((row) => row.key === 'taxable_wage')?.value,
      tax: traceOutput('NL_WAGE_TAX', 'wageTax'),
      net: traceOutput('PAYRUN01_NET_PAY', 'amount'),
      employerCosts: {
        awf: traceOutput('PAYRUN01_AWF_COST', 'amount'),
        aof: traceOutput('PAYRUN01_AOF_COST', 'amount'),
        wko: traceOutput('PAYRUN01_WKO_COST', 'amount'),
        whk: traceOutput('PAYRUN01_WHK_COST', 'amount'),
        zvw: traceOutput('PAYRUN01_ZVW_COST', 'amount'),
        employerInsuranceTotal: traceOutput('PAYRUN01_EMPLOYER_INSURANCE', 'amount'),
        holidayReserve: traceOutput('PAYRUN01_HOLIDAY_RESERVE', 'amount'),
        yearEndReserve: traceOutput('PAYRUN01_YEAR_END_RESERVE', 'amount'),
        total: traceOutput('PAYRUN01_TOTAL_EMPLOYER_COST', 'amount'),
      },
    }).toEqual({
      contractualSalary: independent.contractualSalary,
      gross: independent.gross,
      pensionableBase: independent.pfzw.pensionableBase,
      employeePension: independent.pfzw.employeePremium,
      employerPension: independent.pfzw.employerPremium,
      paww: independent.paww.currentContribution,
      fiscalWage: independent.tax.fiscalWage,
      tax: independent.tax.withholdingWithCredit,
      net: independent.net,
      employerCosts: {
        awf: independent.employerCosts.awf,
        aof: independent.employerCosts.aof,
        wko: independent.employerCosts.wko,
        whk: independent.employerCosts.whk,
        zvw: independent.employerCosts.zvw,
        employerInsuranceTotal: independent.employerCosts.employerInsuranceTotal,
        holidayReserve: independent.employerCosts.holidayReserve,
        yearEndReserve: independent.employerCosts.yearEndReserve,
        total: independent.employerCosts.total,
      },
    })
    expect(traceOutput('PAYRUN01_ALL_LEVY_DEDUCTION', 'amount')).toBe('2.51')
    expect(result.trace.find((step) => step.componentCode === 'PAYRUN01_ALL_LEVY_DEDUCTION')?.inputs).toEqual({
      cashWage: { valueType: 'MONEY', value: '2513.78' },
      contributionBefore: { valueType: 'MONEY', value: '5.03' },
      eligible: { valueType: 'BOOLEAN', value: true },
      periodMaximum: { valueType: 'MONEY', value: '6617.42' },
      periodsBefore: { valueType: 'DECIMAL', value: '2' },
      rate: { valueType: 'PERCENTAGE', value: '0.10' },
      wageBefore: { valueType: 'MONEY', value: '5027.56' },
    })
    expect(traceOutput('NL_WAGE_TAX', 'wageTax')).toBe('120.92')
    expect(result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')?.registeredRuleTrace)
      .toContainEqual(expect.objectContaining({
        code: 'result.period-values',
        values: expect.objectContaining({
          tablePeriodWage: { valueType: 'MONEY', value: '2308.50' },
          wageTax: { valueType: 'MONEY', value: '120.92' },
        }),
      }))
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.resultHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.controls.filter((control) => control.status === 'FAIL')).toEqual([])
    expect(result.controls.find((control) => control.code === 'PAYRUN01-CTRL-009-PENSION-RULE-READY')?.status).toBe('WARNING')
  })

  it('keeps classified supplements and all-levy behavior absent from the default composition', () => {
    const defaultPackage = createPayrun01RulePackage('DEMO_COMPANY_TEST')
    const explicitDisabledPackage = createPayrun01RulePackage('DEMO_COMPANY_TEST', {
      supportClassifiedGrossSupplement: false,
      supportAllLevyDeduction: false,
    })
    const optionOnlyCodes = [
      'PAYRUN01_FIXED_GROSS_SUPPLEMENT',
      'PAYRUN01_FIXED_GROSS_SUPPLEMENT_RESERVEABLE',
      'PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_WAGE_TAX_BASE',
      'PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_EMPLOYEE_INSURANCE_BASE',
      'PAYRUN01_FIXED_GROSS_SUPPLEMENT_IN_ZVW_BASE',
      'PAYRUN01_WAGE_TAX_BASE_WITH_CLASSIFIED_SUPPLEMENT',
      'PAYRUN01_EMPLOYEE_INSURANCE_BASE_WITH_CLASSIFIED_SUPPLEMENT',
      'PAYRUN01_ZVW_BASE_WITH_CLASSIFIED_SUPPLEMENT',
      'PAYRUN01_ALL_LEVY_DEDUCTION',
    ]

    expect(explicitDisabledPackage.compositionId).toBe(defaultPackage.compositionId)
    expect(explicitDisabledPackage.metadata?.packageHash).toBe(defaultPackage.metadata?.packageHash)
    expect(defaultPackage.components.some((component) => optionOnlyCodes.includes(component.code))).toBe(false)
    expect(defaultPackage.resultMappings.some((mapping) => mapping.key === 'all_levy_deduction')).toBe(false)
  })

  it('applies the all-levy period maximum and makes eligibility opt-in per source input', () => {
    const baseSnapshot = makeK2Snapshot('0.00', '0.00', '2513.78')
    const cappedSource = structuredClone(baseSnapshot.canonicalSource) as Record<string, unknown>
    const cappedPayroll = cappedSource.payrollOwned as Record<string, unknown>
    cappedPayroll.parameters = { allLevyRate: '0.10', allLevyPeriodMaximum: '2000.00' }
    cappedPayroll.cumulatives = {
      grossWageBeforePeriod: '5027.56',
      holidayReserveBeforePeriod: '400.92',
      yearEndReserveBeforePeriod: '400.92',
      allLevyPeriodsBefore: '2',
      allLevyWageBefore: '4000.00',
      allLevyContributionBefore: '4.00',
    }
    const cappedSnapshot: PayrollSourceSnapshot = {
      ...baseSnapshot,
      canonicalSource: cappedSource as typeof baseSnapshot.canonicalSource,
      sourceHash: sha256(stableSerialize({ snapshotId: baseSnapshot.id, canonicalSource: cappedSource })),
    }
    const cappedResult = calculateWithGenericFeatures(cappedSnapshot)

    expect(cappedResult.status).toBe('CALCULATED')
    expect(cappedResult.resultRows.find((row) => row.key === 'all_levy_contribution_base')?.value).toBe('2000.00')
    expect(cappedResult.resultRows.find((row) => row.key === 'all_levy_deduction')?.value).toBe('2.00')

    const ineligibleSource = structuredClone(baseSnapshot.canonicalSource) as Record<string, unknown>
    const ineligiblePayroll = ineligibleSource.payrollOwned as Record<string, unknown>
    const ineligibleControls = ineligiblePayroll.controls as Record<string, unknown>
    ineligibleControls.allLevyEligible = false
    const ineligibleSnapshot: PayrollSourceSnapshot = {
      ...baseSnapshot,
      canonicalSource: ineligibleSource as typeof baseSnapshot.canonicalSource,
      sourceHash: sha256(stableSerialize({ snapshotId: baseSnapshot.id, canonicalSource: ineligibleSource })),
    }
    const ineligibleResult = calculateWithGenericFeatures(ineligibleSnapshot)

    expect(ineligibleResult.status).toBe('CALCULATED')
    expect(ineligibleResult.resultRows.find((row) => row.key === 'all_levy_contribution_base')?.value).toBe('0.00')
    expect(ineligibleResult.resultRows.find((row) => row.key === 'all_levy_deduction')?.value).toBe('0.00')
    expect(ineligibleResult.resultRows.find((row) => row.key === 'wage_tax_base_after_all_levy')?.value).toBe('2513.78')
  })
})

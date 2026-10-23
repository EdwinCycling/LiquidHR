import { describe, expect, it } from 'vitest'
import {
  renderPayrun01PayslipHtml,
  renderPayrun01PayslipPdf,
  LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID,
  type Payrun01PayslipPdfInput,
} from './payrun01-payslip-pdf'
import { derivePayd2RetailR1IndependentOracle, derivePayd2RetailR2IndependentOracle } from './payd2-retail-independent-oracle'
import { getRetailModeRuleBundle } from '@liquid-hr/payroll-rules-cao-bench02'
import {
  PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS,
  calculateRetailR1,
  canonical,
  createRetailSourceSnapshot,
  retailCalculation,
  resultAmount,
  scope,
  sourceIds,
  sourceContract,
} from './payd2-retail-source-fixture'
describe('PAYD2 Retail in-memory source cases', () => {
  it('binds R1 to the July wage/version source and preserves the complete indexation-cap trace', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const repeat = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR1IndependentOracle()
    const engineTrace = cao.componentTrace?.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')
    const indexTrace = engineTrace?.registeredRuleTrace?.find((step) => step.code === 'RETAIL_R1_JULY_ACTUAL_RATE_INDEXATION_CAP')
    const metadata = getRetailModeRuleBundle('2026-07-01').rulePackage.metadata?.sourceMetadata

    expect(snapshot.sourceHash).toBe(repeat.sourceHash)
    expect(cao.resultHash).toBe(retailCalculation(repeat).resultHash)
    expect(contract).toMatchObject({
      schemaVersion: 'payroll-source-contract-v1',
      scope: {
        tenantId: scope.tenantId,
        hrGroupId: scope.hrGroupId,
        administrationId: scope.administrationId,
        employeeId: snapshot.sourceEmployeeId,
        employmentId: snapshot.sourceEmploymentId,
        incomeRelationshipId: snapshot.sourceIncomeRelationshipId,
      },
      periodStart: '2026-07-01',
      periodEndExclusive: '2026-08-01',
    })
    expect(contract.references.every((reference) => reference.status === 'BOUND'
      && reference.sourceRowId.length > 0 && reference.version.length > 0)).toBe(true)
    expect(contract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'employments', 'employment_salaries', 'employment_schedules', 'employment_contracts',
      'employment_labor_conditions', 'labor_condition_sets', 'synthetic_fixture',
      'employment_income_relationships', 'income_relationships',
    ]))
    expect(contract.versionVector).toEqual(snapshot.sourceVersionVector)
    expect(snapshot.sourceVersionVector).toMatchObject({
      'cao:rule-package:CAO-RETAIL-NON-FOOD-2026:2026.7': `${cao.packageVersion}:${cao.packageHash}`,
      [`cao:input:${snapshot.sourceEmploymentId}`]: `${cao.inputHash}:${cao.sourceHash}`,
    })
    expect(metadata).toMatchObject({
      activeTableEffectiveFrom: '2026-07-01',
      activeTableEffectiveTo: '2026-12-31',
      activeTableSourceSha256: 'ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc',
      grossScopeNotice: expect.stringContaining('8% vacation allowance'),
    })
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      family: 'RETAIL_MODE',
      packageVersion: '2026.7',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-12-31',
      hourlyBaseRate: oracle.appliedHourlyRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: '0.00',
      grossAmount: oracle.gross,
    })
    expect(indexTrace?.values).toMatchObject({
      previousHourlyRate: { valueType: 'MONEY', value: oracle.previousHourlyRate },
      indexationRate: { valueType: 'PERCENTAGE', value: oracle.indexationRate },
      indexedHourlyRateBeforeRounding: { valueType: 'MONEY', value: oracle.indexedHourlyRateBeforeRounding },
      indexedHourlyRateBeforeCap: { valueType: 'MONEY', value: oracle.indexedHourlyRateBeforeCap },
      tableMaximumHourlyRate: { valueType: 'MONEY', value: oracle.maximumHourlyRate },
      hourlyRateAfterCap: { valueType: 'MONEY', value: oracle.appliedHourlyRate },
    })
    expect(cao.packageHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(cao.resultHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snapshot.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(source.caseProvenance).toMatchObject({ dataClass: 'SYNTHETIC_FIXTURE' })
    expect(source.caseProvenance).toMatchObject({ fixtureId: 'PAYD2-RETAIL-02-R1' })
    expect(source.caseProvenance).toHaveProperty('officialRuleSources', PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS)
    expect(source.caseProvenance).toMatchObject({
      syntheticPayrollInputs: {
        retailNonFoodInStoreActivityShare: '100%',
        pfdExemptionAssumption: 'none',
        realEmployerCaoAndPfdApplicability: expect.stringContaining('SOURCE_GAP'),
        realEmployeeFiscalProfile: expect.stringContaining('SOURCE_GAP'),
      },
    })
    expect(source.retailBusinessScope).toMatchObject({ sourceClassification: 'SYNTHETIC_FIXTURE' })
    expect(snapshot.sourceGaps).toEqual([])
    expect(source.fiscalProfile).toMatchObject({ status: 'CONFIRMED', ageCategory: 'UNDER_AOW' })
    expect(source.payrollOwned).toMatchObject({
      pension: { planCode: 'BPF_DETAILHANDEL_2026', annualFranchise: '18680', totalPremiumRate: '24.75' },
      employerRates: { awf: '2.7400', aof: '6.2700', wko: '0.5000', whk: '1.9300', zvw: '6.1000' },
      reserveRates: { holidayAllowance: '8.0000', yearEnd: '0.00' },
    })
  })

  it('calculates complete R1 gross-to-net, reconciles each component to the independent oracle, and renders only an in-memory CONCEPT PDF', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const payrollOwned = source.payrollOwned as Record<string, unknown>
    const pension = payrollOwned.pension as Record<string, unknown>
    const oracle = derivePayd2RetailR1IndependentOracle()
    const result = calculateRetailR1(snapshot)
    const componentResults = {
      gross: resultAmount(result, 'gross_salary'),
      pensionableBase: resultAmount(result, 'pensionable_wage'),
      employeePension: resultAmount(result, 'employee_pension'),
      employerPension: resultAmount(result, 'employer_pension'),
      taxableWage: resultAmount(result, 'taxable_wage'),
      employeeInsuranceBase: resultAmount(result, 'employee_insurance_base'),
      zvwBase: resultAmount(result, 'zvw_base'),
      wageTax: resultAmount(result, 'wage_tax'),
      net: resultAmount(result, 'net_salary'),
      awf: resultAmount(result, 'employer_awf'),
      aof: resultAmount(result, 'employer_aof'),
      wko: resultAmount(result, 'employer_wko'),
      whk: resultAmount(result, 'employer_whk'),
      zvw: resultAmount(result, 'employer_zvw'),
      employerInsurance: resultAmount(result, 'employer_insurance'),
      holidayReserve: resultAmount(result, 'holiday_allowance_reserve'),
      totalEmployerCost: resultAmount(result, 'total_employer_cost'),
    }
    const htmlInput: Payrun01PayslipPdfInput = {
      data: {
        period: { year: 2026, month: 7, startsOn: '2026-07-01', endsOn: '2026-07-31' },
        lifecycle: 'CONCEPT',
        profile: {
          status: 'SYNTHETIC_TEST_PROFILE',
          employerName: 'Retail Mode TEST',
          employeeName: 'PAYD2 Retail R1 Testmedewerker',
          writtenContract: true,
          contractType: 'INDEFINITE',
          isOnCall: false,
          contractHoursPerWeek: 38,
          fulltimeHoursPerWeek: 38,
        },
        components: result.resultRows.map((row) => {
          if (typeof row.value !== 'string') throw new Error(`NON_MONEY_PAYSLIP_RESULT:${row.key}`)
          return { key: row.key, amount: row.value }
        }),
        sourceWarnings: ['Synthetische R1-proef; conceptbedragen niet voor uitbetaling. 8% vakantietoeslag is alleen als reserve opgenomen.'],
      },
      branding: { liquidHrLogoDataUrl: null },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    }
    const html = renderPayrun01PayslipHtml(htmlInput)
    const pdf = await renderPayrun01PayslipPdf(htmlInput)

    expect(snapshot.sourceGaps).toEqual([])
    expect(sourceContract(snapshot).references.every((reference) => reference.status === 'BOUND')).toBe(true)
    expect(result.status).toBe('CALCULATED')
    expect(result.controls.filter((control) => control.status === 'FAIL')).toEqual([])
    expect(componentResults).toEqual({
      gross: oracle.gross,
      pensionableBase: oracle.monthlyPensionableBase,
      employeePension: oracle.employeePension,
      employerPension: oracle.employerPension,
      taxableWage: oracle.taxableWage,
      employeeInsuranceBase: oracle.taxableWage,
      zvwBase: oracle.taxableWage,
      wageTax: oracle.wageTax,
      net: oracle.net,
      awf: oracle.employerRates.awf,
      aof: oracle.employerRates.aof,
      wko: oracle.employerRates.wko,
      whk: oracle.employerRates.whk,
      zvw: oracle.employerRates.zvw,
      employerInsurance: oracle.employerRates.total,
      holidayReserve: oracle.holidayReserve,
      totalEmployerCost: oracle.totalEmployerCost,
    })
    expect(componentResults).toEqual({
      gross: '4767.20',
      pensionableBase: '3210.53',
      employeePension: '198.65',
      employerPension: '595.96',
      taxableWage: '4568.55',
      employeeInsuranceBase: '4568.55',
      zvwBase: '4568.55',
      wageTax: '1107.17',
      net: '3461.38',
      awf: '125.18',
      aof: '286.45',
      wko: '22.84',
      whk: '88.17',
      zvw: '278.68',
      employerInsurance: '801.32',
      holidayReserve: '381.38',
      totalEmployerCost: '6545.86',
    })
    expect(pension).toMatchObject({
      annualFranchise: '18680',
      totalPremiumRate: '24.75',
      employeeRate: '6.1875',
      employerRate: '18.5625',
      calculationStatus: 'CALCULATED',
    })
    expect((pension.calculationTrace as readonly { componentCode: string; result: string | null }[])
      .find((step) => step.componentCode === 'PENSION_PENSIONABLE_BASE')?.result).toBe(oracle.annualPensionableBase)
    expect(result.trace.find((step) => step.componentCode === 'NL_WAGE_TAX')?.registeredRuleTrace)
      .toContainEqual(expect.objectContaining({
        code: 'result.period-values',
        values: expect.objectContaining({
          tablePeriodWage: { valueType: 'MONEY', value: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.wageTaxTable.oracleTableWage },
          wageTax: { valueType: 'MONEY', value: oracle.wageTax },
        }),
      }))
    expect(resultAmount(result, 'cumulative_gross_wage')).toBe(oracle.gross)
    expect(payrollOwned.amounts).toMatchObject({ variableRegularWage: '0.00' })
    expect(componentResults.gross).toBe('4767.20')
    expect(componentResults.employeePension).toBe('198.65')
    expect(componentResults.employerPension).toBe('595.96')
    expect(oracle.pensionAllocationDifference).toBe('0.00')
    expect(componentResults.holidayReserve).toBe('381.38')
    expect(componentResults.taxableWage).toBe('4568.55')
    expect(componentResults.aof).toBe('286.45')
    expect(componentResults.totalEmployerCost).toBe(oracle.totalEmployerCost)
    expect(componentResults.totalEmployerCost).toBe('6545.86')
    expect(html).toContain('CONCEPT — NIET DEFINITIEF')
    expect(html).toContain('Lokale CONCEPT-proef op basis van synthetische TEST-invoer')
    expect(Buffer.from(pdf).subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(1000)
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.resultHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('binds R2 part-time pay, overlap-safe premiums, and actual-work source versions', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR2IndependentOracle()
    const engineTrace = cao.componentTrace?.find((step) => step.componentCode === 'RETAIL_MODE_GROSS')
    const premiumTrace = engineTrace?.registeredRuleTrace?.find((step) => step.code === 'RETAIL_R2_BEST_OF_PREMIUMS_NO_DOUBLE_PAY')
    const actualWork = source.actualWork as { readonly entries: readonly Record<string, unknown>[] }

    expect(contract.references.every((reference) => reference.status === 'BOUND')).toBe(true)
    expect(contract.references.map((reference) => reference.sourceType)).toEqual(expect.arrayContaining([
      'actual_work_periods', 'work_hour_types', 'employment_work_hour_entries', 'synthetic_fixture',
    ]))
    expect(snapshot.sourceVersionVector).toMatchObject({
      [`actual_work_period:${sourceIds('R2').actualWorkPeriod}`]: '2026-08-01T09:00:00.000Z',
      [`retail_business_scope:${snapshot.sourceEmploymentId}`]: 'SYNTHETIC_FIXTURE:PAYD2-RETAIL-01-IN-STORE-v1',
    })
    expect(actualWork.entries).toHaveLength(4)
    expect(snapshot.sourceGaps).not.toContainEqual(expect.objectContaining({
      field: 'actualWork', reasonCode: 'OVERTIME_RULE_NOT_CONFIGURED',
    }))
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      packageVersion: '2026.7',
      hourlyBaseRate: oracle.hourlyBaseRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: oracle.selectedPremiumGross,
      grossAmount: oracle.gross,
      inputs: {
        scenarioCode: 'R2',
        functionGroup: 'C',
        experienceRow: '1',
        contractHoursPerWeek: '24',
        fullTimeHoursPerWeek: '38',
        weekdayNightHours: oracle.weekdayNightHours,
        sundayHours: oracle.sundayHours,
        dailyOvertimeHours: oracle.dailyOvertimeHours,
        isEcommerce: false,
      },
    })
    expect(premiumTrace?.values).toMatchObject({
      weekdayNightHours: { value: oracle.weekdayNightHours },
      sundayHours: { value: oracle.sundayHours },
      dailyOvertimeHours: { value: oracle.dailyOvertimeHours },
      dailyOvertimeOverlapHours: { value: oracle.overlappingOvertimeHours },
      dailyOvertimeOnlyHours: { value: oracle.overtimeOnlyHours },
      selectedPremiumGross: { value: oracle.selectedPremiumGross },
    })
    expect(source.caseProvenance).toMatchObject({
      premiumOverlap: {
        sourceClassification: 'SYNTHETIC_FIXTURE',
        explicitOvertimeOverlapHours: '2.0000',
      },
    })
    expect(source.fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
    expect(source).not.toHaveProperty('payrollOwned')
  })

  it('blocks night-hour cases when retail business scope is missing or is e-commerce without time-band detail', async () => {
    const missingScope = await createRetailSourceSnapshot('R2', { businessScope: null })
    const eCommerce = await createRetailSourceSnapshot('R2', { eCommerceNight: true })
    const missingCalculation = retailCalculation(missingScope)
    const eCommerceCalculation = retailCalculation(eCommerce)

    expect(missingCalculation).toMatchObject({
      status: 'BLOCKED',
      blockingStatus: 'SOURCE_GAP',
      reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    })
    expect(missingScope.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'cao', status: 'SOURCE_GAP', reasonCode: 'CAO_RETAIL_BUSINESS_SCOPE_UNVERIFIED',
    }))
    expect(sourceContract(missingScope).references.map((reference) => reference.field)).not.toContain('retailBusinessScope')
    expect(eCommerceCalculation).toMatchObject({
      status: 'BLOCKED',
      blockingStatus: 'UNSUPPORTED',
      reasonCode: 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    })
    expect(eCommerce.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'cao', status: 'UNSUPPORTED', reasonCode: 'CAO_RETAIL_ECOMMERCE_NIGHT_BAND_UNSUPPORTED',
    }))
    expect(eCommerceCalculation.grossAmount).toBeUndefined()
  })

  it('keeps R1 tax applicability and nonzero-opening VCR inputs fail-closed', async () => {
    const missingTaxProfile = await createRetailSourceSnapshot('R1', { omitR1FiscalProfile: true })
    const priorVcrOpening = await createRetailSourceSnapshot('R1', { nonZeroR1Opening: true })

    expect(missingTaxProfile.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'CORE_FISCAL_PROFILE_SOURCE_UNAVAILABLE',
    }))
    expect(canonical(missingTaxProfile).fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
    expect(priorVcrOpening.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'pension', status: 'SOURCE_GAP', reasonCode: 'BPF_DETAILHANDEL_VCR_REQUIRES_ZERO_OPENING_FIRST_FULL_PERIOD',
    }))
  })

  it('does not render a payslip from the gross-only source gaps', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const cao = retailCalculation(snapshot)

    expect(() => renderPayrun01PayslipHtml({
      data: {
        period: { year: 2026, month: 7, startsOn: '2026-07-01', endsOn: '2026-07-31' },
        lifecycle: 'CONCEPT',
        profile: {
          status: 'SYNTHETIC_TEST_PROFILE',
          employerName: 'Retail Mode TEST',
          employeeName: 'PAYD2 Retail Testmedewerker',
          writtenContract: true,
          contractType: 'INDEFINITE',
          isOnCall: false,
          contractHoursPerWeek: 24,
          fulltimeHoursPerWeek: 38,
        },
        components: [{ key: 'gross_salary', amount: cao.grossAmount ?? '0.00' }],
        sourceWarnings: ['SOURCE_GAP: fiscal, employer, pension and cumulative inputs are not bound.'],
      },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    })).toThrow('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  })
})

import { describe, expect, it } from 'vitest'
import {
  renderPayrun01PayslipHtml,
  LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID,
} from './payrun01-payslip-pdf'
import {
  derivePayd2RetailR1IndependentOracle,
  derivePayd2RetailR2IndependentOracle,
  derivePayd2RetailR2NetIndependentOracle,
} from './payd2-retail-independent-oracle'
import { getRetailModeRuleBundle } from '@liquid-hr/payroll-rules-cao-bench02'
import {
  PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS,
  PAYW02B_R2_OFFICIAL_SOURCE_PINS,
  canonical,
  createRetailSourceSnapshot,
  retailCalculation,
  scope,
  sourceIds,
  sourceContract,
} from './payd2-retail-source-fixture'
describe('PAYD2 Retail in-memory source cases', () => {
  it('binds R1 to the published July salary row and retains the pension source blocker', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const repeat = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR1IndependentOracle()
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
      [`cao:rule-package:${cao.compositionId}`]: `${cao.packageVersion}:${cao.packageHash}`,
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
      packageVersion: '2026-07',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2027-06-30',
      hourlyBaseRate: oracle.appliedHourlyRate,
      baseAmount: '4767.2',
      premiumAmount: '0',
      grossAmount: oracle.gross,
    })
    expect(cao.trace).toContainEqual(expect.objectContaining({
      code: 'RETAIL_MODE_BASE_SALARY',
      values: expect.objectContaining({
        salaryScale: 'MODE_I',
        salaryStep: 'EXP_15',
        fullTimeSalary: oracle.appliedHourlyRate === '28.95' ? '4767.2' : expect.any(String),
      }),
    }))
    expect(cao.sourceReferences).toContainEqual(expect.objectContaining({
      title: expect.stringContaining('2026-07'),
      url: PAYD2_RETAIL_02_OFFICIAL_SOURCE_PINS.cao.url,
    }))
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'pension', status: 'SOURCE_GAP', reasonCode: 'BPF_DETAILHANDEL_2026_PREMIUM_SPLIT_ROUNDING_UNRESOLVED',
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
    expect(source).not.toHaveProperty('payrollOwned')
    expect(source.pension).toHaveProperty('bpfDetailhandel2026Source.calculationInput.currentPayrollGross', '4767.20')
    expect(source.fiscalProfile).toMatchObject({ status: 'CONFIRMED', ageCategory: 'UNDER_AOW' })
  })

  it('blocks BPF inputs whose current payroll gross differs from the CAO result', async () => {
    const snapshot = await createRetailSourceSnapshot('R1', { bpfCurrentGrossMismatch: true })

    expect(snapshot.sourceGaps).toContainEqual({
      field: 'pension', status: 'UNSUPPORTED', reasonCode: 'BPF_DETAILHANDEL_2026_CURRENT_GROSS_MISMATCH',
    })
    expect(canonical(snapshot)).not.toHaveProperty('payrollOwned')
  })

  it('does not expose R1 Payroll-owned amounts when BPF split rounding is unresolved', async () => {
    const snapshot = await createRetailSourceSnapshot('R1')
    const source = canonical(snapshot)
    const oracle = derivePayd2RetailR1IndependentOracle()

    expect(retailCalculation(snapshot)).toMatchObject({
      status: 'CALCULATED',
      grossAmount: oracle.gross,
      hourlyBaseRate: oracle.appliedHourlyRate,
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'pension', status: 'SOURCE_GAP', reasonCode: 'BPF_DETAILHANDEL_2026_PREMIUM_SPLIT_ROUNDING_UNRESOLVED',
    })
    expect(source).not.toHaveProperty('payrollOwned')
    expect(sourceContract(snapshot).references).toContainEqual(expect.objectContaining({
      field: 'pensionYearToDate',
      sourceType: 'payroll_bpf_detailhandel_vcr_inputs',
      status: 'BOUND',
    }))
    expect(() => renderPayrun01PayslipHtml({
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
        components: [{ key: 'gross_salary', amount: oracle.gross }],
        sourceWarnings: ['SOURCE_GAP: BPF-premiesplitsing kan niet op centen worden gereconcilieerd.'],
      },
      presentation: { templateId: LIQUIDHR_STANDARD_PAYSLIP_TEMPLATE_ID },
    })).toThrow('PAYRUN01_PAYSLIP_RESULT_INCOMPLETE')
  })

  it('does not infer R2 premiums from work-hour labels without an HR Admin payroll release', async () => {
    const snapshot = await createRetailSourceSnapshot('R2')
    const source = canonical(snapshot)
    const contract = sourceContract(snapshot)
    const cao = retailCalculation(snapshot)
    const oracle = derivePayd2RetailR2IndependentOracle()
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
    expect(snapshot.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_PAYROLL_RELEASE_REQUIRED',
    }))
    expect(cao).toMatchObject({
      status: 'CALCULATED',
      packageVersion: '2026-07',
      hourlyBaseRate: oracle.hourlyBaseRate,
      baseAmount: oracle.baseMonthlyGross,
      premiumAmount: '0',
      grossAmount: oracle.baseMonthlyGross,
      inputs: {
        salaryScale: 'MODE_C',
        salaryStep: 'EXP_01',
        contractHoursPerWeek: '24',
        fullTimeHoursPerWeek: '38',
        approvedSundayOrHolidayHours: '0',
      },
    })
    expect(cao).toMatchObject({ baseAmount: '1605.79', premiumAmount: '0', grossAmount: '1605.79' })
    expect(source.caseProvenance).toMatchObject({
      premiumOverlap: {
        sourceClassification: 'SYNTHETIC_FIXTURE',
        explicitOvertimeOverlapHours: '2.0000',
      },
    })
    expect(source.fiscalProfile).toMatchObject({ status: 'SOURCE_GAP' })
    expect(source).not.toHaveProperty('payrollOwned')
  })

  it('keeps the historical R2 oracle separate while W04 payroll releases are absent', async () => {
    const snapshot = await createRetailSourceSnapshot('R2', { completeR2PayrollSource: true })
    const repeated = await createRetailSourceSnapshot('R2', { completeR2PayrollSource: true })
    const source = canonical(snapshot)
    const oracle = derivePayd2RetailR2NetIndependentOracle()

    expect(snapshot.sourceHash).toBe(repeated.sourceHash)
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'actualWork',
      status: 'SOURCE_GAP',
      reasonCode: 'ACTUAL_WORK_PAYROLL_RELEASE_REQUIRED',
    })
    expect(sourceContract(snapshot).references.every((reference) => reference.status === 'BOUND')).toBe(true)
    expect(sourceContract(snapshot).periodStart).toBe('2026-07-01')
    expect(source.employment).toMatchObject({ startsOn: '2026-07-01' })
    expect(source.fiscalProfile).toMatchObject({
      status: 'CONFIRMED',
      effectiveFrom: '2026-07-01',
      versionNumber: 1,
      ageCategory: 'UNDER_AOW',
      payrollTaxCreditApplies: true,
    })
    expect(snapshot.sourceGaps).toContainEqual({
      field: 'pension', status: 'SOURCE_GAP', reasonCode: 'BPF_DETAILHANDEL_2026_VCR_INPUT_MISSING',
    })
    expect(source).not.toHaveProperty('payrollOwned')
    expect(source.caseProvenance).toMatchObject({
      officialRuleSources: PAYW02B_R2_OFFICIAL_SOURCE_PINS,
      syntheticPayrollInputs: {
        fixtureId: 'PAY-W02B-R2-NET-ORACLE-01',
        realEmployerAndPensionApplicability: 'SOURCE_GAP',
        realEmployeeFiscalDeclarations: 'SOURCE_GAP',
        actualWorkIntervalEvidence: 'SYNTHETIC_FIXTURE_ONLY; no Core interval, timezone, pause, or correction source is asserted',
        openingCumulatives: 'EXPLICIT_ZERO_FIRST_PERIOD',
      },
    })
    expect((source.caseProvenance as Record<string, unknown>).syntheticPayrollInputs).toHaveProperty('dependencyMatrix', expect.arrayContaining([
      expect.objectContaining({ field: 'employment-period-hours', status: 'AVAILABLE' }),
      expect.objectContaining({ field: 'fiscal-parameters', status: 'AVAILABLE' }),
      expect.objectContaining({ field: 'pension-arrangement-base-franchise-rates', status: 'AVAILABLE' }),
      expect.objectContaining({ field: 'employer-contributions-and-reserves', status: 'AVAILABLE' }),
      expect.objectContaining({ field: 'opening-cumulative-values', status: 'AVAILABLE' }),
      expect.objectContaining({ field: 'real-employer-and-pension-applicability', status: 'MISSING' }),
      expect.objectContaining({ field: 'real-actual-work-intervals', status: 'MISSING', version: 'NOT_BOUND' }),
    ]))
    expect(oracle).toMatchObject({
      gross: '1621.23',
      monthlyPensionableBase: '638.04',
      totalPension: '157.91',
      employeePension: '39.48',
      employerPension: '118.43',
      taxableWage: '1581.75',
      taxTrace: {
        annualizedWage: '18981.00',
        annualTableWage: '18954.00',
        annualTaxBeforeCredits: '6776.00',
        annualGeneralCredit: '3115.00',
        annualTheoreticalLabourCredit: '3164.00',
        annualTaxAfterCredits: '497.00',
      },
      wageTax: '41.42',
      net: '1540.33',
      totalEmployerCost: '2146.81',
    })
  })

  it.each([
    ['tax profile', { omitR2FiscalProfile: true }, 'taxProfile'],
    ['pension assignment', { omitR2PensionSource: true }, 'pension'],
    ['employer configuration', { omitR2EmployerConfiguration: true }, 'payrollConfiguration'],
    ['opening cumulative', { omitR2OpeningCumulative: true }, 'openingCumulative'],
    ['contradictory opening cumulative', { nonZeroR2OpeningCumulative: true }, 'pension'],
    ['invalid effective date', { invalidR2TaxProfileEffectiveDate: true }, 'taxProfile'],
    ['invalid source version', { invalidR2TaxProfileVersion: true }, 'taxProfile'],
  ] as const)('keeps incomplete R2 %s source fail-closed', async (_name, options, field) => {
    const snapshot = await createRetailSourceSnapshot('R2', { completeR2PayrollSource: true, ...options })

    expect(snapshot.sourceGaps).toEqual(expect.arrayContaining([expect.objectContaining({ field })]))
  })

  it('does not infer night-hour premiums from work-hour type labels', async () => {
    const missingScope = await createRetailSourceSnapshot('R2', { businessScope: null })
    const eCommerce = await createRetailSourceSnapshot('R2', { eCommerceNight: true })
    const missingCalculation = retailCalculation(missingScope)
    const eCommerceCalculation = retailCalculation(eCommerce)

    expect(missingCalculation).toMatchObject({ status: 'CALCULATED', premiumAmount: '0', grossAmount: '1605.79' })
    expect(missingScope.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_PAYROLL_RELEASE_REQUIRED',
    }))
    expect(missingScope.sourceGaps).not.toContainEqual(expect.objectContaining({ field: 'cao' }))
    expect(sourceContract(missingScope).references.map((reference) => reference.field)).not.toContain('retailBusinessScope')
    expect(eCommerceCalculation).toMatchObject({ status: 'CALCULATED', premiumAmount: '0', grossAmount: '1605.79' })
    expect(eCommerce.sourceGaps).toContainEqual(expect.objectContaining({
      field: 'actualWork', status: 'SOURCE_GAP', reasonCode: 'ACTUAL_WORK_PAYROLL_RELEASE_REQUIRED',
    }))
    expect(eCommerce.sourceGaps).not.toContainEqual(expect.objectContaining({ field: 'cao' }))
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

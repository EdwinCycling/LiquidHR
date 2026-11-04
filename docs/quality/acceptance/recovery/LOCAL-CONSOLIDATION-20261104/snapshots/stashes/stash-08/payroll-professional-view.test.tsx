import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PayrollProfessionalRun } from '@/lib/payroll/payroll-professional-service'
import { PayrollRunReconciliation } from './payroll-professional-view'

const pensionRun = {
  run: { id: '30000000-0000-4000-8000-000000000001', status: 'SUCCEEDED', result_hash: null },
  sourceSnapshot: {
    source_employee_id: '10000000-0000-4000-8000-000000000001',
    source_hash: 'a'.repeat(64),
    source_payload: {
      payrollOwned: {
        pensionCalculationTrace: [{
          componentCode: 'PENSION_EMPLOYEE_SHARE',
          formula: 'monthlyTotal × employeeSharePercent ÷ 100',
          assessmentBase: '1094.87',
          rate: '33.3333',
          result: '364.96',
          unroundedValue: '364.95630171',
          roundingRule: 'HALF_UP to 2 decimal places',
          source: 'Core pension arrangement and employment assignment',
          componentVersion: '2026.1',
          ruleProvenance: { status: 'SYNTHETIC_TEST_POLICY_WITH_OFFICIAL_REFERENCE_STAFFEL' },
          dependencies: ['PENSION_MONTHLY_TOTAL'],
        }],
      },
    },
  },
  inputSet: { input_hash: 'b'.repeat(64), engine_version: '0.2.0', rule_package_composition_id: 'NL-PAYROLL-2026:2026.1' },
  payrollPeriod: { period_year: 2026, period_month: 10 },
  componentResults: [{
    component_key: 'employee_pension',
    amount: 364.96,
    result_payload: { component: { code: 'PAYRUN01_EMPLOYEE_PENSION', version: '2026.1' }, amount: '364.96' },
  }],
  trace: null,
  controls: [],
  lifecycleEvents: [],
} as unknown as PayrollProfessionalRun

const employerPremiumRun = {
  run: { id: '30000000-0000-4000-8000-000000000002', status: 'SUCCEEDED', result_hash: null },
  sourceSnapshot: {
    source_employee_id: '10000000-0000-4000-8000-000000000002',
    source_hash: 'c'.repeat(64),
    source_payload: { payrollOwned: {} },
  },
  inputSet: { input_hash: 'd'.repeat(64), engine_version: '0.2.0', rule_package_composition_id: 'NL-PAYROLL-2026:2026.1' },
  payrollPeriod: { period_year: 2026, period_month: 10 },
  componentResults: [{
    component_key: 'employer_insurance',
    amount: 1112.28,
    result_payload: { component: { code: 'PAYRUN01_EMPLOYER_INSURANCE', version: '2026.1' }, amount: '1112.28' },
  }],
  trace: {
    trace_payload: {
      packageMetadata: { sourceMetadata: { publisher: 'Belastingdienst', handbookTitle: 'Handboek Loonheffingen 2026' } },
      definitions: [{
        code: 'PAYRUN01_AWF_COST',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
        outputs: [{ name: 'amount', rounding: { mode: 'HALF_UP', scale: 2 } }],
      }],
      steps: [
        {
          componentCode: 'PAYRUN01_AWF_RATE',
          outputs: { rate: { value: '2.74', valueType: 'PERCENTAGE' } },
        },
        {
          componentCode: 'PAYRUN01_AWF_COST',
          componentId: 'system:payrun01:payrun01_awf_cost',
          sequence: 21,
          version: '2026.2',
          processingScope: 'INCOME_RELATIONSHIP',
          formula: 'assessmentBase × rate ÷ 100',
          inputs: {
            assessmentBase: { value: '6385.04', valueType: 'MONEY' },
            rate: { value: '2.74', valueType: 'PERCENTAGE' },
          },
          outputs: { amount: { value: '174.95', valueType: 'MONEY' } },
          dependencyRefs: [
            { componentCode: 'PAYRUN01_AWF_RATE', inputName: 'rate', outputName: 'rate' },
            { componentCode: 'PAYRUN01_EMPLOYEE_INSURANCE_BASE', inputName: 'assessmentBase', outputName: 'amount' },
          ],
          rulePackageProvenance: { packageId: 'NL-PAYROLL-2026', version: '2026.1' },
        },
      ],
    },
  },
  controls: [],
  lifecycleEvents: [],
} as unknown as PayrollProfessionalRun

const labels: Readonly<Record<string, string>> = {
  gross: 'Gross',
  net: 'Net',
  employeeArithmetic: 'Employee calculation',
  employerCost: 'Employer cost',
  cumulative: 'Cumulative',
  pensionCalculationDetail: 'Pension calculation detail',
  assessmentBase: 'Assessment base',
  percentage: 'Percentage',
  savedResult: 'Saved result',
  roundingMethod: 'Rounding method',
  calculationSource: 'Calculation source',
  ruleProvenance: 'Rule provenance',
  componentVersion: 'Component version',
  formula: 'Formula',
  ruleReference: 'Rule reference',
  dependencies: 'Dependencies',
  unroundedValue: 'Unrounded value',
  finalizedStatus: 'Finalized',
  notFinalized: 'Not finalized',
  conceptStatus: 'Concept — not final',
  notSucceeded: 'Not succeeded',
  reconciliationFlow: 'Reconciliation',
  employeeReconciliationFormula: 'Employee calculation formula',
  employerReconciliationFormula: 'Employer calculation formula',
  distinctFiscalBases: 'Distinct fiscal bases',
  fiscalBaseWageTax: 'Wage-tax base',
  fiscalBaseEmployeeInsurance: 'Employee-insurance base',
  fiscalBaseZvw: 'Zvw base',
  notCalculated: 'Not calculated',
  notRecorded: 'Not recorded',
  noComponentTrace: 'No component trace',
  componentCode: 'Component code',
  effectivePeriod: 'Effective period',
  rulePackage: 'Rule package',
  ruleSource: 'Rule source',
  calculationProvenance: 'Calculation provenance',
  traceStep: 'Trace step',
  employerPremiumBreakdown: 'Employer contribution detail',
  premium_awf: 'AWf contribution',
  assessmentBaseTimesRate: 'Assessment base × percentage ÷ 100',
  decimalPlaces: 'decimal places',
  notAvailable: 'Not available',
  otherComponents: 'Other components',
  controls: 'Controls',
  calculationTrace: 'Calculation trace',
  lifecycle: 'Lifecycle',
  finalized: 'Finalized',
  grossToNetExplanation: 'Gross to net',
  employerContributions: 'Employer contributions',
  pensionReadinessTitle: 'Pension source needs review',
  pensionSourceVerificationRequired: 'Pension not calculated / source verification required',
  netNotDefinitive: 'The displayed net pay is not definitive while the pension source is missing.',
  event_CONCEPT: 'Concept',
}

describe('PayrollRunReconciliation responsive calculation details', () => {
  it('uses shrinkable single-column tracks for saved pension inputs on narrow screens', () => {
    const markup = renderToStaticMarkup(<PayrollRunReconciliation run={pensionRun} locale="nl-NL" labels={labels} />)

    expect(markup).toContain('grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2')
    expect(markup).toContain('€ 364,96')
    expect(markup).toContain('PENSION_MONTHLY_TOTAL')
  })

  it('grounds employer premium details in persisted inputs, rule, rounding and trace dependencies', () => {
    const markup = renderToStaticMarkup(<PayrollRunReconciliation run={employerPremiumRun} locale="en-GB" labels={labels} />)

    expect(markup).toContain('AWf contribution')
    expect(markup).toContain('PAYRUN01_AWF_COST')
    expect(markup).toContain('6,385.04')
    expect(markup).toContain('2.74%')
    expect(markup).toContain('assessmentBase × rate ÷ 100')
    expect(markup).toContain('HALF_UP · decimal places 2')
    expect(markup).toContain('NL-PAYROLL-2026 · 2026.1')
    expect(markup).toContain('Belastingdienst · Handboek Loonheffingen 2026')
    expect(markup).toContain('system:payrun01:payrun01_awf_cost · Trace step 21 · INCOME_RELATIONSHIP')
    expect(markup).toContain('PAYRUN01_AWF_RATE')
    expect(markup).toContain('PAYRUN01_EMPLOYEE_INSURANCE_BASE')
  })

  it('distinguishes a CONCEPT run from FINALIZED and withholds payslip downloads until finalization', () => {
    const conceptRun = {
      ...pensionRun,
      lifecycleEvents: [{
        id: 'event-concept',
        calculation_run_id: pensionRun.run.id,
        event_type: 'CONCEPT',
        created_at: '2026-10-31T12:00:00.000Z',
      }],
    } as unknown as PayrollProfessionalRun
    const finalizedRun = {
      ...pensionRun,
      lifecycleEvents: [{
        id: 'event-finalized',
        calculation_run_id: pensionRun.run.id,
        event_type: 'FINALIZED',
        created_at: '2026-10-31T12:00:00.000Z',
      }],
    } as unknown as PayrollProfessionalRun

    const conceptMarkup = renderToStaticMarkup(<PayrollRunReconciliation run={conceptRun} locale="en-GB" labels={labels} />)
    const finalizedMarkup = renderToStaticMarkup(<PayrollRunReconciliation run={finalizedRun} locale="en-GB" labels={labels} />)

    expect(conceptMarkup).toContain('Concept — not final')
    expect(conceptMarkup).toContain('Not finalized')
    expect(conceptMarkup).not.toContain('/artifact/TECHNICAL_JSON')
    expect(finalizedMarkup).toContain('Finalized')
    expect(finalizedMarkup).toContain('/artifact/TECHNICAL_JSON')
  })

  it('shows the PFZW source gap and non-definitive net without inventing a zero pension', () => {
    const fritsRun = {
      ...employerPremiumRun,
      run: { ...employerPremiumRun.run, id: '30000000-0000-4000-8000-000000000003' },
      sourceSnapshot: {
        ...employerPremiumRun.sourceSnapshot,
        source_payload: { payrollOwned: { fiscalBases: null, pensionCalculationTrace: null } },
      },
      componentResults: [
        { component_key: 'gross_salary', amount: 3219.41, result_payload: { amount: '3219.41' } },
        { component_key: 'net_salary', amount: 2743.91, result_payload: { amount: '2743.91' } },
        ...employerPremiumRun.componentResults,
      ],
      trace: null,
      controls: [{ control_key: 'PAYRUN01-CTRL-009-PENSION-RULE-READY', status: 'WARN', detail_payload: {} }],
      lifecycleEvents: [],
    } as unknown as PayrollProfessionalRun

    const markup = renderToStaticMarkup(<PayrollRunReconciliation run={fritsRun} locale="nl-NL" labels={labels} />)

    expect(markup).toContain('Pension source needs review')
    expect(markup).toContain('Pension not calculated / source verification required')
    expect(markup).toContain('The displayed net pay is not definitive while the pension source is missing.')
    expect(markup).not.toMatch(/Employee pension.{0,40}€\s*0,00/)
  })
})

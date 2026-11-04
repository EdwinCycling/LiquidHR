import { describe, expect, it } from 'vitest'
import {
  employerPremiumExplanations,
  payrollFiscalBases,
  payrollPensionCalculationSteps,
  payrollTraceSteps,
} from './payroll-professional-explanations'

describe('persisted payroll explanation projection', () => {
  it('keeps the three fiscal assessment bases distinct when their saved amounts match', () => {
    const source = {
      payrollOwned: {
        fiscalBases: {
          wageTax: '6385.04',
          employeeInsurance: '6385.04',
          zvw: '6385.04',
        },
      },
    } as const

    expect(payrollFiscalBases(source)).toEqual([
      { key: 'wageTax', labelKey: 'fiscalBaseWageTax', amount: '6385.04' },
      { key: 'employeeInsurance', labelKey: 'fiscalBaseEmployeeInsurance', amount: '6385.04' },
      { key: 'zvw', labelKey: 'fiscalBaseZvw', amount: '6385.04' },
    ])
  })

  it('projects employer contribution bases, rates and saved outputs without calculating them', () => {
    const trace = {
      steps: [
        { componentCode: 'PAYRUN01_AWF_RATE', outputs: { rate: { value: '2.74', valueType: 'PERCENTAGE' } } },
        { componentCode: 'PAYRUN01_AWF_COST', version: '2026.2', inputs: { rate: { value: '2.74', valueType: 'PERCENTAGE' }, assessmentBase: { value: '6385.04', valueType: 'MONEY' } }, outputs: { amount: { value: '174.95', valueType: 'MONEY' } }, dependencyRefs: [] },
        { componentCode: 'PAYRUN01_AOF_RATE', outputs: { rate: { value: '6.27', valueType: 'PERCENTAGE' } } },
        { componentCode: 'PAYRUN01_AOF_COST', version: '2026.2', inputs: { rate: { value: '6.27', valueType: 'PERCENTAGE' }, assessmentBase: { value: '6385.04', valueType: 'MONEY' } }, outputs: { amount: { value: '400.34', valueType: 'MONEY' } }, dependencyRefs: [] },
        { componentCode: 'PAYRUN01_WHK_RATE', outputs: { rate: { value: '1.81', valueType: 'PERCENTAGE' } } },
        { componentCode: 'PAYRUN01_WHK_COST', version: '2026.2', inputs: { rate: { value: '1.81', valueType: 'PERCENTAGE' }, assessmentBase: { value: '6385.04', valueType: 'MONEY' } }, outputs: { amount: { value: '115.57', valueType: 'MONEY' } }, dependencyRefs: [] },
        { componentCode: 'PAYRUN01_WKO_RATE', outputs: { rate: { value: '0.50', valueType: 'PERCENTAGE' } } },
        { componentCode: 'PAYRUN01_WKO_COST', version: '2026.2', inputs: { rate: { value: '0.50', valueType: 'PERCENTAGE' }, assessmentBase: { value: '6385.04', valueType: 'MONEY' } }, outputs: { amount: { value: '31.93', valueType: 'MONEY' } }, dependencyRefs: [] },
        { componentCode: 'PAYRUN01_ZVW_RATE', outputs: { rate: { value: '6.10', valueType: 'PERCENTAGE' } } },
        { componentCode: 'PAYRUN01_ZVW_COST', version: '2026.2', inputs: { rate: { value: '6.10', valueType: 'PERCENTAGE' }, assessmentBase: { value: '6385.04', valueType: 'MONEY' } }, outputs: { amount: { value: '389.49', valueType: 'MONEY' } }, dependencyRefs: [] },
      ],
    } as const

    expect(employerPremiumExplanations(trace).map(({ key, rate, assessmentBase, amount }) => ({ key, rate, assessmentBase, amount }))).toEqual([
      { key: 'awf', rate: '2.74', assessmentBase: '6385.04', amount: '174.95' },
      { key: 'aof', rate: '6.27', assessmentBase: '6385.04', amount: '400.34' },
      { key: 'whk', rate: '1.81', assessmentBase: '6385.04', amount: '115.57' },
      { key: 'wko', rate: '0.50', assessmentBase: '6385.04', amount: '31.93' },
      { key: 'zvw', rate: '6.10', assessmentBase: '6385.04', amount: '389.49' },
    ])
    expect(payrollTraceSteps(trace)).toHaveLength(10)
  })

  it('returns no fabricated pension or fiscal amounts when persisted pension data is absent', () => {
    const source = { payrollOwned: { fiscalBases: null, pensionCalculationTrace: null } } as const

    expect(payrollFiscalBases(source).map((base) => base.amount)).toEqual([null, null, null])
    expect(payrollPensionCalculationSteps(source)).toEqual([])
  })
})

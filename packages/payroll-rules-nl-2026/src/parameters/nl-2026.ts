import type { PayrollTypedParameter } from '@liquid-hr/payroll-engine'

export interface Nl2026ParameterMetadata {
  readonly officialSymbol: string
  readonly valueType: PayrollTypedParameter['valueType']
  readonly value: string
  readonly unit: string
  readonly sourceReference: string
}

export const NL_2026_PARAMETER_METADATA = Object.freeze({
  monthFactor: { officialSymbol: 'F2', valueType: 'DECIMAL', value: '12', unit: 'months per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.1 table 1b, p.8' },
  annualTableStep: { officialSymbol: 'Lv', valueType: 'DECIMAL', value: '54', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.1 table 1a, p.7' },
  maximumAnnualTableWage: { officialSymbol: 'Lmax', valueType: 'MONEY', value: '133110', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.1 table 1a, p.7; parameter appendix p.4' },
  bracket1Offset: { officialSymbol: 'a1.1', valueType: 'MONEY', value: '0', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9' },
  bracket2Offset: { officialSymbol: 'a2.1', valueType: 'MONEY', value: '38883', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9; parameter appendix p.4' },
  bracket3Offset: { officialSymbol: 'a3.1', valueType: 'MONEY', value: '78426', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9; parameter appendix p.4' },
  bracket1RatePercent: { officialSymbol: 'b1.1', valueType: 'PERCENTAGE', value: '35.75', unit: 'percent', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9' },
  bracket2RatePercent: { officialSymbol: 'b2.1', valueType: 'PERCENTAGE', value: '37.56', unit: 'percent', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9; parameter appendix p.4' },
  bracket3RatePercent: { officialSymbol: 'b3.1', valueType: 'PERCENTAGE', value: '49.50', unit: 'percent', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9' },
  bracket1CumulativeTax: { officialSymbol: 'c1.1', valueType: 'MONEY', value: '0', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9' },
  bracket2CumulativeTax: { officialSymbol: 'c2.1', valueType: 'MONEY', value: '13900', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9' },
  bracket3CumulativeTax: { officialSymbol: 'c3.1', valueType: 'MONEY', value: '28752', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.2 table 2, p.9' },
  generalCreditMaximum: { officialSymbol: 'ahkm1.1', valueType: 'MONEY', value: '3115', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.1 table 3, p.10; parameter appendix p.4' },
  generalCreditLowerBound: { officialSymbol: 'ahkg1', valueType: 'MONEY', value: '29736', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.1 table 3, p.10' },
  generalCreditUpperBound: { officialSymbol: 'ahkg2', valueType: 'MONEY', value: '78426', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.1 table 3, p.10' },
  generalCreditTaperRate: { officialSymbol: 'ahka1.1', valueType: 'DECIMAL', value: '0.06398', unit: 'factor', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.1 table 3, p.10' },
  labourCreditBuildRate1: { officialSymbol: 'arko1.1', valueType: 'DECIMAL', value: '0.08324', unit: 'factor', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13; parameter appendix p.4' },
  labourCreditBuildRate2: { officialSymbol: 'arko2.1', valueType: 'DECIMAL', value: '0.31009', unit: 'factor', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13; parameter appendix p.4' },
  labourCreditBuildRate3: { officialSymbol: 'arko3.1', valueType: 'DECIMAL', value: '0.01950', unit: 'factor', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13; parameter appendix p.4' },
  labourCreditBuildCap1: { officialSymbol: 'arkm1.1', valueType: 'MONEY', value: '996', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditBuildCap2: { officialSymbol: 'arkm2.1', valueType: 'MONEY', value: '5300', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditBuildCap3: { officialSymbol: 'arkm3.1', valueType: 'MONEY', value: '5685', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditStart1: { officialSymbol: 'arkg1', valueType: 'MONEY', value: '11965', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditStart2: { officialSymbol: 'arkg2', valueType: 'MONEY', value: '25845', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditTaperStart: { officialSymbol: 'arkg3', valueType: 'MONEY', value: '45592', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditZeroBound: { officialSymbol: 'arkg4', valueType: 'MONEY', value: '132920', unit: 'EUR per year', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
  labourCreditTaperRate: { officialSymbol: 'arka1.1', valueType: 'DECIMAL', value: '0.06510', unit: 'factor', sourceReference: 'Rekenvoorschriften 2026 v2, §2.2.3.4 table 6, p.13' },
} satisfies Readonly<Record<string, Nl2026ParameterMetadata>>)

export const NL_2026_PARAMETERS: Readonly<Record<string, PayrollTypedParameter>> = Object.freeze(
  Object.fromEntries(Object.entries(NL_2026_PARAMETER_METADATA).map(([key, parameter]) => [key, {
    valueType: parameter.valueType,
    value: parameter.value,
  }])) as Record<string, PayrollTypedParameter>,
)

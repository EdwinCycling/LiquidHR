import type { PayrollJson } from './database'

export type PayrollExplanationRecord = { readonly [key: string]: PayrollJson | undefined }

export type PayrollFiscalBase = {
  readonly key: 'wageTax' | 'employeeInsurance' | 'zvw'
  readonly labelKey: string
  readonly amount: string | null
}

export type EmployerPremiumExplanation = {
  readonly key: 'awf' | 'aof' | 'whk' | 'wko' | 'zvw'
  readonly labelKey: string
  readonly code: string
  readonly rate: PayrollJson | undefined
  readonly assessmentBase: PayrollJson | undefined
  readonly amount: PayrollJson | undefined
  readonly step: PayrollExplanationRecord
}

const EMPLOYER_PREMIUMS = [
  { key: 'awf', labelKey: 'premium_awf', code: 'PAYRUN01_AWF_COST', rateCode: 'PAYRUN01_AWF_RATE' },
  { key: 'aof', labelKey: 'premium_aof', code: 'PAYRUN01_AOF_COST', rateCode: 'PAYRUN01_AOF_RATE' },
  { key: 'whk', labelKey: 'premium_whk', code: 'PAYRUN01_WHK_COST', rateCode: 'PAYRUN01_WHK_RATE' },
  { key: 'wko', labelKey: 'premium_wko', code: 'PAYRUN01_WKO_COST', rateCode: 'PAYRUN01_WKO_RATE' },
  { key: 'zvw', labelKey: 'premium_zvw', code: 'PAYRUN01_ZVW_COST', rateCode: 'PAYRUN01_ZVW_RATE' },
] as const

export function payrollExplanationRecord(value: PayrollJson | undefined): PayrollExplanationRecord | null {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as PayrollExplanationRecord
    : null
}

export function payrollExplanationArray(value: PayrollJson | undefined): readonly PayrollJson[] {
  return Array.isArray(value) ? value : []
}

export function payrollExplanationString(value: PayrollJson | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function traceOutputValue(step: PayrollExplanationRecord | undefined, name: string): PayrollJson | undefined {
  const outputs = payrollExplanationRecord(step?.outputs)
  const output = payrollExplanationRecord(outputs?.[name])
  return output?.value
}

export function payrollTraceSteps(tracePayload: PayrollJson | null | undefined): readonly PayrollExplanationRecord[] {
  const payload = payrollExplanationRecord(tracePayload ?? undefined)
  return payrollExplanationArray(payload?.steps)
    .map((value) => payrollExplanationRecord(value))
    .filter((step): step is PayrollExplanationRecord => step !== null)
}

export function payrollTraceStepByCode(
  steps: readonly PayrollExplanationRecord[],
  componentCode: string | null,
): PayrollExplanationRecord | null {
  if (!componentCode) return null
  return steps.find((step) => step.componentCode === componentCode) ?? null
}

export function payrollPensionCalculationSteps(sourcePayload: PayrollJson): readonly PayrollExplanationRecord[] {
  const source = payrollExplanationRecord(sourcePayload)
  const payrollOwned = payrollExplanationRecord(source?.payrollOwned)
  return payrollExplanationArray(payrollOwned?.pensionCalculationTrace)
    .map((value) => payrollExplanationRecord(value))
    .filter((step): step is PayrollExplanationRecord => step !== null)
}

export function payrollFiscalBases(sourcePayload: PayrollJson): readonly PayrollFiscalBase[] {
  const source = payrollExplanationRecord(sourcePayload)
  const payrollOwned = payrollExplanationRecord(source?.payrollOwned)
  const bases = payrollExplanationRecord(payrollOwned?.fiscalBases)
  const definitions: readonly Pick<PayrollFiscalBase, 'key' | 'labelKey'>[] = [
    { key: 'wageTax', labelKey: 'fiscalBaseWageTax' },
    { key: 'employeeInsurance', labelKey: 'fiscalBaseEmployeeInsurance' },
    { key: 'zvw', labelKey: 'fiscalBaseZvw' },
  ]
  return definitions.map(({ key, labelKey }) => ({
    key,
    labelKey,
    amount: payrollExplanationString(bases?.[key]),
  }))
}

export function employerPremiumExplanations(tracePayload: PayrollJson | null | undefined): readonly EmployerPremiumExplanation[] {
  const steps = payrollTraceSteps(tracePayload)
  const byCode = new Map(steps.flatMap((step) => typeof step.componentCode === 'string' ? [[step.componentCode, step] as const] : []))
  return EMPLOYER_PREMIUMS.flatMap((premium) => {
    const step = byCode.get(premium.code)
    if (!step) return []
    const inputs = payrollExplanationRecord(step.inputs)
    return [{
      key: premium.key,
      labelKey: premium.labelKey,
      code: premium.code,
      rate: traceOutputValue(byCode.get(premium.rateCode), 'rate') ?? payrollExplanationRecord(inputs?.rate)?.value,
      assessmentBase: payrollExplanationRecord(inputs?.assessmentBase)?.value,
      amount: traceOutputValue(step, 'amount'),
      step,
    }]
  })
}

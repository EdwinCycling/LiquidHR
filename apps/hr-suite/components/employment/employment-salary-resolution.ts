import { parseDecimalInput } from '@/lib/employment/decimal-input'

export type EmploymentSalaryBasis = 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE' | 'SALARY_BAND'

export interface EffectiveEmploymentSalaryInput {
  salaryBasis: EmploymentSalaryBasis
  manualFulltimeAmount: string
  manualParttimeAmount: string
  selectedScaleAmount?: number | null
  partTimeFactor: number
}

export interface EffectiveEmploymentSalary {
  fulltimeAmount: number | null
  parttimeAmount: number | null
}

export function resolveEffectiveEmploymentSalary(input: EffectiveEmploymentSalaryInput): EffectiveEmploymentSalary {
  const parsedManualFulltimeAmount = parseDecimalInput(input.manualFulltimeAmount)
  const manualFulltimeAmount = Number.isFinite(parsedManualFulltimeAmount) ? parsedManualFulltimeAmount : null
  const fulltimeAmount = input.salaryBasis === 'MINIMUM_WAGE'
    ? null
    : input.salaryBasis === 'CUSTOM_SCALE'
      ? Number.isFinite(input.selectedScaleAmount) ? input.selectedScaleAmount ?? null : null
      : manualFulltimeAmount

  const parsedManualParttimeAmount = parseDecimalInput(input.manualParttimeAmount)
  const parttimeAmount = input.salaryBasis === 'MINIMUM_WAGE'
    ? null
    : Number.isFinite(parsedManualParttimeAmount) && parsedManualParttimeAmount !== 0
      ? parsedManualParttimeAmount
      : fulltimeAmount !== null && Number.isFinite(input.partTimeFactor)
        ? fulltimeAmount * input.partTimeFactor
        : null

  return { fulltimeAmount, parttimeAmount }
}

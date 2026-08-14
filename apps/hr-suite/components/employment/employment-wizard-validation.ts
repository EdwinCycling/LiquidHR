import { isBlockingProbationValidation, validateProbation } from '@/lib/employment/probation-rules'
import { parseDecimalInput } from '@/lib/employment/decimal-input'

export type EmploymentWizardStep = 'administration' | 'employment' | 'payrollChoice' | 'contract' | 'schedule' | 'salary' | 'other' | 'review'

export function canSubmitEmploymentWizard(step: EmploymentWizardStep): boolean {
  return step === 'review'
}

export interface EmploymentWizardValidationInput {
  administrationId: string
  nationality: string
  birthDate: string
  gender: string
  employmentNumber: string
  startsOn: string
  seniorityDate: string
  countryCode: string
  ikvNumber: string
  employmentType: 'EMPLOYEE' | 'INTERN' | 'TEMPORARY_AGENCY' | 'FREELANCER' | 'VOLUNTEER' | 'NO_PAYROLL'
  flexPhaseId: string
  laborConditionSetId: string
  durationType: 'INDEFINITE' | 'DEFINITE' | 'TEMPORARY_NO_END'
  endsOn: string
  probationApplies: boolean
  probationEndsOn: string
  caoAllowsTwoMonths?: boolean
  weeklyHours: string
  days: Readonly<Record<string, string>>
  secondWeekDays: Readonly<Record<string, string>>
  twoWeekRoster: boolean
  salaryBasis: 'MANUAL' | 'MINIMUM_WAGE' | 'CUSTOM_SCALE' | 'SALARY_BAND'
  minimumWageScheme?: 'REGULAR' | 'BBL'
  salaryFrequencyId: string
  fulltimeAmount: string
  salaryScaleStepId: string
  salaryBandId?: string
  jobGroupId: string
  jobId: string
  departmentId: string
  allocations: Array<{ costCenterId: string; costCarrierId: string }>
}

export interface EmploymentWizardValidationOptions {
  optionsLoading: boolean
  payrollDetails: boolean | null
  canWriteSalary: boolean
  minimumRateAvailable: boolean
  rosterMatches: boolean
  allocationsMatch: boolean
}

export function hasMissingEmploymentPrerequisites(input: Pick<EmploymentWizardValidationInput, 'countryCode' | 'nationality' | 'birthDate' | 'gender'>): boolean {
  return !input.countryCode || !input.nationality || !input.birthDate || !input.gender
}

export function isEmploymentWizardStepValid(
  step: EmploymentWizardStep,
  input: EmploymentWizardValidationInput,
  options: EmploymentWizardValidationOptions,
): boolean {
  if (step === 'administration') return Boolean(input.administrationId) && !options.optionsLoading
  if (step === 'employment') {
    return Boolean(/^\d+$/.test(input.employmentNumber.trim()) && input.startsOn && input.seniorityDate && input.countryCode
      && (!options.payrollDetails || (Number(input.ikvNumber) >= 1 && Number(input.ikvNumber) <= 99)))
  }
  if (step === 'payrollChoice') return options.payrollDetails !== null
  if (step === 'review') return true
  if (step === 'contract') {
    const probationError = validateProbation(input)
    return Boolean(input.laborConditionSetId
      && (input.employmentType !== 'TEMPORARY_AGENCY' || input.flexPhaseId)
      && (input.durationType !== 'DEFINITE' || (input.endsOn && input.endsOn >= input.startsOn))
      && (!input.probationApplies || (input.probationEndsOn && input.probationEndsOn >= input.startsOn
        && !isBlockingProbationValidation(probationError))))
  }
  if (step === 'schedule') {
    const weeklyHours = parseDecimalInput(input.weeklyHours)
    const dayValues = Object.values(input.days)
    const secondWeekValues = Object.values(input.secondWeekDays)
    const allDayValues = input.twoWeekRoster ? [...dayValues, ...secondWeekValues] : dayValues
    const validDayValues = allDayValues.length > 0 && allDayValues.every((value) => value.trim() !== '' && Number.isFinite(parseDecimalInput(value)) && parseDecimalInput(value) >= 0 && parseDecimalInput(value) <= 24)
    const rosterMatches = Math.abs(allDayValues.reduce((sum, value) => sum + (parseDecimalInput(value) || 0), 0) - weeklyHours * (input.twoWeekRoster ? 2 : 1)) < 0.0001
    return options.rosterMatches && rosterMatches && input.weeklyHours.trim() !== '' && Number.isFinite(weeklyHours) && weeklyHours >= 0 && weeklyHours <= 50 && validDayValues
  }
  if (step === 'salary') {
    if (!options.canWriteSalary) return true
    if (!input.salaryFrequencyId) return false
    if (input.salaryBasis === 'MINIMUM_WAGE') return Boolean(input.minimumWageScheme)
    if (input.salaryBasis === 'CUSTOM_SCALE') return Boolean(input.salaryScaleStepId)
    if (input.salaryBasis === 'SALARY_BAND') return Boolean(input.salaryBandId) && Number(input.fulltimeAmount) > 0
    return Boolean(input.fulltimeAmount)
  }
  return Boolean(input.jobGroupId && input.jobId && input.departmentId
    && input.allocations.every((allocation) => allocation.costCenterId && allocation.costCarrierId)
    && options.allocationsMatch)
}

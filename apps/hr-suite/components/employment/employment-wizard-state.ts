import type { CompleteEmploymentCreateInput } from '@/lib/employment/schemas'

export function applyOnCallToggle<T extends { isOnCall: boolean }>(draft: T, isOnCall: boolean): T {
  return { ...draft, isOnCall }
}

type CompleteEmploymentDetails = {
  incomeRelationship: NonNullable<CompleteEmploymentCreateInput['incomeRelationship']>
  contract: NonNullable<CompleteEmploymentCreateInput['contract']>
  schedule: NonNullable<CompleteEmploymentCreateInput['schedule']>
  organization: NonNullable<CompleteEmploymentCreateInput['organization']>
  costAllocation: NonNullable<CompleteEmploymentCreateInput['costAllocation']>
  salary: NonNullable<CompleteEmploymentCreateInput['salary']>
}

export function buildEmploymentWizardPayload(input: {
  showPayrollChoice: boolean
  payrollDetails: boolean | null
  canWriteSalary: boolean
  sections: {
    employment: CompleteEmploymentCreateInput['employment']
    details: CompleteEmploymentDetails
  }
}): CompleteEmploymentCreateInput {
  const includeContractDetails = !input.showPayrollChoice || input.payrollDetails !== null
  if (!includeContractDetails) return { employment: input.sections.employment }

  const { salary, ...nonSalaryDetails } = input.sections.details
  return input.payrollDetails === true && input.canWriteSalary
    ? { employment: input.sections.employment, ...nonSalaryDetails, salary }
    : { employment: input.sections.employment, ...nonSalaryDetails }
}

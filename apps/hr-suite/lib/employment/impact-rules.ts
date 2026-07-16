export type EmploymentImpactSource =
  | 'SCHEDULE'
  | 'SALARY'
  | 'ORGANIZATION'
  | 'LABOR_CONDITIONS'
  | 'CONTRACT'
  | 'ADDRESS'

export type EmploymentImpactDomain =
  | 'SALARY'
  | 'LEAVE'
  | 'PENSION'
  | 'PAYROLL'
  | 'SCHEDULE'
  | 'ORGANIZATION'
  | 'LABOR_CONDITIONS'
  | 'COST_ALLOCATION'
  | 'DOCUMENTS'
  | 'INCOME_RELATIONSHIP'
  | 'TRAVEL_ALLOWANCE'
  | 'WORK_LOCATION'

export interface EmploymentImpact {
  domain: EmploymentImpactDomain
  messageKey: string
  recommended: boolean
}

const IMPACTS: Record<EmploymentImpactSource, EmploymentImpact[]> = {
  SCHEDULE: [
    { domain: 'SALARY', messageKey: 'impact.schedule.salary', recommended: true },
    { domain: 'LEAVE', messageKey: 'impact.schedule.leave', recommended: false },
    { domain: 'PENSION', messageKey: 'impact.schedule.pension', recommended: false },
    { domain: 'PAYROLL', messageKey: 'impact.schedule.payroll', recommended: false },
  ],
  SALARY: [
    { domain: 'ORGANIZATION', messageKey: 'impact.salary.organization', recommended: false },
    { domain: 'LABOR_CONDITIONS', messageKey: 'impact.salary.laborConditions', recommended: true },
    { domain: 'PAYROLL', messageKey: 'impact.salary.payroll', recommended: false },
  ],
  ORGANIZATION: [
    { domain: 'COST_ALLOCATION', messageKey: 'impact.organization.costAllocation', recommended: true },
    { domain: 'SALARY', messageKey: 'impact.organization.salary', recommended: false },
    { domain: 'DOCUMENTS', messageKey: 'impact.organization.documents', recommended: false },
  ],
  LABOR_CONDITIONS: [
    { domain: 'SCHEDULE', messageKey: 'impact.laborConditions.schedule', recommended: true },
    { domain: 'SALARY', messageKey: 'impact.laborConditions.salary', recommended: true },
    { domain: 'LEAVE', messageKey: 'impact.laborConditions.leave', recommended: false },
  ],
  CONTRACT: [
    { domain: 'INCOME_RELATIONSHIP', messageKey: 'impact.contract.incomeRelationship', recommended: true },
    { domain: 'DOCUMENTS', messageKey: 'impact.contract.documents', recommended: true },
    { domain: 'PAYROLL', messageKey: 'impact.contract.payroll', recommended: false },
  ],
  ADDRESS: [
    { domain: 'TRAVEL_ALLOWANCE', messageKey: 'impact.address.travelAllowance', recommended: true },
    { domain: 'WORK_LOCATION', messageKey: 'impact.address.workLocation', recommended: false },
    { domain: 'PAYROLL', messageKey: 'impact.address.payroll', recommended: false },
  ],
}

export function getEmploymentImpacts(source: EmploymentImpactSource): EmploymentImpact[] {
  return IMPACTS[source].map((impact) => ({ ...impact }))
}

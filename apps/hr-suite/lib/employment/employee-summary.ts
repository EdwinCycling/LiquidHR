export interface EmployeeSummaryEmployment {
  id: string
  startsOn: string
  endsOn: string | null
  recordStatus: string
}

export interface EmployeeSummaryLaborCondition {
  employmentId: string
  value: string
  validFrom: string
  validUntil: string | null
}

export interface EmployeeSummarySchedule {
  employmentId: string
  value: number
  validFrom: string
  validUntil: string | null
}

export interface EmployeeSummarySalary {
  employmentId: string
  amount: number
  currencyCode: string
  paymentType: 'PERIODIC_FIXED' | 'HOURLY_VARIABLE'
  validFrom: string
  validUntil: string | null
}

export interface EmployeeSummaryOrganization {
  employmentId: string | null
  departmentName: string | null
  jobTitle: string | null
  validFrom: string
  validUntil: string | null
}

export interface CurrentEmployeeSummary {
  asOf: string
  employmentId: string | null
  laborCondition: string | null
  hoursPerWeek: number | null
  salary: {
    amount: number
    currencyCode: string
    paymentType: EmployeeSummarySalary['paymentType']
  } | null
  departmentName: string | null
  jobTitle: string | null
}

interface EmployeeSummaryInput {
  today: string
  employments: EmployeeSummaryEmployment[]
  laborConditions: EmployeeSummaryLaborCondition[]
  schedules: EmployeeSummarySchedule[]
  salaries: EmployeeSummarySalary[]
  organizations: EmployeeSummaryOrganization[]
}

function isEffective(validFrom: string, validUntil: string | null, today: string): boolean {
  return validFrom <= today && (validUntil === null || validUntil >= today)
}

function latestEffective<T extends { validFrom: string; validUntil: string | null }>(items: T[], today: string): T | null {
  return items
    .filter((item) => isEffective(item.validFrom, item.validUntil, today))
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0] ?? null
}

export function selectCurrentEmploymentSummary(input: EmployeeSummaryInput): CurrentEmployeeSummary {
  const currentEmployment = input.employments
    .filter((employment) => employment.recordStatus !== 'CANCELLED')
    .filter((employment) => employment.startsOn <= input.today && (employment.endsOn === null || employment.endsOn >= input.today))
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn))[0]

  if (!currentEmployment) {
    return {
      asOf: input.today,
      employmentId: null,
      laborCondition: null,
      hoursPerWeek: null,
      salary: null,
      departmentName: null,
      jobTitle: null,
    }
  }

  const laborCondition = latestEffective(input.laborConditions.filter((item) => item.employmentId === currentEmployment.id), input.today)
  const schedule = latestEffective(input.schedules.filter((item) => item.employmentId === currentEmployment.id), input.today)
  const salary = latestEffective(input.salaries.filter((item) => item.employmentId === currentEmployment.id), input.today)
  const organization = latestEffective(
    input.organizations.filter((item) => item.employmentId === currentEmployment.id || item.employmentId === null),
    input.today,
  )

  return {
    asOf: input.today,
    employmentId: currentEmployment.id,
    laborCondition: laborCondition?.value ?? null,
    hoursPerWeek: schedule?.value ?? null,
    salary: salary ? { amount: salary.amount, currencyCode: salary.currencyCode, paymentType: salary.paymentType } : null,
    departmentName: organization?.departmentName ?? null,
    jobTitle: organization?.jobTitle ?? null,
  }
}

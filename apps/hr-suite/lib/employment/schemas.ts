import { z } from 'zod'
import { normalizeBsn } from '@/lib/security/bsn-fingerprint'
import { databaseUuid } from '@/lib/validation/database-uuid'
import { isBlockingProbationValidation, validateProbation } from './probation-rules'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const employmentRequestShape = {
  employmentNumber: z.string().trim().regex(/^\d+$/, 'EMPLOYMENT_NUMBER_INVALID').max(40),
  employmentType: z.enum(['EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR']).default('EMPLOYEE'),
  contractType: z.enum(['INDEFINITE', 'DEFINITE', 'ON_CALL', 'TEMPORARY_AGENCY', 'EXTERNAL']),
  startsOn: dateOnly,
  endsOn: dateOnly.nullish(),
  probationEndsOn: dateOnly.nullish(),
  seniorityDate: dateOnly,
  originalHireDate: dateOnly,
  isPrimary: z.boolean().default(false),
  reasonStarted: z.string().trim().max(500).nullish(),
  contractDocumentUrl: z.url().max(2_000).nullish(),
}

type EmploymentDateFields = {
  startsOn: string
  endsOn?: string | null
  probationEndsOn?: string | null
  seniorityDate: string
  originalHireDate: string
}

function validateEmploymentDates(
  value: EmploymentDateFields,
  context: z.core.$RefinementCtx<EmploymentDateFields>,
): void {
    if (value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({ code: 'custom', path: ['endsOn'], message: 'EMPLOYMENT_DATE_RANGE_INVALID' })
    }
    if (value.probationEndsOn && value.probationEndsOn < value.startsOn) {
      context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: 'PROBATION_DATE_INVALID' })
    }
    if (value.seniorityDate > value.startsOn || value.originalHireDate > value.startsOn) {
      context.addIssue({ code: 'custom', path: ['startsOn'], message: 'HIRE_HISTORY_DATE_INVALID' })
    }
}

export const createEmploymentRequestSchema = z
  .object(employmentRequestShape)
  .strict()
  .superRefine(validateEmploymentDates)

export const createEmploymentSchema = z
  .object({ employeeId: databaseUuid, ...employmentRequestShape })
  .strict()
  .superRefine(validateEmploymentDates)

const completeIncomeRelationshipSchema = z.object({
  ikvNumber: z.number().int().min(1).max(99),
  payrollTaxSubnumber: z.string().trim().min(1).max(20),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict()

const completeOrganizationSchema = z.object({
  departmentId: databaseUuid,
  jobId: databaseUuid,
  jobTitle: z.string().trim().min(1).max(160),
  managerEmployeeId: databaseUuid.nullish(),
  directManagerDeputyId: databaseUuid.nullish(),
  costBearer: z.string().trim().max(120).nullish(),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly.nullish(),
}).strict()

const completeContractSchema = z.object({
  // Kept optional for older callers; the source of truth is employment.employmentType.
  workerType: z.enum(['EMPLOYEE', 'STUDENT_INTERN', 'TEMPORARY_AGENCY', 'EXTERNAL_NO_PAYROLL']).default('EMPLOYEE'),
  flexPhaseId: databaseUuid.nullish(),
  laborConditionSetId: databaseUuid,
  durationType: z.enum(['INDEFINITE', 'DEFINITE', 'TEMPORARY_NO_END']),
  startsOn: dateOnly,
  endsOn: dateOnly.nullish(),
  probationApplies: z.boolean(),
  probationEndsOn: dateOnly.nullish(),
  caoAllowsTwoMonths: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.workerType === 'TEMPORARY_AGENCY' && !value.flexPhaseId) {
    context.addIssue({ code: 'custom', path: ['flexPhaseId'], message: 'FLEX_PHASE_REQUIRED' })
  }
  if (value.workerType !== 'TEMPORARY_AGENCY' && value.flexPhaseId) {
    context.addIssue({ code: 'custom', path: ['flexPhaseId'], message: 'FLEX_PHASE_NOT_ALLOWED' })
  }
  if (value.durationType !== 'DEFINITE' && value.endsOn) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'CONTRACT_END_DATE_NOT_ALLOWED' })
  }
  if (value.durationType === 'DEFINITE' && (!value.endsOn || value.endsOn < value.startsOn)) {
    context.addIssue({ code: 'custom', path: ['endsOn'], message: 'CONTRACT_END_DATE_REQUIRED' })
  }
  if (value.probationApplies && (!value.probationEndsOn || value.probationEndsOn < value.startsOn)) {
    context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: 'PROBATION_DATE_INVALID' })
  }
  // De client mag de gekozen CAO-afwijking meesturen; de service en database controleren deze server-side opnieuw.
  const probationError = validateProbation({ ...value, caoAllowsTwoMonths: value.caoAllowsTwoMonths === true })
  if (isBlockingProbationValidation(probationError)) {
    context.addIssue({ code: 'custom', path: ['probationEndsOn'], message: probationError })
  }
})

const completeScheduleSchema = z.object({
  scheduleType: z.enum(['HOURS_PER_DAY', 'HOURS_AND_AVG_DAYS', 'HOURS_AND_SPECIFIC_DAYS', 'TIMES_PER_DAY']),
  startWeek: z.number().int().min(1).max(53).default(1),
  averageDaysPerWeek: z.number().min(0).max(7),
  averageHoursPerWeek: z.number().min(0).max(168),
  partTimeFactor: z.number().min(0).max(1),
  timeForTimeAccrual: z.number().min(0).default(0),
  mondayHours: z.number().min(0).max(24).nullish(),
  tuesdayHours: z.number().min(0).max(24).nullish(),
  wednesdayHours: z.number().min(0).max(24).nullish(),
  thursdayHours: z.number().min(0).max(24).nullish(),
  fridayHours: z.number().min(0).max(24).nullish(),
  saturdayHours: z.number().min(0).max(24).nullish(),
  sundayHours: z.number().min(0).max(24).nullish(),
  isOnCall: z.boolean(),
  onCallObligation: z.boolean().nullish(),
  workScope: z.enum(['FULL_TIME', 'PART_TIME']).nullish(),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict().superRefine((value, context) => {
  if (value.averageHoursPerWeek > 50) {
    context.addIssue({ code: 'custom', path: ['averageHoursPerWeek'], message: 'WEEKLY_HOURS_INVALID' })
  }
  if (value.isOnCall && value.onCallObligation == null) {
    context.addIssue({ code: 'custom', path: ['onCallObligation'], message: 'ON_CALL_OBLIGATION_REQUIRED' })
  }
  if (!value.isOnCall && !value.workScope) {
    context.addIssue({ code: 'custom', path: ['workScope'], message: 'WORK_SCOPE_REQUIRED' })
  }
  if (!value.isOnCall && value.workScope === 'FULL_TIME' && Math.abs(value.partTimeFactor - 1) > 0.000001) {
    context.addIssue({ code: 'custom', path: ['partTimeFactor'], message: 'FULL_TIME_FACTOR_INVALID' })
  }
  const rosterHours = [
    value.mondayHours, value.tuesdayHours, value.wednesdayHours, value.thursdayHours,
    value.fridayHours, value.saturdayHours, value.sundayHours,
  ].reduce<number>((sum, hours) => sum + (hours ?? 0), 0)
  if (Math.abs(rosterHours - value.averageHoursPerWeek) > 0.0001) {
    context.addIssue({ code: 'custom', path: ['averageHoursPerWeek'], message: 'ROSTER_HOURS_MISMATCH' })
  }
})

const completeSalarySchema = z.object({
  paymentType: z.enum(['PERIODIC_FIXED', 'HOURLY_VARIABLE']),
  paymentFrequency: z.enum(['MONTHLY', 'FOUR_WEEKLY']),
  salaryBasis: z.enum(['MANUAL', 'MINIMUM_WAGE', 'CUSTOM_SCALE', 'CAO_SCALE']),
  fulltimeAmount: z.number().nonnegative().nullish(),
  parttimeAmount: z.number().nonnegative().nullish(),
  hourlyRate: z.number().nonnegative().nullish(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  salaryFrequencyId: databaseUuid,
  salaryScaleStepId: databaseUuid.nullish(),
  caoScaleName: z.string().trim().min(1).max(100).nullish(),
  caoStepName: z.string().trim().min(1).max(100).nullish(),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict().superRefine((value, context) => {
  if (value.paymentType === 'PERIODIC_FIXED' && value.fulltimeAmount == null) {
    context.addIssue({ code: 'custom', path: ['fulltimeAmount'], message: 'SALARY_AMOUNT_REQUIRED' })
  }
  if (value.paymentType === 'HOURLY_VARIABLE' && value.hourlyRate == null) {
    context.addIssue({ code: 'custom', path: ['hourlyRate'], message: 'HOURLY_RATE_REQUIRED' })
  }
  if (value.salaryBasis === 'CUSTOM_SCALE' && !value.salaryScaleStepId) {
    context.addIssue({ code: 'custom', path: ['salaryScaleStepId'], message: 'SALARY_SCALE_STEP_REQUIRED' })
  }
})

const completeCostAllocationSchema = z.object({
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
  allocations: z.array(z.object({
    costCenterId: databaseUuid,
    costCarrierId: databaseUuid,
    percentage: z.number().gt(0).max(100),
  }).strict()).min(1).max(50),
}).strict().superRefine((value, context) => {
  const total = value.allocations.reduce((sum, allocation) => sum + allocation.percentage, 0)
  if (Math.abs(total - 100) > 0.0001) {
    context.addIssue({ code: 'custom', path: ['allocations'], message: 'COST_ALLOCATION_TOTAL_INVALID' })
  }
})

export const completeEmploymentCreateSchema = z.object({
  employment: z.object({
    employmentNumber: z.string().trim().regex(/^\d+$/, 'EMPLOYMENT_NUMBER_INVALID').max(40),
    employmentType: z.enum(['EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'TEMPORARY_AGENCY', 'FREELANCER', 'VOLUNTEER', 'NO_PAYROLL']).default('EMPLOYEE'),
    startsOn: dateOnly,
    seniorityDate: dateOnly,
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    isPrimary: z.boolean(),
  }).strict(),
  incomeRelationship: completeIncomeRelationshipSchema.optional(),
  organization: completeOrganizationSchema.optional(),
  contract: completeContractSchema.optional(),
  schedule: completeScheduleSchema.optional(),
  salary: completeSalarySchema.optional(),
  costAllocation: completeCostAllocationSchema.optional(),
}).strict().superRefine((value, context) => {
  if (!value.contract) {
    if (value.incomeRelationship || value.organization || value.schedule || value.salary || value.costAllocation) {
      context.addIssue({ code: 'custom', path: ['contract'], message: 'CONTRACT_DETAILS_NOT_ALLOWED' })
    }
    return
  }
  if (!value.incomeRelationship) context.addIssue({ code: 'custom', path: ['incomeRelationship'], message: 'INCOME_RELATIONSHIP_REQUIRED' })
  if (!value.organization) context.addIssue({ code: 'custom', path: ['organization'], message: 'ORGANIZATION_REQUIRED' })
  if (!value.schedule) context.addIssue({ code: 'custom', path: ['schedule'], message: 'SCHEDULE_REQUIRED' })
  if (!value.costAllocation) context.addIssue({ code: 'custom', path: ['costAllocation'], message: 'COST_ALLOCATION_REQUIRED' })
  if (!value.incomeRelationship || !value.organization || !value.schedule || !value.costAllocation) return
  const startsOn = value.employment.startsOn
  const endsOn = value.contract.endsOn
  const dates = [
    ['incomeRelationship', value.incomeRelationship.validFrom],
    ['organization', value.organization.effectiveFrom],
    ['contract', value.contract.startsOn],
    ['schedule', value.schedule.validFrom],
    ['costAllocation', value.costAllocation.validFrom],
    ...(value.salary ? [['salary', value.salary.validFrom]] : []),
  ] as const
  for (const [field, date] of dates) {
    if (date !== startsOn) {
      context.addIssue({ code: 'custom', path: [field], message: 'INITIAL_TIMELINE_DATE_MISMATCH' })
    } else if (endsOn && date > endsOn) {
      context.addIssue({ code: 'custom', path: [field], message: 'TIMELINE_DATE_OUTSIDE_EMPLOYMENT' })
    }
  }
  if (value.employment.seniorityDate > startsOn) {
    context.addIssue({ code: 'custom', path: ['employment', 'seniorityDate'], message: 'SENIORITY_DATE_INVALID' })
  }
})

export const identityMatchSchema = z
  .object({
    bsn: z.string().max(20).optional(),
    birthDate: dateOnly.optional(),
    birthName: z.string().trim().min(1).max(120).optional(),
    initials: z.string().trim().max(20).optional(),
    privateEmail: z.email().max(254).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.bsn) {
      try {
        normalizeBsn(value.bsn)
      } catch {
        context.addIssue({ code: 'custom', path: ['bsn'], message: 'BSN_INVALID' })
      }
      return
    }
    if (!value.birthDate || !value.birthName) {
      context.addIssue({ code: 'custom', message: 'IDENTITY_SIGNALS_REQUIRED' })
    }
  })

export const terminationSchema = z
  .object({
    lastWorkingDay: dateOnly,
    internalReasonId: databaseUuid,
    statutoryReasonId: databaseUuid,
    initiator: z.enum(['EMPLOYER', 'EMPLOYEE', 'MUTUAL', 'BY_LAW', 'OTHER']),
    explanation: z.string().trim().max(2_000).nullish(),
  })
  .strict()

export type CreateEmploymentInput = z.infer<typeof createEmploymentSchema>
export type CompleteEmploymentCreateInput = z.infer<typeof completeEmploymentCreateSchema>
export type IdentityMatchInput = z.infer<typeof identityMatchSchema>
export type TerminationInput = z.infer<typeof terminationSchema>

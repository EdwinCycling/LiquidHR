import { z } from 'zod'
import { normalizeBsn } from '@/lib/security/bsn-fingerprint'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const employmentRequestShape = {
  employmentNumber: z.string().trim().min(1).max(40),
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
  .object({ employeeId: z.string().uuid(), ...employmentRequestShape })
  .strict()
  .superRefine(validateEmploymentDates)

const completeIncomeRelationshipSchema = z.object({
  ikvNumber: z.number().int().min(1).max(9999),
  payrollTaxSubnumber: z.string().trim().min(1).max(20),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict()

const completeOrganizationSchema = z.object({
  departmentId: z.string().uuid(),
  jobTitle: z.string().trim().min(1).max(160),
  managerEmployeeId: z.string().uuid().nullish(),
  directManagerDeputyId: z.string().uuid().nullish(),
  costBearer: z.string().trim().max(120).nullish(),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly.nullish(),
}).strict()

const completeLaborConditionSchema = z.object({
  conditionGroup: z.string().trim().min(1).max(160),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict()

const completeScheduleSchema = z.object({
  scheduleType: z.enum(['HOURS_PER_DAY', 'HOURS_AND_AVG_DAYS', 'HOURS_AND_SPECIFIC_DAYS', 'TIMES_PER_DAY']),
  startWeek: z.number().int().min(1).max(53).default(1),
  averageDaysPerWeek: z.number().min(0).max(7),
  averageHoursPerWeek: z.number().min(0).max(168),
  partTimeFactor: z.number().min(0).max(2),
  timeForTimeAccrual: z.number().min(0).default(0),
  mondayHours: z.number().min(0).max(24).nullish(),
  tuesdayHours: z.number().min(0).max(24).nullish(),
  wednesdayHours: z.number().min(0).max(24).nullish(),
  thursdayHours: z.number().min(0).max(24).nullish(),
  fridayHours: z.number().min(0).max(24).nullish(),
  saturdayHours: z.number().min(0).max(24).nullish(),
  sundayHours: z.number().min(0).max(24).nullish(),
  validFrom: dateOnly,
  validUntil: dateOnly.nullish(),
}).strict()

const completeSalarySchema = z.object({
  paymentType: z.enum(['PERIODIC_FIXED', 'HOURLY_VARIABLE']),
  paymentFrequency: z.enum(['MONTHLY', 'FOUR_WEEKLY']),
  salaryBasis: z.enum(['MANUAL', 'MINIMUM_WAGE', 'CUSTOM_SCALE', 'CAO_SCALE']),
  fulltimeAmount: z.number().nonnegative().nullish(),
  hourlyRate: z.number().nonnegative().nullish(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  salaryScaleStepId: z.string().uuid().nullish(),
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
    costCenterId: z.string().uuid(),
    percentage: z.number().gt(0).max(100),
  }).strict()).min(1).max(50),
}).strict().superRefine((value, context) => {
  const total = value.allocations.reduce((sum, allocation) => sum + allocation.percentage, 0)
  if (Math.abs(total - 100) > 0.0001) {
    context.addIssue({ code: 'custom', path: ['allocations'], message: 'COST_ALLOCATION_TOTAL_INVALID' })
  }
})

export const completeEmploymentCreateSchema = z.object({
  employment: createEmploymentRequestSchema,
  incomeRelationship: completeIncomeRelationshipSchema,
  organization: completeOrganizationSchema,
  laborCondition: completeLaborConditionSchema,
  schedule: completeScheduleSchema,
  salary: completeSalarySchema.optional(),
  costAllocation: completeCostAllocationSchema,
}).strict().superRefine((value, context) => {
  const startsOn = value.employment.startsOn
  const endsOn = value.employment.endsOn
  const dates = [
    ['incomeRelationship', value.incomeRelationship.validFrom],
    ['organization', value.organization.effectiveFrom],
    ['laborCondition', value.laborCondition.validFrom],
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
    internalReasonId: z.string().uuid(),
    statutoryReasonId: z.string().uuid(),
    initiator: z.enum(['EMPLOYER', 'EMPLOYEE', 'MUTUAL', 'BY_LAW', 'OTHER']),
    explanation: z.string().trim().max(2_000).nullish(),
  })
  .strict()

export type CreateEmploymentInput = z.infer<typeof createEmploymentSchema>
export type CompleteEmploymentCreateInput = z.infer<typeof completeEmploymentCreateSchema>
export type IdentityMatchInput = z.infer<typeof identityMatchSchema>
export type TerminationInput = z.infer<typeof terminationSchema>

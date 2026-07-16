import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableNumber = z.number().nonnegative().nullish()

const commonMutation = {
  effectiveOn: dateOnly,
  reason: z.string().trim().min(1).max(500),
  warningCodes: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  acknowledgements: z.record(z.string(), z.union([z.boolean(), z.string()])).default({}),
}

const laborConditionMutation = z.object({
  timeline: z.literal('LABOR_CONDITIONS'),
  ...commonMutation,
  payload: z.object({ conditionGroup: z.string().trim().min(1).max(160) }).strict(),
}).strict()

const scheduleMutation = z.object({
  timeline: z.literal('SCHEDULE'),
  ...commonMutation,
  payload: z.object({
    scheduleType: z.enum(['HOURS_PER_DAY', 'HOURS_AND_AVG_DAYS', 'HOURS_AND_SPECIFIC_DAYS', 'TIMES_PER_DAY']),
    startWeek: z.number().int().min(1).max(53).default(1),
    averageDaysPerWeek: z.number().min(0).max(7),
    averageHoursPerWeek: z.number().min(0).max(168),
    partTimeFactor: z.number().min(0).max(2),
    timeForTimeAccrual: z.number().min(0).default(0),
    mondayHours: nullableNumber, tuesdayHours: nullableNumber, wednesdayHours: nullableNumber,
    thursdayHours: nullableNumber, fridayHours: nullableNumber, saturdayHours: nullableNumber,
    sundayHours: nullableNumber,
  }).strict(),
}).strict()

const salaryPayload = z.object({
  paymentType: z.enum(['PERIODIC_FIXED', 'HOURLY_VARIABLE']),
  paymentFrequency: z.enum(['MONTHLY', 'FOUR_WEEKLY']),
  salaryBasis: z.enum(['MANUAL', 'MINIMUM_WAGE', 'CUSTOM_SCALE', 'CAO_SCALE']),
  fulltimeAmount: nullableNumber,
  hourlyRate: nullableNumber,
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  salaryScaleStepId: z.string().uuid().nullish(),
  caoScaleName: z.string().trim().min(1).max(100).nullish(),
  caoStepName: z.string().trim().min(1).max(100).nullish(),
}).strict().superRefine((value, context) => {
  if (value.paymentType === 'PERIODIC_FIXED' && value.fulltimeAmount === undefined) {
    context.addIssue({ code: 'custom', path: ['fulltimeAmount'], message: 'SALARY_AMOUNT_REQUIRED' })
  }
  if (value.paymentType === 'HOURLY_VARIABLE' && value.hourlyRate === undefined) {
    context.addIssue({ code: 'custom', path: ['hourlyRate'], message: 'HOURLY_RATE_REQUIRED' })
  }
  if (value.salaryBasis === 'CUSTOM_SCALE' && !value.salaryScaleStepId) {
    context.addIssue({ code: 'custom', path: ['salaryScaleStepId'], message: 'SALARY_SCALE_STEP_REQUIRED' })
  }
  if (value.salaryBasis === 'CAO_SCALE' && (!value.caoScaleName || !value.caoStepName)) {
    context.addIssue({ code: 'custom', path: ['caoScaleName'], message: 'CAO_SCALE_REQUIRED' })
  }
})

const salaryMutation = z.object({
  timeline: z.literal('SALARY'),
  ...commonMutation,
  payload: salaryPayload,
}).strict()

const costAllocationMutation = z.object({
  timeline: z.literal('COST_ALLOCATION'),
  ...commonMutation,
  payload: z.object({
    allocations: z.array(z.object({
      costCenterId: z.string().uuid(),
      percentage: z.number().gt(0).max(100),
    }).strict()).min(1).max(50),
  }).strict().superRefine((value, context) => {
    const total = value.allocations.reduce((sum, allocation) => sum + allocation.percentage, 0)
    if (Math.abs(total - 100) > 0.0001) {
      context.addIssue({ code: 'custom', path: ['allocations'], message: 'COST_ALLOCATION_TOTAL_INVALID' })
    }
  }),
}).strict()

export const timelineMutationSchema = z.discriminatedUnion('timeline', [
  laborConditionMutation, scheduleMutation, salaryMutation, costAllocationMutation,
])

const combinedTimelineMutationItemSchema = z.discriminatedUnion('timeline', [
  z.object({ timeline: z.literal('LABOR_CONDITIONS'), payload: z.object({ conditionGroup: z.string().trim().min(1).max(160) }).strict() }).strict(),
  z.object({ timeline: z.literal('SCHEDULE'), payload: z.object({
    scheduleType: z.enum(['HOURS_PER_DAY', 'HOURS_AND_AVG_DAYS', 'HOURS_AND_SPECIFIC_DAYS', 'TIMES_PER_DAY']),
    startWeek: z.number().int().min(1).max(53).default(1), averageDaysPerWeek: z.number().min(0).max(7), averageHoursPerWeek: z.number().min(0).max(168), partTimeFactor: z.number().min(0).max(2), timeForTimeAccrual: z.number().min(0).default(0),
    mondayHours: nullableNumber, tuesdayHours: nullableNumber, wednesdayHours: nullableNumber, thursdayHours: nullableNumber, fridayHours: nullableNumber, saturdayHours: nullableNumber, sundayHours: nullableNumber,
  }).strict() }).strict(),
  z.object({ timeline: z.literal('SALARY'), payload: salaryPayload }).strict(),
  z.object({ timeline: z.literal('COST_ALLOCATION'), payload: costAllocationMutation.shape.payload }).strict(),
])

export const combinedTimelineMutationSchema = z.object({
  effectiveOn: dateOnly,
  reason: z.string().trim().min(1).max(500),
  mutations: z.array(combinedTimelineMutationItemSchema).min(2).max(4).superRefine((items, context) => {
    if (new Set(items.map((item) => item.timeline)).size !== items.length) {
      context.addIssue({ code: 'custom', path: ['mutations'], message: 'COMBINED_TIMELINE_DUPLICATE' })
    }
  }),
  warningCodes: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  acknowledgements: z.record(z.string(), z.union([z.boolean(), z.string()])).default({}),
}).strict()

export const rollbackTimelineSchema = z.object({
  effectiveOn: dateOnly,
  reason: z.string().trim().min(1).max(500),
}).strict()

export const profileLinkSchema = z.object({
  linkType: z.enum(['LINKEDIN', 'WEBSITE', 'PORTFOLIO', 'GITHUB', 'OTHER']),
  label: z.string().trim().min(1).max(80),
  url: z.url().startsWith('https://').max(2_000),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1_000).default(0),
}).strict()

export const followUpSchema = z.object({
  changeSetId: z.string().uuid().optional(),
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).nullish(),
  responsibleRoleCode: z.string().trim().max(80).nullish(),
  responsibleUserId: z.string().uuid().nullish(),
  dueOn: dateOnly.nullish(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
}).strict()

export const chainAssessmentRequestSchema = z.object({
  proposed: z.object({
    startsOn: dateOnly,
    endsOn: dateOnly.nullish(),
    contractType: z.enum(['INDEFINITE', 'DEFINITE', 'ON_CALL', 'TEMPORARY_AGENCY', 'EXTERNAL']),
  }).strict(),
  historyComplete: z.boolean().default(true),
  exceptionCode: z.string().trim().min(1).max(100).nullish(),
}).strict()

export type TimelineMutationInput = z.infer<typeof timelineMutationSchema>
export type CombinedTimelineMutationInput = z.infer<typeof combinedTimelineMutationSchema>
export type RollbackTimelineInput = z.infer<typeof rollbackTimelineSchema>
export type ProfileLinkInput = z.infer<typeof profileLinkSchema>
export type FollowUpInput = z.infer<typeof followUpSchema>
export type ChainAssessmentRequestInput = z.infer<typeof chainAssessmentRequestSchema>

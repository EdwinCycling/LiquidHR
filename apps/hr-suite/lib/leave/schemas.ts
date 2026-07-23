import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const balanceReportQuerySchema = z.object({
  employmentId: z.string().trim().min(1).max(100).optional(),
  asOfDate: isoDate.optional(),
}).strict()

export type BalanceReportQuery = z.infer<typeof balanceReportQuerySchema>

const requestTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const leaveRequestPreviewQuerySchema = z.object({
  employeeId: z.string().trim().min(1).max(100),
  employmentId: z.string().trim().min(1).max(100).optional(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  mode: z.enum(['PRIORITY', 'DIRECT']).default('DIRECT'),
}).strict()

export type LeaveRequestPreviewQuery = z.infer<typeof leaveRequestPreviewQuerySchema>

export const leaveRequestConfirmSchema = z.object({
  employeeId: z.string().trim().min(1).max(100),
  employmentId: z.string().trim().min(1).max(100).optional(),
  mode: z.enum(['PRIORITY', 'DIRECT']),
  priorityRuleId: z.string().trim().min(1).max(100).nullable().optional(),
  leaveTypeId: z.string().trim().min(1).max(100).nullable().optional(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  timeMode: z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON', 'SPECIFIC_HOURS']),
  specificStart: requestTime.nullable().optional(),
  specificEnd: requestTime.nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict().superRefine((value, context) => {
  if (value.mode === 'DIRECT' && !value.leaveTypeId) context.addIssue({ code: 'custom', path: ['leaveTypeId'], message: 'LEAVE_TYPE_REQUIRED' })
  if (value.mode === 'PRIORITY' && !value.priorityRuleId) context.addIssue({ code: 'custom', path: ['priorityRuleId'], message: 'LEAVE_PRIORITY_RULE_REQUIRED' })
  if (value.timeMode === 'SPECIFIC_HOURS' && (!value.specificStart || !value.specificEnd)) context.addIssue({ code: 'custom', path: ['specificStart'], message: 'LEAVE_TIME_SELECTION_INVALID' })
  if (value.timeMode !== 'SPECIFIC_HOURS' && (value.specificStart || value.specificEnd)) context.addIssue({ code: 'custom', path: ['specificStart'], message: 'LEAVE_TIME_SELECTION_INVALID' })
  if ((value.endDate ?? value.startDate) < value.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'LEAVE_PERIOD_INVALID' })
}).transform((value) => ({ ...value, endDate: value.endDate ?? value.startDate }))

export type LeaveRequestConfirmInput = z.infer<typeof leaveRequestConfirmSchema>

const leaveTypeInput = z.object({
  action: z.literal('LEAVE_TYPE'),
  name: z.string().trim().min(1).max(160),
  colorCode: z.string().trim().min(1).max(32),
  scope: z.enum(['STATUTORY', 'NON_STATUTORY', 'ADV', 'OTHER']),
  entitlementMode: z.enum(['ACCRUAL', 'UNLIMITED', 'ANNUAL_HOURS_CAP', 'WEEKLY_HOURS_FACTOR_CAP']),
  annualHoursCap: z.number().finite().nonnegative().nullable().optional(),
  weeklyHoursCapFactor: z.number().finite().nonnegative().nullable().optional(),
  isSelfService: z.boolean().default(true),
  isActive: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (value.entitlementMode === 'ANNUAL_HOURS_CAP' && value.annualHoursCap === undefined) context.addIssue({ code: 'custom', path: ['annualHoursCap'], message: 'LEAVE_ANNUAL_CAP_REQUIRED' })
  if (value.entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' && value.weeklyHoursCapFactor === undefined) context.addIssue({ code: 'custom', path: ['weeklyHoursCapFactor'], message: 'LEAVE_WEEKLY_FACTOR_REQUIRED' })
  if (value.entitlementMode !== 'ANNUAL_HOURS_CAP' && value.annualHoursCap !== undefined && value.annualHoursCap !== null) context.addIssue({ code: 'custom', path: ['annualHoursCap'], message: 'LEAVE_ANNUAL_CAP_NOT_ALLOWED' })
  if (value.entitlementMode !== 'WEEKLY_HOURS_FACTOR_CAP' && value.weeklyHoursCapFactor !== undefined && value.weeklyHoursCapFactor !== null) context.addIssue({ code: 'custom', path: ['weeklyHoursCapFactor'], message: 'LEAVE_WEEKLY_FACTOR_NOT_ALLOWED' })
})

const workHourTypeInput = z.object({
  action: z.literal('WORK_HOUR_TYPE'),
  name: z.string().trim().min(1).max(160),
  colorCode: z.string().trim().min(1).max(32),
  category: z.enum(['REGULAR_WORK', 'OVERTIME', 'INFORMATIONAL']),
  isActive: z.boolean().default(true),
}).strict()

const leaveProfileInput = z.object({
  action: z.literal('PROFILE'),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
}).strict()

export const leaveCatalogMutationSchema = z.discriminatedUnion('action', [leaveTypeInput, workHourTypeInput, leaveProfileInput])
export type LeaveCatalogMutation = z.infer<typeof leaveCatalogMutationSchema>

const commonRuleFields = {
  leaveProfileId: z.string().trim().min(1).max(100),
  leaveTypeId: z.string().trim().min(1).max(100),
  validFrom: isoDate,
  validUntil: isoDate.nullable().optional(),
  accrualBasis: z.enum(['CONTRACT_HOURS', 'WORKED_HOURS']),
  accrualFrequency: z.enum(['PAYROLL_PERIOD', 'YEARLY']),
  accrualTiming: z.enum(['UPFRONT', 'ARREARS']),
  accrualAmount: z.number().finite().nonnegative().nullable().optional(),
  accrualRate: z.number().finite().nonnegative().nullable().optional(),
  expirationMonths: z.number().int().min(0).max(120),
  workHourTypeIds: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  pauseLeaveTypeIds: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
}

const accrualRuleInput = z.object({
  action: z.literal('ACCRUAL_RULE'),
  ...commonRuleFields,
  predecessorRuleId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.accrualBasis === 'CONTRACT_HOURS' && value.accrualAmount === undefined) context.addIssue({ code: 'custom', path: ['accrualAmount'], message: 'LEAVE_ACCRUAL_AMOUNT_REQUIRED' })
  if (value.accrualBasis === 'WORKED_HOURS' && value.accrualRate === undefined) context.addIssue({ code: 'custom', path: ['accrualRate'], message: 'LEAVE_ACCRUAL_RATE_REQUIRED' })
  if (value.accrualBasis === 'CONTRACT_HOURS' && value.accrualRate !== undefined && value.accrualRate !== null) context.addIssue({ code: 'custom', path: ['accrualRate'], message: 'LEAVE_ACCRUAL_RATE_NOT_ALLOWED' })
  if (value.accrualBasis === 'WORKED_HOURS' && value.accrualAmount !== undefined && value.accrualAmount !== null) context.addIssue({ code: 'custom', path: ['accrualAmount'], message: 'LEAVE_ACCRUAL_AMOUNT_NOT_ALLOWED' })
  if (value.accrualBasis === 'WORKED_HOURS' && value.workHourTypeIds.length === 0) context.addIssue({ code: 'custom', path: ['workHourTypeIds'], message: 'LEAVE_WORK_HOUR_TYPE_REQUIRED' })
})

const exceptionInput = z.object({
  action: z.literal('ACCRUAL_EXCEPTION'),
  employeeId: z.string().trim().min(1).max(100),
  employmentId: z.string().trim().min(1).max(100),
  leaveTypeId: z.string().trim().min(1).max(100),
  validFrom: isoDate,
  validUntil: isoDate.nullable().optional(),
  noAccrual: z.boolean().default(false),
  accrualAmount: z.number().finite().nonnegative().nullable().optional(),
  expirationMonths: z.number().int().min(0).max(120).nullable().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict().superRefine((value, context) => {
  if (value.noAccrual && value.accrualAmount !== undefined && value.accrualAmount !== null) context.addIssue({ code: 'custom', path: ['accrualAmount'], message: 'LEAVE_EXCEPTION_AMOUNT_NOT_ALLOWED' })
})

const bonusRuleInput = z.object({
  action: z.literal('BONUS_RULE'),
  leaveProfileId: z.string().trim().min(1).max(100),
  leaveTypeId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(160),
  triggerType: z.enum(['AGE', 'SENIORITY']),
  awardTiming: z.enum(['START_OF_YEAR', 'ON_TRIGGER_DATE']),
  proRateFirstYear: z.boolean().default(true),
  isActive: z.boolean().default(true),
  tiers: z.array(z.object({ thresholdYears: z.number().int().min(0).max(100), bonusAmount: z.number().finite().nonnegative() }).strict()).min(1).max(100),
}).strict()

const priorityRuleFields = {
  leaveProfileId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(160),
  validFrom: isoDate,
  validUntil: isoDate.nullable().optional(),
  isActive: z.boolean().default(true),
  items: z.array(z.object({ leaveTypeId: z.string().trim().min(1).max(100), sortOrder: z.number().int().positive() }).strict()).min(1).max(100),
}

const priorityItemsRefinement = (value: { items: Array<{ leaveTypeId: string; sortOrder: number }>; validFrom: string; validUntil?: string | null }, context: z.RefinementCtx) => {
  const leaveTypeIds = new Set(value.items.map((item) => item.leaveTypeId))
  const sortOrders = value.items.map((item) => item.sortOrder).sort((a, b) => a - b)
  if (leaveTypeIds.size !== value.items.length) context.addIssue({ code: 'custom', path: ['items'], message: 'LEAVE_PRIORITY_DUPLICATE_TYPE' })
  if (sortOrders.some((sortOrder, index) => sortOrder !== index + 1)) context.addIssue({ code: 'custom', path: ['items'], message: 'LEAVE_PRIORITY_ORDER_NOT_CONTIGUOUS' })
  if (value.validUntil && value.validUntil <= value.validFrom) context.addIssue({ code: 'custom', path: ['validUntil'], message: 'LEAVE_PRIORITY_PERIOD_INVALID' })
}

const priorityRuleInput = z.object({ action: z.literal('PRIORITY_RULE'), ...priorityRuleFields }).strict().superRefine(priorityItemsRefinement)

const priorityRuleUpdateInput = z.object({
  action: z.literal('UPDATE_PRIORITY_RULE'),
  id: z.string().trim().min(1).max(100),
  ...priorityRuleFields,
}).strict().superRefine(priorityItemsRefinement)

const profileAssignmentInput = z.object({
  action: z.literal('PROFILE_ASSIGNMENT'),
  employeeId: z.string().trim().min(1).max(100),
  employmentId: z.string().trim().min(1).max(100),
  leaveProfileId: z.string().trim().min(1).max(100),
  validFrom: isoDate,
  validUntil: isoDate.nullable().optional(),
}).strict()

const catalogUpdateInput = z.object({
  action: z.enum(['UPDATE_LEAVE_TYPE', 'UPDATE_WORK_HOUR_TYPE', 'UPDATE_PROFILE']),
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(160).optional(),
  colorCode: z.string().trim().min(1).max(32).optional(),
  scope: z.enum(['STATUTORY', 'NON_STATUTORY', 'ADV', 'OTHER']).optional(),
  entitlementMode: z.enum(['ACCRUAL', 'UNLIMITED', 'ANNUAL_HOURS_CAP', 'WEEKLY_HOURS_FACTOR_CAP']).optional(),
  annualHoursCap: z.number().finite().nonnegative().nullable().optional(),
  weeklyHoursCapFactor: z.number().finite().nonnegative().nullable().optional(),
  category: z.enum(['REGULAR_WORK', 'OVERTIME', 'INFORMATIONAL']).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isSelfService: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict()

const archiveInput = z.object({
  action: z.enum(['ARCHIVE_LEAVE_TYPE', 'ARCHIVE_WORK_HOUR_TYPE', 'ARCHIVE_PROFILE']),
  id: z.string().trim().min(1).max(100),
}).strict()

export const leaveConfigurationMutationSchema = z.discriminatedUnion('action', [accrualRuleInput, exceptionInput, bonusRuleInput, priorityRuleInput, priorityRuleUpdateInput, profileAssignmentInput, catalogUpdateInput, archiveInput])
export type LeaveConfigurationMutation = z.infer<typeof leaveConfigurationMutationSchema>

const openingBalanceInput = z.object({
  action: z.literal('OPENING_BALANCE'),
  employeeId: z.string().trim().min(1).max(100),
  employmentId: z.string().trim().min(1).max(100),
  leaveTypeId: z.string().trim().min(1).max(100),
  amount: z.number().finite().positive(),
  startDate: isoDate,
  reason: z.string().trim().min(1).max(500),
  sourceKey: z.string().trim().min(8).max(160),
}).strict()

const manualAdjustmentInput = z.object({
  action: z.literal('MANUAL_ADJUSTMENT'),
  employeeId: z.string().trim().min(1).max(100),
  employmentId: z.string().trim().min(1).max(100),
  leaveTypeId: z.string().trim().min(1).max(100),
  accrualYear: z.number().int().min(2000).max(2200),
  amount: z.number().finite().refine((value) => value !== 0, 'LEAVE_MANUAL_ADJUSTMENT_AMOUNT_REQUIRED'),
  reason: z.string().trim().min(1).max(500),
  sourceKey: z.string().trim().min(8).max(160),
}).strict()

const closeYearInput = z.object({
  action: z.literal('CLOSE_YEAR'),
  year: z.number().int().min(2000).max(2199),
}).strict()

export const leaveLedgerMutationSchema = z.discriminatedUnion('action', [openingBalanceInput, manualAdjustmentInput, closeYearInput])
export type LeaveLedgerMutation = z.infer<typeof leaveLedgerMutationSchema>

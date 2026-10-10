import { z } from 'zod'
import { listMyTalentGoalCheckIns, type TalentGoalCheckInMetadata } from '@/lib/talent/check-in-service'
import { listMyTalentEmployeeCapabilityRecords, type TalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'
import { listTalentGoals, type TalentGoal } from '@/lib/talent/goal-service'
import { listTalentCurrentRoleProfileWorkspace, type TalentRoleExplorerAxis } from '@/lib/talent/role-explorer-service'
import { readSelfDevelopmentPlans } from '@/lib/api-v1/resources/development-plans'
import { selfDevelopmentPlansProjectionSchema } from '@/lib/api-v1/resources/projections'
import { getLeaveBalanceReport, LeaveServiceError } from '@/lib/leave/leave-service'
import { getMyNextApprovedLeave, listMyLeaveRequests } from '@/lib/leave/employee-self-service'
import { listMyReminders } from '@/lib/reminders/reminder-service'
import { defineWorkforceTool, type DelegatedWorkforceToolExecutionContext } from './contracts'

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestampSchema = z.string().min(1)
const leaveStatusSchema = z.enum(['PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'])
const leaveTimeModeSchema = z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON', 'SPECIFIC_HOURS'])
const leaveEntitlementSchema = z.enum(['ACCRUAL', 'UNLIMITED', 'ANNUAL_HOURS_CAP', 'ANNUAL_HOURS_FTE_CAP', 'OVERTIME_HOURS'])

const goalStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'])
const goalSourceTypeSchema = z.enum(['SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED'])
const capabilitySourceTypeSchema = z.enum(['SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED', 'IMPORTED'])
const capabilityStatusSchema = z.enum(['DRAFT', 'RELEASED', 'EXPIRED', 'ARCHIVED'])
const checkInEntryTypeSchema = z.enum(['EMPLOYEE_REFLECTION', 'MANAGER_OBSERVATION', 'FOLLOW_UP'])
const checkInStatusSchema = z.enum(['OPEN', 'COMPLETED', 'CANCELLED'])

const developmentPlanSchema = z.object({
  goalId: uuidSchema,
  title: z.string().min(1),
  capability: z.string().nullable(),
  periodStart: dateSchema,
  periodEnd: dateSchema.nullable(),
  progressPercent: z.number().int().min(0).max(100),
  status: goalStatusSchema,
  sourceType: goalSourceTypeSchema,
  completedAt: timestampSchema.nullable(),
  archivedAt: timestampSchema.nullable(),
}).strict()

const developmentProgressSchema = z.object({
  title: z.string().min(1),
  periodStart: dateSchema,
  periodEnd: dateSchema.nullable(),
  progressPercent: z.number().int().min(0).max(100),
  status: goalStatusSchema,
}).strict()

const capabilitySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  levelCode: z.string().nullable(),
  levelName: z.string().nullable(),
  languageLevel: z.string().nullable(),
  languageIsNative: z.boolean(),
  certificateStatus: z.string().nullable(),
  evidenceStatus: z.string().nullable(),
  sourceType: capabilitySourceTypeSchema,
  status: capabilityStatusSchema,
  validFrom: dateSchema,
  validUntil: dateSchema.nullable(),
  updatedAt: timestampSchema,
}).strict()

const developmentGapSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  capabilityType: z.string().min(1),
  requirementType: z.string().min(1),
  targetLevelCode: z.string().nullable(),
  targetLevelRank: z.number().int().nullable(),
  targetLanguageLevel: z.string().nullable(),
  currentLevelCode: z.string().nullable(),
  currentLevelRank: z.number().int().nullable(),
  currentLanguageLevel: z.string().nullable(),
  status: z.enum(['GAP', 'MISSING_EVIDENCE', 'UNKNOWN']),
  validFrom: dateSchema.nullable(),
  validUntil: dateSchema.nullable(),
}).strict()

const checkInSchema = z.object({
  goalId: uuidSchema,
  entryType: checkInEntryTypeSchema,
  followUpDueOn: dateSchema.nullable(),
  status: checkInStatusSchema,
  createdAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
}).strict()

const emptyInputSchema = z.object({}).strict()
const goalCheckInsInputSchema = z.object({ goalId: uuidSchema }).strict()

export const employeeDevelopmentPlansOutputSchema = z.object({
  plans: z.array(developmentPlanSchema),
}).strict()

export const employeeRemoteDevelopmentPlansOutputSchema = z.object({
  plans: selfDevelopmentPlansProjectionSchema,
}).strict()

export const employeeDevelopmentProgressOutputSchema = z.object({
  plans: z.array(developmentProgressSchema),
}).strict()

export const employeeSkillsOutputSchema = z.object({
  skills: z.array(capabilitySchema),
}).strict()

export const employeeCompetenciesOutputSchema = z.object({
  competencies: z.array(capabilitySchema),
}).strict()

export const employeeDevelopmentGapsOutputSchema = z.object({
  asOf: dateSchema,
  gaps: z.array(developmentGapSchema),
}).strict()

export const employeeGoalCheckInsOutputSchema = z.object({
  checkIns: z.array(checkInSchema),
}).strict()

const leaveBalanceEntrySchema = z.object({
  leaveType: z.string().min(1),
  availableHours: z.number().finite().nullable(),
  unit: z.literal('hours'),
  entitlementMode: leaveEntitlementSchema,
  expiring: z.array(z.object({
    expiresOn: dateSchema,
    remainingHours: z.number().finite(),
    daysUntilExpiration: z.number().int(),
  }).strict()),
}).strict()

const leaveEmploymentOptionSchema = z.object({
  id: uuidSchema,
  employmentNumber: z.string().nullable(),
  startsOn: dateSchema,
  endsOn: dateSchema.nullable(),
  administrationName: z.string().nullable(),
  departmentName: z.string().nullable(),
  functionName: z.string().nullable(),
}).strict()

export const employeeLeaveBalanceOutputSchema = z.discriminatedUnion('selectionRequired', [
  z.object({
    selectionRequired: z.literal(false),
    asOf: dateSchema,
    sourceTruncated: z.boolean(),
    employmentId: uuidSchema,
    balances: z.array(leaveBalanceEntrySchema),
  }).strict(),
  z.object({
    selectionRequired: z.literal(true),
    asOf: dateSchema,
    employmentOptions: z.array(leaveEmploymentOptionSchema).min(2),
  }).strict(),
])

const employeeLeaveRequestSchema = z.object({
  requestId: uuidSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  requestedHours: z.number().finite().nonnegative(),
  status: leaveStatusSchema,
  timeMode: leaveTimeModeSchema,
  leaveTypes: z.array(z.object({ name: z.string().min(1), hours: z.number().finite().nonnegative() }).strict()),
}).strict()

export const employeeLeaveRequestsOutputSchema = z.object({
  asOf: dateSchema,
  requests: z.array(employeeLeaveRequestSchema),
  sourceTruncated: z.boolean(),
}).strict()

export const employeeNextLeaveOutputSchema = z.object({
  asOf: dateSchema,
  nextLeave: employeeLeaveRequestSchema.nullable(),
}).strict()

export const employeeRemindersOutputSchema = z.object({
  timeZone: z.literal('Europe/Amsterdam'),
  reminders: z.array(z.object({
    title: z.string().min(1),
    description: z.string().nullable(),
    remindAt: timestampSchema,
    originalRemindAt: timestampSchema,
    status: z.enum(['PENDING', 'COMPLETED', 'DISMISSED']),
    isOverdue: z.boolean(),
  }).strict()),
}).strict()

function mapDevelopmentPlan(goal: TalentGoal): z.infer<typeof developmentPlanSchema> {
  return {
    goalId: goal.id,
    title: goal.title,
    capability: goal.capabilityLabel,
    periodStart: goal.period_start,
    periodEnd: goal.period_end,
    progressPercent: goal.progress_percent,
    status: goalStatusSchema.parse(goal.status),
    sourceType: goalSourceTypeSchema.parse(goal.source_type),
    completedAt: goal.completed_at,
    archivedAt: goal.archived_at,
  }
}

function mapDevelopmentProgress(goal: TalentGoal): z.infer<typeof developmentProgressSchema> {
  return {
    title: goal.title,
    periodStart: goal.period_start,
    periodEnd: goal.period_end,
    progressPercent: goal.progress_percent,
    status: goalStatusSchema.parse(goal.status),
  }
}

function mapCapability(record: TalentEmployeeCapabilityRecord): z.infer<typeof capabilitySchema> {
  return {
    code: record.capabilityCode,
    name: record.capabilityName,
    levelCode: record.talentLevelCode,
    levelName: record.talentLevelName,
    languageLevel: record.languageLevel,
    languageIsNative: record.languageIsNative,
    certificateStatus: record.certificateStatus,
    evidenceStatus: record.evidenceStatus,
    sourceType: capabilitySourceTypeSchema.parse(record.sourceType),
    status: capabilityStatusSchema.parse(record.status),
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    updatedAt: record.updatedAt,
  }
}

function mapDevelopmentGap(axis: TalentRoleExplorerAxis): z.infer<typeof developmentGapSchema> {
  return {
    code: axis.capabilityCode,
    name: axis.capabilityName,
    capabilityType: axis.capabilityType,
    requirementType: axis.requirementType,
    targetLevelCode: axis.targetLevelCode,
    targetLevelRank: axis.targetLevelRank,
    targetLanguageLevel: axis.targetLanguageLevel,
    currentLevelCode: axis.currentLevelCode,
    currentLevelRank: axis.currentLevelRank,
    currentLanguageLevel: axis.currentLanguageLevel,
    status: axis.status === 'MATCH' ? 'UNKNOWN' : axis.status,
    validFrom: axis.validFrom,
    validUntil: axis.validUntil,
  }
}

function mapCheckIn(checkIn: TalentGoalCheckInMetadata): z.infer<typeof checkInSchema> {
  return {
    goalId: checkIn.goal_id,
    entryType: checkInEntryTypeSchema.parse(checkIn.entry_type),
    followUpDueOn: checkIn.follow_up_due_on,
    status: checkInStatusSchema.parse(checkIn.status),
    createdAt: checkIn.created_at,
    completedAt: checkIn.completed_at,
  }
}

const employeeToolMetadata = {
  audience: ['EMPLOYEE'] as const,
  scope: 'SELF' as const,
  operation: 'READ' as const,
  module: 'TALENT' as const,
}

const employeeLeaveToolMetadata = {
  audience: ['EMPLOYEE'] as const,
  scope: 'SELF' as const,
  operation: 'READ' as const,
  module: 'HERA' as const,
}

const employeeReminderToolMetadata = {
  audience: ['EMPLOYEE'] as const,
  scope: 'SELF' as const,
  operation: 'READ' as const,
  module: 'REMINDERS' as const,
}

const leaveBalanceInputSchema = z.object({ employmentId: uuidSchema.optional() }).strict()

async function readEmployeeLeaveBalance(
  input: z.output<typeof leaveBalanceInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
) {
  const dependencies = delegated
    ? { context: delegated.authContext, supabase: delegated.rls.client }
    : undefined
  try {
    const result = await getLeaveBalanceReport({ employmentId: input.employmentId }, dependencies)
    return {
      selectionRequired: false as const,
      asOf: result.report.asOfDate,
      sourceTruncated: result.sourceTruncated,
      employmentId: result.report.employmentId,
      balances: result.report.leaveTypes.map((type) => ({
        leaveType: type.name,
        availableHours: type.currentBalance,
        unit: 'hours' as const,
        entitlementMode: type.entitlementMode,
        expiring: type.expirationBuckets.map((bucket) => ({
          expiresOn: bucket.expirationDate,
          remainingHours: bucket.remainingHours,
          daysUntilExpiration: bucket.daysUntilExpiration,
        })),
      })),
    }
  } catch (error) {
    if (!(error instanceof LeaveServiceError) || error.code !== 'LEAVE_EMPLOYMENT_SELECTION_REQUIRED') throw error
    const selection = z.object({ options: z.array(leaveEmploymentOptionSchema).min(2) }).safeParse(error.details)
    if (!selection.success) throw error
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value
    const year = part('year')
    const month = part('month')
    const day = part('day')
    if (!year || !month || !day) throw new Error('LEAVE_AS_OF_UNAVAILABLE')
    return {
      selectionRequired: true as const,
      asOf: `${year}-${month}-${day}`,
      employmentOptions: selection.data.options,
    }
  }
}

async function readEmployeeLeaveRequests(delegated?: DelegatedWorkforceToolExecutionContext) {
  const dependencies = delegated
    ? { context: delegated.authContext, supabase: delegated.rls.client }
    : undefined
  const result = await listMyLeaveRequests(dependencies)
  return { asOf: result.asOfDate, requests: result.requests, sourceTruncated: result.sourceTruncated }
}

async function readEmployeeNextLeave(delegated?: DelegatedWorkforceToolExecutionContext) {
  const dependencies = delegated
    ? { context: delegated.authContext, supabase: delegated.rls.client }
    : undefined
  const result = await getMyNextApprovedLeave(dependencies)
  return { asOf: result.asOfDate, nextLeave: result.nextLeave }
}

async function readEmployeeReminders(delegated?: DelegatedWorkforceToolExecutionContext) {
  const now = new Date()
  const dependencies = delegated
    ? { context: delegated.authContext, supabase: delegated.rls.client }
    : undefined
  const reminders = await listMyReminders(100, dependencies)
  return {
    timeZone: 'Europe/Amsterdam' as const,
    reminders: reminders
      .filter((item) => item.type === 'PERSONAL' && item.recipientStatus === 'PENDING' && item.reminderStatus !== 'CANCELLED')
      .map((item) => ({
        title: item.title,
        description: item.description,
        remindAt: item.remindAt,
        originalRemindAt: item.originalRemindAt,
        status: item.recipientStatus,
        isOverdue: new Date(item.remindAt).getTime() < now.getTime(),
      })),
  }
}

export const employeeDevelopmentPlansTool = defineWorkforceTool({
  ...employeeToolMetadata,
  id: 'employee.talent.development-plans.read',
  description: 'Lees de eigen ontwikkelplannen met hun actuele status en voortgang.',
  permission: 'self:talent-goal:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeDevelopmentPlansOutputSchema,
  delegatedOutputSchema: employeeRemoteDevelopmentPlansOutputSchema,
  handler: async () => {
    const workspace = await listTalentGoals('self')
    return { plans: workspace.goals.map(mapDevelopmentPlan) }
  },
  delegatedHandler: async (_input, context: DelegatedWorkforceToolExecutionContext) => ({
    plans: await readSelfDevelopmentPlans({ authContext: context.authContext, rls: context.rls }),
  }),
})

export const employeeDevelopmentProgressTool = defineWorkforceTool({
  ...employeeToolMetadata,
  id: 'employee.talent.development-progress.read',
  description: 'Lees de actuele voortgang van de eigen ontwikkelplannen.',
  permission: 'self:talent-goal:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeDevelopmentProgressOutputSchema,
  handler: async () => {
    const workspace = await listTalentGoals('self')
    return { plans: workspace.goals.map(mapDevelopmentProgress) }
  },
})

export const employeeSkillsTool = defineWorkforceTool({
  ...employeeToolMetadata,
  id: 'employee.talent.skills.read',
  description: 'Lees de eigen geregistreerde vaardigheden.',
  permission: 'self:talent-record:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeSkillsOutputSchema,
  delegatedOutputSchema: employeeSkillsOutputSchema,
  handler: async () => {
    const records = await listMyTalentEmployeeCapabilityRecords()
    return {
      skills: records
        .filter((record) => record.capabilityType === 'SKILL')
        .map(mapCapability),
    }
  },
  delegatedHandler: async (_input, context: DelegatedWorkforceToolExecutionContext) => {
    const records = await listMyTalentEmployeeCapabilityRecords(context)
    return {
      skills: records
        .filter((record) => record.capabilityType === 'SKILL')
        .map(mapCapability),
    }
  },
})

export const employeeCompetenciesTool = defineWorkforceTool({
  ...employeeToolMetadata,
  id: 'employee.talent.competencies.read',
  description: 'Lees de eigen geregistreerde competenties.',
  permission: 'self:talent-record:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeCompetenciesOutputSchema,
  delegatedOutputSchema: employeeCompetenciesOutputSchema,
  handler: async () => {
    const records = await listMyTalentEmployeeCapabilityRecords()
    return {
      competencies: records
        .filter((record) => record.capabilityType === 'COMPETENCY')
        .map(mapCapability),
    }
  },
  delegatedHandler: async (_input, context: DelegatedWorkforceToolExecutionContext) => {
    const records = await listMyTalentEmployeeCapabilityRecords(context)
    return {
      competencies: records
        .filter((record) => record.capabilityType === 'COMPETENCY')
        .map(mapCapability),
    }
  },
})

export const employeeDevelopmentGapsTool = defineWorkforceTool({
  ...employeeToolMetadata,
  id: 'employee.talent.development-gaps.read',
  description: 'Lees de eigen ontwikkelpunten uit het actuele functieprofiel.',
  permission: 'self:talent-comparison:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeDevelopmentGapsOutputSchema,
  delegatedOutputSchema: employeeDevelopmentGapsOutputSchema,
  handler: async () => {
    const workspace = await listTalentCurrentRoleProfileWorkspace()
    const axes = workspace.comparison?.axes ?? []
    return {
      asOf: workspace.asOf,
      gaps: axes
        .filter((axis) => axis.status !== 'MATCH')
        .map(mapDevelopmentGap),
    }
  },
  delegatedHandler: async (_input, context: DelegatedWorkforceToolExecutionContext) => {
    const workspace = await listTalentCurrentRoleProfileWorkspace(context)
    const axes = workspace.comparison?.axes ?? []
    return {
      asOf: workspace.asOf,
      gaps: axes
        .filter((axis) => axis.status !== 'MATCH')
        .map(mapDevelopmentGap),
    }
  },
})

export const employeeGoalCheckInsTool = defineWorkforceTool({
  ...employeeToolMetadata,
  id: 'employee.talent.goal-check-ins.read',
  description: 'Lees de eigen voortgangsmetadata van een ontwikkelplan.',
  permission: 'self:talent-goal:read',
  inputSchema: goalCheckInsInputSchema,
  outputSchema: employeeGoalCheckInsOutputSchema,
  handler: async ({ goalId }) => ({
    checkIns: (await listMyTalentGoalCheckIns(goalId)).map(mapCheckIn),
  }),
})

export const employeeLeaveBalanceTool = defineWorkforceTool({
  ...employeeLeaveToolMetadata,
  id: 'employee.leave.balance.read',
  description: 'Lees je eigen actuele verlofsaldo per verloftype, met peildatum en beschikbare vervalinformatie.',
  permission: 'self:leave:read',
  inputSchema: leaveBalanceInputSchema,
  outputSchema: employeeLeaveBalanceOutputSchema,
  handler: async (input) => readEmployeeLeaveBalance(input),
  delegatedHandler: async (input, context) => readEmployeeLeaveBalance(input, context),
})

export const employeeNextLeaveTool = defineWorkforceTool({
  ...employeeLeaveToolMetadata,
  id: 'employee.leave.next.read',
  description: 'Lees je eerstvolgende toekomstige, goedgekeurde verlofaanvraag.',
  permission: 'self:leave:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeNextLeaveOutputSchema,
  handler: async () => readEmployeeNextLeave(),
  delegatedHandler: async (_input, context) => readEmployeeNextLeave(context),
})

export const employeeLeaveRequestsTool = defineWorkforceTool({
  ...employeeLeaveToolMetadata,
  id: 'employee.leave.requests.read',
  description: 'Lees je eigen lopende en goedgekeurde verlofaanvragen met status en periode.',
  permission: 'self:leave:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeLeaveRequestsOutputSchema,
  handler: async () => readEmployeeLeaveRequests(),
  delegatedHandler: async (_input, context) => readEmployeeLeaveRequests(context),
})

export const employeeRemindersTool = defineWorkforceTool({
  ...employeeReminderToolMetadata,
  id: 'employee.reminders.read',
  description: 'Lees alleen je eigen persoonlijke reminders en hun actuele status.',
  permission: 'self:reminder:read',
  inputSchema: emptyInputSchema,
  outputSchema: employeeRemindersOutputSchema,
  handler: async () => readEmployeeReminders(),
  delegatedHandler: async (_input, context) => readEmployeeReminders(context),
})

export const EMPLOYEE_WORKFORCE_TOOLS = [
  employeeDevelopmentPlansTool,
  employeeDevelopmentProgressTool,
  employeeSkillsTool,
  employeeCompetenciesTool,
  employeeDevelopmentGapsTool,
  employeeGoalCheckInsTool,
  employeeLeaveBalanceTool,
  employeeNextLeaveTool,
  employeeLeaveRequestsTool,
  employeeRemindersTool,
] as const

export const employeeWorkforceTools = EMPLOYEE_WORKFORCE_TOOLS

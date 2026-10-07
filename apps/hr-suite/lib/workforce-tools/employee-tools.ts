import { z } from 'zod'
import { listMyTalentGoalCheckIns, type TalentGoalCheckInMetadata } from '@/lib/talent/check-in-service'
import { listMyTalentEmployeeCapabilityRecords, type TalentEmployeeCapabilityRecord } from '@/lib/talent/employee-capability-service'
import { listTalentGoals, type TalentGoal } from '@/lib/talent/goal-service'
import { listTalentCurrentRoleProfileWorkspace, type TalentRoleExplorerAxis } from '@/lib/talent/role-explorer-service'
import { readSelfDevelopmentPlans } from '@/lib/api-v1/resources/development-plans'
import { selfDevelopmentPlansProjectionSchema } from '@/lib/api-v1/resources/projections'
import { defineWorkforceTool, type DelegatedWorkforceToolExecutionContext } from './contracts'

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timestampSchema = z.string().min(1)

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

export const EMPLOYEE_WORKFORCE_TOOLS = [
  employeeDevelopmentPlansTool,
  employeeDevelopmentProgressTool,
  employeeSkillsTool,
  employeeCompetenciesTool,
  employeeDevelopmentGapsTool,
  employeeGoalCheckInsTool,
] as const

export const employeeWorkforceTools = EMPLOYEE_WORKFORCE_TOOLS

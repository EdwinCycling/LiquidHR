import { z } from 'zod'
import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { listFocusManagerTeamOverviewForContext, listFocusManagerUpcomingApprovedVacationForContext } from '@/lib/focus/manager-home-service'
import { listDirectTeamEmployeeScope } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'
import { listProcessWork, type ProcessWorkItem } from '@/lib/process-automation/work-service'
import { listManagerTeamFollowUps } from '@/lib/talent/check-in-service'
import { listManagerTeamDevelopmentPlans } from '@/lib/talent/goal-service'
import { listManagerTalentTeamMatrix, listTalentTeamMatrix, type TalentTeamMatrixCapability, type TalentTeamMatrixRow } from '@/lib/talent/team-service'
import { talentTeamMatrixQuerySchema, type TalentTeamMatrixFilters } from '@/lib/talent/team-schemas'
import { defineWorkforceTool, type DelegatedWorkforceToolExecutionContext } from './contracts'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const MAX_MATRIX_ROWS_PER_PAGE = 25
const MAX_CAPABILITIES_PER_EMPLOYEE = 20
const MAX_MANAGER_ROWS = 100
const MAX_PENDING_ITEMS = 50

const boundedListInputSchema = z.object({
  limit: z.number().int().min(1).max(MAX_MANAGER_ROWS).optional(),
  offset: z.number().int().min(0).max(5_000).optional(),
}).strict()

const boundedPendingInputSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PENDING_ITEMS).optional(),
  offset: z.number().int().min(0).max(600).optional(),
}).strict()

const workforceTeamCapabilityMatrixInputSchema = talentTeamMatrixQuerySchema.extend({
  status: z.enum(['RELEASED', 'EXPIRED']).optional(),
  limit: z.number().int().min(1).max(MAX_MATRIX_ROWS_PER_PAGE).optional(),
  offset: z.number().int().min(0).max(5_000).optional(),
})

const managerMemberSchema = z.object({
  employeeName: z.string().min(1).max(160),
}).strict()

export const managerTeamOverviewOutputSchema = z.object({
  members: z.array(managerMemberSchema).max(MAX_MANAGER_ROWS),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextOffset: z.number().int().nonnegative().nullable(),
  sourceTruncated: z.boolean(),
}).strict()

const managerPendingItemSchema = z.object({
  category: z.enum(['GENERAL', 'ACTUAL_WORK_ENTRY', 'LEAVE_REQUEST']),
  processTitle: z.string().min(1).max(160),
  stepTitle: z.string().min(1).max(160),
  employeeName: z.string().max(160).nullable(),
  deadlineAt: z.string().max(50).nullable(),
  overdue: z.boolean(),
}).strict()

export const managerPendingWorkOutputSchema = z.object({
  items: z.array(managerPendingItemSchema).max(MAX_PENDING_ITEMS),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextOffset: z.number().int().nonnegative().nullable(),
  sourceTruncated: z.boolean(),
}).strict()

const managerVacationEventSchema = z.object({
  employeeName: z.string().min(1).max(160),
  startDate: dateSchema,
  endDate: dateSchema,
}).strict()

export const managerLeaveCalendarOutputSchema = z.object({
  windowStart: dateSchema,
  windowEnd: dateSchema,
  events: z.array(managerVacationEventSchema).max(MAX_MANAGER_ROWS),
  total: z.number().int().nonnegative(),
  sourceTruncated: z.boolean(),
}).strict()

const managerDevelopmentPlanSchema = z.object({
  employeeName: z.string().min(1).max(160),
  periodStart: dateSchema,
  periodEnd: dateSchema.nullable(),
  progressPercent: z.number().int().min(0).max(100),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  completedAt: z.string().nullable(),
}).strict()

export const managerDevelopmentPlansOutputSchema = z.object({
  plans: z.array(managerDevelopmentPlanSchema).max(MAX_MANAGER_ROWS),
  total: z.number().int().nonnegative(),
  sourceTruncated: z.boolean(),
}).strict()

const managerFollowUpSchema = z.object({
  employeeName: z.string().min(1).max(160),
  dueOn: dateSchema,
}).strict()

export const managerFollowUpsOutputSchema = z.object({
  followUps: z.array(managerFollowUpSchema).max(MAX_MANAGER_ROWS),
  total: z.number().int().nonnegative(),
  sourceTruncated: z.boolean(),
}).strict()

const capabilityTypeSchema = z.enum(['COMPETENCY', 'SKILL', 'KNOWLEDGE', 'LANGUAGE', 'CERTIFICATE'])
const capabilityStatusSchema = z.enum(['RELEASED', 'EXPIRED'])
const capabilitySourceSchema = z.enum(['SELF_ENTERED', 'HR_ENTERED', 'MANAGER_ENTERED', 'IMPORTED'])

const managerCapabilitySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: capabilityTypeSchema,
  status: capabilityStatusSchema,
  sourceType: capabilitySourceSchema,
  validFrom: dateSchema,
  validUntil: dateSchema.nullable(),
}).strict()

const managerTeamRowSchema = z.object({
  employeeLabel: z.string().min(1),
  capabilities: z.array(managerCapabilitySchema).max(MAX_CAPABILITIES_PER_EMPLOYEE),
  capabilitiesTruncated: z.boolean(),
}).strict()

export const managerTeamCapabilityMatrixOutputSchema = z.object({
  rows: z.array(managerTeamRowSchema).max(MAX_MATRIX_ROWS_PER_PAGE),
  hasMore: z.boolean(),
  nextOffset: z.number().int().min(0).max(5_000).nullable(),
  sourceTruncated: z.boolean(),
}).strict()

type ManagerCapability = z.infer<typeof managerCapabilitySchema>
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function getManagerExecutionContext(delegated?: DelegatedWorkforceToolExecutionContext): Promise<{
  context: AuthContext
  supabase: SupabaseServerClient
}> {
  return delegated
    ? { context: delegated.authContext, supabase: delegated.rls.client }
    : { context: await requireAuthContext(), supabase: await createClient() }
}

function isCapabilityStatus(status: string): status is ManagerCapability['status'] {
  return status === 'RELEASED' || status === 'EXPIRED'
}

function isCapabilityType(type: string): type is ManagerCapability['type'] {
  return capabilityTypeSchema.safeParse(type).success
}

function isCapabilitySource(source: string): source is ManagerCapability['sourceType'] {
  return capabilitySourceSchema.safeParse(source).success
}

function mapCapability(capability: TalentTeamMatrixCapability): ManagerCapability | null {
  if (!isCapabilityStatus(capability.status) || !isCapabilityType(capability.capabilityType) || !isCapabilitySource(capability.source_type)) return null

  return {
    code: capability.capabilityCode,
    name: capability.capabilityName,
    type: capability.capabilityType,
    status: capability.status,
    sourceType: capability.source_type,
    validFrom: capability.valid_from,
    validUntil: capability.valid_until,
  }
}

function mapTeamRow(row: TalentTeamMatrixRow): z.infer<typeof managerTeamRowSchema> {
  const capabilities = row.capabilities.flatMap((capability) => {
    const mapped = mapCapability(capability)
    return mapped ? [mapped] : []
  })
  return {
    employeeLabel: row.employeeLabel,
    capabilities: capabilities.slice(0, MAX_CAPABILITIES_PER_EMPLOYEE),
    capabilitiesTruncated: capabilities.length > MAX_CAPABILITIES_PER_EMPLOYEE
      || capabilities.length < row.capabilities.length,
  }
}

async function executeManagerTeamOverview(
  input: z.output<typeof boundedListInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
): Promise<z.output<typeof managerTeamOverviewOutputSchema>> {
  const { context, supabase } = await getManagerExecutionContext(delegated)
  const overview = await listFocusManagerTeamOverviewForContext(context, supabase)
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  const members = overview.members
  const page = members.slice(offset, offset + limit)
  const hasMore = offset + page.length < members.length
  return managerTeamOverviewOutputSchema.parse({
    members: page.map((member) => ({ employeeName: member.employeeName })),
    total: overview.total,
    hasMore,
    nextOffset: hasMore ? offset + page.length : null,
    sourceTruncated: overview.sourceTruncated || hasMore,
  })
}

function projectPendingItem(item: ProcessWorkItem): z.output<typeof managerPendingItemSchema> | null {
  if (
    !item.subjectEmployeeId
    || !item.canAct
    || !['OPEN', 'CLAIMED'].includes(item.status)
    || item.businessType === 'P_MUTATION'
    || !['GENERAL', 'ACTUAL_WORK_ENTRY', 'LEAVE_REQUEST'].includes(item.businessCategory)
  ) return null

  return {
    category: item.businessCategory as z.output<typeof managerPendingItemSchema>['category'],
    processTitle: item.processTitle.slice(0, 160),
    stepTitle: item.stepTitle.slice(0, 160),
    employeeName: item.subjectName?.slice(0, 160) ?? null,
    deadlineAt: item.deadlineAt,
    overdue: item.isOverdue,
  }
}

async function executeManagerPendingWork(
  input: z.output<typeof boundedPendingInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
): Promise<z.output<typeof managerPendingWorkOutputSchema>> {
  const { context, supabase } = await getManagerExecutionContext(delegated)
  if (!context.administrationId) throw new Error('MANAGER_CONTEXT_REQUIRED')
  const scope = await listDirectTeamEmployeeScope(context, supabase, 5_000)
  if (scope.employeeIds.length === 0) {
    return { items: [], total: 0, hasMore: false, nextOffset: null, sourceTruncated: scope.sourceTruncated }
  }

  const requests = [
    { view: 'WORK' as const, businessCategory: 'GENERAL' as const },
    { view: 'WORK' as const, businessCategory: 'ACTUAL_WORK_ENTRY' as const },
    { view: 'REQUESTS' as const, businessCategory: 'LEAVE_REQUEST' as const },
  ]
  const results = await Promise.all(requests.map(({ view, businessCategory }) => listProcessWork({
    view,
    tab: 'TODO',
    businessCategory,
    administrationId: context.administrationId ?? undefined,
    language: 'nl',
    sort: 'DEADLINE',
    limit: 200,
    offset: 0,
  }, { context, supabase })))
  const allowedEmployeeIds = new Set(scope.employeeIds)
  const projected = results.flatMap((result) => result.items.flatMap((item) => (
    item.subjectEmployeeId && allowedEmployeeIds.has(item.subjectEmployeeId)
      ? [projectPendingItem(item)].filter((candidate): candidate is z.output<typeof managerPendingItemSchema> => candidate !== null)
      : []
  )))
  projected.sort((left, right) => {
    const deadlineOrder = (left.deadlineAt ?? '9999').localeCompare(right.deadlineAt ?? '9999')
    return deadlineOrder || left.employeeName?.localeCompare(right.employeeName ?? '', 'nl') || left.stepTitle.localeCompare(right.stepTitle, 'nl')
  })
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  const items = projected.slice(offset, offset + limit)
  const hasMore = offset + items.length < projected.length
  return managerPendingWorkOutputSchema.parse({
    items,
    total: projected.length,
    hasMore,
    nextOffset: hasMore ? offset + items.length : null,
    sourceTruncated: scope.sourceTruncated
      || hasMore
      || results.some((result) => result.hasMore),
  })
}

async function executeManagerLeaveCalendar(
  input: z.output<typeof boundedListInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
): Promise<z.output<typeof managerLeaveCalendarOutputSchema>> {
  const { context, supabase } = await getManagerExecutionContext(delegated)
  const today = new Date().toISOString().slice(0, 10)
  const calendar = await listFocusManagerUpcomingApprovedVacationForContext(context, today, supabase)
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  const events = calendar.events.map((event) => ({
    employeeName: event.employeeName,
    startDate: event.startDate,
    endDate: event.endDate,
  }))
  const page = events.slice(offset, offset + limit)
  return managerLeaveCalendarOutputSchema.parse({
    windowStart: calendar.windowStart,
    windowEnd: calendar.windowEnd,
    events: page,
    total: events.length,
    sourceTruncated: calendar.sourceTruncated || offset + page.length < events.length,
  })
}

async function executeManagerDevelopmentPlans(
  input: z.output<typeof boundedListInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
): Promise<z.output<typeof managerDevelopmentPlansOutputSchema>> {
  const plans = await listManagerTeamDevelopmentPlans(delegated
    ? { authContext: delegated.authContext, rls: delegated.rls }
    : undefined)
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  const page = plans.plans.slice(offset, offset + limit)
  return managerDevelopmentPlansOutputSchema.parse({
    plans: page,
    total: plans.plans.length,
    sourceTruncated: plans.sourceTruncated || offset + page.length < plans.plans.length,
  })
}

async function executeManagerFollowUps(
  input: z.output<typeof boundedListInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
): Promise<z.output<typeof managerFollowUpsOutputSchema>> {
  const followUps = await listManagerTeamFollowUps(delegated
    ? { authContext: delegated.authContext, rls: delegated.rls }
    : undefined)
  const limit = input.limit ?? 25
  const offset = input.offset ?? 0
  const page = followUps.followUps.slice(offset, offset + limit)
  return managerFollowUpsOutputSchema.parse({
    followUps: page,
    total: followUps.followUps.length,
    sourceTruncated: followUps.sourceTruncated || offset + page.length < followUps.followUps.length,
  })
}

async function executeTalentTeamCapabilityMatrix(
  input: z.output<typeof workforceTeamCapabilityMatrixInputSchema>,
  delegated?: DelegatedWorkforceToolExecutionContext,
): Promise<z.output<typeof managerTeamCapabilityMatrixOutputSchema>> {
  const { limit = MAX_MATRIX_ROWS_PER_PAGE, offset = 0, ...filters } = input
  const matrix = delegated
    ? await listManagerTalentTeamMatrix(filters satisfies TalentTeamMatrixFilters, {
      context: delegated.authContext,
      supabase: delegated.rls.client,
    })
    : await listManagerTalentTeamMatrix(filters satisfies TalentTeamMatrixFilters)
  const orderedRows = [...matrix.rows].sort((left, right) =>
    left.employeeNumber.localeCompare(right.employeeNumber, 'en')
    || left.employeeId.localeCompare(right.employeeId, 'en'),
  )
  const page = orderedRows.slice(offset, offset + limit)
  const nextOffset = offset + page.length < orderedRows.length ? offset + page.length : null
  return managerTeamCapabilityMatrixOutputSchema.parse({
    rows: page.map(mapTeamRow),
    hasMore: nextOffset !== null,
    nextOffset,
    sourceTruncated: matrix.sourceTruncated,
  })
}

const managerToolMetadata = {
  audience: ['MANAGER'] as const,
  scope: 'MANAGER_SCOPE' as const,
  operation: 'READ' as const,
}

function defineManagerTool<TInput extends z.ZodType, TOutput extends z.ZodType>(definition: {
  id: string
  description: string
  permission: string
  module: 'TALENT' | 'HERA'
  inputSchema: TInput
  outputSchema: TOutput
  execute: (input: z.output<TInput>, context?: DelegatedWorkforceToolExecutionContext) => Promise<unknown>
}) {
  return defineWorkforceTool({
    ...managerToolMetadata,
    ...definition,
    handler: (input) => definition.execute(input),
    delegatedHandler: (input, context) => definition.execute(input, context),
  })
}

export const managerTeamOverviewTool = defineManagerTool({
  id: 'manager.team.overview.read',
  description: 'Lees namen van actieve medewerkers in je eigen directe team.',
  permission: 'talent-team:read',
  module: 'TALENT',
  inputSchema: boundedListInputSchema,
  outputSchema: managerTeamOverviewOutputSchema,
  execute: executeManagerTeamOverview,
})

export const managerPendingWorkTool = defineManagerTool({
  id: 'manager.work.pending.read',
  description: 'Lees openstaande, actiegerichte taken en verlofaanvragen van je eigen directe team.',
  permission: 'process-task:read',
  module: 'HERA',
  inputSchema: boundedPendingInputSchema,
  outputSchema: managerPendingWorkOutputSchema,
  execute: executeManagerPendingWork,
})

export const managerLeaveCalendarTool = defineManagerTool({
  id: 'manager.leave.calendar.read',
  description: 'Lees goedgekeurde vakantie van je eigen directe team in de komende 90 dagen.',
  permission: 'leave:read',
  module: 'HERA',
  inputSchema: boundedListInputSchema,
  outputSchema: managerLeaveCalendarOutputSchema,
  execute: executeManagerLeaveCalendar,
})

export const managerDevelopmentPlansTool = defineManagerTool({
  id: 'manager.talent.development-plans.read',
  description: 'Lees de voortgangsstatus van ontwikkelplannen van je eigen directe team.',
  permission: 'talent-goal:read',
  module: 'TALENT',
  inputSchema: boundedListInputSchema,
  outputSchema: managerDevelopmentPlansOutputSchema,
  execute: executeManagerDevelopmentPlans,
})

export const managerFollowUpsTool = defineManagerTool({
  id: 'manager.talent.follow-ups.read',
  description: 'Lees openstaande opvolgdatums van je eigen directe team zonder notitieteksten.',
  permission: 'talent-goal:read',
  module: 'TALENT',
  inputSchema: boundedListInputSchema,
  outputSchema: managerFollowUpsOutputSchema,
  execute: executeManagerFollowUps,
})

export const managerTeamCapabilityMatrixTool = defineManagerTool({
  id: 'manager.talent.team-capability-matrix.read',
  description: 'Lees de toegestane capabilitygegevens van het directe team.',
  permission: 'talent-team:read',
  module: 'TALENT',
  inputSchema: workforceTeamCapabilityMatrixInputSchema,
  outputSchema: managerTeamCapabilityMatrixOutputSchema,
  execute: executeTalentTeamCapabilityMatrix,
})

export const MANAGER_WORKFORCE_TOOLS = [
  managerTeamOverviewTool,
  managerPendingWorkTool,
  managerLeaveCalendarTool,
  managerDevelopmentPlansTool,
  managerFollowUpsTool,
  managerTeamCapabilityMatrixTool,
] as const

export const managerWorkforceTools = MANAGER_WORKFORCE_TOOLS

export const hrTenantCapabilityMatrixTool = defineWorkforceTool({
  audience: ['HR'] as const,
  scope: 'TENANT' as const,
  operation: 'READ' as const,
  module: 'TALENT',
  id: 'hr.talent.tenant-capability-matrix.read',
  description: 'Lees de toegestane tenantbrede capabilitygegevens.',
  permission: 'talent-team:read',
  additionalPermissions: ['talent:manage'] as const,
  inputSchema: workforceTeamCapabilityMatrixInputSchema,
  outputSchema: managerTeamCapabilityMatrixOutputSchema,
  handler: async (input) => {
    const { limit = MAX_MATRIX_ROWS_PER_PAGE, offset = 0, ...filters } = input
    const matrix = await listTalentTeamMatrix(filters satisfies TalentTeamMatrixFilters)
    const orderedRows = [...matrix.rows].sort((left, right) =>
      left.employeeNumber.localeCompare(right.employeeNumber, 'en')
      || left.employeeId.localeCompare(right.employeeId, 'en'),
    )
    const page = orderedRows.slice(offset, offset + limit)
    const nextOffset = offset + page.length < orderedRows.length ? offset + page.length : null
    return managerTeamCapabilityMatrixOutputSchema.parse({
      rows: page.map(mapTeamRow),
      hasMore: nextOffset !== null,
      nextOffset,
      sourceTruncated: matrix.sourceTruncated,
    })
  },
})

export const HR_WORKFORCE_TOOLS = [hrTenantCapabilityMatrixTool] as const

export const hrWorkforceTools = HR_WORKFORCE_TOOLS

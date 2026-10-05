import type { AuthContext } from '@/lib/auth/permissions'
import type { TalentSelfDevelopmentPlan } from '@/lib/talent/goal-service'
import { z } from 'zod'

export const workforceSummaryProjectionSchema = z.object({
  asOfDate: z.iso.date(),
}).strict()

export const selfDevelopmentPlanStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
])

export const selfDevelopmentPlanProjectionSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  status: selfDevelopmentPlanStatusSchema,
  completedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict()

export const selfDevelopmentPlansProjectionSchema = z.array(selfDevelopmentPlanProjectionSchema)

export interface WorkforceSummaryProjection {
  readonly asOfDate: string
}

export interface SelfDevelopmentPlanProjection {
  readonly periodStart: string
  readonly periodEnd: string | null
  readonly progressPercent: number
  readonly status: z.infer<typeof selfDevelopmentPlanStatusSchema>
  readonly completedAt: string | null
}

export type SelfDevelopmentPlanSource = TalentSelfDevelopmentPlan

export class ApiResourceProjectionError extends Error {
  constructor(readonly code: 'INVALID_AS_OF_DATE' | 'INVALID_DEVELOPMENT_PLAN' | 'SELF_CONTEXT_REQUIRED' | 'SELF_SCOPE_MISMATCH') {
    super(code)
    this.name = 'ApiResourceProjectionError'
  }
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

/**
 * Workforce Summary heeft nog geen goedgekeurde populatie- of aggregaatvelden.
 * De peildatum komt uit de serverklok en beschrijft alleen de projectie.
 */
export function projectWorkforceSummary(now: Date = new Date()): WorkforceSummaryProjection {
  if (!Number.isFinite(now.getTime())) throw new ApiResourceProjectionError('INVALID_AS_OF_DATE')
  const projection = workforceSummaryProjectionSchema.safeParse({ asOfDate: now.toISOString().slice(0, 10) })
  if (!projection.success) throw new ApiResourceProjectionError('INVALID_AS_OF_DATE')
  return projection.data
}

/**
 * Projecteert een al geautoriseerd service-resultaat voor de eigen medewerker.
 * De aanroeper moet de actuele AuthContext laden en de bestaande self-service
 * aanroepen voordat deze projector wordt gebruikt.
 */
export function projectSelfDevelopmentPlans(
  authContext: Pick<AuthContext, 'tenantId' | 'employeeId'>,
  workspace: { readonly goals: ReadonlyArray<SelfDevelopmentPlanSource> },
): SelfDevelopmentPlanProjection[] {
  const employeeId = authContext.employeeId
  if (!isNonEmptyText(authContext.tenantId) || !isNonEmptyText(employeeId)) {
    throw new ApiResourceProjectionError('SELF_CONTEXT_REQUIRED')
  }
  if (!Array.isArray(workspace.goals)) {
    throw new ApiResourceProjectionError('INVALID_DEVELOPMENT_PLAN')
  }
  for (const goal of workspace.goals) {
    if (!goal || typeof goal !== 'object' || Array.isArray(goal)
      || !isNonEmptyText(goal.tenant_id) || !isNonEmptyText(goal.employee_id)) {
      throw new ApiResourceProjectionError('INVALID_DEVELOPMENT_PLAN')
    }
  }
  if (workspace.goals.some((goal) => goal.tenant_id !== authContext.tenantId || goal.employee_id !== employeeId)) {
    throw new ApiResourceProjectionError('SELF_SCOPE_MISMATCH')
  }

  const projection = workspace.goals.map((goal) => ({
    periodStart: goal.period_start,
    periodEnd: goal.period_end,
    progressPercent: goal.progress_percent,
    status: goal.status,
    completedAt: goal.completed_at,
  }))
  const validated = selfDevelopmentPlansProjectionSchema.safeParse(projection)
  if (!validated.success) throw new ApiResourceProjectionError('INVALID_DEVELOPMENT_PLAN')
  return validated.data
}

/** Team Skills blijft uitgesteld totdat het privacy- en linkabilitycontract is goedgekeurd. */
export const teamSkillsApiStatus = 'DEFERRED_PRIVACY_REVIEW' as const

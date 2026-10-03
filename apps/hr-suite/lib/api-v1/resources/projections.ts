import type { AuthContext } from '@/lib/auth/permissions'
import type { TalentGoal, TalentGoalWorkspace } from '@/lib/talent/goal-service'
import { z } from 'zod'

export const workforceSummaryProjectionSchema = z.object({
  asOfDate: z.iso.date(),
}).strict()

export const selfDevelopmentPlanProjectionSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date().nullable(),
  progressPercent: z.number().int().min(0).max(100),
  status: z.string().min(1),
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
  readonly status: TalentGoal['status']
  readonly completedAt: string | null
}

export class ApiResourceProjectionError extends Error {
  constructor(readonly code: 'INVALID_AS_OF_DATE' | 'SELF_CONTEXT_REQUIRED' | 'SELF_SCOPE_MISMATCH') {
    super(code)
    this.name = 'ApiResourceProjectionError'
  }
}

/**
 * Workforce Summary heeft nog geen goedgekeurde populatie- of aggregaatvelden.
 * De peildatum komt uit de serverklok en beschrijft alleen de projectie.
 */
export function projectWorkforceSummary(now: Date = new Date()): WorkforceSummaryProjection {
  if (!Number.isFinite(now.getTime())) throw new ApiResourceProjectionError('INVALID_AS_OF_DATE')
  return { asOfDate: now.toISOString().slice(0, 10) }
}

/**
 * Projecteert een al geautoriseerd service-resultaat voor de eigen medewerker.
 * De aanroeper moet de actuele AuthContext laden en de bestaande self-service
 * aanroepen voordat deze projector wordt gebruikt.
 */
export function projectSelfDevelopmentPlans(
  authContext: Pick<AuthContext, 'employeeId'>,
  workspace: Pick<TalentGoalWorkspace, 'goals'>,
): SelfDevelopmentPlanProjection[] {
  const employeeId = authContext.employeeId
  if (!employeeId) throw new ApiResourceProjectionError('SELF_CONTEXT_REQUIRED')
  if (workspace.goals.some((goal) => goal.employee_id !== employeeId)) {
    throw new ApiResourceProjectionError('SELF_SCOPE_MISMATCH')
  }

  return workspace.goals.map((goal: TalentGoal) => ({
    periodStart: goal.period_start,
    periodEnd: goal.period_end,
    progressPercent: goal.progress_percent,
    status: goal.status,
    completedAt: goal.completed_at,
  }))
}

/** Team Skills blijft uitgesteld totdat het privacy- en linkabilitycontract is goedgekeurd. */
export const teamSkillsApiStatus = 'DEFERRED_PRIVACY_REVIEW' as const

import type { Database } from '@scope/db'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type { TalentGoalCreateInput, TalentGoalListQuery, TalentGoalUpdateInput } from './goal-schemas'
import { createTalentGoalNotification } from './notification-service'

type GoalRow = Database['public']['Tables']['talent_development_goals']['Row']
type GoalInsert = Database['public']['Tables']['talent_development_goals']['Insert']
type GoalUpdate = Database['public']['Tables']['talent_development_goals']['Update']

export class TalentGoalError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentGoalError'
  }
}

export type TalentGoal = Pick<GoalRow, 'id' | 'tenant_id' | 'employee_id' | 'capability_id' | 'title' | 'description' | 'period_start' | 'period_end' | 'progress_percent' | 'status' | 'source_type' | 'version' | 'completed_at' | 'archived_at'> & {
  employeeLabel: string | null
  capabilityLabel: string | null
}

export type TalentGoalWorkspace = {
  goals: TalentGoal[]
  employees: Array<{ id: string; label: string }>
  capabilities: Array<{ id: string; label: string }>
}

export type TalentGoalListOptions = {
  includeOptions?: boolean
  includeEmployeeOptions?: boolean
  includeCapabilityOptions?: boolean
}

function databaseError(message: string, fallback: string, databaseCode?: string): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const explicitCode = normalized.match(/TALENT_[A-Z0-9_]+/)?.[0]
  if (explicitCode) {
    const status = explicitCode.includes('FORBIDDEN') ? 403 : explicitCode.includes('NOT_FOUND') ? 404 : explicitCode.includes('CONFLICT') || explicitCode.includes('DUPLICATE') || explicitCode.includes('LOCKED') ? 409 : 400
    throw new TalentGoalError(explicitCode, status)
  }
  if (databaseCode === '42501') throw new TalentGoalError('TALENT_GOAL_FORBIDDEN', 403)
  if (normalized.includes('DUPLICATE') || normalized.includes('UNIQUE')) throw new TalentGoalError('TALENT_GOAL_DUPLICATE', 409)
  throw new TalentGoalError(fallback)
}

function employeeLabel(firstName: string | null, birthName: string | null, employeeNumber: string | null): string | null {
  const name = [firstName, birthName].filter((value): value is string => Boolean(value?.trim())).join(' ').trim()
  if (!name && !employeeNumber) return null
  return [name || null, employeeNumber ? `(${employeeNumber})` : null].filter(Boolean).join(' ')
}

async function authorizeList(mode: 'admin' | 'manager' | 'self'): Promise<AuthContext> {
  if (mode === 'admin') return requirePermission('talent-goal:manage')
  if (mode === 'manager') return requirePermission('talent-goal:read')
  return requirePermission('self:talent-goal:read')
}

async function loadEmployees(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string, employeeIds: string[]): Promise<Map<string, string | null>> {
  if (employeeIds.length === 0) return new Map()
  const { data, error } = await supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', tenantId).in('id', employeeIds).is('deleted_at', null)
  if (error) throw new TalentGoalError('TALENT_GOAL_EMPLOYEE_READ_FAILED')
  return new Map((data ?? []).map((employee) => [employee.id, employeeLabel(employee.first_name, employee.birth_name, employee.employee_number)]))
}

async function loadEmployeeOptions(supabase: Awaited<ReturnType<typeof createClient>>, context: AuthContext, mode: 'admin' | 'manager'): Promise<Array<{ id: string; label: string }>> {
  let employeeIds: string[] | undefined
  if (mode === 'manager') {
    if (!context.employeeId) throw new TalentGoalError('TALENT_GOAL_EMPLOYEE_REQUIRED', 403)
    const today = new Date().toISOString().slice(0, 10)
    const { data: placements, error: placementError } = await supabase.from('employee_organizations').select('employee_id').eq('tenant_id', context.tenantId).eq('direct_manager_id', context.employeeId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(1000)
    if (placementError) throw new TalentGoalError('TALENT_GOAL_EMPLOYEE_OPTIONS_FAILED')
    employeeIds = [...new Set((placements ?? []).map((placement) => placement.employee_id))]
  }
  let employeeQuery = supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).is('deleted_at', null).eq('is_active', true).order('birth_name').limit(1000)
  if (employeeIds) employeeQuery = employeeQuery.in('id', employeeIds)
  const { data, error } = await employeeQuery
  if (error) throw new TalentGoalError('TALENT_GOAL_EMPLOYEE_OPTIONS_FAILED')
  return (data ?? []).map((employee) => ({ id: employee.id, label: employeeLabel(employee.first_name, employee.birth_name, employee.employee_number) ?? employee.employee_number }))
}

export async function listTalentGoals(mode: 'admin' | 'manager' | 'self', query: TalentGoalListQuery = {}, options: TalentGoalListOptions = {}): Promise<TalentGoalWorkspace> {
  const context = await authorizeList(mode)
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const includeOptions = options.includeOptions ?? true
  const includeEmployeeOptions = options.includeEmployeeOptions ?? includeOptions
  const includeCapabilityOptions = options.includeCapabilityOptions ?? includeOptions

  let goalsQuery = supabase.from('talent_development_goals').select('*').eq('tenant_id', context.tenantId).order('period_start', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (mode === 'self') {
    if (!context.employeeId) return { goals: [], employees: [], capabilities: [] }
    goalsQuery = goalsQuery.eq('employee_id', context.employeeId)
  } else if (query.employeeId) {
    goalsQuery = goalsQuery.eq('employee_id', query.employeeId)
  }
  if (query.goalId) goalsQuery = goalsQuery.eq('id', query.goalId)
  if (query.status) goalsQuery = goalsQuery.eq('status', query.status)

  const { data: rows, error } = await goalsQuery
  if (error) throw new TalentGoalError('TALENT_GOAL_READ_FAILED')
  const goalRows = rows ?? []
  const goalCapabilityIds = [...new Set(goalRows.map((goal) => goal.capability_id).filter((id): id is string => Boolean(id)))]
  const [employeesResult, goalCapabilitiesResult, capabilitiesResult] = await Promise.all([
    mode === 'self' ? Promise.resolve(new Map<string, string | null>()) : loadEmployees(supabase, context.tenantId, goalRows.map((goal) => goal.employee_id)),
    goalCapabilityIds.length === 0 ? Promise.resolve([] as Array<{ id: string; code: string; name: string }>) : supabase.from('talent_capabilities').select('id,code,name').eq('tenant_id', context.tenantId).in('id', goalCapabilityIds).then((result) => {
      if (result.error) throw new TalentGoalError('TALENT_GOAL_CAPABILITY_READ_FAILED')
      return result.data ?? []
    }),
    mode === 'self' || !includeCapabilityOptions ? Promise.resolve([] as Array<{ id: string; label: string }>) : supabase.from('talent_capabilities').select('id,code,name').eq('tenant_id', context.tenantId).eq('status', 'ACTIVE').order('name').limit(500).then((result) => {
      if (result.error) throw new TalentGoalError('TALENT_GOAL_CAPABILITY_READ_FAILED')
      return (result.data ?? []).map((capability) => ({ id: capability.id, label: `${capability.name} (${capability.code})` }))
    }),
  ])
  const capabilityLabels = new Map(goalCapabilitiesResult.map((capability) => [capability.id, `${capability.name} (${capability.code})`]))
  const capabilityOptions = [
    ...goalCapabilitiesResult.map((capability) => ({ id: capability.id, label: `${capability.name} (${capability.code})` })),
    ...capabilitiesResult.filter((capability) => !capabilityLabels.has(capability.id)),
  ]

  return {
    goals: goalRows.map((goal) => ({
      id: goal.id,
      tenant_id: goal.tenant_id,
      employee_id: goal.employee_id,
      capability_id: goal.capability_id,
      title: goal.title,
      description: goal.description,
      period_start: goal.period_start,
      period_end: goal.period_end,
      progress_percent: goal.progress_percent,
      status: goal.status,
      source_type: goal.source_type,
      version: goal.version,
      completed_at: goal.completed_at,
      archived_at: goal.archived_at,
      employeeLabel: employeesResult.get(goal.employee_id) ?? null,
      capabilityLabel: goal.capability_id ? capabilityLabels.get(goal.capability_id) ?? null : null,
    })),
    employees: mode === 'self' || !includeEmployeeOptions ? [] : await loadEmployeeOptions(supabase, context, mode),
    capabilities: capabilityOptions,
  }
}

export async function getTalentGoal(goalId: string, mode: 'admin' | 'manager' | 'self'): Promise<TalentGoal> {
  const workspace = await listTalentGoals(mode, { goalId }, { includeOptions: false })
  const goal = workspace.goals[0]
  if (!goal) throw new TalentGoalError('TALENT_GOAL_NOT_FOUND', 404)
  return goal
}

async function goalMutationContext(employeeId: string | undefined): Promise<{ context: AuthContext; targetEmployeeId: string; sourceType: GoalInsert['source_type'] }> {
  const context = await requireAuthContext()
  const targetEmployeeId = employeeId ?? context.employeeId
  if (!targetEmployeeId) throw new TalentGoalError('TALENT_GOAL_EMPLOYEE_REQUIRED', 400)

  if (context.permissions.includes('talent-goal:manage')) return { context, targetEmployeeId, sourceType: 'HR_ENTERED' }
  await requirePermission('talent-goal:write', targetEmployeeId)
  return { context, targetEmployeeId, sourceType: targetEmployeeId === context.employeeId ? 'SELF_ENTERED' : 'MANAGER_ENTERED' }
}

export async function createTalentGoal(input: TalentGoalCreateInput): Promise<string> {
  await requireTenantModule('TALENT')
  const { context, targetEmployeeId, sourceType } = await goalMutationContext(input.employeeId)
  const supabase = await createClient()
  const insert: GoalInsert = {
    tenant_id: context.tenantId,
    employee_id: targetEmployeeId,
    capability_id: input.capabilityId ?? null,
    title: input.title,
    description: input.description ?? null,
    period_start: input.periodStart,
    period_end: input.periodEnd ?? null,
    progress_percent: input.progressPercent,
    status: input.status,
    source_type: sourceType,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }
  const { data, error } = await supabase.from('talent_development_goals').insert(insert).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_GOAL_CREATE_FAILED', 'TALENT_GOAL_CREATE_FAILED', error?.code)
  try {
    await createTalentGoalNotification(context.tenantId, targetEmployeeId, data.id)
  } catch {
    // A notification is a follow-up aid; it must not roll back a valid goal mutation.
  }
  return data.id
}

export async function updateTalentGoal(goalId: string, input: TalentGoalUpdateInput): Promise<void> {
  await requireTenantModule('TALENT')
  const context = await requireAuthContext()
  const supabase = await createClient()
  const { data: existing, error: readError } = await supabase.from('talent_development_goals').select('*').eq('tenant_id', context.tenantId).eq('id', goalId).maybeSingle()
  if (readError || !existing) throw new TalentGoalError('TALENT_GOAL_NOT_FOUND', 404)
  const isAdmin = context.permissions.includes('talent-goal:manage')
  if (!isAdmin) await requirePermission('talent-goal:write', existing.employee_id)
  if (!isAdmin) {
    const isSelf = context.employeeId === existing.employee_id
    const expectedSource = isSelf ? 'SELF_ENTERED' : 'MANAGER_ENTERED'
    if (existing.source_type !== expectedSource) throw new TalentGoalError('TALENT_GOAL_WRITE_FORBIDDEN', 403)
  }

  const nextStatus = input.status ?? existing.status
  if (existing.status === 'ARCHIVED') throw new TalentGoalError('TALENT_GOAL_ARCHIVED_LOCKED', 409)
  if (existing.status === 'COMPLETED' && nextStatus !== 'COMPLETED' && nextStatus !== 'ARCHIVED') throw new TalentGoalError('TALENT_GOAL_COMPLETED_LOCKED', 409)
  if (existing.status === 'CANCELLED' && nextStatus !== 'CANCELLED' && nextStatus !== 'ARCHIVED') throw new TalentGoalError('TALENT_GOAL_CANCELLED_LOCKED', 409)
  if (existing.status === 'DRAFT' && !['DRAFT', 'ACTIVE', 'CANCELLED', 'ARCHIVED'].includes(nextStatus)) throw new TalentGoalError('TALENT_GOAL_TRANSITION_INVALID', 409)
  if (existing.status === 'ACTIVE' && !['ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(nextStatus)) throw new TalentGoalError('TALENT_GOAL_TRANSITION_INVALID', 409)
  if (nextStatus === 'ARCHIVED' && !isAdmin) throw new TalentGoalError('TALENT_GOAL_ARCHIVE_FORBIDDEN', 403)
  const nextPeriodStart = input.periodStart ?? existing.period_start
  const nextPeriodEnd = input.periodEnd === undefined ? existing.period_end : input.periodEnd
  if (nextPeriodEnd && nextPeriodEnd <= nextPeriodStart) throw new TalentGoalError('TALENT_GOAL_PERIOD_INVALID', 400)
  if (existing.status !== 'DRAFT' && existing.status !== 'ACTIVE' && nextStatus === existing.status && Object.keys(input).some((key) => !['version', 'status'].includes(key))) throw new TalentGoalError('TALENT_GOAL_STATUS_LOCKED', 409)

  const update: GoalUpdate = { version: input.version + 1, updated_by_user_id: context.userId }
  if (input.capabilityId !== undefined) update.capability_id = input.capabilityId
  if (input.title !== undefined) update.title = input.title
  if (input.description !== undefined) update.description = input.description
  if (input.periodStart !== undefined) update.period_start = input.periodStart
  if (input.periodEnd !== undefined) update.period_end = input.periodEnd
  if (input.progressPercent !== undefined) update.progress_percent = input.progressPercent
  if (input.status !== undefined) update.status = input.status

  const { data: updated, error } = await supabase.from('talent_development_goals').update(update).eq('tenant_id', context.tenantId).eq('id', goalId).eq('version', input.version).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_GOAL_UPDATE_FAILED', error.code)
  if (!updated) throw new TalentGoalError('TALENT_GOAL_VERSION_CONFLICT', 409)
  try {
    await createTalentGoalNotification(context.tenantId, existing.employee_id, goalId)
  } catch {
    // A notification is a follow-up aid; it must not roll back a valid goal mutation.
  }
}

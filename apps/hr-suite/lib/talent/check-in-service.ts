import type { Database } from '@scope/db'
import { AuthorizationError, requireAuthContext, requirePermission, requirePermissionInContext, requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { assertDelegatedBearerRlsClient } from '@/lib/api-v1/auth/bearer-rls'
import type { DelegatedBearerRlsClient } from '@/lib/api-v1/auth/bearer-rls'
import { listDirectTeamEmployeeScope } from '@/lib/organization/team-scope'
import type { TalentCheckInCreateInput, TalentCheckInUpdateInput } from './check-in-schemas'

type CheckInRow = Database['public']['Tables']['talent_goal_check_ins']['Row']
type CheckInInsert = Database['public']['Tables']['talent_goal_check_ins']['Insert']
type CheckInUpdate = Database['public']['Tables']['talent_goal_check_ins']['Update']

export type TalentGoalCheckIn = Pick<CheckInRow, 'id' | 'goal_id' | 'employee_id' | 'entry_type' | 'body' | 'follow_up_title' | 'follow_up_due_on' | 'status' | 'version' | 'created_at' | 'completed_at'>
export type TalentGoalCheckInMetadata = Pick<TalentGoalCheckIn, 'id' | 'goal_id' | 'employee_id' | 'entry_type' | 'follow_up_due_on' | 'status' | 'created_at' | 'completed_at'>

export class TalentCheckInError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentCheckInError'
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface TalentManagerFollowUpDependencies {
  readonly authContext: AuthContext
  readonly rls: DelegatedBearerRlsClient<SupabaseServerClient>
}

export interface TalentManagerFollowUp {
  readonly employeeName: string
  readonly dueOn: string
}

export interface TalentManagerFollowUps {
  readonly followUps: ReadonlyArray<TalentManagerFollowUp>
  readonly sourceTruncated: boolean
}

function managerEmployeeName(firstName: string | null, birthName: string | null): string {
  return [firstName, birthName].filter((value): value is string => Boolean(value?.trim())).join(' ').trim()
}

async function authorizeManagerFollowUpRead(dependencies?: TalentManagerFollowUpDependencies): Promise<{
  context: AuthContext
  supabase: SupabaseServerClient
}> {
  let supabase: SupabaseServerClient
  let context: AuthContext
  if (dependencies) {
    assertDelegatedBearerRlsClient<SupabaseServerClient>(dependencies.rls)
    if (dependencies.rls.userId !== dependencies.authContext.userId) throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
    supabase = dependencies.rls.client
    context = await requirePermissionInContext(supabase, dependencies.authContext, 'talent-goal:read')
  } else {
    context = await requirePermission('talent-goal:read')
    supabase = await createClient()
  }
  await requireTenantModule('TALENT', dependencies ? { auth: context, supabase } : undefined)
  if (!context.activeRoles.includes('DIRECT_MANAGER') || !context.employeeId || !context.administrationId) {
    throw new TalentCheckInError('TALENT_CHECKIN_MANAGER_SCOPE_REQUIRED', 403)
  }
  requireHrGroupId(context)
  return { context, supabase }
}

/** Returns due dates for open follow-ups only; never returns check-in titles or note bodies. */
export async function listManagerTeamFollowUps(
  dependencies?: TalentManagerFollowUpDependencies,
): Promise<TalentManagerFollowUps> {
  const { context, supabase } = await authorizeManagerFollowUpRead(dependencies)
  const hrGroupId = requireHrGroupId(context)
  const scope = await listDirectTeamEmployeeScope(context, supabase, 5_000)
  if (scope.employeeIds.length === 0) return { followUps: [], sourceTruncated: scope.sourceTruncated }

  const [employeesResult, checkInsResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id,first_name,birth_name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .in('id', [...scope.employeeIds])
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .limit(5_000),
    supabase
      .from('talent_goal_check_ins')
      .select('employee_id,follow_up_due_on', { count: 'exact' })
      .eq('tenant_id', context.tenantId)
      .in('employee_id', [...scope.employeeIds])
      .eq('entry_type', 'FOLLOW_UP')
      .eq('status', 'OPEN')
      .not('follow_up_due_on', 'is', null)
      .order('follow_up_due_on', { ascending: true })
      .order('employee_id', { ascending: true })
      .limit(1_000),
  ])
  if (employeesResult.error) throw new TalentCheckInError('TALENT_CHECKIN_EMPLOYEE_READ_FAILED')
  if (checkInsResult.error || checkInsResult.count === null) throw new TalentCheckInError('TALENT_CHECKIN_READ_FAILED')

  const employeeNames = new Map((employeesResult.data ?? []).flatMap((employee) => {
    const name = managerEmployeeName(employee.first_name, employee.birth_name)
    return name ? [[employee.id, name] as const] : []
  }))
  let omittedRows = 0
  const followUps = (checkInsResult.data ?? []).flatMap((checkIn): TalentManagerFollowUp[] => {
    const employeeName = employeeNames.get(checkIn.employee_id)
    if (!employeeName || !checkIn.follow_up_due_on) {
      omittedRows += 1
      return []
    }
    return [{ employeeName, dueOn: checkIn.follow_up_due_on }]
  })
  return {
    followUps,
    sourceTruncated: scope.sourceTruncated
      || checkInsResult.count > (checkInsResult.data?.length ?? 0)
      || omittedRows > 0,
  }
}

function checkInDatabaseError(message: string, fallback: string, databaseCode?: string): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const explicitCode = normalized.match(/TALENT_[A-Z0-9_]+/)?.[0]
  if (explicitCode) {
    const status = explicitCode.includes('FORBIDDEN') ? 403 : explicitCode.includes('NOT_FOUND') ? 404 : explicitCode.includes('CONFLICT') || explicitCode.includes('LOCKED') ? 409 : 400
    throw new TalentCheckInError(explicitCode, status)
  }
  if (databaseCode === '42501') throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
  throw new TalentCheckInError(fallback)
}

async function goalContext(goalId: string): Promise<{ context: AuthContext; supabase: Awaited<ReturnType<typeof createClient>>; employeeId: string; goalStatus: string; goalTitle: string; goalVersion: number }> {
  const context = await requireAuthContext()
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: goal, error } = await supabase
    .from('talent_development_goals')
    .select('employee_id,status,title,version')
    .eq('tenant_id', context.tenantId)
    .eq('id', goalId)
    .maybeSingle()
  if (error || !goal) throw new TalentCheckInError('TALENT_GOAL_NOT_FOUND', 404)
  try {
    await requirePermission('talent-goal:read', goal.employee_id)
  } catch {
    throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
  }
  return { context, supabase, employeeId: goal.employee_id, goalStatus: goal.status, goalTitle: goal.title, goalVersion: goal.version }
}

async function checkInMutationContext(goalId: string, input: TalentCheckInCreateInput): Promise<Awaited<ReturnType<typeof goalContext>>> {
  const result = await goalContext(goalId)
  if (result.goalStatus !== 'ACTIVE') throw new TalentCheckInError('TALENT_CHECKIN_GOAL_NOT_ACTIVE', 409)
  const isAdmin = result.context.permissions.includes('talent-goal:manage')
  const isSelf = result.context.employeeId === result.employeeId
  if (!isAdmin && (isSelf ? input.entryType !== 'EMPLOYEE_REFLECTION' : input.entryType === 'EMPLOYEE_REFLECTION')) {
    throw new TalentCheckInError('TALENT_CHECKIN_ENTRY_TYPE_FORBIDDEN', 403)
  }
  await requirePermission('talent-goal:write', result.employeeId)
  return result
}

/** Reuses the check-in service's goal, module, permission, and entry-type checks during preview. */
export async function authorizeTalentGoalCheckIn(goalId: string, input: TalentCheckInCreateInput): Promise<{ employeeId: string; goalStatus: string; goalTitle: string; goalVersion: number }> {
  const result = await checkInMutationContext(goalId, input)
  return { employeeId: result.employeeId, goalStatus: result.goalStatus, goalTitle: result.goalTitle, goalVersion: result.goalVersion }
}

function mapCheckIn(row: CheckInRow): TalentGoalCheckIn {
  return {
    id: row.id,
    goal_id: row.goal_id,
    employee_id: row.employee_id,
    entry_type: row.entry_type,
    body: row.body,
    follow_up_title: row.follow_up_title,
    follow_up_due_on: row.follow_up_due_on,
    status: row.status,
    version: row.version,
    created_at: row.created_at,
    completed_at: row.completed_at,
  }
}

export async function listTalentGoalCheckIns(goalId: string): Promise<TalentGoalCheckIn[]> {
  const { supabase, context } = await goalContext(goalId)
  const { data, error } = await supabase
    .from('talent_goal_check_ins')
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new TalentCheckInError('TALENT_CHECKIN_READ_FAILED')
  return (data ?? []).map((row) => mapCheckIn(row as CheckInRow))
}

export async function listMyTalentGoalCheckIns(goalId: string): Promise<TalentGoalCheckInMetadata[]> {
  const context = await requireAuthContext()
  if (!context.employeeId) throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
  try {
    await requirePermission('self:talent-goal:read', context.employeeId)
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error
    throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
  }
  await requireTenantModule('TALENT')

  const supabase = await createClient()
  const { data: goal, error: goalError } = await supabase
    .from('talent_development_goals')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('id', goalId)
    .eq('employee_id', context.employeeId)
    .maybeSingle()
  if (goalError) throw new TalentCheckInError('TALENT_GOAL_READ_FAILED')
  if (!goal) throw new TalentCheckInError('TALENT_GOAL_NOT_FOUND', 404)

  const { data, error } = await supabase
    .from('talent_goal_check_ins')
    .select('id,goal_id,employee_id,entry_type,follow_up_due_on,status,created_at,completed_at')
    .eq('tenant_id', context.tenantId)
    .eq('goal_id', goalId)
    .eq('employee_id', context.employeeId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new TalentCheckInError('TALENT_CHECKIN_READ_FAILED')
  return (data ?? []) as TalentGoalCheckInMetadata[]
}

export async function createTalentGoalCheckIn(goalId: string, input: TalentCheckInCreateInput): Promise<string> {
  const { context, supabase, employeeId } = await checkInMutationContext(goalId, input)
  const insert: CheckInInsert = {
    tenant_id: context.tenantId,
    goal_id: goalId,
    employee_id: employeeId,
    entry_type: input.entryType,
    author_user_id: context.userId,
    author_employee_id: context.employeeId,
    body: input.body,
    follow_up_title: input.followUpTitle ?? null,
    follow_up_due_on: input.followUpDueOn ?? null,
    status: 'OPEN',
  }
  const { data, error } = await supabase.from('talent_goal_check_ins').insert(insert).select('id').single()
  if (error || !data) {
    if (error) checkInDatabaseError(error.message, 'TALENT_CHECKIN_CREATE_FAILED', error.code)
    throw new TalentCheckInError('TALENT_CHECKIN_CREATE_FAILED', 400)
  }
  return data.id
}

export async function updateTalentGoalCheckIn(checkInId: string, input: TalentCheckInUpdateInput): Promise<void> {
  const context = await requireAuthContext()
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: current, error: readError } = await supabase
    .from('talent_goal_check_ins')
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('id', checkInId)
    .maybeSingle()
  if (readError || !current) throw new TalentCheckInError('TALENT_CHECKIN_NOT_FOUND', 404)
  try {
    await requirePermission('talent-goal:write', current.employee_id)
  } catch {
    throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
  }
  const isAdmin = context.permissions.includes('talent-goal:manage')
  const isSelf = context.employeeId === current.employee_id
  if (!isAdmin && (isSelf ? current.entry_type !== 'EMPLOYEE_REFLECTION' : current.entry_type === 'EMPLOYEE_REFLECTION')) {
    throw new TalentCheckInError('TALENT_CHECKIN_ENTRY_TYPE_FORBIDDEN', 403)
  }
  if (current.status !== 'OPEN') throw new TalentCheckInError('TALENT_CHECKIN_STATUS_LOCKED', 409)
  if (current.entry_type !== 'FOLLOW_UP' && (input.followUpTitle || input.followUpDueOn)) throw new TalentCheckInError('TALENT_CHECKIN_FOLLOW_UP_NOT_ALLOWED', 400)
  if (current.entry_type === 'FOLLOW_UP' && input.followUpTitle === null) throw new TalentCheckInError('TALENT_CHECKIN_FOLLOW_UP_TITLE_REQUIRED', 400)
  const update: CheckInUpdate = { version: input.version + 1 }
  if (input.body !== undefined) update.body = input.body
  if (input.followUpTitle !== undefined) update.follow_up_title = input.followUpTitle
  if (input.followUpDueOn !== undefined) update.follow_up_due_on = input.followUpDueOn
  if (input.status !== undefined) update.status = input.status
  const { data, error } = await supabase
    .from('talent_goal_check_ins')
    .update(update)
    .eq('tenant_id', context.tenantId)
    .eq('id', checkInId)
    .eq('version', input.version)
    .select('id')
    .maybeSingle()
  if (error) checkInDatabaseError(error.message, 'TALENT_CHECKIN_UPDATE_FAILED', error.code)
  if (!data) throw new TalentCheckInError('TALENT_CHECKIN_VERSION_CONFLICT', 409)
}

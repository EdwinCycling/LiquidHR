import type { Database } from '@scope/db'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type { TalentCheckInCreateInput, TalentCheckInUpdateInput } from './check-in-schemas'

type CheckInRow = Database['public']['Tables']['talent_goal_check_ins']['Row']
type CheckInInsert = Database['public']['Tables']['talent_goal_check_ins']['Insert']
type CheckInUpdate = Database['public']['Tables']['talent_goal_check_ins']['Update']

export type TalentGoalCheckIn = Pick<CheckInRow, 'id' | 'goal_id' | 'employee_id' | 'entry_type' | 'body' | 'follow_up_title' | 'follow_up_due_on' | 'status' | 'version' | 'created_at' | 'completed_at'>

export class TalentCheckInError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'TalentCheckInError'
  }
}

async function goalContext(goalId: string): Promise<{ context: AuthContext; supabase: Awaited<ReturnType<typeof createClient>>; employeeId: string }> {
  const context = await requireAuthContext()
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: goal, error } = await supabase
    .from('talent_development_goals')
    .select('employee_id')
    .eq('tenant_id', context.tenantId)
    .eq('id', goalId)
    .maybeSingle()
  if (error || !goal) throw new TalentCheckInError('TALENT_GOAL_NOT_FOUND', 404)
  try {
    await requirePermission('talent-goal:read', goal.employee_id)
  } catch {
    throw new TalentCheckInError('TALENT_CHECKIN_FORBIDDEN', 403)
  }
  return { context, supabase, employeeId: goal.employee_id }
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

export async function createTalentGoalCheckIn(goalId: string, input: TalentCheckInCreateInput): Promise<string> {
  const { context, supabase, employeeId } = await goalContext(goalId)
  const isAdmin = context.permissions.includes('talent-goal:manage')
  const isSelf = context.employeeId === employeeId
  if (!isAdmin && (isSelf ? input.entryType !== 'EMPLOYEE_REFLECTION' : input.entryType === 'EMPLOYEE_REFLECTION')) {
    throw new TalentCheckInError('TALENT_CHECKIN_ENTRY_TYPE_FORBIDDEN', 403)
  }
  await requirePermission('talent-goal:write', employeeId)
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
  if (error || !data) throw new TalentCheckInError(error?.message?.includes('VERSION') ? 'TALENT_CHECKIN_VERSION_CONFLICT' : 'TALENT_CHECKIN_CREATE_FAILED', error?.code === '42501' ? 403 : 400)
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
  if (error) throw new TalentCheckInError(error.message.includes('VERSION') ? 'TALENT_CHECKIN_VERSION_CONFLICT' : 'TALENT_CHECKIN_UPDATE_FAILED', error.code === '42501' ? 403 : 400)
  if (!data) throw new TalentCheckInError('TALENT_CHECKIN_VERSION_CONFLICT', 409)
}

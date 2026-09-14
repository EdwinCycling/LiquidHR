import 'server-only'

import { randomUUID } from 'node:crypto'
import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRealtimeVoiceEnabled, resolveRealtimeVoiceModel } from './realtime-voice'
import { isAiImproveAvailable } from './supabase-governance'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type TeamAiScopeType = 'DIRECT_TEAM' | 'DEPARTMENT'

export interface TeamAiMember {
  employeeId: string
  employeeName: string
  jobTitle: string | null
  departmentName: string | null
}

export interface TeamAiDepartmentOption {
  id: string
  name: string
}

export interface TeamAiScope {
  scopeType: TeamAiScopeType
  departmentId: string | null
  contextName: string
  memberIds: string[]
  members: TeamAiMember[]
}

export interface StartPageTeamAiData {
  mode: 'DIRECT_TEAM' | 'DEPARTMENT_SELECTION'
  scopeType: TeamAiScopeType
  contextName: string | null
  departmentId: string | null
  members: TeamAiMember[]
  totalMemberCount: number
  departments: TeamAiDepartmentOption[]
  aiEnabled: boolean
  voiceEnabled: boolean
}

export interface AuthorizedTeamAiSession {
  id: string
  scopeType: TeamAiScopeType
  departmentId: string | null
  contextName: string
  memberIds: string[]
  members: TeamAiMember[]
  modelId: string
  status: 'ACTIVE' | 'ENDED' | 'FAILED'
  startedAt: string
}

export class TeamAiScopeError extends Error {
  constructor(readonly code: 'TEAM_AI_UNAVAILABLE' | 'TEAM_SCOPE_REQUIRED' | 'TEAM_SCOPE_FORBIDDEN' | 'TEAM_SCOPE_NOT_FOUND' | 'TEAM_SESSION_NOT_FOUND' | 'TEAM_SESSION_NOT_ACTIVE' | 'TEAM_SESSION_CREATE_FAILED' | 'TEAM_SESSION_UPDATE_FAILED', readonly status: 400 | 403 | 404 | 409 | 500) {
    super(code)
  }
}

const departmentSelectorRoles = new Set(['TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR'])
const teamAiRoles = new Set(['DIRECT_MANAGER', 'TENANT_ADMIN', 'HR_ADMIN', 'HR_ADVISOR'])

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isDepartmentSelector(auth: AuthContext): boolean {
  return auth.activeRoles.some((role) => departmentSelectorRoles.has(role))
}

function canUseTeamAi(auth: AuthContext): boolean {
  return auth.permissions.includes('start-page:read') && auth.permissions.includes('ai:use') && auth.activeRoles.some((role) => teamAiRoles.has(role))
}

function employeeName(employee: { id: string; first_name: string; birth_name: string }): string {
  return [employee.first_name, employee.birth_name].filter((part) => Boolean(part?.trim())).join(' ').trim() || employee.id
}

async function assignedDepartmentIds(auth: AuthContext, supabase: SupabaseServerClient): Promise<string[]> {
  if (!auth.employeeId) return []
  const groupId = requireHrGroupId(auth)
  const { data, error } = await supabase.from('department_management')
    .select('department_id')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', groupId)
    .eq('employee_id', auth.employeeId)
    .not('department_id', 'is', null)
    .lte('effective_from', today())
    .or(`effective_to.is.null,effective_to.gte.${today()}`)
    .limit(500)
  if (error) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 500)
  return [...new Set(data.flatMap((row) => row.department_id ? [row.department_id] : []))]
}

export async function listTeamAiDepartments(auth: AuthContext, existingClient?: SupabaseServerClient): Promise<TeamAiDepartmentOption[]> {
  if (!canUseTeamAi(auth) || !isDepartmentSelector(auth)) return []
  const supabase = existingClient ?? await createClient()
  const groupId = requireHrGroupId(auth)
  const assignedIds = isDepartmentSelector(auth) && !auth.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
    ? await assignedDepartmentIds(auth, supabase)
    : []
  let query = supabase.from('departments').select('id,name')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', groupId)
    .eq('is_active', true)
    .order('name')
    .limit(500)
  if (assignedIds.length > 0) query = query.in('id', assignedIds)
  if (isDepartmentSelector(auth) && !auth.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN') && assignedIds.length === 0) return []
  const { data, error } = await query
  if (error) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 500)
  return data.map((department) => ({ id: department.id, name: department.name }))
}

async function loadScopeMembers(auth: AuthContext, employeeIds: string[], departmentId: string | null, scopeType: TeamAiScopeType, contextName: string, supabase: SupabaseServerClient): Promise<TeamAiScope> {
  const groupId = requireHrGroupId(auth)
  const uniqueIds = [...new Set(employeeIds)].filter((employeeId) => employeeId !== auth.employeeId)
  if (uniqueIds.length === 0) {
    return { scopeType, departmentId, contextName, memberIds: [], members: [] }
  }

  const [employeesResult, placementsResult] = await Promise.all([
    supabase.from('employees').select('id,first_name,birth_name').eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).in('id', uniqueIds).eq('is_archived', false).is('deleted_at', null).limit(1000),
    supabase.from('employee_organizations').select('employee_id,department_id,job_title,effective_from').eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).in('employee_id', uniqueIds).lte('effective_from', today()).or(`effective_to.is.null,effective_to.gte.${today()}`).order('effective_from', { ascending: false }).limit(2000),
  ])
  if (employeesResult.error || placementsResult.error) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 500)

  const placements = new Map<string, (typeof placementsResult.data)[number]>()
  for (const placement of placementsResult.data) if (!placements.has(placement.employee_id)) placements.set(placement.employee_id, placement)
  const departmentIds = [...new Set([...placements.values()].map((placement) => placement.department_id))]
  const departmentsResult = departmentIds.length
    ? await supabase.from('departments').select('id,name').eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).in('id', departmentIds)
    : { data: [], error: null }
  if (departmentsResult.error) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 500)
  const departmentNames = new Map((departmentsResult.data ?? []).map((department) => [department.id, department.name]))
  const members = employeesResult.data.map((employee) => {
    const placement = placements.get(employee.id)
    return {
      employeeId: employee.id,
      employeeName: employeeName(employee),
      jobTitle: placement?.job_title ?? null,
      departmentName: placement ? departmentNames.get(placement.department_id) ?? null : null,
    }
  }).sort((left, right) => left.employeeName.localeCompare(right.employeeName, 'nl'))
  return { scopeType, departmentId, contextName, memberIds: members.map((member) => member.employeeId), members }
}

export async function resolveTeamAiScope(auth: AuthContext, departmentId?: string | null, existingClient?: SupabaseServerClient): Promise<TeamAiScope> {
  if (!canUseTeamAi(auth)) throw new TeamAiScopeError('TEAM_SCOPE_FORBIDDEN', 403)
  const supabase = existingClient ?? await createClient()
  const groupId = requireHrGroupId(auth)

  if (isDepartmentSelector(auth)) {
    if (!departmentId) throw new TeamAiScopeError('TEAM_SCOPE_REQUIRED', 400)
    const { data: department, error } = await supabase.from('departments').select('id,name,is_active').eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).eq('id', departmentId).maybeSingle()
    if (error) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 500)
    if (!department?.is_active) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 404)
    if (auth.activeRoles.includes('HR_ADVISOR') && !auth.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')) {
      const assigned = await assignedDepartmentIds(auth, supabase)
      if (!assigned.includes(departmentId)) throw new TeamAiScopeError('TEAM_SCOPE_FORBIDDEN', 403)
    }
    const { data: placements, error: placementError } = await supabase.from('employee_organizations').select('employee_id').eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).eq('department_id', departmentId).lte('effective_from', today()).or(`effective_to.is.null,effective_to.gte.${today()}`).limit(2000)
    if (placementError) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 500)
    return loadScopeMembers(auth, placements.map((placement) => placement.employee_id), departmentId, 'DEPARTMENT', department.name, supabase)
  }

  if (departmentId) throw new TeamAiScopeError('TEAM_SCOPE_FORBIDDEN', 403)
  if (!auth.activeRoles.includes('DIRECT_MANAGER')) throw new TeamAiScopeError('TEAM_SCOPE_FORBIDDEN', 403)
  const directIds = await listDirectTeamEmployeeIds(auth, supabase)
  return loadScopeMembers(auth, directIds, null, 'DIRECT_TEAM', 'Mijn team', supabase)
}

export async function getTeamAiStartPageData(auth: AuthContext, existingClient?: SupabaseServerClient): Promise<StartPageTeamAiData | null> {
  if (!canUseTeamAi(auth)) return null
  const supabase = existingClient ?? await createClient()
  try {
    const departmentSelection = isDepartmentSelector(auth)
    const departments = departmentSelection ? await listTeamAiDepartments(auth, supabase) : []
    if (departmentSelection) {
      return {
        mode: 'DEPARTMENT_SELECTION',
        scopeType: 'DEPARTMENT',
        contextName: null,
        departmentId: null,
        members: [],
        totalMemberCount: 0,
        departments,
        aiEnabled: isAiImproveAvailable(),
        voiceEnabled: isRealtimeVoiceEnabled() && isAiImproveAvailable(),
      }
    }
    const scope = await resolveTeamAiScope(auth, null, supabase)
    return {
      mode: 'DIRECT_TEAM',
      scopeType: scope.scopeType,
      contextName: scope.contextName,
      departmentId: null,
      members: scope.members,
      totalMemberCount: scope.memberIds.length,
      departments: [],
      aiEnabled: isAiImproveAvailable(),
      voiceEnabled: isRealtimeVoiceEnabled() && isAiImproveAvailable(),
    }
  } catch (error) {
    if (error instanceof TeamAiScopeError && error.status < 500) return null
    return null
  }
}

export async function createTeamAiSession(input: { auth: AuthContext; scope: TeamAiScope; conversationType?: 'VOICE' | 'TEXT'; model?: string }): Promise<string> {
  if (input.scope.memberIds.length === 0) throw new TeamAiScopeError('TEAM_SCOPE_NOT_FOUND', 404)
  const groupId = requireHrGroupId(input.auth)
  const id = randomUUID()
  const admin = createAdminClient()
  const { error } = await admin.from('ai_team_sessions').insert({
    id,
    tenant_id: input.auth.tenantId,
    hr_group_id: groupId,
    actor_user_id: input.auth.userId,
    actor_employee_id: input.auth.employeeId,
    administration_id: input.auth.administrationId,
    context_department_id: input.scope.departmentId,
    context_name_snapshot: input.scope.contextName,
    scope_type: input.scope.scopeType,
    conversation_type: input.conversationType ?? 'VOICE',
    model_id: input.model ?? resolveRealtimeVoiceModel(),
    status: 'ACTIVE',
    authorized_employee_count: input.scope.memberIds.length,
  })
  if (error) throw new TeamAiScopeError('TEAM_SESSION_CREATE_FAILED', 500)
  const { error: memberError } = await admin.from('ai_team_session_members').insert(input.scope.memberIds.map((employeeId) => ({ session_id: id, tenant_id: input.auth.tenantId, hr_group_id: groupId, employee_id: employeeId })))
  if (memberError) {
    await admin.from('ai_team_sessions').update({ status: 'FAILED', ended_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', input.auth.tenantId).eq('hr_group_id', groupId)
    throw new TeamAiScopeError('TEAM_SESSION_CREATE_FAILED', 500)
  }
  return id
}

export async function getAuthorizedTeamAiSession(auth: AuthContext, sessionId: string, options: { activeOnly?: boolean } = {}): Promise<AuthorizedTeamAiSession> {
  const groupId = requireHrGroupId(auth)
  const admin = createAdminClient()
  const { data: session, error } = await admin.from('ai_team_sessions').select('id,scope_type,context_department_id,context_name_snapshot,model_id,status,started_at').eq('id', sessionId).eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).eq('actor_user_id', auth.userId).maybeSingle()
  if (error) throw new TeamAiScopeError('TEAM_SESSION_NOT_FOUND', 500)
  if (!session) throw new TeamAiScopeError('TEAM_SESSION_NOT_FOUND', 404)
  if (options.activeOnly && session.status !== 'ACTIVE') throw new TeamAiScopeError('TEAM_SESSION_NOT_ACTIVE', 409)
  const { data: members, error: memberError } = await admin.from('ai_team_session_members').select('employee_id').eq('session_id', session.id).eq('tenant_id', auth.tenantId).eq('hr_group_id', groupId).limit(2000)
  if (memberError) throw new TeamAiScopeError('TEAM_SESSION_NOT_FOUND', 500)
  const scope = await loadScopeMembers(auth, members.map((member) => member.employee_id), session.context_department_id, session.scope_type as TeamAiScopeType, session.context_name_snapshot, await createClient())
  return { id: session.id, scopeType: session.scope_type as TeamAiScopeType, departmentId: session.context_department_id, contextName: session.context_name_snapshot, memberIds: scope.memberIds, members: scope.members, modelId: session.model_id, status: session.status as AuthorizedTeamAiSession['status'], startedAt: session.started_at }
}

export async function finishTeamAiSession(input: { auth: AuthContext; sessionId: string; toolCallCount: number }): Promise<void> {
  const groupId = requireHrGroupId(input.auth)
  const admin = createAdminClient()
  const { data: existing, error } = await admin.from('ai_team_sessions').select('started_at').eq('id', input.sessionId).eq('tenant_id', input.auth.tenantId).eq('hr_group_id', groupId).eq('actor_user_id', input.auth.userId).eq('status', 'ACTIVE').maybeSingle()
  if (error || !existing) return
  const endedAt = new Date()
  const startedAt = new Date(existing.started_at)
  const durationSeconds = Number.isFinite(startedAt.valueOf()) ? Math.max(0, Math.ceil((endedAt.valueOf() - startedAt.valueOf()) / 1000)) : 0
  const { error: updateError } = await admin.from('ai_team_sessions').update({ status: 'ENDED', ended_at: endedAt.toISOString(), duration_seconds: durationSeconds, tool_call_count: input.toolCallCount }).eq('id', input.sessionId).eq('tenant_id', input.auth.tenantId).eq('hr_group_id', groupId).eq('actor_user_id', input.auth.userId).eq('status', 'ACTIVE')
  if (updateError) throw new TeamAiScopeError('TEAM_SESSION_UPDATE_FAILED', 500)
}

export async function failTeamAiSession(input: { auth: AuthContext; sessionId: string }): Promise<void> {
  const groupId = requireHrGroupId(input.auth)
  await createAdminClient().from('ai_team_sessions').update({ status: 'FAILED', ended_at: new Date().toISOString() }).eq('id', input.sessionId).eq('tenant_id', input.auth.tenantId).eq('hr_group_id', groupId).eq('actor_user_id', input.auth.userId).eq('status', 'ACTIVE')
}

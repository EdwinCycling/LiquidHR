import 'server-only'

import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizedTeamAiSession } from '@/lib/ai/team-scope'
import type { AiTeamSummaryLogbookEntryCreateInput, PersonalLogbookEntryCreateInput, PersonalLogbookEntryUpdateInput } from './schemas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface PersonalLogbookEntry {
  id: string
  title: string
  description: string
  source: 'MANUAL' | 'AI_TEAM_SUMMARY'
  sourceSessionId: string | null
  contextName: string | null
  contextDepartmentId: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonalLogbookSummary {
  totalCount: number
  latestCreatedAt: string | null
  manualCount: number
  aiCount: number
}

interface LogbookRow {
  id: string
  title: string
  description: string
  source: string
  source_session_id: string | null
  context_name_snapshot: string | null
  context_department_id: string | null
  created_at: string
  updated_at: string
}

interface LogbookSummaryRow {
  source: string
  created_at: string
}

export class LogbookServiceError extends Error {
  constructor(readonly code: 'LOGBOOK_READ_FAILED' | 'LOGBOOK_CREATE_FAILED' | 'LOGBOOK_UPDATE_FAILED' | 'LOGBOOK_DELETE_FAILED' | 'LOGBOOK_NOT_FOUND' | 'LOGBOOK_SESSION_INVALID', readonly status: 400 | 403 | 404 | 409 | 500) {
    super(code)
  }
}

interface ContextDependencies {
  context: AuthContext
  supabase: SupabaseServerClient
}

async function dependenciesFor(permission: string, dependencies?: ContextDependencies): Promise<ContextDependencies> {
  if (dependencies) {
    if (!dependencies.context.permissions.includes(permission)) throw new LogbookServiceError('LOGBOOK_READ_FAILED', 403)
    return dependencies
  }
  const context = await requirePermission(permission)
  return { context, supabase: await createClient() }
}

function mapEntry(row: LogbookRow): PersonalLogbookEntry {
  if (row.source !== 'MANUAL' && row.source !== 'AI_TEAM_SUMMARY') throw new LogbookServiceError('LOGBOOK_READ_FAILED', 500)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    source: row.source,
    sourceSessionId: row.source_session_id,
    contextName: row.context_name_snapshot,
    contextDepartmentId: row.context_department_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const entryColumns = 'id,title,description,source,source_session_id,context_name_snapshot,context_department_id,created_at,updated_at'

export async function listPersonalLogbookEntries(limit = 200, dependencies?: ContextDependencies): Promise<PersonalLogbookEntry[]> {
  const resolved = await dependenciesFor('logbook:read', dependencies)
  const groupId = requireHrGroupId(resolved.context)
  const { data, error } = await resolved.supabase.from('personal_logbook_entries').select(entryColumns).eq('tenant_id', resolved.context.tenantId).eq('hr_group_id', groupId).eq('owner_user_id', resolved.context.userId).order('created_at', { ascending: false }).limit(Math.max(1, Math.min(limit, 200)))
  if (error) throw new LogbookServiceError('LOGBOOK_READ_FAILED', 500)
  return (data as LogbookRow[]).map(mapEntry)
}

export async function getPersonalLogbookSummary(dependencies?: ContextDependencies): Promise<PersonalLogbookSummary> {
  const resolved = await dependenciesFor('logbook:read', dependencies)
  const groupId = requireHrGroupId(resolved.context)
  const { data, count, error } = await resolved.supabase.from('personal_logbook_entries')
    .select('source,created_at', { count: 'exact' })
    .eq('tenant_id', resolved.context.tenantId)
    .eq('hr_group_id', groupId)
    .eq('owner_user_id', resolved.context.userId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new LogbookServiceError('LOGBOOK_READ_FAILED', 500)
  const rows = (data as LogbookSummaryRow[])
  return {
    totalCount: count ?? rows.length,
    latestCreatedAt: rows[0]?.created_at ?? null,
    manualCount: rows.filter((row) => row.source === 'MANUAL').length,
    aiCount: rows.filter((row) => row.source === 'AI_TEAM_SUMMARY').length,
  }
}

export async function createManualPersonalLogbookEntry(input: PersonalLogbookEntryCreateInput, dependencies?: ContextDependencies): Promise<PersonalLogbookEntry> {
  const resolved = await dependenciesFor('logbook:write', dependencies)
  const groupId = requireHrGroupId(resolved.context)
  const { data, error } = await resolved.supabase.from('personal_logbook_entries').insert({
    tenant_id: resolved.context.tenantId,
    hr_group_id: groupId,
    owner_user_id: resolved.context.userId,
    administration_id: resolved.context.administrationId,
    context_department_id: null,
    context_name_snapshot: null,
    source: 'MANUAL',
    source_session_id: null,
    title: input.title,
    description: input.description,
  }).select(entryColumns).single()
  if (error || !data) throw new LogbookServiceError('LOGBOOK_CREATE_FAILED', 500)
  return mapEntry(data as LogbookRow)
}

export async function createAiTeamSummaryLogbookEntry(input: AiTeamSummaryLogbookEntryCreateInput, dependencies?: ContextDependencies): Promise<PersonalLogbookEntry> {
  const resolved = await dependenciesFor('logbook:write', dependencies)
  const session = await getAuthorizedTeamAiSession(resolved.context, input.sessionId)
  if (session.status !== 'ENDED') throw new LogbookServiceError('LOGBOOK_SESSION_INVALID', 409)
  const groupId = requireHrGroupId(resolved.context)
  const { data, error } = await resolved.supabase.from('personal_logbook_entries').insert({
    tenant_id: resolved.context.tenantId,
    hr_group_id: groupId,
    owner_user_id: resolved.context.userId,
    administration_id: resolved.context.administrationId,
    context_department_id: session.departmentId,
    context_name_snapshot: session.contextName,
    source: 'AI_TEAM_SUMMARY',
    source_session_id: session.id,
    title: input.title,
    description: input.description,
  }).select(entryColumns).single()
  if (error || !data) throw new LogbookServiceError('LOGBOOK_CREATE_FAILED', 500)
  return mapEntry(data as LogbookRow)
}

export async function updatePersonalLogbookEntry(entryId: string, input: PersonalLogbookEntryUpdateInput): Promise<PersonalLogbookEntry> {
  const context = await requirePermission('logbook:write')
  const groupId = requireHrGroupId(context)
  const { data, error } = await (await createClient()).from('personal_logbook_entries').update(input).eq('id', entryId).eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).eq('owner_user_id', context.userId).select(entryColumns).maybeSingle()
  if (error) throw new LogbookServiceError('LOGBOOK_UPDATE_FAILED', 500)
  if (!data) throw new LogbookServiceError('LOGBOOK_NOT_FOUND', 404)
  return mapEntry(data as LogbookRow)
}

export async function deletePersonalLogbookEntry(entryId: string): Promise<void> {
  const context = await requirePermission('logbook:delete')
  const groupId = requireHrGroupId(context)
  const { data, error } = await (await createClient()).from('personal_logbook_entries').delete().eq('id', entryId).eq('tenant_id', context.tenantId).eq('hr_group_id', groupId).eq('owner_user_id', context.userId).select('id').maybeSingle()
  if (error) throw new LogbookServiceError('LOGBOOK_DELETE_FAILED', 500)
  if (!data) throw new LogbookServiceError('LOGBOOK_NOT_FOUND', 404)
}

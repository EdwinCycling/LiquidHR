import 'server-only'
import type { Json } from '@scope/db'
import { z } from 'zod'
import { AuthenticationError, AuthorizationError, requireAnyPermission, requireAuthContext, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { ContextAccessError, ContextSelectionRequiredError } from '@/lib/context/administration-context'
import { ContextAuthenticationError } from '@/lib/context/server-context'
import { compileProcessDefinition } from '@/lib/process-automation/definition-compiler'
import { postgresUuidSchema, wvpCommandSchema, type WvpCommand } from './domain'
import { wvpProcessDefinition } from './process-definition'

const caseSchema = z.object({
  id: postgresUuidSchema, employeeId: postgresUuidSchema, employmentId: postgresUuidSchema, administrationId: postgresUuidSchema,
  name: z.string(), status: z.enum(['ACTIVE', 'RECOVERY_WINDOW', 'CLOSED']), firstAbsenceOn: z.iso.date(), clockStartOn: z.iso.date(),
  pendingConfirmation: z.boolean(), processInstanceId: postgresUuidSchema.nullable(), closedAt: z.string().nullable(), canManage: z.boolean(),
  // SQL boolean comparisons return NULL when the actor has no employee link; that is never self-access.
  isSelf: z.boolean().nullable().transform(value => value ?? false),
  currentMilestone: z.string().nullable(),
  tasks: z.array(z.object({ id: postgresUuidSchema, code: z.string(), dueOn: z.iso.date(), status: z.string(), completedAt: z.string().nullable() })),
  events: z.array(z.object({ id: postgresUuidSchema, type: z.string(), occurredOn: z.iso.date(), createdAt: z.string(), actorUserId: postgresUuidSchema, taskId: postgresUuidSchema.nullable(), agreement: z.string().nullable(), reviewOn: z.iso.date().nullable(), agreementId: postgresUuidSchema.nullable() })),
  capacity: z.array(z.object({ effectiveOn: z.iso.date(), absencePercentage: z.number(), reviewOn: z.iso.date().nullable() })),
  spells: z.array(z.object({ startedOn: z.iso.date(), recoveredOn: z.iso.date().nullable() })),
})
export type WvpCase = z.infer<typeof caseSchema> & { canConfirm: boolean; canStartProcess: boolean }
export class WvpError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code) }
}
function rpcFailure(error: { code?: string; message: string }): never {
  if (['PGRST202', '42P01', '42883'].includes(error.code ?? '')) throw new WvpError('WVP_SCHEMA_REQUIRED', 503)
  const code = error.message.match(/\bWVP_[A-Z_]+\b/)?.[0]
  if (error.code === '42501') throw new WvpError('WVP_FORBIDDEN', 403)
  throw new WvpError(code ?? 'WVP_OPERATION_FAILED', code ? 409 : 500)
}
export async function listWvpCases(caseId?: string): Promise<WvpCase[]> {
  if (caseId) postgresUuidSchema.parse(caseId)
  const auth = await requireAnyPermission(['absence:read', 'self:absence:read'])
  const db = await createClient()
  const { data, error } = await db.rpc('wvp_list', { requested_tenant_id: auth.tenantId, requested_hr_group_id: requireHrGroupId(auth), requested_administration_id: auth.administrationId, requested_case_id: caseId ?? null })
  if (error) rpcFailure(error)
  return z.array(caseSchema).parse(data).map(item => ({
    ...item,
    canConfirm: item.canManage && auth.permissions.includes('process-task:act'),
    canStartProcess: item.canManage && auth.permissions.includes('process-definition:write') && auth.permissions.includes('process-definition:publish'),
  }))
}

async function ensureDefinition(target: WvpCase): Promise<string> {
  const auth = await requirePermission('process-definition:write')
  await requirePermission('process-definition:publish')
  const db = await createClient()
  const key = `wvp01-${target.administrationId.replaceAll('-', '')}`
  const { data: existing, error: readError } = await db.from('process_definitions').select('id,status').eq('tenant_id', auth.tenantId).eq('hr_group_id', requireHrGroupId(auth)).eq('administration_id', target.administrationId).eq('key', key).maybeSingle()
  if (readError) rpcFailure(readError)
  if (existing?.status === 'PUBLISHED') return existing.id
  // Een bestaande afwijkende draft wordt nooit stilzwijgend overschreven.
  if (existing) throw new WvpError('WVP_DEFINITION_CONFLICT')
  const draft = { ...wvpProcessDefinition, key }
  const compiled = compileProcessDefinition(draft)
  const created = await db.rpc('create_process_definition_draft', {
    requested_tenant_id: auth.tenantId, requested_hr_group_id: requireHrGroupId(auth), requested_scope_type: 'ADMINISTRATION', requested_administration_id: target.administrationId,
    requested_key: key, requested_title: draft.title, requested_description: draft.description as Json, requested_definition: draft as unknown as Json, requested_validation_report: {},
  })
  if (created.error) rpcFailure(created.error)
  const identity = z.object({ id: postgresUuidSchema, revision: z.number() }).parse(created.data)
  const published = await db.rpc('publish_process_definition_draft', {
    requested_definition_id: identity.id, requested_expected_revision: identity.revision, requested_compiled_definition: compiled as unknown as Json,
    requested_definition_hash: compiled.hash, requested_schema_version: compiled.schemaVersion, requested_compiler_version: compiled.compilerVersion, requested_changelog: 'WVP01 — verzuimbegeleiding en werkhervatting',
  })
  if (published.error) rpcFailure(published.error)
  return identity.id
}

export async function executeWvpCommand(input: unknown): Promise<string> {
  const command: WvpCommand = wvpCommandSchema.parse(input)
  const auth = await requireAuthContext()
  const target = (await listWvpCases(command.caseId))[0]
  if (!target || (command.action === 'ACKNOWLEDGE' ? !target.isSelf : !target.canManage)) throw new WvpError('WVP_FORBIDDEN', 403)
  if (command.action === 'START' && target.processInstanceId) {
    await requirePermission('process-definition:write')
    await requirePermission('process-definition:publish')
    return target.processInstanceId
  }
  const processDefinitionId = command.action === 'START' ? await ensureDefinition(target) : undefined
  const db = await createClient()
  const payload = processDefinitionId ? { ...command, processDefinitionId } : command
  const { data, error } = await db.rpc('wvp_command', { requested_tenant_id: auth.tenantId, requested_hr_group_id: requireHrGroupId(auth), requested_administration_id: auth.administrationId, command: payload as unknown as Json })
  if (error) rpcFailure(error)
  return data
}
export function wvpErrorStatus(error: unknown): number {
  return error instanceof WvpError ? error.status : error instanceof AuthenticationError || error instanceof ContextAuthenticationError ? 401 : error instanceof AuthorizationError || error instanceof ContextAccessError ? 403 : error instanceof ContextSelectionRequiredError ? 409 : error instanceof z.ZodError ? 400 : 500
}

export async function wvpCaseForProcess(processInstanceId: string): Promise<string | null> {
  await requireAuthContext()
  const db = await createClient()
  const { data, error } = await db.rpc('wvp_case_for_process', { requested_process_instance_id: processInstanceId })
  if (error) rpcFailure(error)
  return data || null
}

import 'server-only'

import { getRequestAuthorizationContext, getSelfPermissions, requireHrGroupId, requirePermission, AuthorizationError } from '@/lib/auth/permissions'
import { createEmployeeSystemActivity } from '@/lib/employees/employee-activity-service'
import { EmployeeServiceError } from '@/lib/employees/errors'
import { isPostgresConflict, toEmployeeUpdate } from '@/lib/employees/employee-mappers'
import type { FocusProfileUpdateInput, RelationInput } from '@/lib/employees/schemas'
import { resolveFocusActAsSession } from './act-as-token'

type FocusRequestAuthorizationContext = Awaited<ReturnType<typeof getRequestAuthorizationContext>>

async function authorizeFocusWrite(
  employeeId: string,
  actAsToken: string | null | undefined,
  selfPermission: 'self:employee:write' | 'self:relation:write',
): Promise<FocusRequestAuthorizationContext> {
  const requestContext = await getRequestAuthorizationContext()

  if (actAsToken) {
    const session = await resolveFocusActAsSession(actAsToken, requestContext.context, requestContext.supabase)
    if (!session || session.subjectEmployeeId !== employeeId) throw new AuthorizationError('Deze Focus-sessie heeft geen toegang tot dit profiel.')

    const selfPermissions = await getSelfPermissions(requestContext.supabase, requestContext.context.tenantId)
    if (!selfPermissions.includes(selfPermission)) throw new AuthorizationError('Je hebt geen recht om deze profielgegevens te wijzigen.')
    if (!requestContext.context.permissions.includes('employee:write')) throw new AuthorizationError('Je hebt geen recht om deze medewerker te wijzigen.')
    return requestContext
  }

  if (requestContext.context.employeeId !== employeeId) throw new AuthorizationError('Je kunt alleen je eigen profiel wijzigen.')
  await requirePermission(selfPermission, employeeId)
  return requestContext
}

export async function updateFocusEmployeeProfile(
  employeeId: string,
  input: FocusProfileUpdateInput,
  actAsToken?: string | null,
): Promise<{ updatedAt: string }> {
  const requestContext = await authorizeFocusWrite(employeeId, actAsToken, 'self:employee:write')
  const { context, supabase } = requestContext
  const { data, error } = await supabase
    .from('employees')
    .update(toEmployeeUpdate(input))
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', requireHrGroupId(context))
    .eq('id', employeeId)
    .eq('updated_at', input.updatedAt)
    .is('deleted_at', null)
    .select('updated_at')
    .maybeSingle()

  if (isPostgresConflict(error)) throw new EmployeeServiceError('EMPLOYEE_UPDATE_CONFLICT', 409)
  if (error) throw new EmployeeServiceError('EMPLOYEE_UPDATE_FAILED', 500)
  if (!data) throw new EmployeeServiceError('EMPLOYEE_CONCURRENCY_CONFLICT', 409)
  await createEmployeeSystemActivity(employeeId, 'employeeUpdated')
  return { updatedAt: data.updated_at }
}

export async function createFocusEmployeeRelation(
  employeeId: string,
  input: RelationInput,
  actAsToken?: string | null,
): Promise<string> {
  const requestContext = await authorizeFocusWrite(employeeId, actAsToken, 'self:relation:write')
  const { data, error } = await requestContext.supabase.from('employee_relations').insert({
    tenant_id: requestContext.context.tenantId,
    employee_id: employeeId,
    relation_type: input.relationType,
    is_emergency_contact: input.isEmergencyContact,
    first_name: input.firstName ?? null,
    initials: input.initials ?? null,
    prefix: input.prefix ?? null,
    last_name: input.lastName,
    gender: input.gender ?? null,
    birth_date: input.birthDate ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    email: input.email?.toLowerCase() ?? null,
    notes: input.notes ?? null,
  }).select('id').single()

  if (error?.code === '23503') throw new EmployeeServiceError('RELATION_TYPE_INVALID', 400)
  if (error || !data) throw new EmployeeServiceError('RELATION_CREATE_FAILED', 500)
  await createEmployeeSystemActivity(employeeId, 'relationCreated')
  return data.id
}

export async function updateFocusEmployeeRelation(
  employeeId: string,
  relationId: string,
  input: RelationInput,
  actAsToken?: string | null,
): Promise<void> {
  const requestContext = await authorizeFocusWrite(employeeId, actAsToken, 'self:relation:write')
  const { data, error } = await requestContext.supabase.from('employee_relations').update({
    relation_type: input.relationType,
    is_emergency_contact: input.isEmergencyContact,
    first_name: input.firstName ?? null,
    initials: input.initials ?? null,
    prefix: input.prefix ?? null,
    last_name: input.lastName,
    gender: input.gender ?? null,
    birth_date: input.birthDate ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    email: input.email?.toLowerCase() ?? null,
    notes: input.notes ?? null,
  }).eq('tenant_id', requestContext.context.tenantId).eq('employee_id', employeeId).eq('id', relationId).is('deleted_at', null).select('id').maybeSingle()

  if (error?.code === '23503') throw new EmployeeServiceError('RELATION_TYPE_INVALID', 400)
  if (error) throw new EmployeeServiceError('RELATION_UPDATE_FAILED', 500)
  if (!data) throw new EmployeeServiceError('RELATION_NOT_FOUND', 404)
  await createEmployeeSystemActivity(employeeId, 'relationUpdated')
}

export async function archiveFocusEmployeeRelation(
  employeeId: string,
  relationId: string,
  actAsToken?: string | null,
): Promise<void> {
  const requestContext = await authorizeFocusWrite(employeeId, actAsToken, 'self:relation:write')
  const { data, error } = await requestContext.supabase.from('employee_relations').update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', requestContext.context.tenantId).eq('employee_id', employeeId).eq('id', relationId).is('deleted_at', null).select('id').maybeSingle()

  if (error) throw new EmployeeServiceError('RELATION_ARCHIVE_FAILED', 500)
  if (!data) throw new EmployeeServiceError('RELATION_NOT_FOUND', 404)
  await createEmployeeSystemActivity(employeeId, 'relationArchived')
}

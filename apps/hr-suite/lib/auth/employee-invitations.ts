import { createInvitation } from '@/lib/auth/invitations'
import { resolveEmployeeInvitationPurpose, type EmployeeInvitationPurpose } from '@/lib/auth/invitation-purpose'
import { InvitationError, type CreatedInvitation } from '@/lib/auth/invitation-rules'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export interface EmployeeInvitationCreated extends CreatedInvitation {
  email: string
  purpose: EmployeeInvitationPurpose
}

/**
 * Employee activation is intentionally a server-canonical flow. The browser
 * may select an employee, but it cannot select the recipient, purpose, role,
 * administration, or scope that will be persisted.
 */
export async function createEmployeeInvitation(employeeId: string, origin: string): Promise<EmployeeInvitationCreated> {
  const context = await requirePermission('user:invite')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id,tenant_id,hr_group_id,private_email,auth_user_id')
    .eq('id', employeeId)
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .maybeSingle()

  if (employeeError) throw employeeError
  if (!employee) throw new InvitationError('EMPLOYEE_NOT_FOUND', 404)
  if (employee.auth_user_id) throw new InvitationError('EMPLOYEE_ALREADY_ACTIVATED', 409)
  if (!employee.private_email) throw new InvitationError('PRIVATE_EMAIL_REQUIRED', 400)

  const [{ data: employments, error: employmentError }, { data: employeeRole, error: roleError }] = await Promise.all([
    supabase
      .from('employments')
      .select('starts_on,ends_on,record_status,deleted_at')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('employee_id', employee.id)
      .eq('record_status', 'CONFIRMED')
      .is('deleted_at', null)
      .order('starts_on', { ascending: true })
      .limit(100),
    supabase
      .from('management_roles')
      .select('id')
      .eq('code', 'EMPLOYEE')
      .is('tenant_id', null)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (employmentError) throw employmentError
  if (roleError) throw roleError
  if (!employeeRole) throw new InvitationError('INVITATION_CREATE_FAILED', 400)

  const purpose = resolveEmployeeInvitationPurpose(
    new Date().toISOString().slice(0, 10),
    (employments ?? []).map((employment) => ({
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      recordStatus: employment.record_status,
      deletedAt: employment.deleted_at,
    })),
  )

  // Employee access is intentionally tenant-scoped. HR-group authorization is
  // enforced by the caller context and the target lookup above; the accepted
  // user is then projected into the tenant's canonical group access model.
  const invitation = await createInvitation({
    email: employee.private_email,
    emailKind: 'PRIVATE',
    purpose,
    employeeId: employee.id,
    administrationId: null,
    managementRoleId: employeeRole.id,
    scopeType: 'TENANT',
    origin,
  })

  return { ...invitation, email: employee.private_email, purpose }
}

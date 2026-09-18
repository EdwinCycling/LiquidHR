import type { Database } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { getAuthUserLastSignInAt } from '@/lib/auth/auth-user'
import { readEmployeeEssAccess } from '@/lib/auth/employee-ess-access'
import { createEmployeeInvitation } from '@/lib/auth/employee-invitations'
import {
  InvitationError,
  type CreateInvitationInput,
} from '@/lib/auth/invitation-rules'
import { canResendInvitation, resolveInvitationLifecycleStatus, type InvitationLifecycleStatus } from '@/lib/auth/invitation-lifecycle'
import { createInvitation } from '@/lib/auth/invitations'
import {
  resolveEmployeeInvitationEligibility,
  type EmployeeInvitationEligibilityStatus,
  type EmployeeInvitationPurpose,
} from '@/lib/auth/invitation-purpose'

type InvitationRow = Database['public']['Tables']['user_invitations']['Row']

export interface InvitationListItem {
  id: string
  email: string
  purpose: InvitationRow['purpose']
  scopeType: InvitationRow['scope_type']
  employeeId: string | null
  administrationId: string | null
  expiresAt: string
  createdAt: string
  status: InvitationLifecycleStatus
  canResend: boolean
}

export interface InvitationCandidate {
  id: string
  name: string
  email: string | null
  language: string
  active: boolean
  status: InvitationLifecycleStatus
  invitationId: string | null
  invitationPurpose: EmployeeInvitationPurpose | null
  invitationEligibility: EmployeeInvitationEligibilityStatus
}

export interface InvitationDefaults {
  managementRoleId: string
}

export interface EmployeeInvitationAccess {
  employeeId: string
  employeeName: string
  recipientEmail: string | null
  invitationPurpose: EmployeeInvitationPurpose | null
  invitationEligibility: EmployeeInvitationEligibilityStatus
  status: InvitationLifecycleStatus
  invitationId: string | null
  invitationExpiresAt: string | null
  canSend: boolean
  canResend: boolean
  essBlocked: boolean
  lastLoginAt: string | null
  canBlock: boolean
  canUnblock: boolean
  canPreview: boolean
}

function invitationQuery(supabase: Awaited<ReturnType<typeof createClient>>, context: AuthContext) {
  return supabase
    .from('user_invitations')
    .select('id,email,purpose,scope_type,employee_id,administration_id,status,expires_at,created_at')
    .eq('tenant_id', context.tenantId)
    .order('created_at', { ascending: false })
    .limit(250)
}

async function linkedEmployeeIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: readonly Pick<InvitationRow, 'employee_id'>[],
): Promise<Set<string>> {
  const employeeIds = rows.flatMap((row) => row.employee_id ? [row.employee_id] : [])
  if (employeeIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('employees')
    .select('id,auth_user_id')
    .in('id', employeeIds)
    .is('deleted_at', null)
  if (error) throw error
  return new Set((data ?? []).filter((employee) => employee.auth_user_id !== null).map((employee) => employee.id))
}

function toListItem(row: Pick<InvitationRow, 'id' | 'email' | 'purpose' | 'scope_type' | 'employee_id' | 'administration_id' | 'status' | 'expires_at' | 'created_at'>, linkedIds: Set<string>): InvitationListItem {
  const employeeLinked = row.employee_id ? linkedIds.has(row.employee_id) : undefined
  return {
    id: row.id,
    email: row.email,
    purpose: row.purpose,
    scopeType: row.scope_type,
    employeeId: row.employee_id,
    administrationId: row.administration_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    status: resolveInvitationLifecycleStatus({ status: row.status, expiresAt: row.expires_at, employeeLinked }),
    canResend: canResendInvitation({ status: row.status, employeeLinked: employeeLinked === true }),
  }
}

export async function listInvitations(): Promise<InvitationListItem[]> {
  const context = await requirePermission('user:read')
  const supabase = await createClient()
  const { data, error } = await invitationQuery(supabase, context)
  if (error) throw error
  const rows = data ?? []
  const linkedIds = await linkedEmployeeIds(supabase, rows)
  return rows.map((row) => toListItem(row, linkedIds))
}

export async function listInvitationCandidates(): Promise<InvitationCandidate[]> {
  const context = await requirePermission('user:invite')
  const supabase = await createClient()
  const [{ data: employees, error: employeeError }, { data: invitations, error: invitationError }] = await Promise.all([
    supabase
      .from('employees')
      .select('id,first_name,birth_name,private_email,preferred_language,auth_user_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId ?? '')
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('birth_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(1000),
    supabase
      .from('user_invitations')
      .select('id,employee_id,status,expires_at,created_at')
      .eq('tenant_id', context.tenantId)
      .not('employee_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])
  if (employeeError) throw employeeError
  if (invitationError) throw invitationError

  const employeeIds = (employees ?? []).map((employee) => employee.id)
  const { data: employments, error: employmentError } = employeeIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('employments')
      .select('employee_id,starts_on,ends_on,record_status,deleted_at')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId ?? '')
      .in('employee_id', employeeIds)
      .limit(5000)
  if (employmentError) throw employmentError

  const employmentsByEmployee = new Map<string, Array<{ startsOn: string; endsOn: string | null; recordStatus: string; deletedAt: string | null }>>()
  for (const employment of employments ?? []) {
    const current = employmentsByEmployee.get(employment.employee_id) ?? []
    current.push({
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      recordStatus: employment.record_status,
      deletedAt: employment.deleted_at,
    })
    employmentsByEmployee.set(employment.employee_id, current)
  }
  const today = new Date().toISOString().slice(0, 10)

  const latestInvitation = new Map<string, typeof invitations[number]>()
  for (const invitation of invitations ?? []) {
    if (invitation.employee_id && !latestInvitation.has(invitation.employee_id)) latestInvitation.set(invitation.employee_id, invitation)
  }

  return (employees ?? []).map((employee) => {
    const invitation = latestInvitation.get(employee.id)
    const status = employee.auth_user_id
      ? 'ACTIVE'
      : invitation
        ? resolveInvitationLifecycleStatus({ status: invitation.status, expiresAt: invitation.expires_at, employeeLinked: false })
        : 'NOT_ACTIVATED'
    const invitationEligibility = resolveEmployeeInvitationEligibility(today, employmentsByEmployee.get(employee.id) ?? [])
    return {
      id: employee.id,
      name: `${employee.first_name} ${employee.birth_name}`.trim(),
      email: employee.private_email,
      language: employee.preferred_language,
      active: employee.auth_user_id !== null,
      status,
      invitationId: invitation?.id ?? null,
      invitationPurpose: invitationEligibility.purpose,
      invitationEligibility: invitationEligibility.status,
    }
  })
}

export async function getEmployeeInvitationAccess(employeeId: string): Promise<EmployeeInvitationAccess | null> {
  const context = await requirePermission('user:invite')
  const supabase = await createClient()
  const [{ data: employee, error: employeeError }, { data: invitations, error: invitationError }, { data: employments, error: employmentError }] = await Promise.all([
    supabase
      .from('employees')
      .select('id,first_name,birth_name,private_email,auth_user_id')
      .eq('id', employeeId)
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId ?? '')
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('user_invitations')
      .select('id,email,purpose,status,expires_at,created_at')
      .eq('tenant_id', context.tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('employments')
      .select('starts_on,ends_on,record_status,deleted_at')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', context.hrGroupId ?? '')
      .eq('employee_id', employeeId)
      .limit(100),
  ])
  if (employeeError) throw employeeError
  if (invitationError) throw invitationError
  if (employmentError) throw employmentError
  if (!employee) return null

  const [essAccess, lastLoginAt] = employee.auth_user_id
    ? await Promise.all([
      readEmployeeEssAccess(supabase, employee.id),
      getAuthUserLastSignInAt(employee.auth_user_id),
    ])
    : [{ status: 'ACTIVE', blockedAt: null, blockedByUserId: null }, null] as const

  const latest = invitations?.[0] ?? null
  const employeeLinked = employee.auth_user_id !== null
  const status = employeeLinked
    ? essAccess.status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE'
    : latest
      ? resolveInvitationLifecycleStatus({ status: latest.status, expiresAt: latest.expires_at, employeeLinked: false })
      : 'NOT_ACTIVATED'
  const invitationEligibility = resolveEmployeeInvitationEligibility(new Date().toISOString().slice(0, 10), (employments ?? []).map((employment) => ({
    startsOn: employment.starts_on,
    endsOn: employment.ends_on,
    recordStatus: employment.record_status,
    deletedAt: employment.deleted_at,
  })))
  const invitationPurpose = invitationEligibility.purpose === null
    ? null
    : latest?.purpose === 'PREBOARDING_EMPLOYEE' || latest?.purpose === 'EMPLOYEE_ACTIVATION'
      ? latest.purpose
      : invitationEligibility.purpose
  const canResend = invitationEligibility.status === 'ELIGIBLE' && latest
    ? canResendInvitation({ status: latest.status, employeeLinked })
    : false

  return {
    employeeId: employee.id,
    employeeName: `${employee.first_name} ${employee.birth_name}`.trim(),
    recipientEmail: latest?.email ?? employee.private_email,
    invitationPurpose,
    invitationEligibility: invitationEligibility.status,
    status,
    invitationId: latest?.id ?? null,
    invitationExpiresAt: latest?.expires_at ?? null,
    canSend: invitationEligibility.status === 'ELIGIBLE' && !employeeLinked && employee.private_email !== null && status !== 'INVITED',
    canResend,
    essBlocked: essAccess.status === 'BLOCKED',
    lastLoginAt,
    canBlock: employeeLinked && essAccess.status !== 'BLOCKED',
    canUnblock: employeeLinked && essAccess.status === 'BLOCKED',
    canPreview: true,
  }
}

export async function getInvitationDefaults(): Promise<InvitationDefaults> {
  await requirePermission('user:invite')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('management_roles')
    .select('id')
    .eq('code', 'EMPLOYEE')
    .is('tenant_id', null)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new InvitationError('INVITATION_CREATE_FAILED', 400)
  return { managementRoleId: data.id }
}

async function readInvitationForMutation(id: string, context: AuthContext) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_invitations')
    .select('id,email,email_kind,purpose,employee_id,administration_id,management_role_id,scope_type,status')
    .eq('id', id)
    .eq('tenant_id', context.tenantId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new InvitationError('INVITATION_NOT_FOUND', 404)
  return { supabase, invitation: data }
}

export async function resendInvitation(id: string, origin: string): Promise<{ id: string; expiresAt: string }> {
  const context = await requirePermission('user:invite')
  const { supabase, invitation } = await readInvitationForMutation(id, context)
  let employeeLinked = false
  if (invitation.employee_id) {
    const { data: employee, error } = await supabase
      .from('employees')
      .select('auth_user_id')
      .eq('id', invitation.employee_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    employeeLinked = employee?.auth_user_id !== null && employee?.auth_user_id !== undefined
  }
  if (!canResendInvitation({ status: invitation.status, employeeLinked })) {
    throw new InvitationError('INVITATION_ALREADY_ACCEPTED', 409)
  }

  const { error: revokeError } = await supabase
    .from('user_invitations')
    .update({ status: 'REVOKED' })
    .eq('id', id)
    .eq('status', 'PENDING')
  if (revokeError) throw new InvitationError('INVITATION_REVOKE_FAILED', 400)

  if (invitation.employee_id) return createEmployeeInvitation(invitation.employee_id, origin)

  const input: CreateInvitationInput = {
    email: invitation.email,
    emailKind: invitation.email_kind,
    purpose: invitation.purpose,
    employeeId: invitation.employee_id,
    administrationId: invitation.administration_id,
    managementRoleId: invitation.management_role_id,
    scopeType: invitation.scope_type,
    origin,
  }
  return createInvitation(input)
}

export async function revokeInvitation(id: string): Promise<void> {
  const context = await requirePermission('user:invite')
  const { supabase, invitation } = await readInvitationForMutation(id, context)
  if (invitation.status === 'ACCEPTED') throw new InvitationError('INVITATION_ALREADY_ACCEPTED', 409)
  const { error } = await supabase
    .from('user_invitations')
    .update({ status: 'REVOKED' })
    .eq('id', id)
    .eq('status', 'PENDING')
  if (error) throw new InvitationError('INVITATION_REVOKE_FAILED', 400)
}

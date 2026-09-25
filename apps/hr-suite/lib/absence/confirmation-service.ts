import 'server-only'

import { getSelfPermissions, requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type AbsenceConfirmationStatus = 'PENDING' | 'CONFIRMED' | 'CORRECTION_REQUESTED'

export interface AbsenceConfirmation {
  id: string
  caseId: string
  employeeId: string
  status: AbsenceConfirmationStatus
  correctionReason: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  correctionRequestedAt: string | null
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function mapConfirmation(row: {
  id: string
  case_id: string
  employee_id: string
  status: string
  correction_reason: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
  correction_requested_at: string | null
}): AbsenceConfirmation {
  const status: AbsenceConfirmationStatus = row.status === 'CONFIRMED' || row.status === 'CORRECTION_REQUESTED' ? row.status : 'PENDING'
  return {
    id: row.id,
    caseId: row.case_id,
    employeeId: row.employee_id,
    status,
    correctionReason: row.correction_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    correctionRequestedAt: row.correction_requested_at,
  }
}

export async function registerAbsenceConfirmation(caseId: string, subjectEmployeeId?: string): Promise<string> {
  const supabase = await createClient()
  const result = await supabase.rpc('register_absence_confirmation', {
    requested_case_id: caseId,
    ...(subjectEmployeeId === undefined ? {} : { requested_subject_employee_id: subjectEmployeeId }),
  })
  if (result.error || typeof result.data !== 'string') throw new Error(result.error?.message ?? 'ABSENCE_CONFIRMATION_REGISTER_FAILED')
  return result.data
}

export async function listAbsenceConfirmations(employeeIds?: readonly string[], dependencies?: { context: AuthContext; supabase: SupabaseServerClient }): Promise<AbsenceConfirmation[]> {
  const context = dependencies?.context ?? await requirePermission('absence:read')
  const supabase = dependencies?.supabase ?? await createClient()
  let query = supabase
    .from('absence_confirmations')
    .select('id,case_id,employee_id,status,correction_reason,created_at,updated_at,confirmed_at,correction_requested_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId ?? '')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (employeeIds?.length) query = query.in('employee_id', [...employeeIds])
  const result = await query
  if (result.error) throw new Error('ABSENCE_CONFIRMATION_READ_FAILED')
  return (result.data ?? []).map(mapConfirmation)
}

export async function getEmployeeAbsenceConfirmation(employeeId: string, dependencies?: { context: AuthContext; supabase: SupabaseServerClient }): Promise<AbsenceConfirmation | null> {
  const context = dependencies?.context ?? await requirePermission('absence:read', employeeId)
  const confirmations = await listAbsenceConfirmations([employeeId], { context, supabase: dependencies?.supabase ?? await createClient() })
  return confirmations[0] ?? null
}

export async function confirmAbsenceConfirmation(caseId: string): Promise<string> {
  await requirePermission('absence:write')
  const supabase = await createClient()
  const result = await supabase.rpc('confirm_absence_confirmation', { requested_case_id: caseId })
  if (result.error || typeof result.data !== 'string') throw new Error(result.error?.message ?? 'ABSENCE_CONFIRMATION_CONFIRM_FAILED')
  return result.data
}

export async function requestAbsenceCorrection(caseId: string, reason: string): Promise<string> {
  await requirePermission('absence:write')
  const supabase = await createClient()
  const result = await supabase.rpc('request_absence_correction', { requested_case_id: caseId, requested_reason: reason })
  if (result.error || typeof result.data !== 'string') throw new Error(result.error?.message ?? 'ABSENCE_CORRECTION_REQUEST_FAILED')
  return result.data
}

export async function assertFocusAbsenceSubject(subjectEmployeeId: string, context?: AuthContext): Promise<AuthContext> {
  const auth = context ?? await requireAuthContext()
  if (!auth.permissions.includes('focus:act-as-employee')) throw new Error('FOCUS_ACT_AS_FORBIDDEN')
  if (!auth.hrGroupId) throw new Error('FOCUS_ACT_AS_GROUP_REQUIRED')
  const selfPermissions = await getSelfPermissions(await createClient(), auth.tenantId)
  if (!selfPermissions.includes('self:absence:write')) throw new Error('SELF_ABSENCE_NOT_AVAILABLE')
  return auth
}

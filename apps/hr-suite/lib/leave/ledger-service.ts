import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { LeaveLedgerMutation } from './schemas'
import { LeaveServiceError } from './leave-service'

function requireAdministration(context: { administrationId: string | null }): string {
  if (!context.administrationId) throw new LeaveServiceError('LEAVE_ADMINISTRATION_REQUIRED', 400)
  return context.administrationId
}

function ledgerError(error: { message: string } | null): never {
  const code = error?.message.match(/LEAVE_[A-Z_]+/)?.[0] ?? 'LEAVE_LEDGER_OPERATION_FAILED'
  throw new LeaveServiceError(code, error?.message.includes('PERMISSION') ? 403 : 409)
}

export async function mutateLeaveLedger(input: LeaveLedgerMutation) {
  const permission = input.action === 'CLOSE_YEAR' ? 'leave:year-close' : 'leave:adjust'
  const context = await requirePermission(permission)
  const administrationId = requireAdministration(context)
  const supabase = await createClient()

  if (input.action === 'OPENING_BALANCE') {
    const result = await supabase.rpc('create_leave_opening_balance', {
      requested_tenant_id: context.tenantId,
      requested_administration_id: administrationId,
      requested_employee_id: input.employeeId,
      requested_employment_id: input.employmentId,
      requested_leave_type_id: input.leaveTypeId,
      requested_amount: input.amount,
      requested_start_date: input.startDate,
      requested_reason: input.reason,
      requested_source_key: input.sourceKey,
    })
    if (result.error || !result.data) ledgerError(result.error)
    return { operation: input.action, id: result.data }
  }

  if (input.action === 'MANUAL_ADJUSTMENT') {
    const result = await supabase.rpc('apply_leave_manual_adjustment', {
      requested_tenant_id: context.tenantId,
      requested_administration_id: administrationId,
      requested_employee_id: input.employeeId,
      requested_employment_id: input.employmentId,
      requested_leave_type_id: input.leaveTypeId,
      requested_accrual_year: input.accrualYear,
      requested_amount: input.amount,
      requested_reason: input.reason,
      requested_source_key: input.sourceKey,
    })
    if (result.error || !result.data) ledgerError(result.error)
    return { operation: input.action, id: result.data }
  }

  const result = await supabase.rpc('close_leave_year', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: administrationId,
    requested_year: input.year,
  })
  if (result.error || !result.data) ledgerError(result.error)
  return { operation: input.action, id: result.data }
}

export async function listLeaveYearControls() {
  const context = await requirePermission('leave:read')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const result = await supabase
    .from('leave_year_controls')
    .select('id, year, status, locked_at, locked_by')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .order('year', { ascending: false })
    .limit(100)
  if (result.error) ledgerError(result.error)
  return result.data
}

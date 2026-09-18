import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import type { Database } from '@scope/db'
import { createClient } from '@/lib/supabase/server'
import type { LeaveLedgerMutation } from './schemas'
import { LeaveServiceError } from './leave-service'

interface LedgerDatabaseError {
  code?: string | null
  details?: string | null
  hint?: string | null
  message?: string | null
}

function safeLedgerFailureMetadata(error: LedgerDatabaseError | null) {
  const databaseText = [error?.message, error?.details, error?.hint].filter((value): value is string => Boolean(value)).join(' ')
  const domainCode = databaseText.match(/\bLEAVE_[A-Z0-9_]+\b/)?.[0] ?? null
  const constraint = databaseText.match(/constraint\s+["']([^"']+)["']/i)?.[1] ?? null
  const functionContext = databaseText.match(/(?:function|pl\/pgsql function)\s+([a-z0-9_]+(?:\.[a-z0-9_]+)?)/i)?.[1] ?? null

  return {
    postgresCode: error?.code ?? null,
    domainCode,
    constraint,
    functionContext,
  }
}

function ledgerError(error: LedgerDatabaseError | null, operation: string, rpcName: string): never {
  const metadata = safeLedgerFailureMetadata(error)
  console.error('[LEAVE_LEDGER] database operation failed', {
    operation,
    rpcName,
    ...metadata,
  })
  const code = metadata.domainCode ?? 'LEAVE_LEDGER_OPERATION_FAILED'
  throw new LeaveServiceError(code, error?.message?.includes('PERMISSION') ? 403 : 409)
}

export async function mutateLeaveLedger(input: LeaveLedgerMutation) {
  const permission = input.action === 'CLOSE_YEAR' ? 'leave:year-close' : 'leave:adjust'
  const context = await requirePermission(permission)
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()

  if (input.action === 'OPENING_BALANCE') {
    if (input.sourceAccrualYear !== undefined && input.expirationDate !== undefined) {
      const result = await supabase.rpc('create_group_leave_opening_balance_cohort', {
        requested_tenant_id: context.tenantId,
        requested_hr_group_id: hrGroupId,
        requested_employee_id: input.employeeId,
        requested_employment_id: input.employmentId,
        requested_leave_type_id: input.leaveTypeId,
        requested_amount: input.amount,
        requested_start_date: input.startDate,
        requested_reason: input.reason,
        requested_source_key: input.sourceKey,
        requested_source_accrual_year: input.sourceAccrualYear,
        requested_expiration_date: input.expirationDate,
      })
      if (result.error || !result.data) ledgerError(result.error, input.action, 'create_group_leave_opening_balance_cohort')
      return { operation: input.action, id: result.data }
    }
    const result = await supabase.rpc('create_group_leave_opening_balance', {
      requested_tenant_id: context.tenantId,
      requested_hr_group_id: hrGroupId,
      requested_employee_id: input.employeeId,
      requested_employment_id: input.employmentId,
      requested_leave_type_id: input.leaveTypeId,
      requested_amount: input.amount,
      requested_start_date: input.startDate,
      requested_reason: input.reason,
      requested_source_key: input.sourceKey,
    })
    if (result.error || !result.data) ledgerError(result.error, input.action, 'create_group_leave_opening_balance')
    return { operation: input.action, id: result.data }
  }

  if (input.action === 'MANUAL_ADJUSTMENT') {
    type ManualAdjustmentRpcArgs = Database['public']['Functions']['apply_group_leave_manual_adjustment']['Args']
    let args: ManualAdjustmentRpcArgs
    if (input.effectiveDate) {
      args = {
        requested_tenant_id: context.tenantId,
        requested_hr_group_id: hrGroupId,
        requested_employee_id: input.employeeId,
        requested_employment_id: input.employmentId,
        requested_leave_type_id: input.leaveTypeId,
        requested_effective_date: input.effectiveDate,
        requested_amount: input.amount,
        requested_reason: input.reason,
        requested_source_key: input.sourceKey,
      }
    } else {
      if (input.accrualYear === undefined) throw new LeaveServiceError('LEAVE_CORRECTION_DATE_REQUIRED', 400)
      args = {
        requested_tenant_id: context.tenantId,
        requested_hr_group_id: hrGroupId,
        requested_employee_id: input.employeeId,
        requested_employment_id: input.employmentId,
        requested_leave_type_id: input.leaveTypeId,
        requested_accrual_year: input.accrualYear,
        requested_amount: input.amount,
        requested_reason: input.reason,
        requested_source_key: input.sourceKey,
      }
    }
    const result = await supabase.rpc('apply_group_leave_manual_adjustment', args)
    if (result.error || !result.data) ledgerError(result.error, input.action, 'apply_group_leave_manual_adjustment')
    return { operation: input.action, id: result.data }
  }

  const result = await supabase.rpc('close_group_leave_year', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_year: input.year,
  })
  if (result.error || !result.data) ledgerError(result.error, input.action, 'close_group_leave_year')
  return { operation: input.action, id: result.data }
}

export async function listLeaveYearControls() {
  const context = await requirePermission('leave:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const result = await supabase
    .from('leave_year_controls')
    .select('id, year, status, locked_at, locked_by')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .order('year', { ascending: false })
    .limit(100)
  if (result.error) ledgerError(result.error, 'LIST_YEAR_CONTROLS', 'list_leave_year_controls')
  return result.data
}

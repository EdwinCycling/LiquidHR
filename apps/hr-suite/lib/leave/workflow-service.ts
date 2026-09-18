import { z } from 'zod'

import { requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getProcessWorkItemDetail, type ProcessWorkDetail } from '@/lib/process-automation/work-service'

import { resolveLeaveEmployment } from './employment-resolver'
import { LeaveServiceError } from './leave-service'
import { leaveRequestConfirmSchema, type LeaveRequestConfirmInput } from './schemas'

const workflowResultSchema = z.object({
  processInstanceId: z.string().uuid(),
  requestId: z.string().uuid(),
  workItemId: z.string().uuid(),
  status: z.string(),
  businessStatus: z.string(),
}).passthrough()

const workflowActionResultSchema = z.object({
  processInstanceId: z.string().uuid(),
  status: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  correlationId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  requestId: z.string().uuid(),
  leaveRequestId: z.string().uuid(),
  businessStatus: z.string(),
}).passthrough()

export type LeaveWorkflowStartInput = LeaveRequestConfirmInput
export type LeaveWorkflowStartResult = z.infer<typeof workflowResultSchema>
export type LeaveWorkflowAction = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'ACKNOWLEDGE' | 'CANCEL'
export type LeaveWorkflowActionResult = z.infer<typeof workflowActionResultSchema>

export interface LeaveWorkflowActionInput {
  readonly workItemId: string
  readonly action: LeaveWorkflowAction
  readonly expectedVersion: number
  readonly stepExpectedVersion?: number | null
  readonly idempotencyKey: string
  readonly correlationId?: string | null
  readonly reason?: string | null
}

function rpcCode(message: string): string {
  return message.split(':', 1)[0]?.trim() || 'LEAVE_WORKFLOW_OPERATION_FAILED'
}

function throwRpcError(message: string): never {
  const code = rpcCode(message)
  const status = code === 'AUTHENTICATION_REQUIRED' ? 401
    : code === 'FORBIDDEN' || code.includes('PERMISSION') ? 403
      : code.includes('NOT_FOUND') ? 404
        : code.includes('STALE') || code.includes('IDEMPOTENCY') || code.includes('NOT_ACTIONABLE') || code.includes('NOT_CANCELLABLE') || code.includes('NOT_RESUBMITTABLE') ? 409
          : 400
  throw new LeaveServiceError(code, status)
}

async function selectedEmployment(input: LeaveWorkflowStartInput) {
  const supabase = await createClient()
  const context = await requirePermission('self:leave:request', input.employeeId)
  const selection = await resolveLeaveEmployment(supabase, context, input.employeeId, input.employmentId, input.startDate)
  if (!selection.employment) {
    if (selection.options.length > 1) throw new LeaveServiceError('LEAVE_EMPLOYMENT_SELECTION_REQUIRED', 409, { options: selection.options })
    throw new LeaveServiceError(input.employmentId ? 'LEAVE_EMPLOYMENT_NOT_FOUND' : 'LEAVE_EMPLOYMENT_REQUIRED', input.employmentId ? 404 : 400)
  }
  return { supabase, context, employment: selection.employment }
}

export async function startLeaveRequestWorkflow(input: LeaveWorkflowStartInput): Promise<LeaveWorkflowStartResult> {
  const parsed = leaveRequestConfirmSchema.safeParse(input)
  if (!parsed.success) throw new LeaveServiceError('LEAVE_INPUT_INVALID', 400)
  const value = parsed.data
  const { supabase, context, employment } = await selectedEmployment(value)
  const { data, error } = await supabase.rpc('start_leave_request_workflow', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: employment.hr_group_id,
    requested_administration_id: employment.administration_id,
    requested_employee_id: value.employeeId,
    requested_employment_id: employment.id,
    requested_mode: value.mode,
    requested_priority_rule_id: value.priorityRuleId ?? null,
    requested_leave_type_id: value.leaveTypeId ?? null,
    requested_start_date: value.startDate,
    requested_end_date: value.endDate,
    requested_time_mode: value.timeMode,
    requested_specific_start: value.specificStart ?? null,
    requested_specific_end: value.specificEnd ?? null,
    requested_idempotency_key: value.idempotencyKey,
    requested_correlation_id: null,
  })
  if (error) throwRpcError(error.message)
  const result = workflowResultSchema.safeParse(data)
  if (!result.success) throw new LeaveServiceError('LEAVE_WORKFLOW_RESULT_INVALID', 500)
  return result.data
}

export async function getLeaveWorkflowDetail(workItemId: string, language: 'nl' | 'en'): Promise<ProcessWorkDetail> {
  const detail = await getProcessWorkItemDetail(workItemId, language)
  if (detail.businessType !== 'LEAVE' || !detail.leaveRequest) throw new LeaveServiceError('LEAVE_WORKFLOW_NOT_FOUND', 404)
  return detail
}

export async function performLeaveWorkflowAction(input: LeaveWorkflowActionInput): Promise<LeaveWorkflowActionResult> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('perform_leave_workflow_action', {
    requested_work_item_id: input.workItemId,
    requested_action: input.action,
    requested_expected_version: input.expectedVersion,
    requested_step_expected_version: input.stepExpectedVersion ?? null,
    requested_idempotency_key: input.idempotencyKey,
    requested_correlation_id: input.correlationId ?? null,
    requested_reason: input.reason ?? null,
  })
  if (error) throwRpcError(error.message)
  const result = workflowActionResultSchema.safeParse(data)
  if (!result.success) throw new LeaveServiceError('LEAVE_WORKFLOW_RESULT_INVALID', 500)
  return result.data
}

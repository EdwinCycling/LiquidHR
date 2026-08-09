import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const runtimeResultSchema = z.object({
  processInstanceId: z.string().uuid(),
  status: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  correlationId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
}).strict()

const projectionSchema = z.object({
  processInstanceId: z.string().uuid(),
  status: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  correlationId: z.string().uuid().nullable(),
  steps: z.array(z.object({
    id: z.string().uuid(),
    stepKey: z.string(),
    activationNumber: z.number().int().positive(),
    status: z.string(),
    expectedVersion: z.number().int().positive(),
    activatedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    deadlineAt: z.string().nullable(),
  }).strict()),
  workItems: z.array(z.object({
    id: z.string().uuid(),
    stepKey: z.string(),
    participantKey: z.string(),
    assignmentMode: z.string(),
    status: z.string(),
    expectedVersion: z.number().int().positive(),
    availableAt: z.string(),
    deadlineAt: z.string().nullable(),
  }).strict()),
}).strict()

export type RuntimeResult = z.infer<typeof runtimeResultSchema>
export type ProcessInstanceProjection = z.infer<typeof projectionSchema>

export type ProcessRuntimeErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'ACTOR_EMPLOYEE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'FORBIDDEN_ACTION'
  | 'PROCESS_DEFINITION_NOT_PUBLISHED'
  | 'PROCESS_VERSION_NOT_FOUND'
  | 'PROCESS_INSTANCE_NOT_FOUND'
  | 'PROCESS_INSTANCE_NOT_ACTIVE'
  | 'SUBJECT_EMPLOYEE_NOT_FOUND'
  | 'SUBJECT_EMPLOYMENT_NOT_FOUND'
  | 'WORK_ITEM_NOT_FOUND'
  | 'WORK_ITEM_NOT_OPEN'
  | 'STEP_NOT_ACTIVE'
  | 'STEP_NOT_FOUND'
  | 'PARTICIPANT_NOT_FOUND'
  | 'STALE_STATE'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'NO_ASSIGNEE'
  | 'AMBIGUOUS_ASSIGNEE'
  | 'INELIGIBLE_ASSIGNEE'
  | 'SELF_ASSIGNMENT_FORBIDDEN'
  | 'CROSS_SCOPE_CANDIDATE'
  | 'INVALID_ASSIGNMENT_SELECTOR'
  | 'INVALID_BUSINESS_DATE'
  | 'TRANSITION_NOT_FOUND'
  | 'AMBIGUOUS_TRANSITION'
  | 'PROCESS_WORK_ITEM_OPERATION_FAILED'

const stableErrorCodes = new Set<ProcessRuntimeErrorCode>([
  'AUTHENTICATION_REQUIRED',
  'ACTOR_EMPLOYEE_NOT_FOUND',
  'FORBIDDEN',
  'FORBIDDEN_ACTION',
  'PROCESS_DEFINITION_NOT_PUBLISHED',
  'PROCESS_VERSION_NOT_FOUND',
  'PROCESS_INSTANCE_NOT_FOUND',
  'PROCESS_INSTANCE_NOT_ACTIVE',
  'SUBJECT_EMPLOYEE_NOT_FOUND',
  'SUBJECT_EMPLOYMENT_NOT_FOUND',
  'WORK_ITEM_NOT_FOUND',
  'WORK_ITEM_NOT_OPEN',
  'STEP_NOT_ACTIVE',
  'STEP_NOT_FOUND',
  'PARTICIPANT_NOT_FOUND',
  'STALE_STATE',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'NO_ASSIGNEE',
  'AMBIGUOUS_ASSIGNEE',
  'INELIGIBLE_ASSIGNEE',
  'SELF_ASSIGNMENT_FORBIDDEN',
  'CROSS_SCOPE_CANDIDATE',
  'INVALID_ASSIGNMENT_SELECTOR',
  'INVALID_BUSINESS_DATE',
  'TRANSITION_NOT_FOUND',
  'AMBIGUOUS_TRANSITION',
  'PROCESS_WORK_ITEM_OPERATION_FAILED',
])

export class ProcessRuntimeError extends Error {
  constructor(
    readonly code: ProcessRuntimeErrorCode,
    readonly status: number,
    message: string = code,
  ) {
    super(message)
    this.name = 'ProcessRuntimeError'
  }
}

function errorCodeFromRpcMessage(message: string): ProcessRuntimeErrorCode {
  const candidate = message.split(':', 1)[0]?.trim() ?? ''
  if (stableErrorCodes.has(candidate as ProcessRuntimeErrorCode)) return candidate as ProcessRuntimeErrorCode
  if (message.includes('permission denied')) return 'FORBIDDEN'
  return 'PROCESS_WORK_ITEM_OPERATION_FAILED'
}

function statusForCode(code: ProcessRuntimeErrorCode): number {
  if (code === 'AUTHENTICATION_REQUIRED') return 401
  if (code === 'FORBIDDEN' || code === 'FORBIDDEN_ACTION' || code === 'ACTOR_EMPLOYEE_NOT_FOUND') return 403
  if (code === 'PROCESS_INSTANCE_NOT_FOUND' || code === 'WORK_ITEM_NOT_FOUND' || code === 'STEP_NOT_FOUND' || code === 'SUBJECT_EMPLOYEE_NOT_FOUND' || code === 'SUBJECT_EMPLOYMENT_NOT_FOUND') return 404
  if (code === 'STALE_STATE' || code === 'IDEMPOTENCY_KEY_REUSED' || code === 'NO_ASSIGNEE' || code === 'AMBIGUOUS_ASSIGNEE' || code === 'TRANSITION_NOT_FOUND' || code === 'AMBIGUOUS_TRANSITION' || code === 'WORK_ITEM_NOT_OPEN' || code === 'STEP_NOT_ACTIVE') return 409
  return 400
}

function throwRuntimeError(message: string): never {
  const code = errorCodeFromRpcMessage(message)
  throw new ProcessRuntimeError(code, statusForCode(code), message)
}

export interface StartProcessCommand {
  readonly processDefinitionId: string
  readonly subjectEmployeeId: string
  readonly employmentId?: string | null
  readonly businessEffectiveDate?: string | null
  readonly idempotencyKey: string
  readonly correlationId?: string | null
}

export interface PerformWorkItemActionCommand {
  readonly workItemId: string
  readonly action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'ACKNOWLEDGE' | 'COMPLETE' | 'CANCEL'
  readonly expectedVersion: number
  readonly stepExpectedVersion?: number | null
  readonly idempotencyKey: string
  readonly correlationId?: string | null
}

export async function startProcess(command: StartProcessCommand): Promise<RuntimeResult> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('start_process', {
    requested_process_definition_id: command.processDefinitionId,
    requested_subject_employee_id: command.subjectEmployeeId,
    requested_employment_id: command.employmentId as string,
    requested_business_effective_date: command.businessEffectiveDate as string,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
  })
  if (error) throwRuntimeError(error.message)
  const parsed = runtimeResultSchema.safeParse(data)
  if (!parsed.success) throw new ProcessRuntimeError('PROCESS_WORK_ITEM_OPERATION_FAILED', 500)
  return parsed.data
}

export async function performWorkItemAction(command: PerformWorkItemActionCommand): Promise<RuntimeResult> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('perform_process_work_item_action', {
    requested_work_item_id: command.workItemId,
    requested_action: command.action,
    requested_expected_version: command.expectedVersion,
    requested_step_expected_version: command.stepExpectedVersion as number,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
  })
  if (error) throwRuntimeError(error.message)
  const parsed = runtimeResultSchema.safeParse(data)
  if (!parsed.success) throw new ProcessRuntimeError('PROCESS_WORK_ITEM_OPERATION_FAILED', 500)
  return parsed.data
}

export async function getProcessInstanceProjection(processInstanceId: string): Promise<ProcessInstanceProjection> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('get_process_instance_projection', {
    requested_process_instance_id: processInstanceId,
  })
  if (error) throwRuntimeError(error.message)
  const parsed = projectionSchema.safeParse(data)
  if (!parsed.success) throw new ProcessRuntimeError('PROCESS_WORK_ITEM_OPERATION_FAILED', 500)
  return parsed.data
}

export function processRuntimeErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProcessRuntimeError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

export const processRuntimeErrorCodeFromMessage = errorCodeFromRpcMessage

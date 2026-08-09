import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const databaseUuidSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)

const kernelResultSchema = z.object({
  workItemId: databaseUuidSchema,
  status: z.string(),
  assigneeEmployeeId: databaseUuidSchema.nullable(),
  expectedVersion: z.number().int().nonnegative(),
  eventId: databaseUuidSchema,
}).strict()

export type WorkItemKernelResult = z.infer<typeof kernelResultSchema>

export type WorkItemKernelErrorCode =
  | 'NO_ASSIGNEE'
  | 'AMBIGUOUS_ASSIGNEE'
  | 'INELIGIBLE_ASSIGNEE'
  | 'ALREADY_CLAIMED'
  | 'STALE_ASSIGNMENT'
  | 'SELF_ASSIGNMENT_FORBIDDEN'
  | 'FORBIDDEN'
  | 'WORK_ITEM_NOT_FOUND'
  | 'WORK_ITEM_NOT_OPEN'
  | 'WORK_ITEM_NOT_CLAIMED'
  | 'WORK_ITEM_NOT_REASSIGNABLE'
  | 'WORK_ITEM_NOT_BLOCKED'
  | 'AUTHENTICATION_REQUIRED'
  | 'ACTOR_EMPLOYEE_NOT_FOUND'
  | 'PROCESS_WORK_ITEM_OPERATION_FAILED'

export class WorkItemKernelError extends Error {
  constructor(
    readonly code: WorkItemKernelErrorCode,
    readonly status: number,
    message: string = code,
  ) {
    super(message)
    this.name = 'WorkItemKernelError'
  }
}

type KernelRpcName =
  | 'claim_process_work_item'
  | 'release_process_work_item'
  | 'reassign_process_work_item'
  | 're_resolve_process_work_item'

type KernelRpcArgs = {
  requested_expected_version: number
  requested_work_item_id: string
  requested_employee_id?: string
}

const stableErrorCodes = new Set<WorkItemKernelErrorCode>([
  'NO_ASSIGNEE',
  'AMBIGUOUS_ASSIGNEE',
  'INELIGIBLE_ASSIGNEE',
  'ALREADY_CLAIMED',
  'STALE_ASSIGNMENT',
  'SELF_ASSIGNMENT_FORBIDDEN',
  'FORBIDDEN',
  'WORK_ITEM_NOT_FOUND',
  'WORK_ITEM_NOT_OPEN',
  'WORK_ITEM_NOT_CLAIMED',
  'WORK_ITEM_NOT_REASSIGNABLE',
  'WORK_ITEM_NOT_BLOCKED',
  'AUTHENTICATION_REQUIRED',
  'ACTOR_EMPLOYEE_NOT_FOUND',
  'PROCESS_WORK_ITEM_OPERATION_FAILED',
])

function isWorkItemKernelErrorCode(value: string): value is WorkItemKernelErrorCode {
  return stableErrorCodes.has(value as WorkItemKernelErrorCode)
}

function errorCodeFromRpcMessage(message: string): WorkItemKernelErrorCode {
  const candidate = message.split(':', 1)[0]?.trim() ?? ''
  if (isWorkItemKernelErrorCode(candidate)) return candidate
  if (message.includes('permission denied') || message.includes('FORBIDDEN')) return 'FORBIDDEN'
  return 'PROCESS_WORK_ITEM_OPERATION_FAILED'
}

function statusForCode(code: WorkItemKernelErrorCode): number {
  if (code === 'AUTHENTICATION_REQUIRED') return 401
  if (code === 'FORBIDDEN' || code === 'SELF_ASSIGNMENT_FORBIDDEN' || code === 'INELIGIBLE_ASSIGNEE' || code === 'ACTOR_EMPLOYEE_NOT_FOUND') return 403
  if (code === 'WORK_ITEM_NOT_FOUND') return 404
  if (code === 'ALREADY_CLAIMED' || code === 'STALE_ASSIGNMENT' || code === 'WORK_ITEM_NOT_OPEN' || code === 'WORK_ITEM_NOT_CLAIMED' || code === 'WORK_ITEM_NOT_REASSIGNABLE' || code === 'WORK_ITEM_NOT_BLOCKED' || code === 'AMBIGUOUS_ASSIGNEE' || code === 'NO_ASSIGNEE') return 409
  return 400
}

async function callKernelRpc(
  functionName: KernelRpcName,
  args: KernelRpcArgs,
): Promise<WorkItemKernelResult> {
  const supabase = await createClient()
  await requireAuthContext(supabase)

  const { data, error } = functionName === 'reassign_process_work_item'
    ? await supabase.rpc(functionName, {
      requested_work_item_id: args.requested_work_item_id,
      requested_expected_version: args.requested_expected_version,
      requested_employee_id: args.requested_employee_id!,
    })
    : await supabase.rpc(functionName, {
      requested_work_item_id: args.requested_work_item_id,
      requested_expected_version: args.requested_expected_version,
    })

  if (error) {
    const code = errorCodeFromRpcMessage(error.message)
    throw new WorkItemKernelError(code, statusForCode(code), error.message)
  }

  const parsed = kernelResultSchema.safeParse(data)
  if (!parsed.success) throw new WorkItemKernelError('PROCESS_WORK_ITEM_OPERATION_FAILED', 500)
  return parsed.data
}

export function claimWorkItem(workItemId: string, expectedVersion: number): Promise<WorkItemKernelResult> {
  return callKernelRpc('claim_process_work_item', {
    requested_work_item_id: workItemId,
    requested_expected_version: expectedVersion,
  })
}

export function releaseWorkItem(workItemId: string, expectedVersion: number): Promise<WorkItemKernelResult> {
  return callKernelRpc('release_process_work_item', {
    requested_work_item_id: workItemId,
    requested_expected_version: expectedVersion,
  })
}

export function reassignWorkItem(workItemId: string, expectedVersion: number, employeeId: string): Promise<WorkItemKernelResult> {
  return callKernelRpc('reassign_process_work_item', {
    requested_work_item_id: workItemId,
    requested_expected_version: expectedVersion,
    requested_employee_id: employeeId,
  })
}

export function reResolveWorkItem(workItemId: string, expectedVersion: number): Promise<WorkItemKernelResult> {
  return callKernelRpc('re_resolve_process_work_item', {
    requested_work_item_id: workItemId,
    requested_expected_version: expectedVersion,
  })
}

export function workItemErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof WorkItemKernelError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

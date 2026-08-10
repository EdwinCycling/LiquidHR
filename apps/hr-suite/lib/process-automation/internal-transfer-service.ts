import { z } from 'zod'
import { NextResponse } from 'next/server'
import { requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const previewItemSchema = z.object({
  code: z.string(),
  candidateCount: z.number().int().nonnegative().optional(),
}).passthrough()

const organizationSnapshotSchema = z.object({
  placementId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  departmentCode: z.string().nullable().optional(),
  departmentName: z.string().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
  jobCode: z.string().nullable().optional(),
  jobName: z.string().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  managerName: z.string().nullable().optional(),
}).strict()

const previewSchema = z.object({
  adapterKey: z.literal('INTERNAL_TRANSFER_ORGANIZATION'),
  processInstanceId: z.string().uuid(),
  workItemId: z.string().uuid(),
  status: z.enum(['SUCCESS', 'WARNING', 'BLOCKING']),
  writesPerformed: z.literal(false),
  effectiveOn: z.string().nullable(),
  employee: z.object({ id: z.string().uuid().nullable(), employmentId: z.string().uuid().nullable() }).strict(),
  current: organizationSnapshotSchema,
  proposed: organizationSnapshotSchema,
  blockers: z.array(previewItemSchema),
  warnings: z.array(previewItemSchema),
  reason: z.string(),
}).strict()

const commitSchema = z.object({
  processInstanceId: z.string().uuid(),
  status: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  correlationId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  adapterKey: z.literal('INTERNAL_TRANSFER_ORGANIZATION'),
  organizationPlacementId: z.string().uuid(),
  preview: previewSchema,
  writesPerformed: z.literal(true),
}).strict()

export type InternalTransferPreview = z.infer<typeof previewSchema>
export type InternalTransferCommit = z.infer<typeof commitSchema>

export class InternalTransferError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'InternalTransferError'
  }
}

function errorCode(message: string): string {
  return message.match(/\b[A-Z][A-Z0-9_]{2,80}\b/)?.[0] ?? 'INTERNAL_TRANSFER_OPERATION_FAILED'
}

function throwRpcError(message: string): never {
  const code = errorCode(message)
  const status = code.includes('FORBIDDEN') ? 403
    : code.includes('NOT_FOUND') ? 404
      : code.includes('STALE') || code.includes('CONFLICT') ? 409
        : 400
  throw new InternalTransferError(code, status, message)
}

export async function getInternalTransferPreview(workItemId: string): Promise<InternalTransferPreview> {
  const supabase = await createClient()
  await requirePermission('organization-placement:write')
  const { data, error } = await supabase.rpc('get_internal_transfer_preview', {
    requested_work_item_id: workItemId,
  })
  if (error) throwRpcError(error.message)
  const parsed = previewSchema.safeParse(data)
  if (!parsed.success) throw new InternalTransferError('INTERNAL_TRANSFER_PREVIEW_INVALID', 500)
  return parsed.data
}

export interface CommitInternalTransferCommand {
  readonly workItemId: string
  readonly expectedVersion: number
  readonly stepExpectedVersion: number | null
  readonly idempotencyKey: string
  readonly correlationId: string | null
}

export async function commitInternalTransfer(command: CommitInternalTransferCommand): Promise<InternalTransferCommit> {
  const supabase = await createClient()
  await requirePermission('organization-placement:write')
  const { data, error } = await supabase.rpc('commit_internal_transfer', {
    requested_work_item_id: command.workItemId,
    requested_expected_version: command.expectedVersion,
    requested_step_expected_version: command.stepExpectedVersion as number,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
  })
  if (error) throwRpcError(error.message)
  const parsed = commitSchema.safeParse(data)
  if (!parsed.success) throw new InternalTransferError('INTERNAL_TRANSFER_COMMIT_INVALID', 500)
  return parsed.data
}

export interface RequestChangesCommand extends CommitInternalTransferCommand {
  readonly reason: string
}

export async function requestInternalTransferChanges(command: RequestChangesCommand): Promise<Record<string, unknown>> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('request_process_work_item_changes', {
    requested_work_item_id: command.workItemId,
    requested_expected_version: command.expectedVersion,
    requested_step_expected_version: command.stepExpectedVersion as number,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
    requested_body: command.reason,
  })
  if (error) throwRpcError(error.message)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new InternalTransferError('REQUEST_CHANGES_RESULT_INVALID', 500)
  return data as Record<string, unknown>
}

export function internalTransferErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof InternalTransferError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

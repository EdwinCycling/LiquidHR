import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const outputSchema = z.object({
  id: z.string().uuid(),
  outputKey: z.string(),
  title: z.string(),
  outputFormat: z.string(),
  status: z.string(),
  documentId: z.string().uuid().nullable(),
  htmlSummary: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  generatedAt: z.string().nullable(),
}).strict()

const outputProjectionSchema = z.object({
  processInstanceId: z.string().uuid(),
  outputs: z.array(outputSchema),
}).strict()

const operationJobSchema = z.object({
  id: z.string().uuid(),
  jobType: z.string(),
  status: z.string(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: z.string(),
  lastAttemptAt: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  canRecover: z.boolean(),
}).strict()

const operationOutputSchema = z.object({
  id: z.string().uuid(),
  outputKey: z.string(),
  status: z.string(),
  documentId: z.string().uuid().nullable(),
  lastErrorCode: z.string().nullable(),
  generatedAt: z.string().nullable(),
}).strict()

const operationsSchema = z.object({
  processInstanceId: z.string().uuid(),
  jobs: z.array(operationJobSchema),
  outputs: z.array(operationOutputSchema),
}).strict()

export type ProcessOutput = z.infer<typeof outputSchema>
export type ProcessOutputProjection = z.infer<typeof outputProjectionSchema>
export type ProcessAutomationOperations = z.infer<typeof operationsSchema>

export class ProcessOutputServiceError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'ProcessOutputServiceError'
  }
}

function throwRpcError(message: string): never {
  const candidate = message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'PROCESS_OUTPUT_READ_FAILED'
  const status = candidate === 'FORBIDDEN' ? 403 : candidate.endsWith('NOT_FOUND') ? 404 : 500
  throw new ProcessOutputServiceError(candidate, status, message)
}

export async function getProcessOutputProjection(processInstanceId: string, language: 'nl' | 'en'): Promise<ProcessOutputProjection> {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('get_process_output_projection', {
    requested_process_instance_id: processInstanceId,
    requested_language: language,
  })
  if (error) throwRpcError(error.message)
  const parsed = outputProjectionSchema.safeParse(data)
  if (!parsed.success) throw new ProcessOutputServiceError('PROCESS_OUTPUT_READ_FAILED', 500)
  return parsed.data
}

export async function getProcessAutomationOperations(processInstanceId: string): Promise<ProcessAutomationOperations> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  if (!context.permissions.includes('process-operations:read')) throw new ProcessOutputServiceError('FORBIDDEN', 403)
  const { data, error } = await supabase.rpc('get_process_automation_operations', {
    requested_process_instance_id: processInstanceId,
  })
  if (error) throwRpcError(error.message)
  const parsed = operationsSchema.safeParse(data)
  if (!parsed.success) throw new ProcessOutputServiceError('PROCESS_OPERATIONS_READ_FAILED', 500)
  return parsed.data
}

export function processOutputServiceErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProcessOutputServiceError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

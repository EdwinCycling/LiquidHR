import 'server-only'

import { randomUUID } from 'node:crypto'
import { after } from 'next/server'
import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  buildProcessOutputHtml,
  buildProcessOutputPdf,
  databaseUuidSchema,
  processOutputBeginSchema,
  processOutputFilename,
  processOutputStorageKey,
  sha256Hex,
} from './process-output'

const claimedJobSchema = z.object({
  id: databaseUuidSchema,
  jobType: z.enum(['PROCESS_REMINDER', 'PROCESS_DOCUMENT_OUTPUT']),
  tenantId: databaseUuidSchema,
  hrGroupId: databaseUuidSchema,
  administrationId: databaseUuidSchema.nullable(),
  processInstanceId: databaseUuidSchema,
  stepInstanceId: databaseUuidSchema.nullable(),
  workItemId: databaseUuidSchema.nullable(),
  attempts: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  correlationId: databaseUuidSchema.nullable(),
}).strict()

const attachmentSchema = z.object({
  outputId: databaseUuidSchema,
  documentId: databaseUuidSchema,
  created: z.boolean(),
}).strict()

export type WorkflowJobRunResult = {
  readonly claimed: number
  readonly succeeded: number
  readonly retried: number
  readonly deadLettered: number
  readonly errors: readonly string[]
}

export class WorkflowJobError extends Error {
  constructor(readonly code: string, message = code) {
    super(message)
    this.name = 'WorkflowJobError'
  }
}

function errorCode(error: unknown): string {
  if (error instanceof WorkflowJobError) return error.code
  if (error instanceof Error) {
    const candidate = error.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0]
    if (candidate) return candidate
  }
  return 'PROCESS_AUTOMATION_RUN_FAILED'
}

function isDuplicateStorageError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('already exists') || normalized.includes('duplicate') || normalized.includes('409')
}

async function finishJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  workerId: string,
  outcome: 'SUCCEEDED' | 'FAILED',
  failureCode?: string,
  resultReferenceId?: string,
): Promise<{ status: string }> {
  const { data, error } = await supabase.rpc('finish_workflow_job', {
    requested_job_id: jobId,
    requested_worker_id: workerId,
    requested_outcome: outcome,
    requested_error_code: failureCode,
    requested_result_reference_id: resultReferenceId,
  })
  if (error) throw new WorkflowJobError('WORKFLOW_JOB_FINISH_FAILED', error.message)
  const parsed = z.object({ status: z.string() }).safeParse(data)
  if (!parsed.success) throw new WorkflowJobError('WORKFLOW_JOB_FINISH_FAILED')
  return parsed.data
}

async function processClaimedJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  job: z.infer<typeof claimedJobSchema>,
  language: 'nl' | 'en',
): Promise<string | undefined> {
  if (job.jobType === 'PROCESS_REMINDER') {
    const { error } = await supabase.rpc('create_process_deadline_reminder', {
      requested_job_id: job.id,
      requested_language: language,
    })
    if (error) throw new WorkflowJobError(error.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'PROCESS_REMINDER_FAILED', error.message)
    return undefined
  }

  const { data: beginData, error: beginError } = await supabase.rpc('begin_process_output', {
    requested_job_id: job.id,
    requested_language: language,
  })
  if (beginError) throw new WorkflowJobError(beginError.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'PROCESS_OUTPUT_BEGIN_FAILED', beginError.message)
  const begin = processOutputBeginSchema.safeParse(beginData)
  if (!begin.success) throw new WorkflowJobError('PROCESS_OUTPUT_BEGIN_FAILED')

  const html = buildProcessOutputHtml(begin.data.source)
  const pdf = buildProcessOutputPdf(begin.data.source)
  const checksum = sha256Hex(pdf)
  const filename = processOutputFilename(begin.data.source)
  const storageKey = processOutputStorageKey(begin.data.source, begin.data.outputId)
  const { data: attachmentData, error: attachmentError } = await supabase.rpc('attach_process_output_document', {
    requested_output_id: begin.data.outputId,
    requested_storage_key: storageKey,
    requested_original_filename: filename,
    requested_content_type: 'application/pdf',
    requested_file_size: pdf.byteLength,
    requested_checksum_sha256: checksum,
    requested_title: begin.data.source.title[begin.data.source.language] ?? begin.data.source.outputKey,
    requested_category_key: begin.data.source.dossierCategoryKey,
  })
  if (attachmentError) throw new WorkflowJobError(attachmentError.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'PROCESS_OUTPUT_ATTACH_FAILED', attachmentError.message)
  const attachment = attachmentSchema.safeParse(attachmentData)
  if (!attachment.success) throw new WorkflowJobError('PROCESS_OUTPUT_ATTACH_FAILED')

  const { error: audienceError } = await supabase.rpc('add_process_output_document_audiences', {
    requested_output_id: begin.data.outputId,
  })
  if (audienceError) throw new WorkflowJobError(audienceError.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'PROCESS_OUTPUT_PERMISSION_FAILED', audienceError.message)

  const upload = await supabase.storage.from('employee-documents').upload(storageKey, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upload.error && !isDuplicateStorageError(upload.error.message)) {
    throw new WorkflowJobError('PROCESS_OUTPUT_UPLOAD_FAILED', upload.error.message)
  }

  const { error: completeError } = await supabase.rpc('complete_process_output', {
    requested_output_id: begin.data.outputId,
    requested_html_summary: html,
    requested_document_id: attachment.data.documentId,
  })
  if (completeError) throw new WorkflowJobError(completeError.message.match(/\b[A-Z][A-Z0-9_]{2,60}\b/)?.[0] ?? 'PROCESS_OUTPUT_COMPLETE_FAILED', completeError.message)
  return begin.data.outputId
}

export async function runWorkflowJobs(limit = 5, language: 'nl' | 'en' = 'nl'): Promise<WorkflowJobRunResult> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  if (!context.permissions.includes('process-operations:write')) throw new WorkflowJobError('FORBIDDEN')
  const workerId = randomUUID()
  let claimed = 0
  let succeeded = 0
  let retried = 0
  let deadLettered = 0
  const errors: string[] = []

  for (let index = 0; index < Math.max(1, Math.min(limit, 20)); index += 1) {
    const { data, error } = await supabase.rpc('claim_workflow_job', { requested_worker_id: workerId })
    if (error) throw new WorkflowJobError('WORKFLOW_JOB_CLAIM_FAILED', error.message)
    if (data === null) break
    const parsed = claimedJobSchema.safeParse(data)
    if (!parsed.success) throw new WorkflowJobError('WORKFLOW_JOB_CLAIM_FAILED')
    const job = parsed.data
    claimed += 1
    try {
      const resultReferenceId = await processClaimedJob(supabase, job, language)
      const result = await finishJob(supabase, job.id, workerId, 'SUCCEEDED', undefined, resultReferenceId)
      succeeded += 1
      if (result.status === 'DEAD_LETTER') deadLettered += 1
    } catch (error) {
      const code = errorCode(error)
      errors.push(code)
      try {
        const result = await finishJob(supabase, job.id, workerId, 'FAILED', code)
        if (result.status === 'DEAD_LETTER') deadLettered += 1
        else retried += 1
      } catch (finishError) {
        errors.push(errorCode(finishError))
      }
    }
  }

  return { claimed, succeeded, retried, deadLettered, errors }
}

export function scheduleWorkflowDrain(language: 'nl' | 'en' = 'nl'): void {
  after(async () => {
    try { await runWorkflowJobs(5, language) } catch { /* De duurzame jobstatus legt de volgende poging vast. */ }
  })
}

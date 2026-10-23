import 'server-only'

import { z } from 'zod'
import { requireAuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export const processOperationsFilterSchema = z.enum(['ALL', 'BLOCKED', 'OVERDUE', 'RETRY', 'FAILED'])

export const processOperationsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  filter: processOperationsFilterSchema.default('ALL'),
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
}).strict()

const operationsItemSchema = z.object({
  problemKey: z.enum(['BLOCKED_PROCESS', 'OVERDUE_WORK_ITEM', 'AUTOMATION_RETRY', 'AUTOMATION_FAILED']),
  jobType: z.enum(['PROCESS_REMINDER', 'PROCESS_DOCUMENT_OUTPUT']).nullable(),
  sourceId: z.string().uuid(),
  jobId: z.string().uuid().nullable(),
  processInstanceId: z.string().uuid(),
  workItemId: z.string().uuid().nullable(),
  processTitle: z.string(),
  stepTitle: z.string().nullable(),
  status: z.string(),
  responsibleLabel: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  occurredAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  nextRetryAt: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  canRecover: z.boolean(),
}).strict()

const operationsInboxSchema = z.object({
  summary: z.object({
    blockedProcesses: z.number().int().nonnegative(),
    overdueTasks: z.number().int().nonnegative(),
    failedAutomations: z.number().int().nonnegative(),
    retryingAutomations: z.number().int().nonnegative(),
  }).strict(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  items: z.array(operationsItemSchema),
}).strict()

export type ProcessOperationsQuery = z.infer<typeof processOperationsQuerySchema>
export type ProcessOperationsInbox = z.infer<typeof operationsInboxSchema>

export class ProcessOperationsServiceError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'ProcessOperationsServiceError'
  }
}

export async function getProcessOperationsInbox(
  query: ProcessOperationsQuery,
  language: 'nl' | 'en',
): Promise<ProcessOperationsInbox> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  if (!context.permissions.includes('process-operations:read')) {
    throw new ProcessOperationsServiceError('FORBIDDEN', 403)
  }

  const { data, error } = await supabase.rpc('get_process_operations_inbox', {
    requested_search: query.search || null,
    requested_filter: query.filter,
    requested_page: query.page,
    requested_page_size: query.pageSize,
    requested_language: language,
  })
  if (error) {
    const code = error.message.includes('AUTHENTICATION_REQUIRED')
      ? 'AUTHENTICATION_REQUIRED'
      : error.message.includes('FORBIDDEN')
        ? 'FORBIDDEN'
        : error.message.includes('PROCESS_OPERATIONS_FILTER_INVALID')
          ? 'PROCESS_OPERATIONS_FILTER_INVALID'
          : 'PROCESS_OPERATIONS_READ_FAILED'
    const status = code === 'AUTHENTICATION_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code.endsWith('INVALID') ? 400 : 500
    throw new ProcessOperationsServiceError(code, status)
  }

  const parsed = operationsInboxSchema.safeParse(data)
  if (!parsed.success) throw new ProcessOperationsServiceError('PROCESS_OPERATIONS_READ_FAILED', 500)
  return parsed.data
}

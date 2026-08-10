import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

const assignmentExplanationSchema = z.record(z.string(), z.string().nullable())
const databaseUuidSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)

const workItemSchema = z.object({
  workItemId: databaseUuidSchema,
  processInstanceId: databaseUuidSchema,
  stepInstanceId: databaseUuidSchema,
  processDefinitionId: databaseUuidSchema,
  processKey: z.string(),
  processTitle: z.string(),
  subjectEmployeeId: databaseUuidSchema.nullable(),
  subjectName: z.string().nullable(),
  stepKey: z.string(),
  stepTitle: z.string(),
  participantKey: z.string(),
  assignmentMode: z.string(),
  receivedVia: z.string(),
  assignmentExplanation: assignmentExplanationSchema,
  status: z.string(),
  instanceStatus: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
  claimedByUserId: databaseUuidSchema.nullable(),
  assigneeEmployeeId: databaseUuidSchema.nullable(),
  claimedAt: z.string().nullable(),
  availableAt: z.string(),
  deadlineAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  canAct: z.boolean(),
  canClaim: z.boolean(),
  isOverdue: z.boolean(),
}).strict()

const workListSchema = z.object({
  items: z.array(workItemSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
}).strict()

const timelineEventSchema = z.object({
  id: databaseUuidSchema,
  eventType: z.string(),
  createdAt: z.string(),
  actorEmployeeId: databaseUuidSchema.nullable(),
}).strict()

const detailStepSchema = z.object({
  id: databaseUuidSchema,
  stepKey: z.string(),
  status: z.string(),
  expectedVersion: z.number().int().positive(),
  activatedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
}).strict()

const detailWorkItemSchema = z.object({
  id: databaseUuidSchema,
  stepKey: z.string(),
  participantKey: z.string(),
  assignmentMode: z.string(),
  status: z.string(),
  expectedVersion: z.number().int().positive(),
  availableAt: z.string(),
  deadlineAt: z.string().nullable(),
}).strict()

const workDetailSchema = z.object({
  workItemId: databaseUuidSchema,
  processInstanceId: databaseUuidSchema,
  processDefinitionId: databaseUuidSchema,
  processKey: z.string(),
  processTitle: z.string(),
  processDescription: z.string().nullable(),
  subjectEmployeeId: databaseUuidSchema.nullable(),
  subjectName: z.string().nullable(),
  instanceStatus: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  correlationId: databaseUuidSchema.nullable(),
  stepKey: z.string(),
  stepTitle: z.string(),
  participantKey: z.string(),
  assignmentMode: z.string(),
  assignmentExplanation: assignmentExplanationSchema,
  status: z.string(),
  expectedVersion: z.number().int().positive(),
  stepExpectedVersion: z.number().int().positive().nullable(),
  claimedByUserId: databaseUuidSchema.nullable(),
  assigneeEmployeeId: databaseUuidSchema.nullable(),
  claimedAt: z.string().nullable(),
  availableAt: z.string(),
  deadlineAt: z.string().nullable(),
  isOverdue: z.boolean(),
  canAct: z.boolean(),
  canClaim: z.boolean(),
  canRelease: z.boolean(),
  canReassign: z.boolean(),
  allowedActions: z.array(z.string()),
  steps: z.array(detailStepSchema),
  workItems: z.array(detailWorkItemSchema),
  timeline: z.array(timelineEventSchema),
}).strict()

export type ProcessWorkItem = z.infer<typeof workItemSchema>
export type ProcessWorkList = z.infer<typeof workListSchema>
export type ProcessWorkDetail = z.infer<typeof workDetailSchema>
export type ProcessWorkTab = 'TODO' | 'CLAIMED' | 'WAITING' | 'COMPLETED' | 'ALL'
export type ProcessWorkSort = 'NEEDS_ACTION' | 'DEADLINE'

export interface ProcessWorkListInput {
  readonly hrGroupId?: string
  readonly administrationId?: string
  readonly tab?: ProcessWorkTab
  readonly search?: string
  readonly status?: string
  readonly processDefinitionId?: string
  readonly subjectEmployeeId?: string
  readonly subjectEmploymentId?: string
  readonly language: 'nl' | 'en'
  readonly sort?: ProcessWorkSort
  readonly limit?: number
  readonly offset?: number
}

export type ProcessWorkErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'WORK_ITEM_NOT_FOUND'
  | 'PROCESS_INSTANCE_NOT_FOUND'
  | 'PROCESS_WORK_PROJECTION_FAILED'
  | 'PROCESS_WORK_FILTER_OPTIONS_FAILED'

export class ProcessWorkError extends Error {
  constructor(readonly code: ProcessWorkErrorCode, readonly status: number, message: string = code) {
    super(message)
    this.name = 'ProcessWorkError'
  }
}

const readPermissions = new Set(['process-task:read', 'self:process-task:read', 'process-instance:read', 'self:process-instance:read'])

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface ProcessWorkDependencies {
  readonly supabase: SupabaseServerClient
  readonly context: AuthContext
}

function rpcErrorCode(message: string): ProcessWorkErrorCode {
  const candidate = message.split(':', 1)[0]?.trim() ?? ''
  if (candidate === 'AUTHENTICATION_REQUIRED') return 'AUTHENTICATION_REQUIRED'
  if (candidate === 'FORBIDDEN' || message.includes('permission denied')) return 'FORBIDDEN'
  if (candidate === 'WORK_ITEM_NOT_FOUND') return 'WORK_ITEM_NOT_FOUND'
  if (candidate === 'PROCESS_INSTANCE_NOT_FOUND') return 'PROCESS_INSTANCE_NOT_FOUND'
  return 'PROCESS_WORK_PROJECTION_FAILED'
}

function throwRpcError(message: string): never {
  const code = rpcErrorCode(message)
  const status = code === 'AUTHENTICATION_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code.endsWith('NOT_FOUND') ? 404 : 500
  throw new ProcessWorkError(code as ProcessWorkErrorCode, status, message)
}

async function authorizedClient(dependencies?: ProcessWorkDependencies) {
  const supabase = dependencies?.supabase ?? await createClient()
  const context = dependencies?.context ?? await requireAuthContext(supabase)
  if (!context.permissions.some((permission) => readPermissions.has(permission))) {
    throw new ProcessWorkError('FORBIDDEN', 403)
  }
  if (!context.hrGroupId) throw new ProcessWorkError('FORBIDDEN', 403)
  return { supabase, context }
}

export async function listProcessWork(input: ProcessWorkListInput, dependencies?: ProcessWorkDependencies): Promise<ProcessWorkList> {
  const { supabase, context } = await authorizedClient(dependencies)
  const request = {
    requested_hr_group_id: input.hrGroupId ?? context.hrGroupId!,
    requested_administration_id: input.administrationId,
    requested_tab: input.tab ?? 'TODO',
    requested_search: input.search?.trim() || undefined,
    requested_status: input.status || undefined,
    requested_process_definition_id: input.processDefinitionId,
    requested_language: input.language,
    requested_sort: input.sort ?? 'NEEDS_ACTION',
    requested_limit: input.limit ?? 100,
    requested_offset: input.offset ?? 0,
  }
  const { data, error } = input.subjectEmploymentId
    ? await supabase.rpc('get_process_work_projection_for_employment', {
      ...request,
      requested_employment_id: input.subjectEmploymentId,
    })
    : await supabase.rpc('get_process_work_projection_with_administration', {
      ...request,
      requested_subject_employee_id: input.subjectEmployeeId,
    })
  if (error) throwRpcError(error.message)
  const parsed = workListSchema.safeParse(data)
  if (!parsed.success) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500)
  return parsed.data
}

export interface ProcessWorkFilterOptions {
  readonly processes: ReadonlyArray<{ id: string; key: string; title: string }>
  readonly administrations: ReadonlyArray<{ id: string; code: string; name: string }>
}

function localizedOptionTitle(value: unknown, fallback: string): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fallback
  const record = value as Record<string, unknown>
  const languageValue = record.nl ?? record.en
  return typeof languageValue === 'string' && languageValue.trim() ? languageValue : fallback
}

export async function listProcessWorkFilterOptions(): Promise<ProcessWorkFilterOptions> {
  const { supabase, context } = await authorizedClient()
  const [processes, administrations] = await Promise.all([
    supabase.from('process_definitions').select('id, key, title').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId!).eq('status', 'PUBLISHED').order('key').limit(200),
    supabase.from('administrations').select('id, code, name').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId!).eq('is_active', true).order('name').limit(200),
  ])
  if (processes.error || administrations.error) throw new ProcessWorkError('PROCESS_WORK_FILTER_OPTIONS_FAILED', 500)
  return {
    processes: processes.data.map((process) => ({ id: process.id, key: process.key, title: localizedOptionTitle(process.title, process.key) })),
    administrations: administrations.data.map((administration) => ({ id: administration.id, code: administration.code, name: administration.name })),
  }
}

export async function getProcessWorkItemDetail(workItemId: string, language: 'nl' | 'en'): Promise<ProcessWorkDetail> {
  const { supabase } = await authorizedClient()
  const { data, error } = await supabase.rpc('get_process_work_item_detail', {
    requested_work_item_id: workItemId,
    requested_language: language,
  })
  if (error) throwRpcError(error.message)
  const parsed = workDetailSchema.safeParse(data)
  if (!parsed.success) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500)
  return parsed.data
}

export function processWorkErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProcessWorkError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

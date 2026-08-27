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

const assignmentCandidateRowSchema = z.object({
  employee_id: databaseUuidSchema,
  management_role_code: z.string().nullable(),
  resolution_date: z.string(),
  resolution_revision: z.number().int().nonnegative(),
  resolution_source: z.string(),
  is_eligible: z.boolean(),
}).strict()

const assignmentEmployeeRowSchema = z.object({
  id: databaseUuidSchema,
  employee_number: z.string(),
  first_name: z.string(),
  birth_name: z.string(),
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
export interface ProcessWorkAssignmentOption {
  readonly id: string
  readonly employeeNumber: string
  readonly name: string
  readonly resolutionDate: string
  readonly resolutionSource: string
  readonly managementRoleCode: string | null
}
export type ProcessWorkTab = 'TODO' | 'CLAIMED' | 'WAITING' | 'COMPLETED' | 'ALL'
export type ProcessWorkSort = 'NEEDS_ACTION' | 'DEADLINE'

export type ProcessWorkTabCounts = Record<ProcessWorkTab, number>

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

const processWorkTabs: readonly ProcessWorkTab[] = ['TODO', 'CLAIMED', 'WAITING', 'COMPLETED', 'ALL']

function boundedPagination(input: Pick<ProcessWorkListInput, 'limit' | 'offset'>): { limit: number; offset: number } {
  return {
    limit: Math.min(Math.max(input.limit ?? 100, 1), 200),
    offset: Math.max(input.offset ?? 0, 0),
  }
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
  const pagination = boundedPagination(input)
  const administrationFiltered = Boolean(input.administrationId)
  const request = {
    requested_hr_group_id: input.hrGroupId ?? context.hrGroupId!,
    requested_administration_id: input.administrationId,
    requested_tab: input.tab ?? 'TODO',
    requested_search: input.search?.trim() || undefined,
    requested_status: input.status || undefined,
    requested_process_definition_id: input.processDefinitionId,
    requested_language: input.language,
    requested_sort: input.sort ?? 'NEEDS_ACTION',
    // De bestaande administratie-wrapper filtert pas na het pagineren. Lees
    // daarom eerst het ondersteunde maximum en pas daarna de gevraagde pagina.
    requested_limit: administrationFiltered ? 200 : pagination.limit,
    requested_offset: administrationFiltered ? 0 : pagination.offset,
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
  if (!administrationFiltered) return parsed.data

  const items = parsed.data.items.slice(pagination.offset, pagination.offset + pagination.limit)
  return {
    items,
    total: parsed.data.total,
    hasMore: parsed.data.total > pagination.offset + pagination.limit,
  }
}

export async function listProcessWorkTabCounts(
  input: Omit<ProcessWorkListInput, 'tab' | 'limit' | 'offset'>,
  dependencies?: ProcessWorkDependencies,
): Promise<ProcessWorkTabCounts> {
  const counts = await Promise.all(processWorkTabs.map(async (tab) => ({
    tab,
    total: (await listProcessWork({ ...input, tab, limit: 1, offset: 0 }, dependencies)).total,
  })))
  return counts.reduce<ProcessWorkTabCounts>((result, entry) => {
    result[entry.tab] = entry.total
    return result
  }, { TODO: 0, CLAIMED: 0, WAITING: 0, COMPLETED: 0, ALL: 0 })
}

export interface ProcessWorkFilterOptions {
  readonly processes: ReadonlyArray<{ id: string; key: string; title: string }>
  readonly administrations: ReadonlyArray<{ id: string; code: string; name: string }>
}

function localizedOptionTitle(value: unknown, fallback: string, language: 'nl' | 'en'): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return fallback
  const record = value as Record<string, unknown>
  const languageValue = record[language] ?? record[language === 'nl' ? 'en' : 'nl']
  return typeof languageValue === 'string' && languageValue.trim() ? languageValue : fallback
}

export async function listProcessWorkFilterOptions(dependencies?: ProcessWorkDependencies, language: 'nl' | 'en' = 'nl'): Promise<ProcessWorkFilterOptions> {
  const { supabase, context } = await authorizedClient(dependencies)
  const [processes, administrations] = await Promise.all([
    supabase.from('process_definitions').select('id, key, title').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId!).eq('status', 'PUBLISHED').order('key').limit(200),
    supabase.from('administrations').select('id, code, name').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId!).eq('is_active', true).order('name').limit(200),
  ])
  if (processes.error || administrations.error) throw new ProcessWorkError('PROCESS_WORK_FILTER_OPTIONS_FAILED', 500)
  return {
    processes: processes.data.map((process) => ({ id: process.id, key: process.key, title: localizedOptionTitle(process.title, process.key, language) })),
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

export async function getProcessWorkItemAssignmentOptions(workItemId: string): Promise<ReadonlyArray<ProcessWorkAssignmentOption>> {
  const { supabase } = await authorizedClient()
  const { data: detailData, error: detailError } = await supabase.rpc('get_process_work_item_detail', {
    requested_work_item_id: workItemId,
    requested_language: 'nl',
  })
  if (detailError) throwRpcError(detailError.message)
  const parsedDetail = workDetailSchema.safeParse(detailData)
  if (!parsedDetail.success) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500)
  if (!parsedDetail.data.canReassign) throw new ProcessWorkError('FORBIDDEN', 403)

  const { data: candidateData, error: candidateError } = await supabase
    .from('process_work_item_candidates')
    .select('employee_id, management_role_code, resolution_date, resolution_revision, resolution_source, is_eligible')
    .eq('work_item_id', workItemId)
    .eq('is_eligible', true)
    .order('resolution_revision', { ascending: false })
    .order('resolution_date', { ascending: false })
  if (candidateError) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500, candidateError.message)
  const parsedCandidates = z.array(assignmentCandidateRowSchema).safeParse(candidateData ?? [])
  if (!parsedCandidates.success) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500)

  const latestCandidates = new Map<string, z.infer<typeof assignmentCandidateRowSchema>>()
  for (const candidate of parsedCandidates.data) {
    if (!latestCandidates.has(candidate.employee_id)) latestCandidates.set(candidate.employee_id, candidate)
  }
  const employeeIds = [...latestCandidates.keys()]
  if (employeeIds.length === 0) return []

  const { data: employeeData, error: employeeError } = await supabase
    .from('employees')
    .select('id, employee_number, first_name, birth_name')
    .in('id', employeeIds)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
  if (employeeError) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500, employeeError.message)
  const parsedEmployees = z.array(assignmentEmployeeRowSchema).safeParse(employeeData ?? [])
  if (!parsedEmployees.success) throw new ProcessWorkError('PROCESS_WORK_PROJECTION_FAILED', 500)
  const employees = new Map(parsedEmployees.data.map((employee) => [employee.id, employee]))

  return employeeIds.flatMap((employeeId) => {
    const candidate = latestCandidates.get(employeeId)
    const employee = employees.get(employeeId)
    if (!candidate || !employee) return []
    return [{
      id: employee.id,
      employeeNumber: employee.employee_number,
      name: [employee.first_name, employee.birth_name].filter((part) => part.trim()).join(' '),
      resolutionDate: candidate.resolution_date,
      resolutionSource: candidate.resolution_source,
      managementRoleCode: candidate.management_role_code,
    }]
  })
}

export function processWorkErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ProcessWorkError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

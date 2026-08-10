import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthContext, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createProcessOutputDocumentDownload } from '@/lib/documents/document-service'
import { createClient } from '@/lib/supabase/server'
import { getProcessRecipeStartContext, type ProcessRecipeStartContext } from './recipe-service'

const runtimeResultSchema = z.object({
  processInstanceId: z.string().uuid(),
  status: z.string(),
  currentStepKey: z.string().nullable(),
  instanceVersion: z.number().int().positive(),
  correlationId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
}).passthrough()

const acknowledgementResultSchema = runtimeResultSchema.extend({
  adapterKey: z.literal('DOCUMENT_ACKNOWLEDGEMENT'),
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  documentChecksumSha256: z.string().length(64),
  workItemId: z.string().uuid().optional(),
  acknowledgementId: z.string().uuid().optional(),
  alreadyAcknowledged: z.boolean().optional(),
  writesPerformed: z.boolean().optional(),
}).passthrough()

const startDataDocumentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  originalFilename: z.string(),
  checksumSha256: z.string().length(64),
}).strict()

const documentContextSchema = z.object({
  documentId: z.string().uuid(),
  employeeId: z.string().uuid(),
  title: z.string(),
  originalFilename: z.string(),
  contentType: z.string(),
  checksumSha256: z.string().length(64),
  acknowledged: z.boolean(),
}).strict()

export interface DocumentAcknowledgementStartEmployee {
  readonly id: string
  readonly employeeNumber: string
  readonly name: string
}

export interface DocumentAcknowledgementStartDocument {
  readonly id: string
  readonly employeeId: string
  readonly title: string
  readonly originalFilename: string
  readonly checksumSha256: string
}

export interface DocumentAcknowledgementStartData {
  readonly recipe: ProcessRecipeStartContext
  readonly employees: readonly DocumentAcknowledgementStartEmployee[]
  readonly documents: readonly DocumentAcknowledgementStartDocument[]
}

export interface DocumentAcknowledgementCommand {
  readonly processDefinitionId: string
  readonly subjectEmployeeId: string
  readonly documentId: string
  readonly idempotencyKey: string
  readonly correlationId?: string | null
}

export class DocumentAcknowledgementError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) {
    super(message)
    this.name = 'DocumentAcknowledgementError'
  }
}

function rpcErrorCode(message: string): string {
  return message.match(/\b[A-Z][A-Z0-9_]{2,100}\b/)?.[0] ?? 'DOCUMENT_ACKNOWLEDGEMENT_OPERATION_FAILED'
}

function throwRpcError(message: string): never {
  const code = rpcErrorCode(message)
  const status = code === 'AUTHENTICATION_REQUIRED' ? 401 : code === 'FORBIDDEN' || code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('STALE') || code.includes('CONFLICT') ? 409 : 400
  throw new DocumentAcknowledgementError(code, status, message)
}

export function documentAcknowledgementErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof DocumentAcknowledgementError)) return null
  return NextResponse.json({ code: error.code }, { status: error.status })
}

export async function getDocumentAcknowledgementStartData(): Promise<DocumentAcknowledgementStartData> {
  const context = await requirePermission('process-instance:start')
  const supabase = await createClient()
  const groupId = requireHrGroupId(context)
  const [recipe, employeesResult, documentsResult] = await Promise.all([
    getProcessRecipeStartContext('document-acknowledgement'),
    supabase.from('employees')
      .select('id, employee_number, first_name, birth_name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', groupId)
      .eq('is_active', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('employee_number')
      .limit(500),
    supabase.from('employee_documents')
      .select('id, employee_id, title, original_filename, checksum_sha256, administration_id, document_audiences(target_type, target_employee_id)')
      .eq('tenant_id', context.tenantId)
      .eq('administration_id', context.administrationId as string)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])
  if (employeesResult.error || documentsResult.error) throw new DocumentAcknowledgementError('DOCUMENT_ACKNOWLEDGEMENT_START_DATA_FAILED', 500)

  const employees = (employeesResult.data ?? []).map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employee_number,
    name: `${employee.first_name} ${employee.birth_name}`.trim(),
  }))
  const employeeIds = new Set(employees.map((employee) => employee.id))
  const documents = (documentsResult.data ?? [])
    .filter((document) => employeeIds.has(document.employee_id))
    .filter((document) => document.document_audiences.some((audience) => audience.target_type === 'EMPLOYEE' && audience.target_employee_id === document.employee_id))
    .map((document) => ({
      id: document.id,
      employeeId: document.employee_id,
      title: document.title,
      originalFilename: document.original_filename,
      checksumSha256: document.checksum_sha256,
    }))
  return { recipe, employees, documents }
}

export async function startDocumentAcknowledgement(command: DocumentAcknowledgementCommand) {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('start_document_acknowledgement', {
    requested_process_definition_id: command.processDefinitionId,
    requested_subject_employee_id: command.subjectEmployeeId,
    requested_document_id: command.documentId,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
  })
  if (error) throwRpcError(error.message)
  const parsed = acknowledgementResultSchema.safeParse(data)
  if (!parsed.success) throw new DocumentAcknowledgementError('DOCUMENT_ACKNOWLEDGEMENT_START_RESULT_INVALID', 500)
  return parsed.data
}

export async function acknowledgeDocumentWorkItem(command: {
  readonly workItemId: string
  readonly expectedVersion: number
  readonly stepExpectedVersion?: number | null
  readonly idempotencyKey: string
  readonly correlationId?: string | null
}) {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('acknowledge_document_process_work_item', {
    requested_work_item_id: command.workItemId,
    requested_expected_version: command.expectedVersion,
    requested_step_expected_version: command.stepExpectedVersion as number,
    requested_idempotency_key: command.idempotencyKey,
    requested_correlation_id: command.correlationId as string,
  })
  if (error) throwRpcError(error.message)
  const parsed = acknowledgementResultSchema.safeParse(data)
  if (!parsed.success) throw new DocumentAcknowledgementError('DOCUMENT_ACKNOWLEDGEMENT_RESULT_INVALID', 500)
  return parsed.data
}

export async function getDocumentAcknowledgementDocument(workItemId: string) {
  const supabase = await createClient()
  await requireAuthContext(supabase)
  const { data, error } = await supabase.rpc('get_document_acknowledgement_document', {
    requested_work_item_id: workItemId,
  })
  if (error) throwRpcError(error.message)
  const parsed = documentContextSchema.safeParse(data)
  if (!parsed.success) throw new DocumentAcknowledgementError('DOCUMENT_ACKNOWLEDGEMENT_DOCUMENT_RESULT_INVALID', 500)
  return parsed.data
}

export async function createDocumentAcknowledgementDownload(workItemId: string): Promise<string> {
  const document = await getDocumentAcknowledgementDocument(workItemId)
  return createProcessOutputDocumentDownload(document.employeeId, document.documentId)
}

export const documentAcknowledgementStartDocumentSchema = startDataDocumentSchema

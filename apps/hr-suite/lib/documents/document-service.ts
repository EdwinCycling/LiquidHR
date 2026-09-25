import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { Json } from '@scope/db'
import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isInlineDocumentPreviewContentType, sanitizeDocumentFilename, validateDocumentFile } from './file-rules'
import { validateDocumentCustomFieldValues, type DocumentCustomFieldDefinition } from './custom-field-rules'
import type { DocumentDeleteInput, DocumentMetadataInput } from './schemas'

const BUCKET = 'employee-documents'

export class DocumentServiceError extends Error { constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'DocumentServiceError' } }
function administration(id: string | null): string { if (!id) throw new DocumentServiceError('ADMINISTRATION_REQUIRED', 400); return id }

type DocumentPermission = 'document:read' | 'document:write' | 'document:delete'

async function assertEmployeeDocumentScope(employeeId: string, permission: DocumentPermission, supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  const { data, error } = await supabase.rpc('can_access_employee_dossier', { requested_employee_id: employeeId, requested_permission: permission })
  if (error) throw new DocumentServiceError('DOCUMENT_AUTHORIZATION_FAILED', 500)
  if (!data) throw new AuthorizationError('Je hebt geen toegang tot dit dossier.')
}

async function customFieldReadback(documentIds: string[], supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!documentIds.length) return new Map<string, { customFields: Json; labelsNl: Json; labelsEn: Json }>()
  const { data, error } = await supabase.rpc('get_accessible_employee_document_custom_fields', { requested_document_ids: documentIds })
  if (error) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_READ_FAILED', 500)
  return new Map((data ?? []).map((row) => [row.document_id, { customFields: row.custom_fields, labelsNl: row.labels_nl, labelsEn: row.labels_en }]))
}

export async function listEmployeeDocuments(employeeId: string) {
  await requirePermission('document:read', employeeId)
  const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:read', supabase)
  const { data, error } = await supabase.from('employee_documents').select('id, category_id, title, description, tags, original_filename, content_type, file_size, checksum_sha256, added_by_user_id, expires_on, created_at, deleted_at, deleted_by_user_id, delete_reason, expiry_reminder_id, document_categories(code, name, requires_salary_permission), document_audiences(target_type, target_employee_id, target_management_role_id, target_department_id)')
    .eq('employee_id', employeeId).is('deleted_at', null).order('created_at', { ascending: false }).limit(500)
  if (error) throw new DocumentServiceError('DOCUMENT_READ_FAILED', 500)
  const customFields = await customFieldReadback((data ?? []).map((row) => row.id), supabase)
  const activeDocuments = (data ?? []).map((row) => ({
    ...row,
    custom_fields: customFields.get(row.id)?.customFields ?? {},
    custom_field_labels_nl: customFields.get(row.id)?.labelsNl ?? {},
    custom_field_labels_en: customFields.get(row.id)?.labelsEn ?? {},
  }))
  const { data: deletedRows, error: deletedError } = await supabase.rpc('get_deleted_employee_documents_for_restore', { requested_employee_id: employeeId })
  if (deletedError) throw new DocumentServiceError('DOCUMENT_READ_FAILED', 500)
  const deletedDocuments = (deletedRows ?? []).map((row) => ({
    id: row.id,
    category_id: row.category_id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    custom_fields: {},
    custom_field_labels_nl: {},
    custom_field_labels_en: {},
    original_filename: row.original_filename,
    content_type: row.content_type,
    file_size: Number(row.file_size),
    expires_on: row.expires_on,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
    delete_reason: row.delete_reason,
    expiry_reminder_id: row.expiry_reminder_id,
    document_categories: row.category_code && row.category_name !== null ? { code: row.category_code, name: row.category_name, requires_salary_permission: row.category_requires_salary_permission ?? false } : null,
    document_audiences: [],
  }))
  return [...activeDocuments, ...deletedDocuments].sort((left, right) => right.created_at.localeCompare(left.created_at))
}

export async function listEmployeeDashboardDocuments(employeeId: string, limit = 3, dependencies?: { context: Awaited<ReturnType<typeof requirePermission>>; supabase: Awaited<ReturnType<typeof createClient>> }) {
  if (!dependencies) await requirePermission('document:read', employeeId)
  const supabase = dependencies?.supabase ?? await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:read', supabase)
  const { data, error } = await supabase.from('employee_documents')
    .select('id, title, description, tags, category_id, expires_on, created_at, original_filename, content_type, document_categories(name, requires_salary_permission)')
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new DocumentServiceError('DOCUMENT_READ_FAILED', 500)
  const customFields = await customFieldReadback((data ?? []).map((document) => document.id), supabase)
  return (data ?? []).map((document) => ({
    id: document.id,
    employeeId,
    title: document.title,
    description: document.description,
    tags: document.tags,
    categoryName: document.document_categories?.name ?? null,
    requiresSalaryPermission: document.document_categories?.requires_salary_permission ?? false,
    expiresOn: document.expires_on,
    createdAt: document.created_at,
    originalFilename: document.original_filename,
    contentType: document.content_type,
    customFields: customFields.get(document.id)?.customFields ?? {},
    customFieldLabelsNl: customFields.get(document.id)?.labelsNl ?? {},
    customFieldLabelsEn: customFields.get(document.id)?.labelsEn ?? {},
  }))
}

export async function getDocumentOptions(employeeId: string) {
  const context = await requirePermission('document:write', employeeId); const administrationId = administration(context.administrationId); const hrGroupId = requireHrGroupId(context); const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:write', supabase)
  const [categories, departments, roles, employees, cloudTags, customFieldDefinitions, customFieldOptions] = await Promise.all([
    supabase.from('document_categories').select('id, code, name, requires_salary_permission').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('is_active', true).order('code').limit(200),
    supabase.from('departments').select('id, code, name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('code').limit(500),
    supabase.from('management_roles').select('id, code, name').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).order('code').limit(200),
    supabase.from('employees').select('id, employee_number, first_name, birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(500),
    supabase.from('star_performer_tags').select('id, name').eq('tenant_id', context.tenantId).eq('is_active', true).order('name').limit(200),
    supabase.from('custom_field_definitions').select('id,key,label_nl,label_en,field_type,is_required,sort_order,hr_access,manager_access,employee_self_access').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('entity_type', 'DOCUMENT').eq('is_active', true).is('deleted_at', null).order('sort_order').order('label_nl').limit(200),
    supabase.from('custom_field_select_options').select('definition_id,value,label_nl,label_en,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('sort_order').limit(1000),
  ])
  if (categories.error || departments.error || roles.error || employees.error || cloudTags.error || customFieldDefinitions.error || customFieldOptions.error) throw new DocumentServiceError('DOCUMENT_OPTIONS_FAILED', 500)
  const fieldAccess = (definition: NonNullable<typeof customFieldDefinitions.data>[number]) => context.employeeId === employeeId
    ? definition.employee_self_access
    : context.permissions.includes('custom-fields:write') ? definition.hr_access : definition.manager_access
  return {
    categories: categories.data, departments: departments.data, roles: roles.data, employees: employees.data, cloudTags: cloudTags.data,
    documentCustomFields: customFieldDefinitions.data.flatMap((definition) => {
      if (fieldAccess(definition) !== 'WRITE') return []
      return [{
        ...definition,
        access: 'WRITE' as const,
        options: customFieldOptions.data.filter((option) => option.definition_id === definition.id),
      }]
    }),
  }
}

export async function uploadEmployeeDocument(employeeId: string, file: File, metadata: DocumentMetadataInput): Promise<string> {
  const context = await requirePermission('document:write', employeeId); const administrationId = administration(context.administrationId)
  const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:write', supabase)
  const validation = await validateDocumentFile(file)
  if (!validation.ok) throw new DocumentServiceError(validation.reason === 'EMPTY' ? 'DOCUMENT_FILE_EMPTY' : validation.reason === 'SIZE' ? 'DOCUMENT_SIZE_INVALID' : 'DOCUMENT_TYPE_INVALID', 400)
  const [{ data: definitions, error: definitionError }, { data: fieldOptions, error: optionError }] = await Promise.all([
    supabase.from('custom_field_definitions').select('id,key,field_type,is_required,hr_access,manager_access,employee_self_access').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('entity_type', 'DOCUMENT').eq('is_active', true).is('deleted_at', null),
    supabase.from('custom_field_select_options').select('definition_id,value').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_active', true),
  ])
  if (definitionError || optionError) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_FAILED', 500)
  const isHr = context.permissions.includes('custom-fields:write')
  const writableDefinitions: DocumentCustomFieldDefinition[] = definitions.map((definition) => ({
    key: definition.key,
    field_type: definition.field_type,
    is_required: definition.is_required,
    access: context.employeeId === employeeId ? definition.employee_self_access : isHr ? definition.hr_access : definition.manager_access,
    options: fieldOptions.filter((option) => option.definition_id === definition.id).map((option) => option.value),
  }))
  const validationError = validateDocumentCustomFieldValues(writableDefinitions, metadata.customFields)
  if (validationError) throw new DocumentServiceError(validationError, 400)
  await validateDocumentWriteMetadata(employeeId, metadata, context, supabase)
  const { bytes, contentType } = validation
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const storageKey = `${context.tenantId}/${administrationId}/${employeeId}/${randomUUID()}/${sanitizeDocumentFilename(file.name)}`
  const upload = await supabase.storage.from(BUCKET).upload(storageKey, bytes, { contentType, upsert: false })
  if (upload.error) throw new DocumentServiceError('DOCUMENT_UPLOAD_FAILED', 500)
  const payload = { ...metadata, storageKey, originalFilename: file.name, contentType, fileSize: file.size, checksumSha256: checksum }
  const { data, error } = await supabase.rpc('create_employee_document_metadata_atomic', { requested_employee_id: employeeId, requested_administration_id: administrationId, requested_payload: payload as Json })
  if (error || !data) {
    const removed = await createAdminClient().storage.from(BUCKET).remove([storageKey])
    if (removed.error) throw new DocumentServiceError('DOCUMENT_UPLOAD_ROLLBACK_FAILED', 500)
    throw new DocumentServiceError(error?.message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'DOCUMENT_METADATA_FAILED', error?.code === '42501' ? 403 : 400)
  }
  return data
}

export async function updateEmployeeDocumentMetadata(employeeId: string, documentId: string, metadata: DocumentMetadataInput): Promise<void> {
  const context = await requirePermission('document:write', employeeId)
  const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:write', supabase)
  await validateDocumentWriteMetadata(employeeId, metadata, context, supabase)
  const { data: definitions, error: definitionError } = await supabase.from('custom_field_definitions').select('id,key,field_type,is_required,hr_access,manager_access,employee_self_access').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('entity_type', 'DOCUMENT').eq('is_active', true).is('deleted_at', null)
  const { data: fieldOptions, error: optionsError } = await supabase.from('custom_field_select_options').select('definition_id,value').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_active', true)
  if (definitionError || optionsError) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_FAILED', 500)
  const isHr = context.permissions.includes('custom-fields:write')
  const fieldDefinitions: DocumentCustomFieldDefinition[] = definitions.map((definition) => ({
    key: definition.key,
    field_type: definition.field_type,
    is_required: definition.is_required,
    access: context.employeeId === employeeId ? definition.employee_self_access : isHr ? definition.hr_access : definition.manager_access,
    options: fieldOptions.filter((option) => option.definition_id === definition.id).map((option) => option.value),
  }))
  const validationError = validateDocumentCustomFieldValues(fieldDefinitions, metadata.customFields)
  if (validationError) throw new DocumentServiceError(validationError, 400)
  const { error } = await supabase.rpc('update_employee_document_metadata_atomic', {
    requested_employee_id: employeeId,
    requested_document_id: documentId,
    requested_payload: metadata as unknown as Json,
  })
  if (error) throw new DocumentServiceError(error.message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'DOCUMENT_METADATA_FAILED', error.code === '42501' ? 403 : 400)
}

async function validateDocumentWriteMetadata(employeeId: string, metadata: DocumentMetadataInput, context: Awaited<ReturnType<typeof requirePermission>>, supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  const administrationId = administration(context.administrationId)
  const [categoryResult, employeesResult, rolesResult, departmentsResult] = await Promise.all([
    supabase.from('document_categories').select('id,requires_salary_permission').eq('id', metadata.categoryId).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('is_active', true).maybeSingle(),
    supabase.from('employees').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_active', true).eq('is_archived', false).is('deleted_at', null),
    supabase.from('management_roles').select('id').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).eq('is_active', true).is('deleted_at', null),
    supabase.from('departments').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_active', true),
  ])
  if (categoryResult.error || employeesResult.error || rolesResult.error || departmentsResult.error) throw new DocumentServiceError('DOCUMENT_OPTIONS_FAILED', 500)
  if (!categoryResult.data) throw new DocumentServiceError('DOCUMENT_CATEGORY_INVALID', 400)
  if (categoryResult.data.requires_salary_permission && !context.permissions.includes('salary:read')) throw new DocumentServiceError('DOCUMENT_SALARY_PERMISSION_REQUIRED', 403)
  const employeeIds = new Set((employeesResult.data ?? []).map((employee) => employee.id))
  const roleIds = new Set((rolesResult.data ?? []).map((role) => role.id))
  const departmentIds = new Set((departmentsResult.data ?? []).map((department) => department.id))
  if (metadata.audiences.some((audience) => audience.type === 'EMPLOYEE' ? !employeeIds.has(audience.targetId) : audience.type === 'MANAGEMENT_ROLE' ? !roleIds.has(audience.targetId) : !departmentIds.has(audience.targetId))) throw new DocumentServiceError('DOCUMENT_AUDIENCE_SCOPE_INVALID', 400)
  if (metadata.reminder?.targets.some((target) => target.type === 'EMPLOYEE' ? !employeeIds.has(target.targetId) : !roleIds.has(target.targetId))) throw new DocumentServiceError('REMINDER_TARGET_SCOPE_INVALID', 400)
  if (!employeeIds.has(employeeId)) throw new DocumentServiceError('DOCUMENT_EMPLOYEE_SCOPE_INVALID', 403)
}

export interface DocumentFileResponse {
  body: ReadableStream<Uint8Array>
  contentType: string
  fileSize: number
  originalFilename: string
}

async function openAuthorizedDocumentFile(employeeId: string, documentId: string, failureCode: string): Promise<DocumentFileResponse> {
  await requirePermission('document:read', employeeId); const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:read', supabase)
  const { data: document, error } = await supabase.from('employee_documents').select('storage_key, original_filename, content_type, file_size').eq('id', documentId).eq('employee_id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !document) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(document.storage_key, 60)
  if (signed.error || !signed.data?.signedUrl) throw new DocumentServiceError(failureCode, 502)

  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!configuredSupabaseUrl) throw new DocumentServiceError(failureCode, 500)

  let storageUrl: URL
  try {
    storageUrl = new URL(signed.data.signedUrl)
    if (storageUrl.origin !== new URL(configuredSupabaseUrl).origin) throw new Error('Unexpected storage origin')
  } catch {
    throw new DocumentServiceError(failureCode, 502)
  }

  let response: Response
  try {
    response = await fetch(storageUrl, { cache: 'no-store', redirect: 'error' })
  } catch {
    throw new DocumentServiceError(failureCode, 502)
  }
  if (!response.ok || !response.body) throw new DocumentServiceError(failureCode, 502)

  const contentType = document.content_type.trim().toLocaleLowerCase('en-US')
  const returnedContentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLocaleLowerCase('en-US')
  if (!contentType || (returnedContentType && returnedContentType !== contentType)) {
    await response.body.cancel()
    throw new DocumentServiceError(failureCode, 502)
  }

  const fileSize = Number(document.file_size)
  const returnedFileSize = response.headers.get('content-length')
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || (returnedFileSize !== null && Number(returnedFileSize) !== fileSize)) {
    await response.body.cancel()
    throw new DocumentServiceError(failureCode, 502)
  }

  return { body: response.body, contentType, fileSize, originalFilename: document.original_filename }
}

export async function createDocumentDownload(employeeId: string, documentId: string): Promise<DocumentFileResponse> {
  return openAuthorizedDocumentFile(employeeId, documentId, 'DOCUMENT_DOWNLOAD_FAILED')
}

export async function createDocumentPreview(employeeId: string, documentId: string): Promise<DocumentFileResponse> {
  const file = await openAuthorizedDocumentFile(employeeId, documentId, 'DOCUMENT_PREVIEW_FAILED')
  const contentType = file.contentType
  if (!isInlineDocumentPreviewContentType(contentType)) {
    await file.body.cancel()
    throw new DocumentServiceError('DOCUMENT_PREVIEW_UNSUPPORTED', 415)
  }

  return file
}

export async function createProcessOutputDocumentDownload(employeeId: string, documentId: string): Promise<string> {
  const admin = createAdminClient()
  const { data: document, error } = await admin.from('employee_documents').select('storage_key').eq('id', documentId).eq('employee_id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !document) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
  const signed = await admin.storage.from(BUCKET).createSignedUrl(document.storage_key, 60)
  if (signed.error || !signed.data?.signedUrl) throw new DocumentServiceError('DOCUMENT_DOWNLOAD_FAILED', 500)
  return signed.data.signedUrl
}

export async function softDeleteDocument(employeeId: string, documentId: string, input: DocumentDeleteInput): Promise<void> {
  await requirePermission('document:delete', employeeId); const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:delete', supabase)
  const { data, error } = await supabase.rpc('soft_delete_employee_document_atomic', { requested_employee_id: employeeId, requested_document_id: documentId, requested_delete_reason: input.reason })
  if (error) throw new DocumentServiceError(error.message.match(/[A-Z_]+/)?.[0] ?? 'DOCUMENT_DELETE_FAILED', error.code === '42501' ? 403 : 404)
  if (!data) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
}

export async function restoreDocument(employeeId: string, documentId: string): Promise<void> {
  await requirePermission('document:delete', employeeId); const supabase = await createClient()
  await assertEmployeeDocumentScope(employeeId, 'document:delete', supabase)
  const { data, error } = await supabase.rpc('restore_employee_document_atomic', { requested_employee_id: employeeId, requested_document_id: documentId })
  if (error) throw new DocumentServiceError(error.message.match(/[A-Z_]+/)?.[0] ?? 'DOCUMENT_RESTORE_FAILED', error.code === '42501' ? 403 : 404)
  if (!data) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
}

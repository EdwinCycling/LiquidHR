import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { Json } from '@scope/db'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { isAllowedDocumentFile, MAX_DOCUMENT_FILE_BYTES } from './file-rules'
import type { DocumentDeleteInput, DocumentMetadataInput } from './schemas'

const BUCKET = 'employee-documents'

export class DocumentServiceError extends Error { constructor(public readonly code: string, public readonly status: number) { super(code); this.name = 'DocumentServiceError' } }
function administration(id: string | null): string { if (!id) throw new DocumentServiceError('ADMINISTRATION_REQUIRED', 400); return id }
function cleanFilename(name: string): string { return name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-180) || 'document' }

export async function listEmployeeDocuments(employeeId: string) {
  await requirePermission('document:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_documents').select('id, title, description, tags, custom_fields, original_filename, content_type, file_size, expires_on, created_at, deleted_at, delete_reason, expiry_reminder_id, document_categories(code, name), document_audiences(target_type, target_employee_id, target_management_role_id, target_department_id)')
    .eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(500)
  if (error) throw new DocumentServiceError('DOCUMENT_READ_FAILED', 500)
  return data
}

export async function listEmployeeDashboardDocuments(employeeId: string, limit = 3) {
  await requirePermission('document:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_documents')
    .select('id, title, expires_on, created_at')
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new DocumentServiceError('DOCUMENT_READ_FAILED', 500)
  return (data ?? []).map((document) => ({
    id: document.id,
    title: document.title,
    expiresOn: document.expires_on,
    createdAt: document.created_at,
  }))
}

export async function getDocumentOptions(employeeId: string) {
  const context = await requirePermission('document:write', employeeId); const administrationId = administration(context.administrationId); const hrGroupId = requireHrGroupId(context); const supabase = await createClient()
  const [categories, departments, roles, employees, cloudTags, customFieldDefinitions, customFieldOptions] = await Promise.all([
    supabase.from('document_categories').select('id, code, name').eq('administration_id', administrationId).eq('is_active', true).order('code').limit(200),
    supabase.from('departments').select('id, code, name').eq('tenant_id', context.tenantId).eq('is_active', true).order('code').limit(500),
    supabase.from('management_roles').select('id, code, name').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).order('code').limit(200),
    supabase.from('employees').select('id, employee_number, first_name, birth_name').eq('tenant_id', context.tenantId).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(500),
    supabase.from('star_performer_tags').select('id, name').eq('tenant_id', context.tenantId).eq('is_active', true).order('name').limit(200),
    supabase.from('custom_field_definitions').select('id,key,label_nl,label_en,field_type,is_required,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('entity_type', 'DOCUMENT').eq('is_active', true).is('deleted_at', null).order('sort_order').order('label_nl').limit(200),
    supabase.from('custom_field_select_options').select('definition_id,value,label_nl,label_en,sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('sort_order').limit(1000),
  ])
  if (categories.error || departments.error || roles.error || employees.error || cloudTags.error || customFieldDefinitions.error || customFieldOptions.error) throw new DocumentServiceError('DOCUMENT_OPTIONS_FAILED', 500)
  return {
    categories: categories.data, departments: departments.data, roles: roles.data, employees: employees.data, cloudTags: cloudTags.data,
    documentCustomFields: customFieldDefinitions.data.map((definition) => ({
      ...definition,
      options: customFieldOptions.data.filter((option) => option.definition_id === definition.id),
    })),
  }
}

export async function uploadEmployeeDocument(employeeId: string, file: File, metadata: DocumentMetadataInput): Promise<string> {
  const context = await requirePermission('document:write', employeeId); const administrationId = administration(context.administrationId)
  if (!isAllowedDocumentFile(file)) throw new DocumentServiceError('DOCUMENT_TYPE_INVALID', 400)
  if (file.size < 1 || file.size > MAX_DOCUMENT_FILE_BYTES) throw new DocumentServiceError('DOCUMENT_SIZE_INVALID', 400)
  const supabase = await createClient()
  const [{ data: definitions, error: definitionError }, { data: fieldOptions, error: optionError }] = await Promise.all([
    supabase.from('custom_field_definitions').select('id,key,field_type,is_required').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('entity_type', 'DOCUMENT').eq('is_active', true).is('deleted_at', null),
    supabase.from('custom_field_select_options').select('definition_id,value').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_active', true),
  ])
  if (definitionError || optionError) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_FAILED', 500)
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]))
  if (Object.keys(metadata.customFields).some((key) => !definitionByKey.has(key))) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_INVALID', 400)
  for (const definition of definitions) {
    let value = metadata.customFields[definition.key]
    if (definition.field_type === 'AUTO_INCREMENT' && (value === undefined || value === null || value === '')) {
      const { data: nextValue, error: nextValueError } = await supabase.rpc('next_custom_field_value', { p_definition_id: definition.id })
      if (nextValueError || nextValue === null) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_FAILED', 500)
      metadata.customFields[definition.key] = nextValue
      value = nextValue
    }
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    if (definition.is_required && empty) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_REQUIRED', 400)
    if (empty) continue
    const allowed = new Set(fieldOptions.filter((option) => option.definition_id === definition.id).map((option) => option.value))
    if ((definition.field_type === 'SELECT' && (typeof value !== 'string' || !allowed.has(value)))
      || (definition.field_type === 'MULTI_SELECT' && (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !allowed.has(item))))
      || (definition.field_type === 'NUMBER' && typeof value !== 'number')
      || (definition.field_type === 'BOOLEAN' && typeof value !== 'boolean')) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_INVALID', 400)
  }
  const bytes = new Uint8Array(await file.arrayBuffer()); const checksum = createHash('sha256').update(bytes).digest('hex')
  const storageKey = `${context.tenantId}/${administrationId}/${employeeId}/${randomUUID()}/${cleanFilename(file.name)}`
  const upload = await supabase.storage.from(BUCKET).upload(storageKey, bytes, { contentType: file.type, upsert: false })
  if (upload.error) throw new DocumentServiceError('DOCUMENT_UPLOAD_FAILED', 500)
  const payload = { ...metadata, storageKey, originalFilename: file.name, contentType: file.type, fileSize: file.size, checksumSha256: checksum }
  const { data, error } = await supabase.rpc('create_employee_document_metadata', { requested_employee_id: employeeId, requested_administration_id: administrationId, requested_payload: payload as Json })
  if (error || !data) { await supabase.storage.from(BUCKET).remove([storageKey]); throw new DocumentServiceError(error?.message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'DOCUMENT_METADATA_FAILED', 400) }
  const { error: customFieldError } = await supabase.from('employee_documents').update({ custom_fields: metadata.customFields as Json }).eq('id', data).eq('employee_id', employeeId)
  if (customFieldError) throw new DocumentServiceError('DOCUMENT_CUSTOM_FIELDS_FAILED', 500)
  return data
}

export async function createDocumentDownload(employeeId: string, documentId: string): Promise<string> {
  await requirePermission('document:read', employeeId); const supabase = await createClient()
  const { data: document, error } = await supabase.from('employee_documents').select('storage_key').eq('id', documentId).eq('employee_id', employeeId).is('deleted_at', null).maybeSingle()
  if (error || !document) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(document.storage_key, 60)
  if (signed.error) throw new DocumentServiceError('DOCUMENT_DOWNLOAD_FAILED', 500)
  return signed.data.signedUrl
}

export async function softDeleteDocument(employeeId: string, documentId: string, input: DocumentDeleteInput): Promise<void> {
  const context = await requirePermission('document:delete', employeeId); const supabase = await createClient()
  const { data, error } = await supabase.from('employee_documents').update({ deleted_at: new Date().toISOString(), deleted_by_user_id: context.userId, delete_reason: input.reason }).eq('id', documentId).eq('employee_id', employeeId).is('deleted_at', null).select('id').maybeSingle()
  if (error || !data) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
}

export async function restoreDocument(employeeId: string, documentId: string): Promise<void> {
  await requirePermission('document:delete', employeeId); const supabase = await createClient()
  const { data, error } = await supabase.from('employee_documents').update({ deleted_at: null, deleted_by_user_id: null, delete_reason: null }).eq('id', documentId).eq('employee_id', employeeId).not('deleted_at', 'is', null).select('id').maybeSingle()
  if (error || !data) throw new DocumentServiceError('DOCUMENT_NOT_FOUND', 404)
}

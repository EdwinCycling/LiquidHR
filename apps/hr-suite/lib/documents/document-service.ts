import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
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
  const { data, error } = await supabase.from('employee_documents').select('id, title, description, tags, original_filename, content_type, file_size, expires_on, created_at, deleted_at, delete_reason, expiry_reminder_id, document_categories(code, name), document_audiences(target_type, target_employee_id, target_management_role_id, target_department_id)')
    .eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(500)
  if (error) throw new DocumentServiceError('DOCUMENT_READ_FAILED', 500)
  return data
}

export async function getDocumentOptions(employeeId: string) {
  const context = await requirePermission('document:write', employeeId); const administrationId = administration(context.administrationId); const supabase = await createClient()
  const [categories, departments, roles, employees] = await Promise.all([
    supabase.from('document_categories').select('id, code, name').eq('administration_id', administrationId).eq('is_active', true).order('code').limit(200),
    supabase.from('departments').select('id, code, name').eq('administration_id', administrationId).eq('is_active', true).order('code').limit(500),
    supabase.from('management_roles').select('id, code, name').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).order('code').limit(200),
    supabase.from('employees').select('id, employee_number, first_name, birth_name').eq('tenant_id', context.tenantId).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(500),
  ])
  if (categories.error || departments.error || roles.error || employees.error) throw new DocumentServiceError('DOCUMENT_OPTIONS_FAILED', 500)
  return { categories: categories.data, departments: departments.data, roles: roles.data, employees: employees.data }
}

export async function uploadEmployeeDocument(employeeId: string, file: File, metadata: DocumentMetadataInput): Promise<string> {
  const context = await requirePermission('document:write', employeeId); const administrationId = administration(context.administrationId)
  if (!isAllowedDocumentFile(file)) throw new DocumentServiceError('DOCUMENT_TYPE_INVALID', 400)
  if (file.size < 1 || file.size > MAX_DOCUMENT_FILE_BYTES) throw new DocumentServiceError('DOCUMENT_SIZE_INVALID', 400)
  const bytes = new Uint8Array(await file.arrayBuffer()); const checksum = createHash('sha256').update(bytes).digest('hex')
  const storageKey = `${context.tenantId}/${administrationId}/${employeeId}/${randomUUID()}/${cleanFilename(file.name)}`
  const supabase = await createClient(); const upload = await supabase.storage.from(BUCKET).upload(storageKey, bytes, { contentType: file.type, upsert: false })
  if (upload.error) throw new DocumentServiceError('DOCUMENT_UPLOAD_FAILED', 500)
  const payload = { ...metadata, storageKey, originalFilename: file.name, contentType: file.type, fileSize: file.size, checksumSha256: checksum }
  const { data, error } = await supabase.rpc('create_employee_document_metadata', { requested_employee_id: employeeId, requested_administration_id: administrationId, requested_payload: payload as Json })
  if (error || !data) { await supabase.storage.from(BUCKET).remove([storageKey]); throw new DocumentServiceError(error?.message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'DOCUMENT_METADATA_FAILED', 400) }
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

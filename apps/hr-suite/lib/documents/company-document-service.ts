import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { requireAuthContext, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { sanitizeDocumentFilename, validateDocumentFile } from './file-rules'
import type { CompanyDocumentMetadataInput } from './company-schemas'

const BUCKET = 'company-documents'

export class CompanyDocumentServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'CompanyDocumentServiceError'
  }
}

export async function listCompanyDocuments() {
  const context = await requireAuthContext()
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const query = supabase.from('company_documents')
    .select('id, title, original_filename, content_type, file_size, created_at')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .is('deleted_at', null)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error) throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_READ_FAILED', 500)
  return data
}

export async function uploadCompanyDocument(file: File, metadata: CompanyDocumentMetadataInput): Promise<string> {
  const context = await requirePermission('company-document:write')
  const hrGroupId = requireHrGroupId(context)
  const validation = await validateDocumentFile(file)
  if (!validation.ok) throw new CompanyDocumentServiceError(validation.reason === 'SIZE' ? 'DOCUMENT_SIZE_INVALID' : 'DOCUMENT_TYPE_INVALID', 400)

  const { bytes, contentType } = validation
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const storageKey = `${context.tenantId}/${hrGroupId}/${randomUUID()}/${sanitizeDocumentFilename(file.name)}`
  const supabase = await createClient()
  const upload = await supabase.storage.from(BUCKET).upload(storageKey, bytes, { contentType, upsert: false })
  if (upload.error) throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_UPLOAD_FAILED', 500)

  const { data, error } = await supabase.from('company_documents').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    title: metadata.title,
    original_filename: file.name,
    storage_key: storageKey,
    file_size: file.size,
    content_type: contentType,
    checksum_sha256: checksum,
    uploaded_by_user_id: context.userId,
  }).select('id').single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([storageKey])
    throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_METADATA_FAILED', 400)
  }
  return data.id
}

export async function createCompanyDocumentDownload(documentId: string): Promise<string> {
  const context = await requireAuthContext()
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const query = supabase.from('company_documents').select('storage_key').eq('id', documentId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).is('deleted_at', null)
  const { data, error } = await query.maybeSingle()
  if (error || !data) throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_NOT_FOUND', 404)
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(data.storage_key, 60)
  if (signed.error) throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_DOWNLOAD_FAILED', 500)
  return signed.data.signedUrl
}

export async function deleteCompanyDocument(documentId: string): Promise<void> {
  const context = await requirePermission('company-document:delete')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const existing = await supabase.from('company_documents').select('id').eq('id', documentId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).is('deleted_at', null).maybeSingle()
  if (existing.error || !existing.data) throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_NOT_FOUND', 404)
  const { error } = await supabase.rpc('soft_delete_company_document', { requested_document_id: documentId })
  if (!error) return
  if (error.code === 'P0001' || error.message === 'COMPANY_DOCUMENT_FORBIDDEN') throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_FORBIDDEN', 403)
  if (error.code === 'P0002' || error.message === 'COMPANY_DOCUMENT_NOT_FOUND') throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_NOT_FOUND', 404)
  throw new CompanyDocumentServiceError('COMPANY_DOCUMENT_DELETE_FAILED', 500)
}

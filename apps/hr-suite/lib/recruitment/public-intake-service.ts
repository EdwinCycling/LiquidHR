import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createTurnstileBotChallengeAdapter, createRemoteMalwareScannerAdapter, createPublicIntakeKey, validateRecruitmentDocument, type RecruitmentDocument } from './public-security'
import { RecruitmentError } from './errors'

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function requirePublicSecurityConfig(): { readonly pepper: string } {
  const pepper = process.env.RECRUITMENT_RATE_LIMIT_PEPPER
  if (!pepper || pepper.length < 16) throw new RecruitmentError('RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', 503)
  if (!process.env.TURNSTILE_SECRET_KEY) throw new RecruitmentError('RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE', 503)
  if (!process.env.RECRUITMENT_MALWARE_SCAN_URL || !process.env.RECRUITMENT_MALWARE_SCAN_API_KEY) throw new RecruitmentError('RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE', 503)
  return { pepper }
}

export async function createPublicIntakeProof(input: {
  readonly publicationId: string
  readonly challengeToken: string
  readonly networkAddress: string
  readonly formFingerprint: string
}): Promise<string> {
  const { pepper } = requirePublicSecurityConfig()
  const challenge = await createTurnstileBotChallengeAdapter().verify(input.challengeToken)
  if (!challenge.ok) throw new RecruitmentError(challenge.code, challenge.code.includes('UNAVAILABLE') ? 503 : 422)
  const admin = createAdminClient()
  const publication = await admin.from('recruitment_publications').select('id,tenant_id,hr_group_id,status').eq('id', input.publicationId).maybeSingle()
  if (publication.error || !publication.data || publication.data.status !== 'OPEN') throw new RecruitmentError('RECRUITMENT_PUBLICATION_NOT_OPEN', 404)
  const bucketKeyHash = await createPublicIntakeKey({ networkAddress: input.networkAddress, formFingerprint: input.formFingerprint }, pepper)
  const windowStartedAt = new Date(Math.floor(Date.now() / 900_000) * 900_000).toISOString()
  const current = await admin.from('recruitment_public_intake_limits').select('id,request_count').eq('publication_id', input.publicationId).eq('bucket_key_hash', bucketKeyHash).eq('window_started_at', windowStartedAt).maybeSingle()
  if (current.error) throw new RecruitmentError('RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', 503)
  if ((current.data?.request_count ?? 0) >= 5) throw new RecruitmentError('RECRUITMENT_PUBLIC_RATE_LIMITED', 429)
  const proof = crypto.randomUUID()
  const proofHash = await sha256(proof)
  const proofPayload = {
    proof_hash: proofHash,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    consumed_at: null,
  }
  if (current.data) {
    const updated = await admin.from('recruitment_public_intake_limits').update({ ...proofPayload, request_count: current.data.request_count + 1 }).eq('id', current.data.id)
    if (updated.error) throw new RecruitmentError('RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', 503)
  } else {
    const inserted = await admin.from('recruitment_public_intake_limits').insert({
      publication_id: input.publicationId, tenant_id: publication.data.tenant_id, hr_group_id: publication.data.hr_group_id,
      bucket_key_hash: bucketKeyHash, window_started_at: windowStartedAt, request_count: 1, ...proofPayload,
    })
    if (inserted.error) throw new RecruitmentError('RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', 503)
  }
  return proof
}

export async function scanAndStorePublicDocument(applicationId: string, document: RecruitmentDocument): Promise<void> {
  const validation = validateRecruitmentDocument(document)
  if (!validation.ok) throw new RecruitmentError(validation.code, 422)
  const scan = await createRemoteMalwareScannerAdapter().scan(document)
  if (scan.status === 'UNAVAILABLE') throw new RecruitmentError('RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE', 503)
  if (scan.status === 'REJECTED') throw new RecruitmentError('RECRUITMENT_DOCUMENT_REJECTED', 422)
  const admin = createAdminClient()
  const application = await admin.from('recruitment_applications').select('id,tenant_id,hr_group_id').eq('id', applicationId).maybeSingle()
  if (application.error || !application.data) throw new RecruitmentError('RECRUITMENT_APPLICATION_NOT_FOUND', 404)
  const extension = validation.detectedType === 'PDF' ? 'pdf' : 'docx'
  const storageKey = `${application.data.tenant_id}/${application.data.hr_group_id}/${applicationId}/${crypto.randomUUID()}.${extension}`
  const uploaded = await admin.storage.from('recruitment-documents').upload(storageKey, document.bytes, { contentType: document.mimeType, upsert: false })
  if (uploaded.error) throw new RecruitmentError('RECRUITMENT_DOCUMENT_UPLOAD_FAILED', 503)
  const inserted = await admin.from('recruitment_documents').insert({
    tenant_id: application.data.tenant_id,
    hr_group_id: application.data.hr_group_id,
    application_id: applicationId,
    storage_key: storageKey,
    original_filename: document.fileName,
    mime_type: document.mimeType,
    file_size: document.size,
    checksum_sha256: await sha256Bytes(document.bytes),
    scan_status: 'CLEAN',
    scanner_reference: scan.reference,
    scanned_at: new Date().toISOString(),
  })
  if (inserted.error) {
    await admin.storage.from('recruitment-documents').remove([storageKey])
    throw new RecruitmentError('RECRUITMENT_DOCUMENT_UPLOAD_FAILED', 503)
  }
}

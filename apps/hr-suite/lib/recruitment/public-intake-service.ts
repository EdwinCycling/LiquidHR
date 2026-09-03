import 'server-only'

import { Buffer } from 'node:buffer'
import type { Database } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTurnstileBotChallengeAdapter, createRemoteMalwareScannerAdapter, createPublicIntakeKey, PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES, validateRecruitmentDocument, type RecruitmentDocument } from './public-security'
import { recruitmentDatabaseError, RecruitmentError } from './errors'

type SupabaseServerClient = SupabaseClient<Database>
type RpcClient = SupabaseServerClient & {
  rpc(name: string, args: Record<string, unknown>): Promise<{ readonly data: unknown; readonly error: { readonly message: string } | null }>
}

export type PublicIntakeClaim = {
  readonly proof: string
  readonly bucketKeyHash: string
  readonly proofId: string
  readonly expiresAt: string
}

export type CleanPublicDocumentScan = {
  readonly detectedType: 'PDF' | 'DOCX'
  readonly reference: string
  readonly checksumSha256: string
}

function rpc(client: SupabaseServerClient): RpcClient {
  return client as unknown as RpcClient
}

function parseRpcObject(result: { readonly data: unknown; readonly error: { readonly message: string } | null }): Record<string, unknown> {
  if (result.error) throw recruitmentDatabaseError(result.error)
  if (typeof result.data !== 'object' || result.data === null || Array.isArray(result.data)) throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return result.data as Record<string, unknown>
}

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
  if (!pepper || pepper.length < 32) {
    console.warn(JSON.stringify({
      event: 'SEC012_PUBLIC_SECURITY_BLOCKED',
      phase: 'RATE_LIMIT_CONFIG',
      reason: 'MISSING_OR_INVALID_PEPPER',
    }))
    throw new RecruitmentError('RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', 503)
  }
  if (!process.env.TURNSTILE_SECRET_KEY) throw new RecruitmentError('RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE', 503)
  return { pepper }
}

function createServerProof(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

export async function createPublicIntakeProof(input: {
  readonly publicationId: string
  readonly challengeToken: string
  readonly trustedClientIdentity: string
}): Promise<PublicIntakeClaim> {
  const { pepper } = requirePublicSecurityConfig()
  const challenge = await createTurnstileBotChallengeAdapter().verify(input.challengeToken)
  if (!challenge.ok) throw new RecruitmentError(challenge.code, challenge.code.includes('UNAVAILABLE') ? 503 : 422)

  const proof = createServerProof()
  const bucketKeyHash = await createPublicIntakeKey({ publicationId: input.publicationId, trustedClientIdentity: input.trustedClientIdentity }, pepper)
  const proofHash = await sha256(proof)
  const result = await rpc(createAdminClient()).rpc('recruitment_claim_public_intake', {
    requested_publication_id: input.publicationId,
    requested_bucket_key_hash: bucketKeyHash,
    requested_proof_hash: proofHash,
  })
  const data = parseRpcObject(result)
  if (data.accepted === false) {
    const retryAfterSeconds = typeof data.retryAfterSeconds === 'number' && Number.isInteger(data.retryAfterSeconds)
      ? Math.max(1, Math.min(900, data.retryAfterSeconds))
      : undefined
    throw new RecruitmentError('RECRUITMENT_PUBLIC_RATE_LIMITED', 429, retryAfterSeconds)
  }
  if (data.accepted !== true || typeof data.proofId !== 'string' || typeof data.expiresAt !== 'string') throw new RecruitmentError('RECRUITMENT_OPERATION_FAILED', 500)
  return { proof, bucketKeyHash, proofId: data.proofId, expiresAt: data.expiresAt }
}

export async function scanPublicDocument(document: RecruitmentDocument): Promise<CleanPublicDocumentScan> {
  const validation = validateRecruitmentDocument(document, { maxBytes: PUBLIC_RECRUITMENT_DOCUMENT_MAX_BYTES })
  if (!validation.ok) throw new RecruitmentError(validation.code, 422)
  const scan = await createRemoteMalwareScannerAdapter().scan(document)
  if (scan.status === 'UNAVAILABLE') throw new RecruitmentError('RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE', 503)
  if (scan.status === 'REJECTED') throw new RecruitmentError('RECRUITMENT_DOCUMENT_REJECTED', 422)
  return { detectedType: validation.detectedType, reference: scan.reference, checksumSha256: await sha256Bytes(document.bytes) }
}

export async function storePublicDocument(applicationId: string, document: RecruitmentDocument, scan: CleanPublicDocumentScan): Promise<void> {
  const admin = createAdminClient()
  const application = await admin.from('recruitment_applications').select('id,tenant_id,hr_group_id').eq('id', applicationId).maybeSingle()
  if (application.error || !application.data) throw new RecruitmentError('RECRUITMENT_APPLICATION_NOT_FOUND', 404)
  const extension = scan.detectedType === 'PDF' ? 'pdf' : 'docx'
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
    checksum_sha256: scan.checksumSha256,
    scan_status: 'CLEAN',
    scanner_reference: scan.reference,
    scanned_at: new Date().toISOString(),
  })
  if (inserted.error) {
    await admin.storage.from('recruitment-documents').remove([storageKey])
    throw new RecruitmentError('RECRUITMENT_DOCUMENT_UPLOAD_FAILED', 503)
  }
}

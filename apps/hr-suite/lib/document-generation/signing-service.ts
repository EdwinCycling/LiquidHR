import 'server-only'

import { z } from 'zod'
import { requirePermission, requireAuthContext, requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export class DocumentSigningError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'DocumentSigningError'
  }
}

type QueryClient = Awaited<ReturnType<typeof createClient>>

interface LooseResult {
  readonly data: unknown
  readonly error: unknown
}

interface LooseQuery extends PromiseLike<LooseResult> {
  select(columns?: string): LooseQuery
  eq(column: string, value: unknown): LooseQuery
  order(column: string, options?: { ascending?: boolean }): LooseQuery
  limit(count: number): LooseQuery
}

interface AuthorizedSigningRequest {
  readonly client: QueryClient
  readonly tenantId: string
  readonly hrGroupId: string
  readonly userId: string
  readonly employeeId: string | null
}

function table(client: QueryClient, name: string): LooseQuery {
  return (client.from as unknown as (relation: string) => LooseQuery)(name)
}

function adminClient(): QueryClient {
  return createAdminClient() as unknown as QueryClient
}

async function authorize(permission: 'document-signing:read' | 'document-signing:write', targetEmployeeId?: string): Promise<AuthorizedSigningRequest> {
  const auth: AuthContext = await requirePermission(permission, targetEmployeeId)
  return {
    client: await createClient(),
    tenantId: auth.tenantId,
    hrGroupId: requireHrGroupId(auth),
    userId: auth.userId,
    employeeId: auth.employeeId,
  }
}

async function rpc(name: string, parameters: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = adminClient()
  const call = client.rpc.bind(client) as unknown as (functionName: string, args: Record<string, unknown>) => Promise<LooseResult>
  const result = await call(name, parameters)
  if (result.error) {
    const message = result.error && typeof result.error === 'object' && 'message' in result.error ? String(result.error.message) : ''
    const match = message.match(/\b(?:DOCUMENT|SIGNING|HR_GROUP|EMPLOYEE)_[A-Z0-9_]+\b/)
    const code = match?.[0] ?? 'DOCUMENT_SIGNING_MUTATION_FAILED'
    const status = code.includes('FORBIDDEN') ? 403 : code.includes('NOT_FOUND') ? 404 : code.includes('REQUIRED') || code.includes('INVALID') ? 422 : 409
    throw new DocumentSigningError(code, status)
  }
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw new DocumentSigningError('DOCUMENT_SIGNING_RESPONSE_INVALID', 502)
  return result.data as Record<string, unknown>
}

function parseUuid(value: unknown, code: string): string {
  const parsed = z.string().uuid().safeParse(value)
  if (!parsed.success) throw new DocumentSigningError(code, 400)
  return parsed.data
}

function toSigningRequest(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    employeeId: row.employee_id,
    signerEmployeeId: row.signer_employee_id,
    providerCode: row.provider_code,
    externalReference: row.external_reference,
    status: row.status,
    preparedAt: row.prepared_at,
    signedAt: row.signed_at,
    declinedAt: row.declined_at,
    createdAt: row.created_at,
  }
}

export async function listSigningRequests(): Promise<readonly Record<string, unknown>[]> {
  const request = await authorize('document-signing:read')
  const result = await table(request.client, 'document_signing_requests')
    .select('id,snapshot_id,employee_id,signer_employee_id,provider_code,external_reference,status,prepared_at,signed_at,declined_at,created_at')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (result.error || !Array.isArray(result.data)) throw new DocumentSigningError('DOCUMENT_SIGNING_READ_FAILED', 500)
  return (result.data as Record<string, unknown>[]).map(toSigningRequest)
}

export async function listMySigningRequests(): Promise<readonly Record<string, unknown>[]> {
  const actor = await requireAuthContext()
  if (!actor.employeeId) throw new DocumentSigningError('DOCUMENT_SIGNING_EMPLOYEE_REQUIRED', 403)
  const request = await authorize('document-signing:read', actor.employeeId)
  const result = await table(request.client, 'document_signing_requests')
    .select('id,snapshot_id,employee_id,signer_employee_id,provider_code,external_reference,status,prepared_at,signed_at,declined_at,created_at')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('signer_employee_id', request.employeeId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (result.error || !Array.isArray(result.data)) throw new DocumentSigningError('DOCUMENT_SIGNING_READ_FAILED', 500)
  return (result.data as Record<string, unknown>[]).map(toSigningRequest)
}

export async function prepareSigning(snapshotId: unknown): Promise<Record<string, unknown>> {
  const parsedSnapshotId = parseUuid(snapshotId, 'DOCUMENT_SIGNING_INPUT_INVALID')
  const request = await authorize('document-signing:write')
  return rpc('prepare_document_signing', {
    requested_snapshot_id: parsedSnapshotId,
    requested_actor_user_id: request.userId,
  })
}

export async function completeSigning(requestId: unknown): Promise<Record<string, unknown>> {
  const parsedRequestId = parseUuid(requestId, 'DOCUMENT_SIGNING_INPUT_INVALID')
  const actor = await requireAuthContext()
  if (!actor.employeeId) throw new DocumentSigningError('DOCUMENT_SIGNING_EMPLOYEE_REQUIRED', 403)
  const request = await authorize('document-signing:write', actor.employeeId)
  return rpc('complete_document_signing', {
    requested_request_id: parsedRequestId,
    requested_actor_user_id: request.userId,
  })
}

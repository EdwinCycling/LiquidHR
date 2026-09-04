import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getEditorData, getNormalizedDocumentV1 } from '@/lib/document-studio/service'
import { parseCanonicalDocument } from '@/lib/document-studio/canonical-document'
import { resolveGenerationSnapshot, type GenerationContext, type ResolvedGenerationSnapshot } from './domain'
import { DG1_RENDERER_VERSION, pdfHash, renderResolvedSnapshotToPdf } from './pdf'

const inputSchema = z.object({ templateVersionId: z.string().uuid(), employeeId: z.string().uuid(), idempotencyKey: z.string().uuid().optional(), freeInputs: z.record(z.string(), z.string()).default({}), temporalInputs: z.record(z.string(), z.string()).default({}) })
export class DocumentGenerationError extends Error { constructor(readonly code: string, readonly status: number) { super(code) } }
type QueryClient = Awaited<ReturnType<typeof createClient>>
interface LooseResult { readonly data: unknown; readonly error: unknown }
interface LooseQuery extends PromiseLike<LooseResult> { select(columns?: string): LooseQuery; eq(column: string, value: unknown): LooseQuery; is(column: string, value: unknown): LooseQuery; order(column: string, options?: { ascending?: boolean }): LooseQuery; limit(count: number): LooseQuery; maybeSingle(): Promise<LooseResult>; single(): Promise<LooseResult>; insert(values: unknown): LooseQuery; update(values: unknown): LooseQuery }
function table(client: QueryClient, name: string): LooseQuery { return (client.from as unknown as (relation: string) => LooseQuery)(name) }
async function row<T>(query: PromiseLike<LooseResult>): Promise<T> { const result = await query; if (result.error || result.data === null) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500); return result.data as T }
async function optionalRow<T>(query: PromiseLike<LooseResult>): Promise<T | null> { const result = await query; if (result.error) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500); return result.data as T | null }
async function rpc(client: QueryClient, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> { const call = client.rpc.bind(client) as unknown as (functionName: string, parameters: Record<string, unknown>) => Promise<LooseResult>; const result = await call(name, args); if (result.error || typeof result.data !== 'object' || result.data === null || Array.isArray(result.data)) throw new DocumentGenerationError(typeof result.error === 'object' && result.error !== null && 'message' in result.error ? String((result.error as { message: unknown }).message) : 'DOCUMENT_GENERATION_MUTATION_FAILED', 409); return result.data as Record<string, unknown> }
async function authz(): Promise<{ client: QueryClient; tenantId: string; hrGroupId: string; userId: string }> { const auth = await requirePermission('document-generation:write'); return { client: await createClient(), tenantId: auth.tenantId, hrGroupId: requireHrGroupId(auth), userId: auth.userId } }

export async function createGenerationPreview(value: unknown): Promise<{ id: string; status: 'PREVIEW'; freeKeys: string[]; resolvedDocumentHash: string }> {
  const input = inputSchema.parse(value); const { client, tenantId, hrGroupId, userId } = await authz(); const normalized = await getNormalizedDocumentV1(input.templateVersionId)
  if (!normalized) throw new DocumentGenerationError('DOCUMENT_TEMPLATE_VERSION_NOT_FOUND', 404)
  const employee = await row<{ id: string; first_name: string | null; birth_name: string | null; employee_number: string | null }>(table(client, 'employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', input.employeeId).is('deleted_at', null).maybeSingle())
  const editorData = await getEditorData(input.templateVersionId)
  const profile = editorData?.profiles.find((candidate) => candidate.id === editorData.version.document_profile_id) ?? editorData?.profiles.find((candidate) => candidate.is_default && candidate.is_active)
  const profileSource = profile ? await optionalRow<Record<string, unknown>>(table(client, 'administrations').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', profile.source_administration_id).maybeSingle()) : null
  const company = profile ? await optionalRow<Record<string, unknown>>(table(client, 'administration_company_data').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', profile.source_administration_id).maybeSingle()) : null
  const branding = profile ? await optionalRow<Record<string, unknown>>(table(client, 'administration_branding').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', profile.source_administration_id).maybeSingle()) : null
  const freeKeys = normalized.placeholderManifest.filter((item) => item.type === 'FREE').map((item) => item.key)
  const knownValues = { 'employee.first_name': employee.first_name ?? '', 'employee.last_name': employee.birth_name ?? '', 'employee.employee_number': employee.employee_number ?? '' }
  const context: GenerationContext = { tenantId, hrGroupId, employeeId: employee.id, templateId: normalized.templateId, templateVersionId: normalized.templateVersionId, templateVersion: normalized.templateVersion, rendererVersion: DG1_RENDERER_VERSION, generatedAt: new Date().toISOString(), knownValues, temporalValues: input.temporalInputs, freeValues: Object.fromEntries(freeKeys.map((key) => [key, input.freeInputs[key] ?? ''])), documentProfile: profile ? { id: profile.id, name: profile.name, sourceAdministrationId: profile.source_administration_id, logoAssetId: profile.logo_asset_id, isDefault: profile.is_default, source: profileSource, branding } : {}, organization: { company }, componentVersions: normalized.composition.map((item) => ({ kind: item.kind, templateVersionId: item.versionId, version: item.version })) }
  const canonicalDocument = { schema: { id: 'liquid-hr.document-studio.native.v1' as const, version: 1 as const }, kind: normalized.kind, page: normalized.page, regions: normalized.regions }
  const snapshot = resolveGenerationSnapshot(canonicalDocument, context)
  const id = randomUUID(); const payload = { id, tenant_id: tenantId, hr_group_id: hrGroupId, employee_id: employee.id, template_id: normalized.templateId, template_version_id: normalized.templateVersionId, template_version: normalized.templateVersion, snapshot: { ...snapshot, resolvedDocument: undefined }, resolved_document_json: snapshot.resolvedDocument, resolved_document_hash: snapshot.resolvedDocumentHash, renderer_version: snapshot.rendererVersion, generated_by_user_id: userId }
  const requestHash = createHash('sha256').update(JSON.stringify({ templateVersionId: input.templateVersionId, employeeId: input.employeeId, freeInputs: input.freeInputs, temporalInputs: input.temporalInputs })).digest('hex')
  const result = await rpc(client, 'create_document_generation_preview', { requested_payload: { ...payload, idempotency_key: input.idempotencyKey ?? randomUUID(), request_hash: requestHash } })
  return { id: String(result.id), status: 'PREVIEW', freeKeys, resolvedDocumentHash: snapshot.resolvedDocumentHash }
}

export async function finalizeGeneration(snapshotId: string, requestedIdempotencyKey?: string): Promise<{ id: string; status: 'FINAL'; pdfHash: string }> {
  const { client, tenantId, hrGroupId } = await authz(); const snapshot = await row<Record<string, unknown>>(table(client, 'document_generation_snapshots').select('*').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('id', snapshotId).maybeSingle())
  if (snapshot.status === 'FINAL') return { id: snapshotId, status: 'FINAL', pdfHash: String(snapshot.final_pdf_hash) }
  if (snapshot.status !== 'PREVIEW') throw new DocumentGenerationError('DOCUMENT_GENERATION_STATE_INVALID', 409)
  const resolvedDocument = parseCanonicalDocument(snapshot.resolved_document_json); const stored = snapshot.snapshot as Record<string, unknown>; const context = { ...stored, resolvedDocument, resolvedDocumentJson: JSON.stringify(resolvedDocument), resolvedDocumentHash: String(snapshot.resolved_document_hash), placeholderInputs: stored.placeholderInputs } as unknown as ResolvedGenerationSnapshot
  const pdf = renderResolvedSnapshotToPdf(context); const hash = pdfHash(pdf); const key = `${tenantId}/${hrGroupId}/${String(snapshot.employee_id)}/generated/${snapshotId}.pdf`; const upload = await client.storage.from('employee-documents').upload(key, pdf, { contentType: 'application/pdf', upsert: false }); if (upload.error && !upload.error.message.toLowerCase().includes('already exists')) throw new DocumentGenerationError('DOCUMENT_GENERATION_UPLOAD_FAILED', 500)
  const result = await rpc(client, 'finalize_document_generation', { requested_snapshot_id: snapshotId, requested_idempotency_key: requestedIdempotencyKey ?? randomUUID(), requested_request_hash: createHash('sha256').update(snapshotId).digest('hex'), requested_pdf_hash: hash, requested_storage_key: key, requested_renderer_version: DG1_RENDERER_VERSION })
  return { id: String(result.id), status: 'FINAL', pdfHash: String(result.pdfHash) }
}

export async function listGenerationHistory(): Promise<readonly Record<string, unknown>[]> { const { client, tenantId, hrGroupId } = await authz(); const result = await table(client, 'document_generation_snapshots').select('id,employee_id,template_id,template_version,status,generated_by_user_id,generated_at,final_pdf_hash').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).order('generated_at', { ascending: false }).limit(500); if (result.error) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500); return (result.data ?? []) as Record<string, unknown>[] }

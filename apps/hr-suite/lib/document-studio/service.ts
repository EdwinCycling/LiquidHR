import { getRequestAuthorizationContext, requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { randomUUID } from 'node:crypto'
import { sha256CanonicalJson } from './canonical-hash'
import { AssetPolicyError, normalizeStructuralImage, type NormalizedStructuralImage } from './asset-policy'
import {
  normalizeCanonicalDocument,
  type DocumentValidationIssue,
  type NormalizedCanonicalDocument,
} from './canonical-document'
import {
  archiveTemplatePayloadSchema,
  createTemplatePayloadSchema,
  draftPayloadSchema,
  templateMetadataSchema,
  validateDraftPayloadSchema,
  type CreateTemplatePayload,
  type DraftPayload,
  type TemplateMetadata,
} from './schemas'
import {
  callDocumentStudioRpc,
  getDocumentStudioTemplate,
  getDocumentStudioVersion,
  insertDocumentStudioProfile,
  insertDocumentStudioType,
  listDocumentStudioAssets,
  listDocumentStudioAdministrationOptions,
  listDocumentStudioTags,
  listDocumentStudioTemplateTagIds,
  listDocumentStudioCompositions,
  listDocumentStudioProfiles,
  listDocumentStudioTemplates,
  listDocumentStudioVersions,
  listDocumentStudioTypes,
  type DocumentStudioAssetRow,
  type DocumentStudioAdministrationOption,
  updateDocumentStudioProfile,
  updateDocumentStudioTemplate,
  updateDocumentStudioType,
  type DocumentStudioCompositionRow,
  type DocumentStudioProfileRow,
  type SupabaseServerClient,
  type DocumentStudioTemplateRow,
  type DocumentStudioTypeRow,
  type DocumentStudioTagRow,
  type DocumentStudioVersionRow,
} from './repository'
import { documentProfileInputSchema, documentTypeInputSchema, templateMetadataUpdateSchema } from './schemas'

export class DocumentStudioServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly issues: readonly DocumentValidationIssue[] = [],
  ) {
    super(code)
    this.name = 'DocumentStudioServiceError'
  }
}

export interface DocumentStudioTemplateSummary extends DocumentStudioTemplateRow {
  readonly draft: { readonly id: string; readonly revision: number } | null
  readonly activeVersion: number | null
  readonly category_code: string
}

export interface DocumentStudioTemplateDetail extends DocumentStudioTemplateSummary {
  readonly versions: readonly DocumentStudioVersionRow[]
  readonly compositions: Readonly<Record<string, readonly DocumentStudioCompositionRow[]>>
}

export interface DocumentStudioEditorData {
  readonly template: DocumentStudioTemplateDetail
  readonly version: DocumentStudioVersionRow
  readonly compositions: readonly DocumentStudioCompositionRow[]
  readonly types: readonly DocumentStudioTypeRow[]
  readonly profiles: readonly DocumentStudioProfileRow[]
  readonly tags: readonly DocumentStudioTagRow[]
  readonly tagIds: readonly string[]
}

interface AuthorizedDocumentStudioRequest {
  readonly auth: AuthContext
  readonly client: SupabaseServerClient
  readonly hrGroupId: string
}

async function authorize(permission: string): Promise<AuthorizedDocumentStudioRequest> {
  const auth = await requirePermission(permission)
  const request = await getRequestAuthorizationContext()
  return { auth, client: request.supabase, hrGroupId: requireHrGroupId(auth) }
}

function parsePayload<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new DocumentStudioServiceError('DOCUMENT_STUDIO_INPUT_INVALID', 400)
  return result.data
}

function normalizeForKind(document: unknown, kind: TemplateMetadata['kind'], assetRefs: readonly string[]) {
  let normalized: NormalizedCanonicalDocument
  try {
    normalized = normalizeCanonicalDocument(document)
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      const issues = (error as { readonly issues?: readonly DocumentValidationIssue[] }).issues ?? []
      throw new DocumentStudioServiceError('DOCUMENT_SCHEMA_INVALID', 422, issues)
    }
    throw error
  }
  if (normalized.document.kind !== kind) throw new DocumentStudioServiceError('DOCUMENT_KIND_MISMATCH', 422)
  const expected = [...normalized.assetRefs].sort()
  const supplied = [...new Set(assetRefs)].sort()
  if (JSON.stringify(expected) !== JSON.stringify(supplied)) throw new DocumentStudioServiceError('DOCUMENT_ASSET_REFS_MISMATCH', 422)
  return normalized
}

function requestHash(value: unknown): string {
  return sha256CanonicalJson(JSON.stringify(value))
}

function rpcRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DocumentStudioServiceError('DOCUMENT_STUDIO_RESPONSE_INVALID', 502)
  return value as Record<string, unknown>
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new DocumentStudioServiceError(code, 502)
  return value
}

function requiredNumber(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new DocumentStudioServiceError(code, 502)
  return value
}

function mapTemplateSummary(
  row: DocumentStudioTemplateRow,
  versions: readonly DocumentStudioVersionRow[],
): DocumentStudioTemplateSummary {
  const draft = versions.find((version) => version.status === 'DRAFT')
  const active = versions.find((version) => version.status === 'ACTIVE')
  return {
    ...row,
    draft: draft ? { id: draft.id, revision: draft.revision } : null,
    activeVersion: active?.version_number ?? null,
    category_code: draft?.category_code ?? active?.category_code ?? 'GENERAL',
  }
}

export async function listTemplates(): Promise<readonly DocumentStudioTemplateSummary[]> {
  const { client, auth, hrGroupId } = await authorize('document-template:read')
  const templates = await listDocumentStudioTemplates(client, auth.tenantId, hrGroupId)
  return Promise.all(templates.map(async (template) => mapTemplateSummary(
    template,
    await listDocumentStudioVersions(client, auth.tenantId, hrGroupId, template.id),
  )))
}

export async function getTemplateDetail(templateId: string): Promise<DocumentStudioTemplateDetail | null> {
  const { client, auth, hrGroupId } = await authorize('document-template:read')
  const template = await getDocumentStudioTemplate(client, auth.tenantId, hrGroupId, templateId)
  if (!template) return null
  const versions = await listDocumentStudioVersions(client, auth.tenantId, hrGroupId, template.id)
  const compositions = Object.fromEntries(await Promise.all(versions.map(async (version) => [
    version.id,
    await listDocumentStudioCompositions(client, auth.tenantId, hrGroupId, version.id),
  ] as const)))
  return { ...mapTemplateSummary(template, versions), versions, compositions }
}

export async function getEditorData(versionId: string): Promise<DocumentStudioEditorData | null> {
  const { client, auth, hrGroupId } = await authorize('document-template:read')
  const version = await getDocumentStudioVersion(client, auth.tenantId, hrGroupId, versionId)
  if (!version) return null
  const template = await getDocumentStudioTemplate(client, auth.tenantId, hrGroupId, version.template_id)
  if (!template) return null
  const versions = await listDocumentStudioVersions(client, auth.tenantId, hrGroupId, template.id)
  const [compositions, types, profiles, tags, tagIds] = await Promise.all([
    listDocumentStudioCompositions(client, auth.tenantId, hrGroupId, version.id),
    listDocumentStudioTypes(client, auth.tenantId, hrGroupId),
    listDocumentStudioProfiles(client, auth.tenantId, hrGroupId),
    listDocumentStudioTags(client, auth.tenantId),
    listDocumentStudioTemplateTagIds(client, auth.tenantId, hrGroupId, template.id),
  ])
  return { template: { ...mapTemplateSummary(template, versions), versions, compositions: {} }, version, compositions, types, profiles, tags, tagIds }
}

export async function createDraftFromActive(templateId: string): Promise<Record<string, unknown>> {
  const { client } = await authorize('document-template:write')
  const result = rpcRecord(await callDocumentStudioRpc(client, 'create_document_studio_draft_from_active', {
    requested_template_id: templateId,
    requested_idempotency_key: randomUUID(),
    requested_request_hash: requestHash({ templateId }),
  }))
  return { templateId: requiredString(result.templateId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), draftId: requiredString(result.draftId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), revision: requiredNumber(result.revision, 'DOCUMENT_STUDIO_RESPONSE_INVALID') }
}

export async function updateTemplateMetadata(templateId: string, value: unknown): Promise<DocumentStudioTemplateRow> {
  const { client, auth, hrGroupId } = await authorize('document-template:write')
  const metadata = parsePayload(templateMetadataUpdateSchema, value)
  return updateDocumentStudioTemplate(client, auth.tenantId, hrGroupId, templateId, { name: metadata.name, description: metadata.description, updated_by_user_id: auth.userId })
}

export async function createTemplate(value: unknown): Promise<Record<string, unknown>> {
  const { client, auth, hrGroupId } = await authorize('document-template:write')
  const payload = parsePayload<CreateTemplatePayload>(createTemplatePayloadSchema, value)
  const normalized = normalizeForKind(payload.document, payload.metadata.kind, payload.assetRefs)
  const result = rpcRecord(await callDocumentStudioRpc(client, 'create_document_studio_template_draft', {
    requested_tenant_id: auth.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_template_key: payload.metadata.templateKey,
    requested_kind: payload.metadata.kind,
    requested_language: payload.metadata.language,
    requested_name: payload.metadata.name,
    requested_description: payload.metadata.description,
    requested_document_type_id: payload.metadata.documentTypeId,
    requested_category: payload.metadata.categoryCode,
    requested_default_dossier: payload.metadata.defaultDossier,
    requested_profile_id: payload.metadata.documentProfileId,
    requested_document: normalized.document,
    requested_composition: payload.composition,
    requested_assets: payload.assetRefs,
    requested_idempotency_key: payload.idempotencyKey,
    requested_request_hash: requestHash(payload),
  }))
  return { templateId: requiredString(result.templateId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), draftId: requiredString(result.draftId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), revision: requiredNumber(result.revision, 'DOCUMENT_STUDIO_RESPONSE_INVALID') }
}

export async function saveDraft(value: unknown): Promise<Record<string, unknown>> {
  const { client, auth, hrGroupId } = await authorize('document-template:write')
  const payload = parsePayload<DraftPayload>(draftPayloadSchema, value)
  const version = await getDocumentStudioVersion(client, auth.tenantId, hrGroupId, payload.draftVersionId)
  if (!version || version.status !== 'DRAFT') throw new DocumentStudioServiceError('DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND', 404)
  const metadata = parsePayload<Partial<TemplateMetadata>>(templateMetadataSchema.partial().omit({ templateKey: true, kind: true, language: true }), payload.metadata)
  const template = await getDocumentStudioTemplate(client, auth.tenantId, hrGroupId, version.template_id)
  if (!template) throw new DocumentStudioServiceError('DOCUMENT_TEMPLATE_NOT_FOUND', 404)
  const resolvedMetadata = {
    name: metadata.name ?? template.name,
    description: metadata.description === undefined ? template.description : metadata.description,
    documentTypeId: metadata.documentTypeId ?? version.document_type_id,
    categoryCode: metadata.categoryCode ?? version.category_code,
    defaultDossier: metadata.defaultDossier ?? version.default_dossier,
    documentProfileId: metadata.documentProfileId === undefined ? version.document_profile_id : metadata.documentProfileId,
  }
  const normalized = normalizeForKind(payload.document, template.kind, payload.assetRefs)
  const result = rpcRecord(await callDocumentStudioRpc(client, 'save_document_studio_template_draft', {
    requested_draft_id: payload.draftVersionId,
    requested_expected_revision: payload.expectedRevision,
    requested_name: resolvedMetadata.name,
    requested_description: resolvedMetadata.description,
    requested_document_type_id: resolvedMetadata.documentTypeId,
    requested_category: resolvedMetadata.categoryCode,
    requested_default_dossier: resolvedMetadata.defaultDossier,
    requested_profile_id: resolvedMetadata.documentProfileId,
    requested_document: normalized.document,
    requested_composition: payload.composition,
    requested_assets: payload.assetRefs,
    requested_idempotency_key: payload.idempotencyKey,
    requested_request_hash: requestHash(payload),
  }))
  return { templateId: requiredString(result.templateId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), draftId: requiredString(result.draftId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), revision: requiredNumber(result.revision, 'DOCUMENT_STUDIO_RESPONSE_INVALID') }
}

export async function validateDraft(value: unknown): Promise<{ readonly valid: boolean; readonly errors: readonly DocumentValidationIssue[]; readonly warnings: readonly DocumentValidationIssue[]; readonly contentHash: string }> {
  const { client, auth, hrGroupId } = await authorize('document-template:write')
  const payload = parsePayload<{ draftVersionId: string; expectedRevision: number }>(validateDraftPayloadSchema, value)
  const version = await getDocumentStudioVersion(client, auth.tenantId, hrGroupId, payload.draftVersionId)
  if (!version || version.status !== 'DRAFT') throw new DocumentStudioServiceError('DOCUMENT_TEMPLATE_DRAFT_NOT_FOUND', 404)
  if (version.revision !== payload.expectedRevision) throw new DocumentStudioServiceError('DOCUMENT_TEMPLATE_DRAFT_CONFLICT', 409)
  const assets = await listDocumentStudioAssets(client, auth.tenantId, hrGroupId)
  const knownAssets = new Set(assets.map((asset) => asset.id))
  let normalized: ReturnType<typeof normalizeCanonicalDocument> | null = null
  const errors: DocumentValidationIssue[] = []
  try {
    normalized = normalizeCanonicalDocument(version.document_json)
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      errors.push(...((error as { readonly issues?: readonly DocumentValidationIssue[] }).issues ?? []))
    } else throw error
  }
  if (normalized && normalized.document.kind !== (await getDocumentStudioTemplate(client, auth.tenantId, hrGroupId, version.template_id))?.kind) {
    errors.push({ code: 'DOCUMENT_KIND_MISMATCH', path: [], messageKey: 'documentStudio.validation.kindMismatch' })
  }
  if (normalized) {
    for (const assetRef of normalized.assetRefs) {
      if (!knownAssets.has(assetRef)) errors.push({ code: 'ASSET_NOT_APPROVED', path: [], messageKey: 'documentStudio.validation.assetNotApproved' })
    }
  }
  const canonicalJson = normalized?.canonicalJson ?? JSON.stringify(version.document_json)
  const contentHash = sha256CanonicalJson(canonicalJson)
  const result = rpcRecord(await callDocumentStudioRpc(client, 'validate_document_studio_template_draft', {
    requested_draft_id: payload.draftVersionId,
    requested_expected_revision: payload.expectedRevision,
    requested_hash: contentHash,
    requested_diagnostics: errors,
  }))
  return { valid: result.valid === true && errors.length === 0, errors, warnings: [], contentHash }
}

export async function activateDraft(value: unknown): Promise<Record<string, unknown>> {
  const { client } = await authorize('document-template:activate')
  const payload = parsePayload<{ draftVersionId: string; expectedRevision: number; idempotencyKey: string }>(draftPayloadSchema.pick({ draftVersionId: true, expectedRevision: true, idempotencyKey: true }), value)
  const result = rpcRecord(await callDocumentStudioRpc(client, 'activate_document_studio_template_draft', {
    requested_draft_id: payload.draftVersionId,
    requested_expected_revision: payload.expectedRevision,
    requested_idempotency_key: payload.idempotencyKey,
    requested_request_hash: requestHash(payload),
  }))
  return { templateId: requiredString(result.templateId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), versionId: requiredString(result.versionId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), versionNumber: requiredNumber(result.versionNumber, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), revision: requiredNumber(result.revision, 'DOCUMENT_STUDIO_RESPONSE_INVALID') }
}

export async function archiveTemplate(templateId: string, value: unknown): Promise<Record<string, unknown>> {
  const { client } = await authorize('document-template:archive')
  const payload = parsePayload<{ idempotencyKey: string }>(archiveTemplatePayloadSchema, value)
  const result = rpcRecord(await callDocumentStudioRpc(client, 'archive_document_studio_template', {
    requested_template_id: templateId,
    requested_idempotency_key: payload.idempotencyKey,
    requested_request_hash: requestHash(payload),
  }))
  return { templateId: requiredString(result.templateId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), archived: result.archived === true }
}

export async function discardDraft(versionId: string, value: unknown): Promise<Record<string, unknown>> {
  const { client } = await authorize('document-template:write')
  const payload = parsePayload<{ idempotencyKey: string }>(archiveTemplatePayloadSchema, value)
  const result = rpcRecord(await callDocumentStudioRpc(client, 'discard_document_studio_template_draft', {
    requested_draft_id: versionId,
    requested_idempotency_key: payload.idempotencyKey,
    requested_request_hash: requestHash(payload),
  }))
  return { templateId: requiredString(result.templateId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), draftId: requiredString(result.draftId, 'DOCUMENT_STUDIO_RESPONSE_INVALID'), discarded: result.discarded === true }
}

export async function createStructuralAsset(file: File): Promise<{ readonly assetId: string; readonly storageKey: string; readonly asset: DocumentStudioAssetRow }> {
  const { client, auth, hrGroupId } = await authorize('document-asset:write')
  let normalized: NormalizedStructuralImage
  try {
    normalized = await normalizeStructuralImage(new Uint8Array(await file.arrayBuffer()), file.name, file.type)
  } catch (error) {
    if (error instanceof AssetPolicyError) throw new DocumentStudioServiceError(error.code, 422)
    throw new DocumentStudioServiceError('DOCUMENT_ASSET_INVALID', 422)
  }
  const assetId = randomUUID()
  const storageKey = `${auth.tenantId}/${hrGroupId}/${assetId}/normalized.${normalized.normalizedMime === 'image/png' ? 'png' : 'jpg'}`
  await callDocumentStudioRpc(client, 'create_document_studio_asset', {
    requested_tenant_id: auth.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_asset_id: assetId,
    requested_filename: normalized.originalFilename,
    requested_mime: normalized.normalizedMime,
    requested_byte_size: normalized.byteSize,
    requested_width: normalized.width,
    requested_height: normalized.height,
    requested_pixel_count: normalized.pixelCount,
    requested_sha256: normalized.sha256,
    requested_storage_key: storageKey,
  })
  const upload = await client.storage.from('document-studio-assets').upload(storageKey, Buffer.from(normalized.normalizedBytes), { contentType: normalized.normalizedMime, upsert: false })
  if (upload.error) {
    await callDocumentStudioRpc(client, 'retire_document_studio_asset', { requested_asset_id: assetId }).catch(() => undefined)
    throw new DocumentStudioServiceError('DOCUMENT_ASSET_STORAGE_FAILED', 502)
  }
  const assets = await listDocumentStudioAssets(client, auth.tenantId, hrGroupId)
  const asset = assets.find((candidate) => candidate.id === assetId)
  if (!asset) throw new DocumentStudioServiceError('DOCUMENT_ASSET_NOT_FOUND', 502)
  return { assetId, storageKey, asset }
}

export async function retireAsset(assetId: string): Promise<Record<string, unknown>> {
  const { client } = await authorize('document-asset:write')
  return rpcRecord(await callDocumentStudioRpc(client, 'retire_document_studio_asset', { requested_asset_id: assetId }))
}

export async function listAssets(): Promise<readonly DocumentStudioAssetRow[]> {
  const { client, auth, hrGroupId } = await authorize('document-asset:read')
  return listDocumentStudioAssets(client, auth.tenantId, hrGroupId)
}

export async function listTypes(): Promise<readonly DocumentStudioTypeRow[]> {
  const { client, auth, hrGroupId } = await authorize('document-type:read')
  return listDocumentStudioTypes(client, auth.tenantId, hrGroupId)
}

export async function listProfiles(): Promise<readonly DocumentStudioProfileRow[]> {
  const { client, auth, hrGroupId } = await authorize('document-profile:read')
  return listDocumentStudioProfiles(client, auth.tenantId, hrGroupId)
}

export async function listAdministrationOptions(): Promise<readonly DocumentStudioAdministrationOption[]> {
  const { client, auth, hrGroupId } = await authorize('document-profile:read')
  return listDocumentStudioAdministrationOptions(client, auth.tenantId, hrGroupId)
}

export async function replaceTemplateTags(templateId: string, tagIds: readonly string[]): Promise<Record<string, unknown>> {
  const { client } = await authorize('document-template:write')
  return rpcRecord(await callDocumentStudioRpc(client, 'replace_document_studio_template_tags', { requested_template_id: templateId, requested_tag_ids: tagIds }))
}

export async function createDocumentType(value: unknown): Promise<DocumentStudioTypeRow> {
  const { client, auth, hrGroupId } = await authorize('document-type:write')
  const input = parsePayload(documentTypeInputSchema, value)
  return insertDocumentStudioType(client, {
    tenant_id: auth.tenantId, hr_group_id: hrGroupId, code: input.code, name: input.name, description: input.description,
    retention_kind: input.retentionKind, retention_years: input.retentionYears, is_active: input.isActive,
    created_by_user_id: auth.userId, updated_by_user_id: auth.userId,
  })
}

export async function updateDocumentType(id: string, value: unknown): Promise<DocumentStudioTypeRow> {
  const { client, auth, hrGroupId } = await authorize('document-type:write')
  const input = parsePayload(documentTypeInputSchema, value)
  return updateDocumentStudioType(client, id, auth.tenantId, hrGroupId, {
    code: input.code, name: input.name, description: input.description, retention_kind: input.retentionKind,
    retention_years: input.retentionYears, is_active: input.isActive, updated_by_user_id: auth.userId,
  })
}

export async function createDocumentProfile(value: unknown): Promise<DocumentStudioProfileRow> {
  const { client, auth, hrGroupId } = await authorize('document-profile:write')
  const input = parsePayload(documentProfileInputSchema, value)
  return insertDocumentStudioProfile(client, {
    tenant_id: auth.tenantId, hr_group_id: hrGroupId, name: input.name, source_administration_id: input.sourceAdministrationId,
    logo_asset_id: input.logoAssetId, is_default: input.isDefault, is_active: input.isActive,
    created_by_user_id: auth.userId, updated_by_user_id: auth.userId,
  })
}

export async function updateDocumentProfile(id: string, value: unknown): Promise<DocumentStudioProfileRow> {
  const { client, auth, hrGroupId } = await authorize('document-profile:write')
  const input = parsePayload(documentProfileInputSchema, value)
  return updateDocumentStudioProfile(client, id, auth.tenantId, hrGroupId, {
    name: input.name, source_administration_id: input.sourceAdministrationId, logo_asset_id: input.logoAssetId,
    is_default: input.isDefault, is_active: input.isActive, updated_by_user_id: auth.userId,
  })
}

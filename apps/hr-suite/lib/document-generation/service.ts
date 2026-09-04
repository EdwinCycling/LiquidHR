import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEditorData, getNormalizedDocumentV1 } from '@/lib/document-studio/service'
import { createNormalizedDocumentV1, type NormalizedDocumentV1 } from '@/lib/document-studio/normalized-document'
import { type CanonicalBlock, type CanonicalRegion } from '@/lib/document-studio/canonical-document'
import { resolveGenerationSnapshot, assertActiveComponentVersions, type GenerationAsset, type GenerationContext, type ResolvedGenerationSnapshot } from './domain'
import { parseGenerationDocument, type GenerationDocument } from './generation-document'
import { GenerationResolutionError, resolveRequiredGenerationValues } from './resolver'
import { DG1_RENDERER_VERSION, pdfHash, renderResolvedSnapshotToPdf } from './pdf'
import { renderResolvedSnapshotToHtml } from './html'

const inputSchema = z.object({
  templateVersionId: z.string().uuid(),
  employeeId: z.string().uuid(),
  idempotencyKey: z.string().uuid().optional(),
  freeInputs: z.record(z.string(), z.string()).default({}),
  temporalInputs: z.record(z.string(), z.string()).default({}),
}).strict()

export class DocumentGenerationError extends Error {
  constructor(readonly code: string, readonly status: number, readonly details?: readonly string[]) {
    super(code)
    this.name = 'DocumentGenerationError'
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
  is(column: string, value: unknown): LooseQuery
  order(column: string, options?: { ascending?: boolean }): LooseQuery
  limit(count: number): LooseQuery
  maybeSingle(): Promise<LooseResult>
  single(): Promise<LooseResult>
  insert(values: unknown): LooseQuery
  update(values: unknown): LooseQuery
}

interface AuthorizedGenerationRequest {
  readonly client: QueryClient
  readonly tenantId: string
  readonly hrGroupId: string
  readonly userId: string
  readonly administrationId: string | null
}

interface EmployeeRow {
  readonly id: string
  readonly first_name: string | null
  readonly birth_name: string | null
  readonly employee_number: string | null
}

interface EmploymentRow {
  readonly starts_on: string | null
}

interface StoredSnapshotRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly employee_id: string
  readonly template_id: string
  readonly template_version_id: string
  readonly template_version: number
  readonly snapshot: unknown
  readonly resolved_document_json: unknown
  readonly resolved_document_hash: string
  readonly renderer_version: string
  readonly generated_by_user_id: string
  readonly generated_at: string
  readonly status: 'PREVIEW' | 'FINAL'
  readonly final_pdf_hash: string | null
  readonly final_storage_key: string | null
  readonly final_pdf_size: number | null
  readonly template_name: string
  readonly employee_name: string
  readonly employee_number: string | null
  readonly document_category: string
  readonly default_dossier: boolean
  readonly source_administration_id: string | null
}

interface StoredAssetRow {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly status: 'PENDING' | 'APPROVED' | 'RETIRED'
  readonly normalized_mime: 'image/png' | 'image/jpeg'
  readonly storage_key: string
  readonly sha256: string
}

type DossierStatus = 'CREATED' | 'SKIPPED'

function table(client: QueryClient, name: string): LooseQuery {
  return (client.from as unknown as (relation: string) => LooseQuery)(name)
}

function adminClient(): QueryClient {
  return createAdminClient() as unknown as QueryClient
}

async function row<T>(query: PromiseLike<LooseResult>): Promise<T> {
  const result = await query
  if (result.error || result.data === null) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500)
  return result.data as T
}

async function optionalRow<T>(query: PromiseLike<LooseResult>): Promise<T | null> {
  const result = await query
  if (result.error) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500)
  return result.data as T | null
}

function errorCode(error: unknown): string | null {
  if (error instanceof DocumentGenerationError) return error.code
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  const code = (error as { readonly code: unknown }).code
  return typeof code === 'string' ? code : null
}

function mapDocumentStudioError(error: unknown): never {
  const code = errorCode(error)
  if (code === 'DOCUMENT_TEMPLATE_VERSION_NOT_ACTIVE' || code === 'DOCUMENT_TEMPLATE_NOT_ACTIVE') {
    throw new DocumentGenerationError('DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE', 422)
  }
  if (code === 'DOCUMENT_ASSET_NOT_FOUND' || code === 'DOCUMENT_ASSET_NOT_APPROVED') {
    throw new DocumentGenerationError('DOCUMENT_GENERATION_ASSET_NOT_AVAILABLE', 422)
  }
  if (code === 'DOCUMENT_TEMPLATE_COMPOSITION_INVALID') {
    throw new DocumentGenerationError('DOCUMENT_GENERATION_COMPONENT_INVALID', 422)
  }
  throw error
}

async function rpc(client: QueryClient, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const call = client.rpc.bind(client) as unknown as (functionName: string, parameters: Record<string, unknown>) => Promise<LooseResult>
  const result = await call(name, args)
  if (result.error) {
    const message = typeof result.error === 'object' && result.error !== null && 'message' in result.error
      ? String((result.error as { readonly message: unknown }).message)
      : ''
    const match = message.match(/\b(?:DOCUMENT|FORBIDDEN|HR_GROUP|ADMINISTRATION|EMPLOYEE|STORAGE)_[A-Z0-9_]+\b/)
    const code = match?.[0] ?? 'DOCUMENT_GENERATION_MUTATION_FAILED'
    const status = code.includes('FORBIDDEN')
      ? 403
      : code.includes('NOT_FOUND')
        ? 404
        : code.includes('UNRESOLVED') || code.includes('NOT_ACTIVE') || code.includes('INVALID') || code.includes('MISSING')
          ? 422
          : 409
    throw new DocumentGenerationError(code, status)
  }
  if (typeof result.data !== 'object' || result.data === null || Array.isArray(result.data)) throw new DocumentGenerationError('DOCUMENT_GENERATION_RESPONSE_INVALID', 502)
  return result.data as Record<string, unknown>
}

async function authz(permission: 'document-generation:read' | 'document-generation:write'): Promise<AuthorizedGenerationRequest> {
  const auth: AuthContext = await requirePermission(permission)
  return {
    client: await createClient(),
    tenantId: auth.tenantId,
    hrGroupId: requireHrGroupId(auth),
    userId: auth.userId,
    administrationId: auth.administrationId,
  }
}

function parseInput(value: unknown): z.infer<typeof inputSchema> {
  const parsed = inputSchema.safeParse(value)
  if (!parsed.success) throw new DocumentGenerationError('DOCUMENT_GENERATION_INPUT_INVALID', 400)
  return parsed.data
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableInputRecord(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(values).sort().map((key) => [key, values[key] ?? '']))
}

function generationRequestHash(input: z.infer<typeof inputSchema>): string {
  return sha256(JSON.stringify({
    templateVersionId: input.templateVersionId,
    employeeId: input.employeeId,
    freeInputs: stableInputRecord(input.freeInputs),
    temporalInputs: stableInputRecord(input.temporalInputs),
  }))
}

function persistedRecord(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DocumentGenerationError(code, 500)
  return value as Record<string, unknown>
}

function persistedString(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new DocumentGenerationError(code, 500)
  return value
}

function persistedStringMap(value: unknown): Record<string, string> {
  const record = persistedRecord(value, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID')
  const entries = Object.entries(record)
  if (entries.some(([, item]) => typeof item !== 'string')) throw new DocumentGenerationError('DOCUMENT_GENERATION_SNAPSHOT_INVALID', 500)
  return Object.fromEntries(entries.map(([key, item]) => [key, String(item)]))
}

function snapshotContext(snapshot: StoredSnapshotRow, resolvedDocument: GenerationDocument): ResolvedGenerationSnapshot {
  const stored = persistedRecord(snapshot.snapshot, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID')
  const placeholderInputs = persistedRecord(stored.placeholderInputs, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID')
  return {
    tenantId: persistedString(stored.tenantId, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    hrGroupId: persistedString(stored.hrGroupId, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    employeeId: persistedString(stored.employeeId, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    templateId: persistedString(stored.templateId, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    templateName: persistedString(stored.templateName, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    templateVersionId: persistedString(stored.templateVersionId, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    templateVersion: typeof stored.templateVersion === 'number' ? stored.templateVersion : snapshot.template_version,
    documentCategory: persistedString(stored.documentCategory, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    defaultDossier: typeof stored.defaultDossier === 'boolean' ? stored.defaultDossier : snapshot.default_dossier,
    rendererVersion: persistedString(stored.rendererVersion, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    generatedAt: persistedString(stored.generatedAt, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    knownValues: persistedStringMap(stored.knownValues),
    temporalValues: persistedStringMap(stored.temporalValues),
    freeValues: persistedStringMap(stored.freeValues),
    documentProfile: persistedRecord(stored.documentProfile ?? {}, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    organization: persistedRecord(stored.organization ?? {}, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID'),
    componentVersions: Array.isArray(stored.componentVersions) ? stored.componentVersions as ResolvedGenerationSnapshot['componentVersions'] : [],
    assets: Array.isArray(stored.assets) ? stored.assets as GenerationAsset[] : [],
    resolvedDocument,
    resolvedDocumentJson: typeof snapshot.resolved_document_json === 'string' ? snapshot.resolved_document_json : JSON.stringify(snapshot.resolved_document_json),
    resolvedDocumentHash: snapshot.resolved_document_hash,
    placeholderInputs: {
      known: persistedStringMap(placeholderInputs.known),
      temporal: persistedStringMap(placeholderInputs.temporal),
      free: persistedStringMap(placeholderInputs.free),
    },
  }
}

function snapshotForStorage(snapshot: ResolvedGenerationSnapshot): Record<string, unknown> {
  const generatedOnlyKeys = new Set(['resolvedDocument', 'resolvedDocumentJson', 'resolvedDocumentHash'])
  return Object.fromEntries(Object.entries(snapshot).filter(([key]) => !generatedOnlyKeys.has(key)))
}

async function activeNormalizedDocument(versionId: string): Promise<NormalizedDocumentV1> {
  try {
    const normalized = await getNormalizedDocumentV1(versionId)
    if (!normalized) throw new DocumentGenerationError('DOCUMENT_TEMPLATE_VERSION_NOT_FOUND', 404)
    return normalized
  } catch (error) {
    if (error instanceof DocumentGenerationError) throw error
    mapDocumentStudioError(error)
  }
}

interface MaterializedDocument {
  readonly document: GenerationDocument
  readonly assets: readonly GenerationAsset[]
  readonly componentVersions: ResolvedGenerationSnapshot['componentVersions']
}

async function materializeDocument(normalized: NormalizedDocumentV1): Promise<MaterializedDocument> {
  if (normalized.kind !== 'DOCUMENT' || !normalized.regions.body) throw new DocumentGenerationError('DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE', 422)
  const coverRefs = normalized.composition.filter((item) => item.kind === 'COVER')
  if (coverRefs.length > 1) throw new DocumentGenerationError('DOCUMENT_GENERATION_COMPONENT_INVALID', 422)
  const assets = new Map<string, GenerationAsset>()
  const addAssets = (items: readonly NormalizedDocumentV1['assets'][number][]) => {
    for (const asset of items) {
      const next: GenerationAsset = { ...asset }
      const previous = assets.get(next.assetRef)
      if (previous && JSON.stringify(previous) !== JSON.stringify(next)) throw new DocumentGenerationError('DOCUMENT_GENERATION_ASSET_CONFLICT', 422)
      assets.set(next.assetRef, next)
    }
  }
  addAssets(normalized.assets)
  let cover: CanonicalRegion | null = null
  const appendixBlocks: CanonicalBlock[] = []
  const componentVersions = normalized.composition.map((item) => ({ kind: item.kind, templateVersionId: item.versionId, version: item.version }))
  const materializedVersions: typeof componentVersions = []
  for (const reference of normalized.composition) {
    const component = await activeNormalizedDocument(reference.versionId)
    if (component.templateVersionId !== reference.versionId || component.templateId !== reference.templateId || component.templateVersion !== reference.version || component.kind !== reference.kind || component.composition.length > 0) {
      throw new DocumentGenerationError('DOCUMENT_GENERATION_COMPONENT_INVALID', 422)
    }
    addAssets(component.assets)
    materializedVersions.push({ kind: component.kind === 'COVER' ? 'COVER' : 'APPENDIX', templateVersionId: component.templateVersionId, version: component.templateVersion })
    if (reference.kind === 'COVER') {
      if (!component.regions.cover) throw new DocumentGenerationError('DOCUMENT_GENERATION_COMPONENT_INVALID', 422)
      cover = component.regions.cover
    } else {
      const content = component.regions.appendix?.content ?? []
      if (content.length > 0) {
        if (appendixBlocks.length > 0) appendixBlocks.push({ type: 'pageBreak' })
        appendixBlocks.push(...content)
      }
    }
  }
  try {
    assertActiveComponentVersions(componentVersions, materializedVersions)
  } catch {
    throw new DocumentGenerationError('DOCUMENT_GENERATION_COMPONENT_INVALID', 422)
  }
  return {
    document: {
      schema: { id: 'liquid-hr.document-studio.native.v1', version: 1 },
      kind: 'DOCUMENT',
      page: normalized.page,
      regions: {
        cover,
        header: normalized.regions.header,
        body: normalized.regions.body,
        appendix: appendixBlocks.length > 0 ? { type: 'region', content: appendixBlocks } : null,
        footer: normalized.regions.footer,
      },
    },
    assets: [...assets.values()],
    componentVersions,
  }
}

async function fullNormalizedDocument(versionId: string): Promise<{ readonly normalized: NormalizedDocumentV1; readonly materialized: MaterializedDocument; readonly composed: NormalizedDocumentV1 }> {
  const normalized = await activeNormalizedDocument(versionId)
  const materialized = await materializeDocument(normalized)
  const composed = createNormalizedDocumentV1({
    templateId: normalized.templateId,
    templateVersionId: normalized.templateVersionId,
    templateVersion: normalized.templateVersion,
    document: materialized.document,
    composition: normalized.composition,
    assets: materialized.assets,
  })
  return { normalized, materialized, composed }
}
export async function listGenerationOptions(): Promise<{ templates: readonly { id: string; name: string; versionId: string; version: number }[]; employees: readonly { id: string; name: string; employeeNumber: string | null }[] }> {
  const { client, tenantId, hrGroupId } = await authz('document-generation:write')
  const templates = await row<Record<string, unknown>[]>(table(client, 'document_studio_templates')
    .select('id,name,current_active_version_id')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('kind', 'DOCUMENT')
    .eq('lifecycle', 'ACTIVE')
    .order('name')
    .limit(200))
  const active = (await Promise.all(templates.flatMap(async (template) => {
    if (typeof template.current_active_version_id !== 'string') return []
    const version = await optionalRow<Record<string, unknown>>(table(client, 'document_studio_template_versions')
      .select('id,version_number,status')
      .eq('tenant_id', tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('id', template.current_active_version_id)
      .eq('status', 'ACTIVE')
      .maybeSingle())
    if (!version || typeof version.version_number !== 'number') return []
    return [{ id: String(template.id), name: String(template.name), versionId: String(version.id), version: version.version_number }]
  }))).flat()
  const employees = await row<Record<string, unknown>[]>(table(client, 'employees')
    .select('id,first_name,birth_name,employee_number')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .is('deleted_at', null)
    .eq('is_archived', false)
    .order('birth_name')
    .limit(2000))
  return {
    templates: active,
    employees: employees.map((employee) => ({
      id: String(employee.id),
      name: [employee.first_name, employee.birth_name].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' '),
      employeeNumber: typeof employee.employee_number === 'string' ? employee.employee_number : null,
    })),
  }
}

async function generationManifestForVersion(templateVersionId: string): Promise<{ readonly freeKeys: string[]; readonly temporalKeys: string[] }> {
  const { composed } = await fullNormalizedDocument(templateVersionId)
  return {
    freeKeys: composed.placeholderManifest.filter((entry) => entry.type === 'FREE').map((entry) => entry.key),
    temporalKeys: composed.placeholderManifest.filter((entry) => entry.type === 'TEMPORAL').map((entry) => entry.key),
  }
}

export async function listGenerationManifest(templateVersionId: string): Promise<{ readonly freeKeys: string[]; readonly temporalKeys: string[] }> {
  await authz('document-generation:write')
  if (!z.string().uuid().safeParse(templateVersionId).success) throw new DocumentGenerationError('DOCUMENT_GENERATION_INPUT_INVALID', 400)
  return generationManifestForVersion(templateVersionId)
}

export async function listGenerationFreeKeys(templateVersionId: string): Promise<readonly string[]> {
  return (await listGenerationManifest(templateVersionId)).freeKeys
}

interface AdministrationSnapshot {
  readonly id: string
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly code: string
  readonly name: string
  readonly administration_number: string
  readonly coc_number: string | null
  readonly vat_number: string | null
  readonly is_active: boolean
}

interface CompanySnapshot {
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly single_location: boolean
  readonly address_line_1: string | null
  readonly address_line_2: string | null
  readonly street: string | null
  readonly house_number: string | null
  readonly house_number_addition: string | null
  readonly postal_code: string | null
  readonly city: string | null
  readonly region: string | null
  readonly country_code: string
  readonly source: string
  readonly source_reference: string | null
}

interface BrandingSnapshot {
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly primary_color: string
  readonly accent_color: string
  readonly sidebar_color: string
  readonly logo_storage_path: string | null
}

async function resolveSourceAdministration(
  client: QueryClient,
  request: AuthorizedGenerationRequest,
  preferredId: string | null,
): Promise<string | null> {
  if (preferredId) {
    const preferred = await optionalRow<Pick<AdministrationSnapshot, 'id'>>(table(client, 'administrations')
      .select('id')
      .eq('tenant_id', request.tenantId)
      .eq('hr_group_id', request.hrGroupId)
      .eq('id', preferredId)
      .eq('is_active', true)
      .maybeSingle())
    return preferred?.id ?? null
  }
  if (request.administrationId) {
    const active = await optionalRow<Pick<AdministrationSnapshot, 'id'>>(table(client, 'administrations')
      .select('id')
      .eq('tenant_id', request.tenantId)
      .eq('hr_group_id', request.hrGroupId)
      .eq('id', request.administrationId)
      .eq('is_active', true)
      .maybeSingle())
    if (active) return active.id
  }
  const first = await optionalRow<Pick<AdministrationSnapshot, 'id'>>(table(client, 'administrations')
    .select('id')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .maybeSingle())
  return first?.id ?? null
}

async function buildGenerationCandidate(
  input: z.infer<typeof inputSchema>,
  request: AuthorizedGenerationRequest,
): Promise<{ readonly snapshot: ResolvedGenerationSnapshot; readonly requestHash: string; readonly idempotencyKey: string }> {
  const { normalized, materialized, composed } = await fullNormalizedDocument(input.templateVersionId)
  const employee = await optionalRow<EmployeeRow>(table(request.client, 'employees')
    .select('id,first_name,birth_name,employee_number')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('id', input.employeeId)
    .is('deleted_at', null)
    .maybeSingle())
  if (!employee) throw new DocumentGenerationError('DOCUMENT_GENERATION_EMPLOYEE_NOT_FOUND', 404)
  const employment = await optionalRow<EmploymentRow>(table(request.client, 'employments')
    .select('starts_on')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('employee_id', input.employeeId)
    .order('starts_on', { ascending: false })
    .limit(1)
    .maybeSingle())
  let editorData: Awaited<ReturnType<typeof getEditorData>>
  try {
    editorData = await getEditorData(input.templateVersionId)
  } catch (error) {
    mapDocumentStudioError(error)
  }
  if (!editorData || editorData.version.status !== 'ACTIVE' || editorData.template.lifecycle !== 'ACTIVE' || editorData.template.current_active_version_id !== editorData.version.id) {
    throw new DocumentGenerationError('DOCUMENT_GENERATION_TEMPLATE_NOT_ACTIVE', 422)
  }
  const configuredProfileId = editorData.version.document_profile_id
  const configuredProfile = configuredProfileId
    ? editorData.profiles.find((candidate) => candidate.id === configuredProfileId && candidate.is_active) ?? null
    : null
  if (configuredProfileId && !configuredProfile) throw new DocumentGenerationError('DOCUMENT_GENERATION_PROFILE_NOT_ACTIVE', 422)
  const profile = configuredProfile ?? (configuredProfileId ? null : editorData.profiles.find((candidate) => candidate.is_default && candidate.is_active) ?? null)
  const sourceAdministrationId = await resolveSourceAdministration(request.client, request, profile?.source_administration_id ?? null)
  if (!sourceAdministrationId) throw new DocumentGenerationError('DOCUMENT_GENERATION_PROFILE_SOURCE_INVALID', 422)
  const profileSource = await optionalRow<AdministrationSnapshot>(table(request.client, 'administrations')
    .select('id,tenant_id,hr_group_id,code,name,administration_number,coc_number,vat_number,is_active')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('id', sourceAdministrationId)
    .eq('is_active', true)
    .maybeSingle())
  if (!profileSource) throw new DocumentGenerationError('DOCUMENT_GENERATION_PROFILE_SOURCE_INVALID', 422)
  const [company, branding] = await Promise.all([
    optionalRow<CompanySnapshot>(table(request.client, 'administration_company_data')
      .select('tenant_id,hr_group_id,single_location,address_line_1,address_line_2,street,house_number,house_number_addition,postal_code,city,region,country_code,source,source_reference')
      .eq('tenant_id', request.tenantId)
      .eq('hr_group_id', request.hrGroupId)
      .maybeSingle()),
    optionalRow<BrandingSnapshot>(table(request.client, 'administration_branding')
      .select('tenant_id,hr_group_id,primary_color,accent_color,sidebar_color,logo_storage_path')
      .eq('tenant_id', request.tenantId)
      .eq('hr_group_id', request.hrGroupId)
      .maybeSingle()),
  ])
  const knownCatalog: Record<string, string> = {
    'employee.first_name': employee.first_name ?? '',
    'employee.last_name': employee.birth_name ?? '',
    'employee.employee_number': employee.employee_number ?? '',
    'employment.start_date': employment?.starts_on ?? '',
  }
  let resolvedValues
  try {
    resolvedValues = resolveRequiredGenerationValues(composed.placeholderManifest, knownCatalog, input.temporalInputs, input.freeInputs)
  } catch (error) {
    if (error instanceof GenerationResolutionError) throw new DocumentGenerationError('DOCUMENT_GENERATION_FIELD_UNRESOLVED', 422, error.missingKeys)
    throw error
  }
  const context: GenerationContext = {
    tenantId: request.tenantId,
    hrGroupId: request.hrGroupId,
    employeeId: employee.id,
    templateId: normalized.templateId,
    templateName: editorData.template.name,
    templateVersionId: normalized.templateVersionId,
    templateVersion: normalized.templateVersion,
    documentCategory: editorData.version.category_code,
    defaultDossier: editorData.version.default_dossier,
    rendererVersion: DG1_RENDERER_VERSION,
    generatedAt: new Date().toISOString(),
    knownValues: resolvedValues.known,
    temporalValues: resolvedValues.temporal,
    freeValues: resolvedValues.free,
    documentProfile: profile
      ? { id: profile.id, name: profile.name, sourceAdministrationId, logoAssetId: profile.logo_asset_id, isDefault: profile.is_default, source: profileSource }
      : { sourceAdministrationId, source: profileSource },
    organization: { administration: profileSource, company, branding },
    componentVersions: materialized.componentVersions,
    assets: materialized.assets,
  }
  const snapshot = resolveGenerationSnapshot(materialized.document, context)
  const requestHash = generationRequestHash(input)
  return { snapshot, requestHash, idempotencyKey: input.idempotencyKey ?? randomUUID() }
}

async function storedSnapshot(
  client: QueryClient,
  tenantId: string,
  hrGroupId: string,
  snapshotId: string,
): Promise<StoredSnapshotRow | null> {
  return optionalRow<StoredSnapshotRow>(table(client, 'document_generation_snapshots')
    .select('id,tenant_id,hr_group_id,employee_id,template_id,template_version_id,template_version,snapshot,resolved_document_json,resolved_document_hash,renderer_version,generated_by_user_id,generated_at,status,final_pdf_hash,final_storage_key,final_pdf_size,template_name,employee_name,employee_number,document_category,default_dossier,source_administration_id')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('id', snapshotId)
    .maybeSingle())
}

function placeholderKeys(snapshot: StoredSnapshotRow, type: 'free' | 'temporal'): string[] {
  const stored = persistedRecord(snapshot.snapshot, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID')
  const inputs = persistedRecord(stored.placeholderInputs, 'DOCUMENT_GENERATION_SNAPSHOT_INVALID')
  return Object.keys(persistedStringMap(inputs[type])).sort()
}

async function replayPreview(
  request: AuthorizedGenerationRequest,
  idempotencyKey: string,
  requestHash: string,
): Promise<{ id: string; status: 'PREVIEW'; freeKeys: string[]; temporalKeys: string[]; resolvedDocumentHash: string } | null> {
  const existing = await optionalRow<{ readonly request_hash: string; readonly snapshot_id: string }>(table(adminClient(), 'document_generation_idempotency')
    .select('request_hash,snapshot_id')
    .eq('tenant_id', request.tenantId)
    .eq('hr_group_id', request.hrGroupId)
    .eq('actor_user_id', request.userId)
    .eq('operation', 'PREVIEW')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle())
  if (!existing) return null
  if (existing.request_hash !== requestHash) throw new DocumentGenerationError('DOCUMENT_GENERATION_IDEMPOTENCY_CONFLICT', 409)
  const actual = await storedSnapshot(adminClient(), request.tenantId, request.hrGroupId, existing.snapshot_id)
  if (!actual) throw new DocumentGenerationError('DOCUMENT_GENERATION_STATE_INVALID', 409)
  return {
    id: actual.id,
    status: 'PREVIEW',
    freeKeys: placeholderKeys(actual, 'free'),
    temporalKeys: placeholderKeys(actual, 'temporal'),
    resolvedDocumentHash: actual.resolved_document_hash,
  }
}

export async function createGenerationPreview(value: unknown): Promise<{ id: string; status: 'PREVIEW'; freeKeys: string[]; temporalKeys: string[]; resolvedDocumentHash: string }> {
  const input = parseInput(value)
  const request = await authz('document-generation:write')
  const idempotencyKey = input.idempotencyKey ?? randomUUID()
  const requestHash = generationRequestHash(input)
  if (input.idempotencyKey) {
    const replay = await replayPreview(request, idempotencyKey, requestHash)
    if (replay) return replay
  }
  const candidate = await buildGenerationCandidate(input, request)
  const id = randomUUID()
  const payload = {
    id,
    tenant_id: request.tenantId,
    hr_group_id: request.hrGroupId,
    employee_id: candidate.snapshot.employeeId,
    template_id: candidate.snapshot.templateId,
    template_version_id: candidate.snapshot.templateVersionId,
    template_version: candidate.snapshot.templateVersion,
    snapshot: snapshotForStorage(candidate.snapshot),
    resolved_document_json: candidate.snapshot.resolvedDocument,
    resolved_document_hash: candidate.snapshot.resolvedDocumentHash,
    renderer_version: candidate.snapshot.rendererVersion,
    actor_user_id: request.userId,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
  }
  const result = await rpc(adminClient(), 'create_document_generation_preview', { requested_payload: payload })
  const resultId = persistedString(result.id, 'DOCUMENT_GENERATION_RESPONSE_INVALID')
  const actual = await storedSnapshot(adminClient(), request.tenantId, request.hrGroupId, resultId)
  if (!actual) throw new DocumentGenerationError('DOCUMENT_GENERATION_READ_FAILED', 500)
  if (actual.status !== 'PREVIEW') throw new DocumentGenerationError('DOCUMENT_GENERATION_STATE_INVALID', 409)
  return {
    id: actual.id,
    status: 'PREVIEW',
    freeKeys: placeholderKeys(actual, 'free'),
    temporalKeys: placeholderKeys(actual, 'temporal'),
    resolvedDocumentHash: actual.resolved_document_hash,
  }
}

async function downloadStorageBytes(client: QueryClient, bucket: string, key: string): Promise<Uint8Array> {
  const result = await client.storage.from(bucket).download(key)
  if (result.error || !result.data) throw new DocumentGenerationError('DOCUMENT_GENERATION_STORAGE_READ_FAILED', 500)
  return new Uint8Array(await result.data.arrayBuffer())
}

function storageErrorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error ? String((error as { readonly message: unknown }).message) : ''
}

function isAlreadyExistsError(error: unknown): boolean {
  return /already exists|duplicate|resource exists/i.test(storageErrorMessage(error))
}

async function ensurePdfArtifact(client: QueryClient, key: string, pdf: Uint8Array, expectedHash: string): Promise<void> {
  const upload = await client.storage.from('employee-documents').upload(key, pdf, { contentType: 'application/pdf', upsert: false })
  if (upload.error && !isAlreadyExistsError(upload.error)) throw new DocumentGenerationError('DOCUMENT_GENERATION_UPLOAD_FAILED', 500)
  const persisted = await downloadStorageBytes(client, 'employee-documents', key)
  if (pdfHash(persisted) !== expectedHash) throw new DocumentGenerationError('DOCUMENT_GENERATION_STORAGE_CONFLICT', 409)
}

async function verifyPdfArtifact(client: QueryClient, key: string, expectedHash: string): Promise<void> {
  const persisted = await downloadStorageBytes(client, 'employee-documents', key)
  if (pdfHash(persisted) !== expectedHash) throw new DocumentGenerationError('DOCUMENT_GENERATION_STORAGE_CONFLICT', 409)
}

async function assetUrls(
  client: QueryClient,
  tenantId: string,
  hrGroupId: string,
  assets: readonly GenerationAsset[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  for (const asset of assets) {
    if (urls[asset.assetRef]) continue
    if (asset.storageRef !== asset.assetRef) throw new DocumentGenerationError('DOCUMENT_GENERATION_ASSET_CONFLICT', 422)
    const stored = await optionalRow<StoredAssetRow>(table(client, 'document_studio_assets')
      .select('id,tenant_id,hr_group_id,status,normalized_mime,storage_key,sha256')
      .eq('tenant_id', tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('id', asset.storageRef)
      .maybeSingle())
    if (!stored || stored.status === 'PENDING' || stored.normalized_mime !== asset.normalizedMime || stored.sha256 !== asset.sha256) {
      throw new DocumentGenerationError('DOCUMENT_GENERATION_ASSET_NOT_AVAILABLE', 422)
    }
    const bytes = await downloadStorageBytes(client, 'document-studio-assets', stored.storage_key)
    if (sha256(bytes) !== asset.sha256) throw new DocumentGenerationError('DOCUMENT_GENERATION_ASSET_CONFLICT', 409)
    urls[asset.assetRef] = `data:${asset.normalizedMime};base64,${Buffer.from(bytes).toString('base64')}`
  }
  return urls
}

async function ensureDossier(client: QueryClient, snapshot: StoredSnapshotRow, userId: string): Promise<DossierStatus> {
  if (!snapshot.default_dossier) return 'SKIPPED'
  const result = await rpc(client, 'ensure_document_generation_dossier', {
    requested_snapshot_id: snapshot.id,
    requested_actor_user_id: userId,
  })
  if (result.status !== 'CREATED') throw new DocumentGenerationError('DOCUMENT_GENERATION_DOSSIER_FAILED', 500)
  return 'CREATED'
}

export async function finalizeGeneration(snapshotId: string, requestedIdempotencyKey?: string): Promise<{ id: string; status: 'FINAL'; pdfHash: string; dossierStatus: DossierStatus }> {
  const parsedSnapshotId = z.string().uuid().safeParse(snapshotId)
  if (!parsedSnapshotId.success) throw new DocumentGenerationError('DOCUMENT_GENERATION_INPUT_INVALID', 400)
  const parsedKey = requestedIdempotencyKey === undefined ? { success: true as const, data: randomUUID() } : z.string().uuid().safeParse(requestedIdempotencyKey)
  if (!parsedKey.success) throw new DocumentGenerationError('DOCUMENT_GENERATION_INPUT_INVALID', 400)
  const request = await authz('document-generation:write')
  const admin = adminClient()
  const snapshot = await storedSnapshot(admin, request.tenantId, request.hrGroupId, parsedSnapshotId.data)
  if (!snapshot) throw new DocumentGenerationError('DOCUMENT_GENERATION_NOT_FOUND', 404)
  const key = `${request.tenantId}/${request.hrGroupId}/${snapshot.employee_id}/generated/${snapshot.id}.pdf`
  const requestHash = sha256(snapshot.id)
  let result: Record<string, unknown>
  if (snapshot.status === 'FINAL') {
    if (!snapshot.final_pdf_hash || !snapshot.final_storage_key || !snapshot.final_pdf_size) throw new DocumentGenerationError('DOCUMENT_GENERATION_STATE_INVALID', 409)
    await verifyPdfArtifact(admin, snapshot.final_storage_key, snapshot.final_pdf_hash)
    result = await rpc(admin, 'finalize_document_generation', {
      requested_snapshot_id: snapshot.id,
      requested_actor_user_id: request.userId,
      requested_idempotency_key: parsedKey.data,
      requested_request_hash: requestHash,
      requested_pdf_hash: snapshot.final_pdf_hash,
      requested_storage_key: snapshot.final_storage_key,
      requested_file_size: snapshot.final_pdf_size,
      requested_renderer_version: snapshot.renderer_version,
    })
  } else if (snapshot.status === 'PREVIEW') {
    const resolvedDocument = parseGenerationDocument(snapshot.resolved_document_json)
    const context = snapshotContext(snapshot, resolvedDocument)
    const resolvedAssets = await assetUrls(admin, request.tenantId, request.hrGroupId, context.assets)
    const pdf = await renderResolvedSnapshotToPdf(context, { assetUrls: resolvedAssets })
    const hash = pdfHash(pdf)
    await ensurePdfArtifact(admin, key, pdf, hash)
    result = await rpc(admin, 'finalize_document_generation', {
      requested_snapshot_id: snapshot.id,
      requested_actor_user_id: request.userId,
      requested_idempotency_key: parsedKey.data,
      requested_request_hash: requestHash,
      requested_pdf_hash: hash,
      requested_storage_key: key,
      requested_file_size: pdf.byteLength,
      requested_renderer_version: context.rendererVersion,
    })
    if (result.pdfHash !== hash) throw new DocumentGenerationError('DOCUMENT_GENERATION_STORAGE_CONFLICT', 409)
  } else {
    throw new DocumentGenerationError('DOCUMENT_GENERATION_STATE_INVALID', 409)
  }
  const actualHash = persistedString(result.pdfHash, 'DOCUMENT_GENERATION_RESPONSE_INVALID')
  const finalSnapshot = await storedSnapshot(admin, request.tenantId, request.hrGroupId, snapshot.id)
  if (!finalSnapshot || finalSnapshot.status !== 'FINAL' || !finalSnapshot.final_storage_key || !finalSnapshot.final_pdf_hash) throw new DocumentGenerationError('DOCUMENT_GENERATION_STATE_INVALID', 409)
  await verifyPdfArtifact(admin, finalSnapshot.final_storage_key, finalSnapshot.final_pdf_hash)
  if (actualHash !== finalSnapshot.final_pdf_hash) throw new DocumentGenerationError('DOCUMENT_GENERATION_STORAGE_CONFLICT', 409)
  const dossierStatus = await ensureDossier(admin, finalSnapshot, request.userId)
  return { id: finalSnapshot.id, status: 'FINAL', pdfHash: finalSnapshot.final_pdf_hash, dossierStatus }
}

export async function listGenerationHistory(): Promise<readonly Record<string, unknown>[]> {
  const { client, tenantId, hrGroupId } = await authz('document-generation:read')
  const rows = await row<StoredSnapshotRow[]>(table(client, 'document_generation_snapshots')
    .select('id,tenant_id,hr_group_id,employee_id,template_id,template_version_id,template_version,snapshot,resolved_document_json,resolved_document_hash,renderer_version,generated_by_user_id,generated_at,status,final_pdf_hash,final_storage_key,final_pdf_size,template_name,employee_name,employee_number,document_category,default_dossier,source_administration_id')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .order('generated_at', { ascending: false })
    .limit(500))
  const links = await row<Array<{ readonly snapshot_id: string; readonly employee_document_id: string }>>(table(client, 'document_generation_dossier_links')
    .select('snapshot_id,employee_document_id')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .limit(500))
  const linked = new Set(links.map((link) => link.snapshot_id))
  return rows.map((item) => ({
    id: item.id,
    templateId: item.template_id,
    templateName: item.template_name,
    employeeId: item.employee_id,
    employeeName: item.employee_name,
    employeeNumber: item.employee_number,
    templateVersion: item.template_version,
    documentCategory: item.document_category,
    status: item.status,
    generatedByUserId: item.generated_by_user_id,
    generatedAt: item.generated_at,
    finalPdfHash: item.final_pdf_hash,
    dossierStatus: item.default_dossier ? (linked.has(item.id) ? 'CREATED' : 'PENDING') : 'SKIPPED',
  }))
}

export async function createGenerationDownload(snapshotId: string): Promise<string> {
  const { client, tenantId, hrGroupId } = await authz('document-generation:read')
  const snapshot = await optionalRow<{ status: 'PREVIEW' | 'FINAL'; final_storage_key: string | null }>(table(client, 'document_generation_snapshots')
    .select('status,final_storage_key')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('id', snapshotId)
    .maybeSingle())
  if (!snapshot || snapshot.status !== 'FINAL' || !snapshot.final_storage_key) throw new DocumentGenerationError('DOCUMENT_GENERATION_FINAL_NOT_FOUND', 404)
  const signed = await adminClient().storage.from('employee-documents').createSignedUrl(snapshot.final_storage_key, 60)
  if (signed.error || !signed.data?.signedUrl) throw new DocumentGenerationError('DOCUMENT_GENERATION_DOWNLOAD_FAILED', 500)
  return signed.data.signedUrl
}

export async function getGenerationPreview(snapshotId: string): Promise<{ status: string; html: string; resolvedDocumentHash: string }> {
  const { tenantId, hrGroupId } = await authz('document-generation:read')
  const admin = adminClient()
  const snapshot = await storedSnapshot(admin, tenantId, hrGroupId, snapshotId)
  if (!snapshot) throw new DocumentGenerationError('DOCUMENT_GENERATION_NOT_FOUND', 404)
  const resolvedDocument = parseGenerationDocument(snapshot.resolved_document_json)
  const context = snapshotContext(snapshot, resolvedDocument)
  const resolvedAssets = await assetUrls(admin, tenantId, hrGroupId, context.assets)
  return {
    status: snapshot.status,
    html: renderResolvedSnapshotToHtml(context, { assetUrls: resolvedAssets }),
    resolvedDocumentHash: snapshot.resolved_document_hash,
  }
}
